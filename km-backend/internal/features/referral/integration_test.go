package referral

import (
	"context"
	"errors"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run the referral rules against real Postgres (a throwaway schema, see pgtest). They
// skip when no database is configured.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type memSettings struct {
	mu  sync.Mutex
	val map[string]string
}

func (m *memSettings) GetValue(_ context.Context, key string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.val[key]
	if !ok {
		return "", mongo.ErrNoDocuments
	}
	return v, nil
}

func (m *memSettings) SetValue(_ context.Context, key, value string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.val[key] = value
	return nil
}

type memUsers struct{ byID map[string]*user.User }

func (m memUsers) FindUserByID(_ context.Context, id string) (*user.User, error) {
	return m.byID[id], nil
}

func (m memUsers) FindUserByMobile(_ context.Context, mobile string) (*user.User, error) {
	for _, u := range m.byID {
		if u.Mobile == mobile {
			return u, nil
		}
	}
	return nil, nil
}

func (m memUsers) FindUsersByIDs(_ context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	out := map[primitive.ObjectID]*user.User{}
	for _, id := range ids {
		if u := m.byID[id.Hex()]; u != nil {
			out[id] = u
		}
	}
	return out, nil
}

type env struct {
	ctx    context.Context
	pg     *database.PostgresDB
	svc    *service
	wallet wallet.WalletService
	users  memUsers
	clock  time.Time
}

func setup(t *testing.T) *env {
	t.Helper()
	pg := pgtest.New(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)
	// The wallet needs a Mongo handle it never uses here; this one never connects
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}
	tx := database.NewPgTransactor(pg)
	walletSvc := wallet.NewWalletService(wallet.NewWalletRepository(pg, tx, mdb), &config.Config{}, nil, nil, paymenttest.New(), tx)
	users := memUsers{byID: map[string]*user.User{}}
	e := &env{ctx: ctx, pg: pg, wallet: walletSvc, users: users, clock: time.Now()}
	e.svc = &service{repo: NewRepository(pg), tx: tx, wallet: walletSvc, settings: &memSettings{val: map[string]string{}},
		users: users, now: func() time.Time { return e.clock }}
	return e
}

var mobiles = 9000000000

// member adds a member who joined just now
func (e *env) member(name string) string {
	mobiles++
	u := &user.User{ID: primitive.NewObjectID(), Name: name, Mobile: strconv.Itoa(mobiles), CreatedAt: e.clock, AccountStatus: user.AccountActive}
	e.users.byID[u.ID.Hex()] = u
	return u.ID.Hex()
}

