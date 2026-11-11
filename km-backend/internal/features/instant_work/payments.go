package instant_work

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	passPricePaise int64 = 99_00
	passPriceINR         = 99.00
	passQuota            = 10
	passValidity         = 90 * 24 * time.Hour
)

var ErrPassAlreadyActive = apperr.New("PASS_ALREADY_ACTIVE", "you still have gig credits on your current InstantPass")

// createActivePass writes a ready-to-use pass and syncs the worker's quota. It must run in a
// transaction. A pass that has expired or has no credits left is replaced; one that still has
// credits blocks the purchase.
func (s *InstantWorkServiceImpl) createActivePass(ctx context.Context, userID primitive.ObjectID, channel, orderID, paymentID string) (*InstantPass, error) {
	if err := s.repo.RetireFinishedPasses(ctx, userID); err != nil {
		return nil, err
	}
	active, err := s.repo.GetActivePassByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if active != nil {
		return nil, ErrPassAlreadyActive
	}

	now := time.Now()
	pass := &InstantPass{
		UserID:            userID,
		HasActivePass:     true,
		Channel:           channel,
		QuotaTotal:        passQuota,
		QuotaRemaining:    passQuota,
		PriceINR:          passPriceINR,
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		ActivatedAt:       now,
		ExpiresAt:         now.Add(passValidity),
	}
	if err := s.repo.CreatePass(ctx, pass); err != nil {
		return nil, err
	}
	if err := s.repo.SyncWorkerPass(ctx, userID, passQuota, pass.ExpiresAt); err != nil {
		return nil, err
	}
	return pass, nil
}

func (s *InstantWorkServiceImpl) notifyPassActivated(userID primitive.ObjectID) {
	if s.notifService == nil {
		return
	}
	_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID:   userID,
		Type:     "instant_pass_activated",
		Category: notification.CategorySystem,
		Title:    "InstantPass activated",
		Message:  "Your InstantPass is active: 10 gig credits and unlimited chats for 90 days.",
		Link:     "/wallet",
	})
}

// PurchasePassWithWallet charges the wallet and activates the pass as one step
func (s *InstantWorkServiceImpl) PurchasePassWithWallet(ctx context.Context, userID primitive.ObjectID) (*InstantPass, *wallet.WalletSummaryResponse, error) {
	var pass *InstantPass
	var summary *wallet.WalletSummaryResponse
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if pass, err = s.createActivePass(ctx, userID, PassChannelWallet, "", ""); err != nil {
			return err
		}
		_, summary, err = s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
			UserID:        userID,
			Type:          wallet.TypeDebit,
			TargetBalance: wallet.BalanceMain,
			Category:      wallet.CategoryPassPurchase,
			Amount:        passPriceINR,
			ReferenceID:   "pass:" + pass.ID.Hex() + ":pay",
			Description:   "InstantPass (10 spot gigs)",
			Metadata:      map[string]interface{}{"pass_id": pass.ID.Hex(), "quota": passQuota, "channel": "wallet"},
		})
		return err
	})
	if err != nil {
		return nil, nil, err
	}

	go s.notifyPassActivated(userID)
	return pass, summary, nil
}

// CreatePassOrder opens a checkout for the ₹99 pass. The pass exists once the payment arrives.
func (s *InstantWorkServiceImpl) CreatePassOrder(ctx context.Context, userID primitive.ObjectID) (*CreatePassOrderResponse, error) {
	active, err := s.repo.GetActivePassByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if active != nil && active.QuotaRemaining > 0 {
		return nil, ErrPassAlreadyActive
	}

	checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
		UserID:      userID,
		Purpose:     payment.PurposeInstantPass,
		AmountPaise: passPricePaise,
		Description: "InstantPass (10 spot gigs)",
	})
	if err != nil {
		return nil, err
	}

	return &CreatePassOrderResponse{
		KeyID:   checkout.KeyID,
		OrderID: checkout.OrderID,
		Amount:  float64(checkout.AmountPaise),
		PassINR: checkout.Amount,
	}, nil
}

func (s *InstantWorkServiceImpl) fulfillPass(ctx context.Context, order *payment.Order) error {
	_, err := s.createActivePass(ctx, order.UserID, PassChannelOnline, order.RazorpayOrderID, order.RazorpayPaymentID)
	if errors.Is(err, ErrPassAlreadyActive) {
		return payment.Unfulfillable("You already have an InstantPass with credits left")
	}
	return err
}

// revokePass ends a pass an admin refunds from Payments. Only an unused pass can be refunded.
func (s *InstantWorkServiceImpl) revokePass(ctx context.Context, order *payment.Order) error {
	pass, err := s.repo.GetPassByOrderID(ctx, order.RazorpayOrderID)
	if err != nil {
		return err
	}
	if pass == nil {
		return ErrPassUsed
	}
	return s.endRefundedPass(ctx, pass.ID)
}

// revokeWalletPass ends a wallet-bought pass when its dispute is refunded in full
func (s *InstantWorkServiceImpl) revokeWalletPass(ctx context.Context, tx *wallet.WalletTransaction) error {
	id, _ := tx.Metadata["pass_id"].(string)
	passID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return ErrPassUsed
	}
	return s.endRefundedPass(ctx, passID)
}

func (s *InstantWorkServiceImpl) endRefundedPass(ctx context.Context, passID primitive.ObjectID) error {
	pass, err := s.repo.RefundUnusedPass(ctx, passID)
	if err != nil {
		return err
	}
	if err := s.repo.SyncWorkerPass(ctx, pass.UserID, 0, time.Time{}); err != nil {
		return err
	}
	return s.repo.SetWorkerFreeNow(ctx, pass.UserID, false)
}

// VerifyPassPayment confirms a checkout and returns the pass it bought
func (s *InstantWorkServiceImpl) VerifyPassPayment(ctx context.Context, userID primitive.ObjectID, req VerifyPassPaymentRequest) (*InstantPass, error) {
	order, err := s.payments.Confirm(ctx, userID, payment.PurposeInstantPass, payment.ConfirmInput{
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		RazorpaySignature: req.RazorpaySignature,
	})
	if err != nil {
		return nil, err
	}
	pass, err := s.repo.GetPassByOrderID(ctx, order.RazorpayOrderID)
	if err == nil && pass != nil && pass.HasActivePass {
		go s.notifyPassActivated(userID)
	}
	return pass, err
}
