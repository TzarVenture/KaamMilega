package subscription

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type mockSubscriptionRepo struct {
	subs map[string]*ExpertSubscription
}

func newMockSubscriptionRepo() *mockSubscriptionRepo {
	return &mockSubscriptionRepo{
		subs: make(map[string]*ExpertSubscription),
	}
}

func (m *mockSubscriptionRepo) CreateSubscription(ctx context.Context, sub *ExpertSubscription) (*ExpertSubscription, error) {
	if sub.ID.IsZero() {
		sub.ID = primitive.NewObjectID()
	}
	if sub.CreatedAt.IsZero() {
		sub.CreatedAt = time.Now()
	}
	m.subs[sub.ID.Hex()] = sub
	return sub, nil
}

func (m *mockSubscriptionRepo) GetActiveSubscription(ctx context.Context, userID string) (*ExpertSubscription, error) {
	for _, s := range m.subs {
		if s.UserID.Hex() == userID && s.Status == StatusActive && s.ExpiresAt.After(time.Now()) {
			return s, nil
		}
	}
	return nil, nil
}

func (m *mockSubscriptionRepo) GetSubscriptionByID(ctx context.Context, id string) (*ExpertSubscription, error) {
	s, ok := m.subs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return s, nil
}

func (m *mockSubscriptionRepo) GetByRazorpayOrderID(ctx context.Context, orderID string) (*ExpertSubscription, error) {
	for _, s := range m.subs {
		if s.RazorpayOrderID == orderID {
			return s, nil
		}
	}
	return nil, nil
}

func (m *mockSubscriptionRepo) UpdateSubscriptionStatus(ctx context.Context, id string, status string) error {
	s, ok := m.subs[id]
	if !ok {
		return errors.New("not found")
	}
	s.Status = status
	return nil
}

type mockUserRepo struct {
	user.UserRepository
	users map[string]*user.User
}

func (m *mockUserRepo) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	u, ok := m.users[id]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (m *mockUserRepo) UpdateUser(ctx context.Context, u *user.User) (*user.User, error) {
	m.users[u.ID.Hex()] = u
	return u, nil
}

type mockWalletService struct {
	wallet.WalletService
	wallets map[string]*wallet.WalletSummaryResponse
}

func (w *mockWalletService) GetWalletSummary(ctx context.Context, userID string) (*wallet.WalletSummaryResponse, error) {
	sum, ok := w.wallets[userID]
	if !ok {
		sum = &wallet.WalletSummaryResponse{
			UserID:              userID,
			Currency:            "INR",
			Status:              "active",
			MainBalance:         0,
			TotalBalance:        0,
			WithdrawableBalance: 0,
		}
		w.wallets[userID] = sum
	}
	return sum, nil
}

func (w *mockWalletService) RecordTransaction(ctx context.Context, input wallet.RecordTransactionInput) (*wallet.TransactionItemResponse, *wallet.WalletSummaryResponse, error) {
	uid := input.UserID.Hex()
	sum, _ := w.GetWalletSummary(ctx, uid)

	if input.Type == wallet.TypeDebit {
		if sum.MainBalance < input.Amount {
			return nil, nil, errors.New("insufficient balance")
		}
		sum.MainBalance -= input.Amount
		sum.TotalBalance -= input.Amount
	}

	txItem := &wallet.TransactionItemResponse{
		ID:            primitive.NewObjectID().Hex(),
		WalletID:      uid,
		Type:          input.Type,
		TargetBalance: input.TargetBalance,
		Category:      input.Category,
		Amount:        input.Amount,
		Status:        wallet.StatusCompleted,
		ReferenceID:   input.ReferenceID,
		Description:   input.Description,
		CreatedAt:     time.Now(),
	}
	return txItem, sum, nil
}

func TestGetPlans(t *testing.T) {
	repo := newMockSubscriptionRepo()
	cfg := &config.Config{}
	svc := &SubscriptionServiceImpl{repo: repo, cfg: cfg}

	plans := svc.GetPlans(context.Background())
	if len(plans) != 2 {
		t.Fatalf("expected 2 plans, got %d", len(plans))
	}

	if plans[0].PlanType != PlanMonthly || plans[0].Price != 499.00 {
		t.Errorf("unexpected monthly plan: %+v", plans[0])
	}
	if plans[1].PlanType != PlanYearly || plans[1].Price != 4499.00 {
		t.Errorf("unexpected yearly plan: %+v", plans[1])
	}
}

