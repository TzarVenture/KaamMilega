package subscription

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SubscriptionService interface {
	GetPlans(ctx context.Context) []PlanDetails
	GetMySubscription(ctx context.Context, userID string) (*SubscriptionStatusResponse, error)
	CreateOrder(ctx context.Context, userID string, req CreateSubscriptionOrderRequest) (*CreateSubscriptionOrderResponse, error)
	VerifyPayment(ctx context.Context, userID string, req VerifySubscriptionPaymentRequest) (*ExpertSubscription, error)
	SubscribeWithWallet(ctx context.Context, userID string, req SubscribeWithWalletRequest) (*ExpertSubscription, *wallet.WalletSummaryResponse, error)
}

type SubscriptionServiceImpl struct {
	repo          SubscriptionRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	cfg           *config.Config
	httpClient    *http.Client
}

func NewSubscriptionService(
	repo SubscriptionRepository,
	userRepo user.UserRepository,
	walletService wallet.WalletService,
	cfg *config.Config,
) SubscriptionService {
	return &SubscriptionServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		cfg:           cfg,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *SubscriptionServiceImpl) GetPlans(ctx context.Context) []PlanDetails {
	return []PlanDetails{
		{
			PlanType:       PlanMonthly,
			Name:           "Monthly Pro Expert",
			Price:          MonthlyPrice,
			DurationDays:   30,
			SavingsPercent: 0,
			Description:    "Flexible month-to-month access to monetize your industry expertise.",
			Perks: []string{
				"Verified Pro Expert Badge on Profile",
				"Featured Placement in Expert Directory",
				"Host Unlimited Paid 1-on-1 Mentorship Calls",
				"Full Availability Schedule & Calendar Management",
				"Direct Bank & UPI Earnings Payouts",
				"Standard Mentorship Search Visibility",
			},
		},
		{
			PlanType:       PlanYearly,
			Name:           "Annual Pro Expert",
			Price:          YearlyPrice,
			DurationDays:   365,
			SavingsPercent: 25,
			Description:    "Best value plan for dedicated professionals. Save 25% compared to monthly.",
			Perks: []string{
				"All Monthly Pro Expert Perks",
				"Priority Top-Ranking in Mentorship & Expert Search",
				"Verified Pro Badge with Golden Highlight",
				"Save 25% (Equivalent to ₹375 / month)",
				"Dedicated WhatsApp & VIP Priority Support",
				"Annual Verified Mentor Certificate",
			},
		},
	}
}

func (s *SubscriptionServiceImpl) GetMySubscription(ctx context.Context, userID string) (*SubscriptionStatusResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	sub, err := s.repo.GetActiveSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}

	if sub == nil {
		return &SubscriptionStatusResponse{
			IsActive: false,
		}, nil
	}

	daysRemaining := int(time.Until(sub.ExpiresAt).Hours() / 24)
	if daysRemaining < 0 {
		daysRemaining = 0
	}

	return &SubscriptionStatusResponse{
		IsActive:      true,
		Subscription:  sub,
		DaysRemaining: daysRemaining,
		PlanType:      sub.PlanType,
		ExpiresAt:     &sub.ExpiresAt,
	}, nil
}

func (s *SubscriptionServiceImpl) CreateOrder(ctx context.Context, userID string, req CreateSubscriptionOrderRequest) (*CreateSubscriptionOrderResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	var price float64
	var planName string
	switch req.PlanType {
	case PlanMonthly:
		price = MonthlyPrice
		planName = "Monthly Pro Expert"
	case PlanYearly:
		price = YearlyPrice
		planName = "Annual Pro Expert"
	default:
		return nil, errors.New("invalid plan_type: must be 'monthly' or 'yearly'")
	}

	keyID := s.cfg.RazorpayKeyID
	keySecret := s.cfg.RazorpayKeySecret
	if keyID == "" || keySecret == "" {
		return nil, errors.New("razorpay credentials not configured")
	}

	amountPaise := int64(price * 100)
	receiptID := fmt.Sprintf("sub_%s_%d", userID[:min(6, len(userID))], time.Now().Unix())

	payload := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  receiptID,
		"notes": map[string]interface{}{
			"user_id":   userID,
			"plan_type": req.PlanType,
			"purpose":   "expert_subscription",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal order request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach razorpay api: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read razorpay response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order creation failed (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var rzpOrder struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(respBytes, &rzpOrder); err != nil {
		return nil, fmt.Errorf("failed to decode razorpay response: %w", err)
	}

	return &CreateSubscriptionOrderResponse{
		OrderID:     rzpOrder.ID,
		Amount:      price,
		AmountPaise: amountPaise,
		Currency:    "INR",
		KeyID:       keyID,
		PlanType:    req.PlanType,
		PlanName:    planName,
	}, nil
}

func (s *SubscriptionServiceImpl) VerifyPayment(ctx context.Context, userID string, req VerifySubscriptionPaymentRequest) (*ExpertSubscription, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	if req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" || req.RazorpaySignature == "" {
		return nil, errors.New("missing razorpay verification fields")
	}

	var price float64
	var durationDays int
	switch req.PlanType {
	case PlanMonthly:
		price = MonthlyPrice
		durationDays = 30
	case PlanYearly:
		price = YearlyPrice
		durationDays = 365
	default:
		return nil, errors.New("invalid plan_type: must be 'monthly' or 'yearly'")
	}

	keySecret := s.cfg.RazorpayKeySecret
	if keySecret == "" {
		return nil, errors.New("razorpay gateway credentials not configured")
	}

	// Verify HMAC-SHA256 signature
	data := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
	h := hmac.New(sha256.New, []byte(keySecret))
	h.Write([]byte(data))
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(req.RazorpaySignature)) {
		return nil, errors.New("invalid razorpay signature: payment verification failed")
	}

	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, durationDays)

	sub := &ExpertSubscription{
		UserID:            uid,
		PlanType:          req.PlanType,
		Amount:            price,
		PaymentMethod:     "razorpay",
		PaymentStatus:     "paid",
		Status:            StatusActive,
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		StartsAt:          now,
		ExpiresAt:         expiresAt,
	}

	created, err := s.repo.CreateSubscription(ctx, sub)
	if err != nil {
		return nil, fmt.Errorf("failed to save subscription record: %w", err)
	}

	// Grant expert role & activate profile
	_ = s.grantExpertRole(ctx, userID)

	return created, nil
}

