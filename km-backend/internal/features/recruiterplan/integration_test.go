package recruiterplan

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run the plan rules against real Postgres (a throwaway schema, see pgtest). They
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

type memUsers struct {
	user.UserRepository
	roles map[string][]string
}

func (m memUsers) FindUserByID(_ context.Context, id string) (*user.User, error) {
	roles, ok := m.roles[id]
	if !ok {
		return nil, nil
	}
	return &user.User{Name: "Asha Traders", Roles: roles}, nil
}

func (m memUsers) FindUsersByIDs(context.Context, []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	return map[primitive.ObjectID]*user.User{}, nil
}

type env struct {
	ctx    context.Context
	pg     *database.PostgresDB
	svc    *service
	wallet wallet.WalletService
	users  memUsers
	fake   *paymenttest.Fake
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
	fake := paymenttest.New()
	walletSvc := wallet.NewWalletService(wallet.NewWalletRepository(pg, tx, mdb), &config.Config{}, nil, nil, fake, tx)
	users := memUsers{roles: map[string][]string{}}
	coupons := promo.NewService(promo.NewRepository(pg), tx, walletSvc, users)
	svc := NewService(NewRepository(pg), tx, walletSvc, fake, &memSettings{val: map[string]string{}}, users, nil, coupons).(*service)
	svc.users = users
	return &env{ctx: ctx, pg: pg, svc: svc, wallet: walletSvc, users: users, fake: fake}
}

func (e *env) recruiter() primitive.ObjectID {
	id := primitive.NewObjectID()
	e.users.roles[id.Hex()] = []string{user.RoleRecruiter}
	return id
}

func (e *env) fund(t *testing.T, userID primitive.ObjectID, rupees float64) {
	t.Helper()
	_, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: userID, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceMain, Category: wallet.CategoryTopup,
		Amount: rupees, ReferenceID: "fund:" + primitive.NewObjectID().Hex(), Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func (e *env) plan(t *testing.T, price float64, jobs, chats *int) *Plan {
	t.Helper()
	p, err := e.svc.CreatePlan(e.ctx, PlanInput{Name: "Starter", Price: price, PeriodDays: 30,
		Limits: Limits{JobPosts: jobs, NewChats: chats}, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func (e *env) enforce(t *testing.T, free Limits) {
	t.Helper()
	if _, err := e.svc.SaveSettings(e.ctx, Settings{Enforce: true, Free: free}); err != nil {
		t.Fatal(err)
	}
}

func (e *env) used(t *testing.T, userID primitive.ObjectID) Usage {
	t.Helper()
	o, err := e.svc.Overview(e.ctx, userID.Hex())
	if err != nil {
		t.Fatal(err)
	}
	return o.Usage
}

func ref() string { return primitive.NewObjectID().Hex() }

func TestUsageIsOnlyCountedUntilEnforced(t *testing.T) {
	e := setup(t)
	r := e.recruiter()
	// Default free allowance is 2 job posts, but enforcement is off
	for i := 0; i < 4; i++ {
		if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); err != nil {
			t.Fatalf("post %d: %v", i+1, err)
		}
	}
	if got := e.used(t, r).JobPosts.Used; got != 4 {
		t.Fatalf("used = %d, want 4", got)
	}

	// Candidates and admins are never counted
	member := primitive.NewObjectID()
	e.users.roles[member.Hex()] = []string{user.RoleUser}
	admin := primitive.NewObjectID()
	e.users.roles[admin.Hex()] = []string{user.RoleRecruiter, user.RoleAdmin}
	e.enforce(t, Limits{JobPosts: intp(0), NewChats: intp(0)})
	for _, id := range []primitive.ObjectID{member, admin} {
		if _, err := e.svc.Use(e.ctx, id, KindNewChat, ref()); err != nil {
			t.Fatalf("%s: %v", id.Hex(), err)
		}
	}
}

func TestFreeAllowanceWhenEnforced(t *testing.T) {
	e := setup(t)
	r := e.recruiter()
	e.enforce(t, Limits{JobPosts: intp(2), NewChats: intp(1)})

	first, second := ref(), ref()
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, first); err != nil {
		t.Fatal(err)
	}
	// The same job again doesn't count twice
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, first); err != nil {
		t.Fatal(err)
	}
	release, err := e.svc.Use(e.ctx, r, KindJobPost, second)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); !errors.Is(err, ErrJobPostsUsedUp) {
		t.Fatalf("third post: %v", err)
	}
	// A post that failed to save is given back
	release(e.ctx)
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); err != nil {
		t.Fatalf("after release: %v", err)
	}

	person := ref()
	if _, err := e.svc.Use(e.ctx, r, KindNewChat, person); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Use(e.ctx, r, KindNewChat, ref()); !errors.Is(err, ErrChatsUsedUp) {
		t.Fatalf("second chat: %v", err)
	}

	// A new month starts again
	e.svc.now = func() time.Time { return time.Now().AddDate(0, 1, 0) }
	if _, err := e.svc.Use(e.ctx, r, KindNewChat, ref()); err != nil {
		t.Fatalf("next month: %v", err)
	}
}