func TestSubscribeWithWallet_InsufficientBalance(t *testing.T) {
	repo := newMockSubscriptionRepo()
	userID := primitive.NewObjectID().Hex()
	mockWallet := &mockWalletService{
		wallets: map[string]*wallet.WalletSummaryResponse{
			userID: {MainBalance: 100.00}, // Required 499
		},
	}
	mockUser := &mockUserRepo{users: make(map[string]*user.User)}
	cfg := &config.Config{}

	svc := &SubscriptionServiceImpl{
		repo:          repo,
		userRepo:      mockUser,
		walletService: mockWallet,
		cfg:           cfg,
		tx:            database.NoopTransactor{},
	}

	_, _, err := svc.SubscribeWithWallet(context.Background(), userID, SubscribeWithWalletRequest{PlanType: PlanMonthly})
	if err == nil {
		t.Fatal("expected error due to insufficient balance, got nil")
	}
}

func TestSubscribeWithWallet_Success(t *testing.T) {
	repo := newMockSubscriptionRepo()
	uid := primitive.NewObjectID()
	userID := uid.Hex()

	mockWallet := &mockWalletService{
		wallets: map[string]*wallet.WalletSummaryResponse{
			userID: {MainBalance: 1000.00, TotalBalance: 1000.00},
		},
	}
	testUser := &user.User{
		ID:               uid,
		Roles:            []string{user.RoleUser},
		ExperienceDetail: "2 Years",
	}
	mockUser := &mockUserRepo{
		users: map[string]*user.User{
			userID: testUser,
		},
	}
	cfg := &config.Config{}

	svc := &SubscriptionServiceImpl{
		repo:          repo,
		userRepo:      mockUser,
		walletService: mockWallet,
		cfg:           cfg,
		tx:            database.NoopTransactor{},
	}

	sub, summary, err := svc.SubscribeWithWallet(context.Background(), userID, SubscribeWithWalletRequest{PlanType: PlanMonthly})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sub.Status != StatusActive {
		t.Errorf("expected active subscription, got %s", sub.Status)
	}
	if sub.Amount != 499.00 {
		t.Errorf("expected amount 499, got %.2f", sub.Amount)
	}
	if summary.MainBalance != 501.00 {
		t.Errorf("expected remaining wallet balance 501, got %.2f", summary.MainBalance)
	}

	// Verify user role upgrade
	u, _ := mockUser.FindUserByID(context.Background(), userID)
	hasExpertRole := false
	for _, r := range u.Roles {
		if r == user.RoleExpert {
			hasExpertRole = true
			break
		}
	}
	if !hasExpertRole {
		t.Error("expected user to have role 'expert'")
	}
	if u.ExpertApprovalStatus != "approved" {
		t.Errorf("expected expert_approval_status 'approved', got %s", u.ExpertApprovalStatus)
	}
}

func TestSubscribeWithWallet_RequiresTwoYearsExperience(t *testing.T) {
	repo := newMockSubscriptionRepo()
	uid := primitive.NewObjectID()
	userID := uid.Hex()

	mockWallet := &mockWalletService{
		wallets: map[string]*wallet.WalletSummaryResponse{
			userID: {MainBalance: 1000.00, TotalBalance: 1000.00},
		},
	}
	testUser := &user.User{
		ID:               uid,
		Roles:            []string{user.RoleUser},
		ExperienceDetail: "1 Year",
	}
	svc := &SubscriptionServiceImpl{
		repo:          repo,
		userRepo:      &mockUserRepo{users: map[string]*user.User{userID: testUser}},
		walletService: mockWallet,
		cfg:           &config.Config{},
		tx:            database.NoopTransactor{},
	}

	_, _, err := svc.SubscribeWithWallet(context.Background(), userID, SubscribeWithWalletRequest{PlanType: PlanMonthly})
	if err != user.ErrExpertExperienceRequired {
		t.Fatalf("expected experience error, got %v", err)
	}
	if mockWallet.wallets[userID].MainBalance != 1000.00 {
		t.Errorf("wallet must not be debited, balance is %.2f", mockWallet.wallets[userID].MainBalance)
	}
	if testUser.Roles[0] != user.RoleUser || len(testUser.Roles) != 1 {
		t.Errorf("expert role must not be granted, roles %v", testUser.Roles)
	}
}

func razorpayFixture() (*mockSubscriptionRepo, *paymenttest.Fake, SubscriptionService, string) {
	repo := newMockSubscriptionRepo()
	uid := primitive.NewObjectID()
	userID := uid.Hex()
	users := &mockUserRepo{users: map[string]*user.User{
		userID: {ID: uid, Roles: []string{user.RoleUser}, ExperienceDetail: "2 Years"},
	}}
	fake := paymenttest.New()
	return repo, fake, NewSubscriptionService(repo, users, nil, &config.Config{}, fake, database.NoopTransactor{}), userID
}

