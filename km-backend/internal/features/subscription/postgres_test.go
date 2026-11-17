package subscription

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
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These buy plans with the real wallet on a throwaway Postgres schema (see pgtest).

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

// safeUsers is an in-memory user store that is safe to use from several goroutines
type safeUsers struct {
	user.UserRepository
	mu    sync.Mutex
	users map[string]user.User
}

func (s *safeUsers) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return nil, errors.New("user not found")
	}
	u.Roles = append([]string(nil), u.Roles...)
	return &u, nil
}

func (s *safeUsers) UpdateUser(ctx context.Context, u *user.User) (*user.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[u.ID.Hex()] = *u
	return u, nil
}

type pgFixture struct {
	ctx     context.Context
	pg      *database.PostgresDB
	svc     *SubscriptionServiceImpl
	wallets wallet.WalletService
	users   *safeUsers
	uid     primitive.ObjectID
}

func newPGFixture(t *testing.T, topUp float64) *pgFixture {
	t.Helper()
	pg := pgtest.New(t)
	tx := database.NewPgTransactor(pg)
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1"))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}
	payments := paymenttest.New()
	wallets := wallet.NewWalletService(wallet.NewWalletRepository(pg, tx, mdb), &config.Config{}, nil, nil, payments, tx)

	uid := primitive.NewObjectID()
	users := &safeUsers{users: map[string]user.User{uid.Hex(): {ID: uid, Roles: []string{user.RoleUser}, ExperienceDetail: "3 Years"}}}
	f := &pgFixture{
		ctx:     context.Background(),
		pg:      pg,
		svc:     NewSubscriptionService(NewSubscriptionRepository(pg), users, wallets, &config.Config{}, payments, tx).(*SubscriptionServiceImpl),
		wallets: wallets,
		users:   users,
		uid:     uid,
	}
	if topUp > 0 {
		if _, _, err := wallets.RecordTransaction(f.ctx, wallet.RecordTransactionInput{
			UserID: uid, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceMain, Category: wallet.CategoryTopup,
			Amount: topUp, ReferenceID: "topup:" + primitive.NewObjectID().Hex(), Description: "test",
		}); err != nil {
			t.Fatal(err)
		}
	}
	return f
}

func (f *pgFixture) main(t *testing.T) float64 {
	t.Helper()
	w, err := f.wallets.GetWalletSummary(f.ctx, f.uid.Hex())
	if err != nil {
		t.Fatal(err)
	}
	return w.MainBalance
}

func (f *pgFixture) isExpert() bool {
	u, _ := f.users.FindUserByID(f.ctx, f.uid.Hex())
	for _, r := range u.Roles {
		if r == user.RoleExpert {
			return true
		}
	}
	return false
}

func (f *pgFixture) rows(t *testing.T) int64 {
	t.Helper()
	var n int64
	if err := f.pg.DB.Raw(`SELECT count(*) FROM expert_subscriptions WHERE user_id = ?`, f.uid.Hex()).Scan(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPGWalletPurchaseChargesAndGrantsTheRole(t *testing.T) {
	f := newPGFixture(t, 1000)
	sub, _, err := f.svc.SubscribeWithWallet(f.ctx, f.uid.Hex(), SubscribeWithWalletRequest{PlanType: PlanMonthly})
	if err != nil {
		t.Fatal(err)
	}
	if f.main(t) != 1000-MonthlyPrice || !f.isExpert() {
		t.Fatalf("main = %v, expert = %v", f.main(t), f.isExpert())
	}
	status, err := f.svc.GetMySubscription(f.ctx, f.uid.Hex())
	if err != nil || !status.IsActive || status.Subscription.ID != sub.ID || status.Subscription.Amount != MonthlyPrice {
		t.Fatalf("status = %+v, err = %v", status, err)
	}
}

func TestPGShortWalletLeavesNoPlanAndNoRole(t *testing.T) {
	f := newPGFixture(t, 100)
	if _, _, err := f.svc.SubscribeWithWallet(f.ctx, f.uid.Hex(), SubscribeWithWalletRequest{PlanType: PlanMonthly}); !errors.Is(err, wallet.ErrInsufficient) {
		t.Fatalf("err = %v", err)
	}
	if n := f.rows(t); n != 0 || f.isExpert() || f.main(t) != 100 {
		t.Fatalf("rows = %d, expert = %v, main = %v", n, f.isExpert(), f.main(t))
	}
}

func TestPGDoubleClickBuysOnce(t *testing.T) {
	f := newPGFixture(t, 5000)
	var wg sync.WaitGroup
	errs := make([]error, 3)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, errs[i] = f.svc.SubscribeWithWallet(f.ctx, f.uid.Hex(), SubscribeWithWalletRequest{PlanType: PlanMonthly})
		}(i)
	}
	wg.Wait()

	ok := 0
	for _, err := range errs {
		if err == nil {
			ok++
		} else if !errors.Is(err, ErrJustSubscribed) {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if n := f.rows(t); ok != 1 || n != 1 || f.main(t) != 5000-MonthlyPrice {
		t.Fatalf("ok = %d, rows = %d, main = %v", ok, n, f.main(t))
	}
}

func TestPGEarlyRenewalStacksAfterTheCurrentPlan(t *testing.T) {
	f := newPGFixture(t, 5000)
	first, _, err := f.svc.SubscribeWithWallet(f.ctx, f.uid.Hex(), SubscribeWithWalletRequest{PlanType: PlanMonthly})
	if err != nil {
		t.Fatal(err)
	}
	// Past the double-click window
	if err := f.pg.DB.Exec(`UPDATE expert_subscriptions SET created_at = ? WHERE id = ?`, time.Now().Add(-10*time.Minute), first.ID.Hex()).Error; err != nil {
		t.Fatal(err)
	}
	second, _, err := f.svc.SubscribeWithWallet(f.ctx, f.uid.Hex(), SubscribeWithWalletRequest{PlanType: PlanYearly})
	if err != nil {
		t.Fatal(err)
	}
	if !second.StartsAt.Equal(first.ExpiresAt) && second.StartsAt.Sub(first.ExpiresAt).Abs() > time.Millisecond {
		t.Fatalf("renewal starts %v, current plan ends %v", second.StartsAt, first.ExpiresAt)
	}
	status, _ := f.svc.GetMySubscription(f.ctx, f.uid.Hex())
	if status.Subscription.ID != second.ID || f.rows(t) != 2 {
		t.Fatalf("latest = %s, rows = %d", status.Subscription.ID.Hex(), f.rows(t))
	}
}

func TestPGStatusCheckRepairsAMissingRole(t *testing.T) {
	f := newPGFixture(t, 1000)
	if _, _, err := f.svc.SubscribeWithWallet(f.ctx, f.uid.Hex(), SubscribeWithWalletRequest{PlanType: PlanMonthly}); err != nil {
		t.Fatal(err)
	}
	// As if the role update after the purchase had failed
	u, _ := f.users.FindUserByID(f.ctx, f.uid.Hex())
	u.Roles = []string{user.RoleUser}
	_, _ = f.users.UpdateUser(f.ctx, u)

	if _, err := f.svc.GetMySubscription(f.ctx, f.uid.Hex()); err != nil {
		t.Fatal(err)
	}
	if !f.isExpert() {
		t.Fatal("status check did not restore the expert role")
	}
}