func TestLimitHoldsUnderParallelPosts(t *testing.T) {
	e := setup(t)
	r := e.recruiter()
	e.enforce(t, Limits{JobPosts: intp(1)})

	var wg sync.WaitGroup
	var mu sync.Mutex
	ok := 0
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); err == nil {
				mu.Lock()
				ok++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if ok != 1 {
		t.Fatalf("%d posts got through a limit of 1", ok)
	}
}

func TestBuyWithWalletAndQueue(t *testing.T) {
	e := setup(t)
	r := e.recruiter()
	p := e.plan(t, 499, intp(5), nil)

	if _, _, _, err := e.svc.BuyWithWallet(e.ctx, r.Hex(), p.ID, ""); !errors.Is(err, wallet.ErrInsufficient) {
		t.Fatalf("empty wallet: %v", err)
	}
	member := primitive.NewObjectID()
	e.users.roles[member.Hex()] = []string{user.RoleUser}
	if _, _, _, err := e.svc.BuyWithWallet(e.ctx, member.Hex(), p.ID, ""); !errors.Is(err, ErrRecruitersOnly) {
		t.Fatalf("candidate: %v", err)
	}

	e.fund(t, r, 1500)
	sub, summary, _, err := e.svc.BuyWithWallet(e.ctx, r.Hex(), p.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if summary.MainBalance != 1001 || sub.PricePaise != 499_00 || *sub.JobPosts != 5 || sub.NewChats != nil {
		t.Fatalf("sub = %+v, main = %v", sub, summary.MainBalance)
	}
	if got := sub.ExpiresAt.Sub(sub.StartsAt); got != 30*24*time.Hour {
		t.Fatalf("length = %v", got)
	}

	// Editing the plan later doesn't change what was bought
	if _, err := e.svc.UpdatePlan(e.ctx, p.ID, PlanInput{Name: "Starter", Price: 999, PeriodDays: 30,
		Limits: Limits{JobPosts: intp(1)}, IsActive: true}); err != nil {
		t.Fatal(err)
	}

	// Usage now counts against the plan; unlimited chats even with enforcement on
	e.enforce(t, Limits{JobPosts: intp(0), NewChats: intp(0)})
	for i := 0; i < 5; i++ {
		if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); err != nil {
			t.Fatalf("post %d: %v", i+1, err)
		}
	}
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); !errors.Is(err, ErrJobPostsUsedUp) {
		t.Fatalf("sixth post: %v", err)
	}
	if _, err := e.svc.Use(e.ctx, r, KindNewChat, ref()); err != nil {
		t.Fatalf("chat on an unlimited plan: %v", err)
	}

	// Buying again queues the new plan after the current one; a third is refused
	p2 := e.plan(t, 299, intp(3), nil)
	next, _, _, err := e.svc.BuyWithWallet(e.ctx, r.Hex(), p2.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if !next.StartsAt.Equal(sub.ExpiresAt) {
		t.Fatalf("queued start %v, want %v", next.StartsAt, sub.ExpiresAt)
	}
	if _, _, _, err := e.svc.BuyWithWallet(e.ctx, r.Hex(), p2.ID, ""); !errors.Is(err, ErrQueueFull) {
		t.Fatalf("third plan: %v", err)
	}
	o, err := e.svc.Overview(e.ctx, r.Hex())
	if err != nil {
		t.Fatal(err)
	}
	if o.Current == nil || o.Current.ID != sub.ID || len(o.Queued) != 1 || o.Usage.JobPosts.Used != 5 || !o.Enforced {
		t.Fatalf("overview = %+v", o)
	}

	// When the first plan ends, the queued one runs with a fresh count
	e.svc.now = func() time.Time { return sub.ExpiresAt.Add(time.Minute) }
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); err != nil {
		t.Fatalf("first post of the next plan: %v", err)
	}
	if u := e.used(t, r); u.JobPosts.Used != 1 || *u.JobPosts.Limit != 3 {
		t.Fatalf("usage = %+v", u.JobPosts)
	}

	// A switched-off plan can't be bought
	if _, err := e.svc.UpdatePlan(e.ctx, p2.ID, PlanInput{Name: "Old", Price: 299, PeriodDays: 30}); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := e.svc.BuyWithWallet(e.ctx, r.Hex(), p2.ID, ""); !errors.Is(err, ErrPlanInactive) {
		t.Fatalf("inactive plan: %v", err)
	}
}

