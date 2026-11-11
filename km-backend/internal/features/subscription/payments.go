package subscription

import (
	"context"
	"errors"
	"fmt"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrInvalidPlan    = apperr.New("SUBSCRIPTION_PLAN_INVALID", "choose a monthly or yearly plan")
	ErrJustSubscribed = apperr.New("SUBSCRIPTION_JUST_PURCHASED", "this plan was purchased just now")
)

// A second purchase this soon after the last one is a double click, not a renewal
const duplicatePurchaseWindow = 2 * time.Minute

type planTerms struct {
	Price        float64
	DurationDays int
	Name         string
}

func termsFor(planType string) (planTerms, error) {
	switch planType {
	case PlanMonthly:
		return planTerms{Price: MonthlyPrice, DurationDays: 30, Name: "Monthly Pro Expert"}, nil
	case PlanYearly:
		return planTerms{Price: YearlyPrice, DurationDays: 365, Name: "Annual Pro Expert"}, nil
	}
	return planTerms{}, ErrInvalidPlan
}

func parseUser(userID string) (primitive.ObjectID, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return primitive.NilObjectID, apperr.New("UNAUTHORIZED", "unauthorized: missing user id")
	}
	return uid, nil
}

// activate writes the subscription and grants the expert role. A renewal adds to the time left
// instead of throwing it away.
func (s *SubscriptionServiceImpl) activate(ctx context.Context, uid primitive.ObjectID, planType string, terms planTerms, method, orderID, paymentID string) (*ExpertSubscription, error) {
	now := time.Now()
	startsAt := now
	active, err := s.repo.GetActiveSubscription(ctx, uid.Hex())
	if err != nil {
		return nil, err
	}
	if active != nil {
		if now.Sub(active.CreatedAt) < duplicatePurchaseWindow {
			return nil, ErrJustSubscribed
		}
		if active.ExpiresAt.After(now) {
			startsAt = active.ExpiresAt
		}
	}

	created, err := s.repo.CreateSubscription(ctx, &ExpertSubscription{
		UserID:            uid,
		PlanType:          planType,
		Amount:            terms.Price,
		PaymentMethod:     method,
		PaymentStatus:     "paid",
		Status:            StatusActive,
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		StartsAt:          startsAt,
		ExpiresAt:         startsAt.AddDate(0, 0, terms.DurationDays),
	})
	if err != nil {
		return nil, fmt.Errorf("saving subscription: %w", err)
	}
	if err := s.grantExpertRole(ctx, uid.Hex()); err != nil {
		return nil, fmt.Errorf("granting expert role: %w", err)
	}
	return created, nil
}

// CreateOrder opens a checkout for a plan at the server's price
func (s *SubscriptionServiceImpl) CreateOrder(ctx context.Context, userID string, req CreateSubscriptionOrderRequest) (*CreateSubscriptionOrderResponse, error) {
	uid, err := parseUser(userID)
	if err != nil {
		return nil, err
	}
	terms, err := termsFor(req.PlanType)
	if err != nil {
		return nil, err
	}
	if err := s.checkExpertEligibility(ctx, userID); err != nil {
		return nil, err
	}

	checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
		UserID:      uid,
		Purpose:     payment.PurposeSubscription,
		AmountPaise: money.ToPaise(terms.Price),
		TargetID:    req.PlanType,
		Description: terms.Name,
	})
	if err != nil {
		return nil, err
	}

	return &CreateSubscriptionOrderResponse{
		OrderID:     checkout.OrderID,
		Amount:      checkout.Amount,
		AmountPaise: checkout.AmountPaise,
		Currency:    checkout.Currency,
		KeyID:       checkout.KeyID,
		PlanType:    req.PlanType,
		PlanName:    terms.Name,
	}, nil
}

func (s *SubscriptionServiceImpl) fulfillSubscription(ctx context.Context, order *payment.Order) error {
	terms, err := termsFor(order.TargetID)
	if err != nil {
		return payment.Unfulfillable("This plan is no longer available")
	}
	terms.Price = order.Amount()
	_, err = s.activate(ctx, order.UserID, order.TargetID, terms, "razorpay", order.RazorpayOrderID, order.RazorpayPaymentID)
	if errors.Is(err, ErrJustSubscribed) {
		return payment.Unfulfillable("This plan was already purchased")
	}
	return err
}

// revokeSubscription ends a refunded subscription
func (s *SubscriptionServiceImpl) revokeSubscription(ctx context.Context, order *payment.Order) error {
	sub, err := s.repo.GetByRazorpayOrderID(ctx, order.RazorpayOrderID)
	if err != nil || sub == nil {
		return err
	}
	return s.repo.UpdateSubscriptionStatus(ctx, sub.ID.Hex(), "cancelled")
}

// VerifyPayment confirms a checkout. The plan is the one saved with the order.
func (s *SubscriptionServiceImpl) VerifyPayment(ctx context.Context, userID string, req VerifySubscriptionPaymentRequest) (*ExpertSubscription, error) {
	uid, err := parseUser(userID)
	if err != nil {
		return nil, err
	}
	order, err := s.payments.Confirm(ctx, uid, payment.PurposeSubscription, payment.ConfirmInput{
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		RazorpaySignature: req.RazorpaySignature,
	})
	if err != nil {
		return nil, err
	}
	return s.repo.GetByRazorpayOrderID(ctx, order.RazorpayOrderID)
}

// SubscribeWithWallet charges the wallet and activates the plan as one step
func (s *SubscriptionServiceImpl) SubscribeWithWallet(ctx context.Context, userID string, req SubscribeWithWalletRequest) (*ExpertSubscription, *wallet.WalletSummaryResponse, error) {
	uid, err := parseUser(userID)
	if err != nil {
		return nil, nil, err
	}
	terms, err := termsFor(req.PlanType)
	if err != nil {
		return nil, nil, err
	}
	if err := s.checkExpertEligibility(ctx, userID); err != nil {
		return nil, nil, err
	}

	var created *ExpertSubscription
	var summary *wallet.WalletSummaryResponse
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if created, err = s.activate(ctx, uid, req.PlanType, terms, "wallet", "", ""); err != nil {
			return err
		}
		_, summary, err = s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
			UserID:        uid,
			Type:          wallet.TypeDebit,
			TargetBalance: wallet.BalanceMain,
			Category:      wallet.CategorySubscription,
			Amount:        terms.Price,
			ReferenceID:   "subscription:" + created.ID.Hex() + ":pay",
			Description:   "KaamMilega " + terms.Name,
			Metadata: map[string]interface{}{
				"subscription_id": created.ID.Hex(),
				"plan_type":       req.PlanType,
				"payment_method":  "wallet",
			},
		})
		return err
	})
	if err != nil {
		return nil, nil, err
	}
	return created, summary, nil
}
