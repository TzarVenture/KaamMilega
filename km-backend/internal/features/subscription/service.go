package subscription

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/payment"
	"km-backend/internal/database"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

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
	payments      payment.Service
	tx            database.Transactor
}

func NewSubscriptionService(
	repo SubscriptionRepository,
	userRepo user.UserRepository,
	walletService wallet.WalletService,
	cfg *config.Config,
	payments payment.Service,
	tx database.Transactor,
) SubscriptionService {
	s := &SubscriptionServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		cfg:           cfg,
		payments:      payments,
		tx:            tx,
	}
	payments.Register(payment.PurposeSubscription, payment.Handlers{
		Fulfill: s.fulfillSubscription,
		Revoke:  s.revokeSubscription,
	})
	return s
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

// checkExpertEligibility enforces the client rule that an Expert needs 2+ years of experience
func (s *SubscriptionServiceImpl) checkExpertEligibility(ctx context.Context, userID string) error {
	u, err := s.userRepo.FindUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if u == nil {
		return errors.New("user not found")
	}
	if user.ExperienceYears(u) < user.MinExpertExperienceYears {
		return user.ErrExpertExperienceRequired
	}
	return nil
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
