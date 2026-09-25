package subscription

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"km-backend/internal/config"
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
		ID:    uid,
		Roles: []string{user.RoleUser},
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

func TestVerifyPayment_Razorpay(t *testing.T) {
	repo := newMockSubscriptionRepo()
	uid := primitive.NewObjectID()
	userID := uid.Hex()

	testUser := &user.User{
		ID:    uid,
		Roles: []string{user.RoleUser},
	}
	mockUser := &mockUserRepo{
		users: map[string]*user.User{
			userID: testUser,
		},
	}
	secret := "test_secret_123"
	cfg := &config.Config{RazorpayKeySecret: secret}

	svc := &SubscriptionServiceImpl{
		repo:     repo,
		userRepo: mockUser,
		cfg:      cfg,
	}

	orderID := "order_test_999"
	paymentID := "pay_test_888"

	// 1. Invalid signature
	_, err := svc.VerifyPayment(context.Background(), userID, VerifySubscriptionPaymentRequest{
		PlanType:          PlanYearly,
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		RazorpaySignature: "invalid_sig",
	})
	if err == nil {
		t.Fatal("expected error on invalid signature, got nil")
	}

	// 2. Valid signature
	data := fmt.Sprintf("%s|%s", orderID, paymentID)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	validSig := hex.EncodeToString(h.Sum(nil))

	sub, err := svc.VerifyPayment(context.Background(), userID, VerifySubscriptionPaymentRequest{
		PlanType:          PlanYearly,
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		RazorpaySignature: validSig,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sub.Amount != 4499.00 {
		t.Errorf("expected yearly amount 4499, got %.2f", sub.Amount)
	}
	if sub.PlanType != PlanYearly {
		t.Errorf("expected yearly plan type, got %s", sub.PlanType)
	}

	// Verify expiry is approximately 365 days from now
	days := int(sub.ExpiresAt.Sub(sub.StartsAt).Hours() / 24)
	if days != 365 {
		t.Errorf("expected 365 days validity, got %d", days)
	}
}