func buyPlan(t *testing.T, svc SubscriptionService, userID, plan, paymentID string) (*ExpertSubscription, error) {
	t.Helper()
	ctx := context.Background()
	order, err := svc.CreateOrder(ctx, userID, CreateSubscriptionOrderRequest{PlanType: plan})
	if err != nil {
		t.Fatal(err)
	}
	return svc.VerifyPayment(ctx, userID, VerifySubscriptionPaymentRequest{RazorpayOrderID: order.OrderID, RazorpayPaymentID: paymentID, RazorpaySignature: "sig"})
}

func TestVerifyPayment_UsesThePlanSavedWithTheOrder(t *testing.T) {
	repo, _, svc, userID := razorpayFixture()
	ctx := context.Background()

	order, err := svc.CreateOrder(ctx, userID, CreateSubscriptionOrderRequest{PlanType: PlanYearly})
	if err != nil {
		t.Fatal(err)
	}
	if order.AmountPaise != 449900 || len(repo.subs) != 0 {
		t.Fatalf("order = %+v, subs = %d", order, len(repo.subs))
	}

	input := VerifySubscriptionPaymentRequest{PlanType: PlanMonthly, RazorpayOrderID: order.OrderID, RazorpayPaymentID: "pay_1", RazorpaySignature: "sig"}
	for i := 0; i < 2; i++ {
		sub, err := svc.VerifyPayment(ctx, userID, input)
		if err != nil {
			t.Fatal(err)
		}
		if sub.PlanType != PlanYearly || sub.Amount != 4499 {
			t.Fatalf("sub = %+v", sub)
		}
		if days := int(sub.ExpiresAt.Sub(sub.StartsAt).Hours() / 24); days != 365 {
			t.Fatalf("days = %d", days)
		}
	}
	if len(repo.subs) != 1 {
		t.Fatalf("subs = %d", len(repo.subs))
	}
}

func TestVerifyPayment_RefusesAnotherUsersOrder(t *testing.T) {
	_, _, svc, userID := razorpayFixture()
	ctx := context.Background()
	order, err := svc.CreateOrder(ctx, userID, CreateSubscriptionOrderRequest{PlanType: PlanMonthly})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.VerifyPayment(ctx, primitive.NewObjectID().Hex(), VerifySubscriptionPaymentRequest{RazorpayOrderID: order.OrderID, RazorpayPaymentID: "pay_1", RazorpaySignature: "sig"})
	if !errors.Is(err, payment.ErrOrderNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestCreateOrder_RefusesAnUnknownPlan(t *testing.T) {
	_, _, svc, userID := razorpayFixture()
	if _, err := svc.CreateOrder(context.Background(), userID, CreateSubscriptionOrderRequest{PlanType: "lifetime"}); !errors.Is(err, ErrInvalidPlan) {
		t.Fatalf("err = %v", err)
	}
}

func TestDoubleCheckoutIsRefundedNotStacked(t *testing.T) {
	repo, _, svc, userID := razorpayFixture()
	if _, err := buyPlan(t, svc, userID, PlanMonthly, "pay_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := buyPlan(t, svc, userID, PlanMonthly, "pay_2"); !errors.Is(err, payment.ErrRefunding) {
		t.Fatalf("err = %v", err)
	}
	if len(repo.subs) != 1 {
		t.Fatalf("subs = %d", len(repo.subs))
	}
}

func TestRenewalAddsToTheTimeLeft(t *testing.T) {
	repo, _, svc, userID := razorpayFixture()
	first, err := buyPlan(t, svc, userID, PlanMonthly, "pay_1")
	if err != nil {
		t.Fatal(err)
	}
	first.CreatedAt = time.Now().Add(-time.Hour)

	second, err := buyPlan(t, svc, userID, PlanMonthly, "pay_2")
	if err != nil {
		t.Fatal(err)
	}
	if !second.StartsAt.Equal(first.ExpiresAt) || len(repo.subs) != 2 {
		t.Fatalf("second starts %v, first expires %v, subs = %d", second.StartsAt, first.ExpiresAt, len(repo.subs))
	}
}

func TestAdminRefundEndsTheSubscription(t *testing.T) {
	_, fake, svc, userID := razorpayFixture()
	sub, err := buyPlan(t, svc, userID, PlanMonthly, "pay_1")
	if err != nil {
		t.Fatal(err)
	}
	if err := fake.Handlers[payment.PurposeSubscription].Revoke(context.Background(), fake.Orders[sub.RazorpayOrderID]); err != nil {
		t.Fatal(err)
	}
	if sub.Status != "cancelled" {
		t.Fatalf("status = %s", sub.Status)
	}
}