func (e *env) code(t *testing.T, userID string) string {
	t.Helper()
	o, err := e.svc.Overview(e.ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	return o.Code
}

func (e *env) invite(t *testing.T, referrer string, name string) string {
	t.Helper()
	id := e.member(name)
	if err := e.svc.Claim(e.ctx, id, e.code(t, referrer)); err != nil {
		t.Fatalf("claim: %v", err)
	}
	return id
}

// order records a paid online order
func (e *env) order(t *testing.T, userID, purpose string, paise int64, status string) string {
	t.Helper()
	id := primitive.NewObjectID().Hex()
	err := e.pg.DB.Exec(`INSERT INTO payment_orders (id, razorpay_order_id, razorpay_payment_id, user_id, purpose, amount_paise, status, paid_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, "order_"+id, "pay_"+id, userID, purpose, paise, status, e.clock).Error
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func (e *env) ledger(t *testing.T, userID string, typ wallet.TransactionType, cat wallet.TransactionCategory, rupees float64, meta map[string]interface{}) {
	t.Helper()
	_, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: database.OID(userID), Type: typ, TargetBalance: wallet.BalanceMain, Category: cat,
		Amount: rupees, ReferenceID: "test:" + primitive.NewObjectID().Hex(), Description: "test", Metadata: meta,
	})
	if err != nil {
		t.Fatal(err)
	}
}

// spend tops up the wallet and spends it on a pass
func (e *env) spend(t *testing.T, userID string, rupees float64) {
	t.Helper()
	e.ledger(t, userID, wallet.TypeCredit, wallet.CategoryTopup, rupees, nil)
	e.ledger(t, userID, wallet.TypeDebit, wallet.CategoryPassPurchase, rupees, nil)
}

func (e *env) run(t *testing.T) {
	t.Helper()
	if err := e.svc.Run(e.ctx); err != nil {
		t.Fatal(err)
	}
}

func (e *env) bonus(t *testing.T, userID string) int64 {
	t.Helper()
	var b []int64
	if err := e.pg.DB.Raw(`SELECT bonus_paise FROM wallets WHERE user_id = ?`, userID).Scan(&b).Error; err != nil {
		t.Fatal(err)
	}
	if len(b) == 0 {
		return 0
	}
	return b[0]
}

func (e *env) status(t *testing.T, referredID string) *Referral {
	t.Helper()
	r, err := e.svc.repo.GetByReferred(e.ctx, referredID)
	if err != nil || r == nil {
		t.Fatalf("referral of %s: %v", referredID, err)
	}
	return r
}

func (e *env) settings(t *testing.T, change func(*Settings)) {
	t.Helper()
	s := DefaultSettings()
	change(&s)
	if _, err := e.svc.SaveSettings(e.ctx, s); err != nil {
		t.Fatal(err)
	}
}

func TestClaimRules(t *testing.T) {
	e := setup(t)
	asha := e.member("Asha Rao")
	code := e.code(t, asha)
	if again := e.code(t, asha); again != code || len(code) != 9 {
		t.Fatalf("code %q then %q", code, again)
	}

	if err := e.svc.Claim(e.ctx, asha, code); !errors.Is(err, ErrOwnCode) {
		t.Fatalf("own code: %v", err)
	}
	ravi := e.member("Ravi")
	if err := e.svc.Claim(e.ctx, ravi, "NOPE123"); !errors.Is(err, ErrCodeNotFound) {
		t.Fatalf("unknown code: %v", err)
	}
	// Lower case and spaces are fine; sending it twice is fine
	if err := e.svc.Claim(e.ctx, ravi, "  "+string([]rune(code))+" "); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Claim(e.ctx, ravi, code); err != nil {
		t.Fatalf("same code again: %v", err)
	}
	other := e.member("Other")
	if err := e.svc.Claim(e.ctx, ravi, e.code(t, other)); !errors.Is(err, ErrAlreadyLinked) {
		t.Fatalf("second inviter: %v", err)
	}

	// Too long after joining
	old := e.member("Old")
	e.users.byID[old].CreatedAt = e.clock.Add(-ClaimWindow - time.Minute)
	if err := e.svc.Claim(e.ctx, old, code); !errors.Is(err, ErrTooLate) {
		t.Fatalf("old account: %v", err)
	}
	// Paid first, then tried to add an inviter
	payer := e.member("Payer")
	e.order(t, payer, "instant_pass", 9900, "paid")
	if err := e.svc.Claim(e.ctx, payer, code); !errors.Is(err, ErrAlreadyPaid) {
		t.Fatalf("after paying: %v", err)
	}
	// Inviter no longer active
	gone := e.member("Gone")
	goneCode := e.code(t, gone)
	e.users.byID[gone].AccountStatus = user.AccountSuspended
	if err := e.svc.Claim(e.ctx, e.member("New"), goneCode); !errors.Is(err, ErrInviterGone) {
		t.Fatalf("suspended inviter: %v", err)
	}
	// Switched off
	e.settings(t, func(s *Settings) { s.Enabled = false })
	if err := e.svc.Claim(e.ctx, e.member("Late"), code); !errors.Is(err, ErrDisabled) {
		t.Fatalf("disabled: %v", err)
	}
}

func TestMemberRewardAfterWait(t *testing.T) {
	e := setup(t)
	e.settings(t, func(s *Settings) { s.MemberReward = 50 })
	asha := e.member("Asha")
	ravi := e.invite(t, asha, "Ravi Kumar")

	// A top-up isn't a purchase
	e.order(t, ravi, "wallet_topup", 50000, "paid")
	e.run(t)
	if r := e.status(t, ravi); r.Status != StatusPending {
		t.Fatalf("after a top-up: %s", r.Status)
	}
	// Spending from the wallet is
	e.spend(t, ravi, 99)
	e.run(t)
	r := e.status(t, ravi)
	if r.Status != StatusPaid || r.ReleaseAt == nil || r.ReleaseAt.Sub(*r.PaidAt) != 30*24*time.Hour {
		t.Fatalf("after spending: %+v", r)
	}
	// Not before the 30 days
	e.clock = e.clock.Add(29 * 24 * time.Hour)
	e.run(t)
	if e.status(t, ravi).Status != StatusPaid || e.bonus(t, asha) != 0 {
		t.Fatal("rewarded early")
	}
	e.clock = e.clock.Add(2 * 24 * time.Hour)
	e.run(t)
	e.run(t) // a second run changes nothing
	r = e.status(t, ravi)
	if r.Status != StatusReleased || r.RewardKind != RewardMember || r.Reward != 50 || e.bonus(t, asha) != 5000 {
		t.Fatalf("released: %+v, bonus %d", r, e.bonus(t, asha))
	}

	o, err := e.svc.Overview(e.ctx, asha)
	if err != nil {
		t.Fatal(err)
	}
	if o.Earned != 50 || o.Counts.Released != 1 || len(o.People) != 1 || o.People[0].FirstName != "Ravi" || o.Aggregator != nil {
		t.Fatalf("overview: %+v", o)
	}
}

func TestNothingWhenMemberRewardIsZero(t *testing.T) {
	e := setup(t)
	asha := e.member("Asha")
	ravi := e.invite(t, asha, "Ravi")
	e.order(t, ravi, "recruiter_plan", 49900, "paid")
	e.run(t)
	e.clock = e.clock.Add(31 * 24 * time.Hour)
	e.run(t)
	if r := e.status(t, ravi); r.Status != StatusReleased || r.RewardKind != RewardNone || e.bonus(t, asha) != 0 {
		t.Fatalf("zero reward: %+v", r)
	}
}

func TestRefundCancels(t *testing.T) {
	e := setup(t)
	e.settings(t, func(s *Settings) { s.MemberReward = 50 })
	asha := e.member("Asha")

	// Paid online, then refunded
	online := e.invite(t, asha, "Online")
	id := e.order(t, online, "event_ticket", 20000, "paid")
	// Paid online, part refunded: the rest still counts
	partial := e.invite(t, asha, "Partial")
	partID := e.order(t, partial, "event_ticket", 20000, "paid")
	// Spent from the wallet, then refunded to the wallet
	wallet1 := e.invite(t, asha, "Wallet")
	e.spend(t, wallet1, 100)
	// A top-up refund's money coming back is not a purchase refund
	kept := e.invite(t, asha, "Kept")
	e.spend(t, kept, 100)
	e.ledger(t, kept, wallet.TypeCredit, wallet.CategoryRefund, 30, map[string]interface{}{"topup_refund_id": "x"})

	e.run(t)
	if err := e.pg.DB.Exec(`UPDATE payment_orders SET status = 'refunded', refund_paise = amount_paise WHERE id = ?`, id).Error; err != nil {
		t.Fatal(err)
	}
	if err := e.pg.DB.Exec(`UPDATE payment_orders SET status = 'refunded', refund_paise = 5000 WHERE id = ?`, partID).Error; err != nil {
		t.Fatal(err)
	}
	e.ledger(t, wallet1, wallet.TypeCredit, wallet.CategoryRefund, 100, nil)

	e.clock = e.clock.Add(31 * 24 * time.Hour)
	e.run(t)
	for _, c := range []struct {
		id, want string
	}{{online, StatusCancelled}, {wallet1, StatusCancelled}, {kept, StatusReleased}, {partial, StatusReleased}} {
		if got := e.status(t, c.id).Status; got != c.want {
			t.Errorf("%s: %s, want %s", e.users.byID[c.id].Name, got, c.want)
		}
	}
	if e.bonus(t, asha) != 10000 {
		t.Fatalf("bonus %d, want Kept's and Partial's rewards", e.bonus(t, asha))
	}
}

func TestAggregatorGroups(t *testing.T) {
	e := setup(t)
	e.settings(t, func(s *Settings) { s.MemberReward = 50; s.AggregatorGroup = 3 })
	admin := e.member("Admin")
	agg := e.member("Aggregator")
	if _, err := e.svc.SetAggregator(e.ctx, admin, e.users.byID[agg].Mobile, true, "local agent"); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.SetAggregator(e.ctx, admin, "0000000000", true, ""); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("unknown member: %v", err)
	}
	if list, err := e.svc.ListAggregators(e.ctx); err != nil || len(list) != 1 || !list[0].Active || list[0].UserID != agg || list[0].Note != "local agent" || list[0].Name != "Aggregator" {
		t.Fatalf("approved list: %+v %v", list, err)
	}
	for i := 0; i < 7; i++ {
		e.order(t, e.invite(t, agg, "Person"), "instant_pass", 9900, "paid")
	}
	e.run(t)
	e.clock = e.clock.Add(31 * 24 * time.Hour)
	e.run(t)
	e.run(t)

	payouts, err := e.svc.repo.PayoutsByUser(e.ctx, agg)
	if err != nil {
		t.Fatal(err)
	}
	// 7 referrals in groups of 3: two rewards, one towards the next; no per-referral member reward
	if len(payouts) != 2 || payouts[0].BatchNo != 1 || payouts[1].BatchNo != 2 || payouts[0].Credit != 2500 || payouts[0].Cash != 2500 {
		t.Fatalf("payouts: %+v", payouts)
	}
	if got := e.bonus(t, agg); got != 500000 {
		t.Fatalf("bonus %d, want ₹5,000", got)
	}
	o, err := e.svc.Overview(e.ctx, agg)
	if err != nil {
		t.Fatal(err)
	}
	if !o.IsAggregator || o.Aggregator.TowardsNext != 1 || o.Aggregator.Groups != 2 || o.Aggregator.CashOwed != 5000 || o.Earned != 5000 {
		t.Fatalf("overview: %+v %+v", o, o.Aggregator)
	}

	// The cash half is recorded as paid once
	if _, err := e.svc.MarkCashPaid(e.ctx, admin, payouts[0].ID, "paid by UPI"); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.MarkCashPaid(e.ctx, admin, payouts[0].ID, ""); !errors.Is(err, ErrCashPaid) {
		t.Fatalf("paid twice: %v", err)
	}
	owed, _, err := e.svc.ListPayouts(e.ctx, true, 1, 20)
	if err != nil || len(owed) != 1 || owed[0].ID != payouts[1].ID {
		t.Fatalf("owed list: %+v %v", owed, err)
	}

	// Removed: new referrals become member ones; re-approved: the leftover can still complete a group
	if _, err := e.svc.SetAggregator(e.ctx, admin, agg, false, ""); err != nil {
		t.Fatal(err)
	}
	late := e.invite(t, agg, "Late")
	e.order(t, late, "instant_pass", 9900, "paid")
	e.run(t)
	e.clock = e.clock.Add(31 * 24 * time.Hour)
	e.run(t)
	if r := e.status(t, late); r.RewardKind != RewardMember {
		t.Fatalf("after removal: %+v", r)
	}
	list, err := e.svc.ListAggregators(e.ctx)
	if err != nil || len(list) != 1 || list[0].Active || list[0].UserID != agg || list[0].Released != 8 || list[0].CashOwed != 2500 {
		t.Fatalf("aggregators: %+v %v", list, err)
	}
}