func TestOnlinePurchaseAndRefund(t *testing.T) {
	e := setup(t)
	r := e.recruiter()
	p := e.plan(t, 799, intp(10), intp(50))

	checkout, err := e.svc.CreateOrder(e.ctx, r.Hex(), p.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if checkout.AmountPaise != 799_00 {
		t.Fatalf("checkout = %+v", checkout)
	}
	// The plan points at its checkout, so the checkout has to exist
	if err := e.pg.DB.Exec(`INSERT INTO payment_orders (id, razorpay_order_id, razorpay_payment_id, user_id, purpose, amount_paise, status)
		VALUES (?, ?, 'pay_test', ?, 'recruiter_plan', ?, 'paid')`,
		primitive.NewObjectID().Hex(), checkout.OrderID, r.Hex(), checkout.AmountPaise).Error; err != nil {
		t.Fatal(err)
	}
	sub, err := e.svc.VerifyPayment(e.ctx, r.Hex(), payment.ConfirmInput{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_test"})
	if err != nil {
		t.Fatal(err)
	}
	if sub.Channel != ChannelOnline || sub.PricePaise != 799_00 || *sub.NewChats != 50 {
		t.Fatalf("sub = %+v", sub)
	}

	order := e.fake.Orders[checkout.OrderID]
	if _, err := e.svc.Use(e.ctx, r, KindJobPost, ref()); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.revoke(e.ctx, order); !errors.Is(err, ErrRefundUsed) {
		t.Fatalf("refunding a used plan: %v", err)
	}
	if err := e.pg.DB.Exec(`DELETE FROM recruiter_usage WHERE subscription_id = ?`, sub.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := e.svc.revoke(e.ctx, order); err != nil {
		t.Fatalf("refunding an unused plan: %v", err)
	}
	if o, _ := e.svc.Overview(e.ctx, r.Hex()); o.Current != nil {
		t.Fatalf("refunded plan still current: %+v", o.Current)
	}
}

func TestPlanValidation(t *testing.T) {
	e := setup(t)
	cases := []struct {
		in   PlanInput
		want error
	}{
		{PlanInput{Name: " ", Price: 100, PeriodDays: 30}, ErrPlanName},
		{PlanInput{Name: "Pro", Price: 0, PeriodDays: 30}, ErrPlanPrice},
		{PlanInput{Name: "Pro", Price: 100, PeriodDays: 0}, ErrPlanPeriod},
		{PlanInput{Name: "Pro", Price: 100, PeriodDays: 30, Limits: Limits{JobPosts: intp(-1)}}, ErrPlanLimit},
	}
	for _, c := range cases {
		if _, err := e.svc.CreatePlan(e.ctx, c.in); !errors.Is(err, c.want) {
			t.Errorf("%+v: err = %v, want %v", c.in, err, c.want)
		}
	}
	if _, err := e.svc.SaveSettings(e.ctx, Settings{Free: Limits{NewChats: intp(-2)}}); !errors.Is(err, ErrSettings) {
		t.Fatalf("settings: %v", err)
	}
	s, err := e.svc.GetSettings(e.ctx)
	if err != nil || s.Enforce || *s.Free.JobPosts != 2 {
		t.Fatalf("defaults = %+v, %v", s, err)
	}
}