func (s *SubscriptionServiceImpl) SubscribeWithWallet(ctx context.Context, userID string, req SubscribeWithWalletRequest) (*ExpertSubscription, *wallet.WalletSummaryResponse, error) {
	if userID == "" {
		return nil, nil, errors.New("unauthorized: missing user id")
	}

	var price float64
	var durationDays int
	var planName string
	switch req.PlanType {
	case PlanMonthly:
		price = MonthlyPrice
		durationDays = 30
		planName = "Monthly Pro Expert"
	case PlanYearly:
		price = YearlyPrice
		durationDays = 365
		planName = "Annual Pro Expert"
	default:
		return nil, nil, errors.New("invalid plan_type: must be 'monthly' or 'yearly'")
	}

	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, nil, errors.New("invalid user id")
	}

	// 1. Verify user wallet balance
	walletSummary, err := s.walletService.GetWalletSummary(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to retrieve wallet summary: %w", err)
	}

	if walletSummary.MainBalance < price {
		return nil, nil, fmt.Errorf("insufficient wallet balance: required ₹%.2f, available ₹%.2f", price, walletSummary.MainBalance)
	}

	// 2. Create subscription record
	now := time.Now()
	expiresAt := now.AddDate(0, 0, durationDays)

	sub := &ExpertSubscription{
		UserID:        uid,
		PlanType:      req.PlanType,
		Amount:        price,
		PaymentMethod: "wallet",
		PaymentStatus: "paid",
		Status:        StatusActive,
		StartsAt:      now,
		ExpiresAt:     expiresAt,
	}

	created, err := s.repo.CreateSubscription(ctx, sub)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to record subscription: %w", err)
	}

	// 3. Atomically debit user's main wallet balance via ledger
	debitInput := wallet.RecordTransactionInput{
		UserID:        uid,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceMain,
		Category:      wallet.CategorySubscription,
		Amount:        price,
		ReferenceID:   created.ID.Hex() + "_sub",
		Description:   fmt.Sprintf("KaamMilega Pro Expert (%s)", planName),
		Metadata: map[string]interface{}{
			"subscription_id": created.ID.Hex(),
			"plan_type":       req.PlanType,
			"payment_method":  "wallet",
		},
	}

	_, updatedSummary, err := s.walletService.RecordTransaction(ctx, debitInput)
	if err != nil {
		return nil, nil, fmt.Errorf("wallet debit failed: %w", err)
	}

	// 4. Grant expert role & activate profile
	_ = s.grantExpertRole(ctx, userID)

	return created, updatedSummary, nil
}

func (s *SubscriptionServiceImpl) grantExpertRole(ctx context.Context, userID string) error {
	u, err := s.userRepo.FindUserByID(ctx, userID)
	if err != nil || u == nil {
		return err
	}

	hasExpertRole := false
	for _, r := range u.Roles {
		if r == user.RoleExpert {
			hasExpertRole = true
			break
		}
	}
	if !hasExpertRole {
		u.Roles = append(u.Roles, user.RoleExpert)
	}
	u.ExpertApprovalStatus = "approved"
	u.IsConsultant = true

	_, err = s.userRepo.UpdateUser(ctx, u)
	return err
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
