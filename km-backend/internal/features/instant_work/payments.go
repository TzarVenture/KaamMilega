package instant_work

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// PassPricePaise is the InstantPass price before any coupon
	PassPricePaise int64 = 99_00
	passQuota            = 10
	passValidity         = 90 * 24 * time.Hour
)

var passPriceINR = money.ToRupees(PassPricePaise)

func passRef(passID primitive.ObjectID) string { return "pass:" + passID.Hex() }

var ErrPassAlreadyActive = apperr.New("PASS_ALREADY_ACTIVE", "you still have gig credits on your current InstantPass")

// createActivePass writes a ready-to-use pass and syncs the worker's quota. It must run in a
// transaction. A pass that has expired or has no credits left is replaced; one that still has
// credits blocks the purchase.
// pricePaise is what the worker paid, after any coupon.
func (s *InstantWorkServiceImpl) createActivePass(ctx context.Context, userID primitive.ObjectID, channel, orderID, paymentID string, pricePaise int64) (*InstantPass, error) {
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
		PriceINR:          money.ToRupees(pricePaise),
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

// PurchasePassWithWallet charges the wallet (bonus credit first) and activates the pass as one
// step. code is an optional coupon.
func (s *InstantWorkServiceImpl) PurchasePassWithWallet(ctx context.Context, userID primitive.ObjectID, code string) (*InstantPass, *wallet.WalletSummaryResponse, *promo.Receipt, error) {
	var pass *InstantPass
	var summary *wallet.WalletSummaryResponse
	var receipt *promo.Receipt
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		price, err := s.promo.PriceForWallet(ctx, userID.Hex(), payment.PurposeInstantPass, PassPricePaise, code)
		if err != nil {
			return err
		}
		if pass, err = s.createActivePass(ctx, userID, PassChannelWallet, "", "", price.PricePaise); err != nil {
			return err
		}
		paid, err := s.promo.PayFromWallet(ctx, price, promo.WalletPay{
			Category:    wallet.CategoryPassPurchase,
			ReferenceID: passRef(pass.ID) + ":pay",
			PurchaseRef: passRef(pass.ID),
			Description: "InstantPass (10 spot gigs)",
			Metadata:    map[string]interface{}{"pass_id": pass.ID.Hex(), "quota": passQuota, "channel": "wallet"},
		})
		if err != nil {
			return err
		}
		summary, receipt = paid.Summary, promo.ReceiptOf(price, paid)
		return nil
	})
	if err != nil {
		return nil, nil, nil, err
	}

	go s.notifyPassActivated(userID)
	return pass, summary, receipt, nil
}

// CreatePassOrder opens a checkout for the pass at its coupon price. The pass exists once the
// payment arrives.
func (s *InstantWorkServiceImpl) CreatePassOrder(ctx context.Context, userID primitive.ObjectID, code string) (*CreatePassOrderResponse, error) {
	active, err := s.repo.GetActivePassByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if active != nil && active.QuotaRemaining > 0 {
		return nil, ErrPassAlreadyActive
	}

	checkout, _, err := s.promo.CheckoutOnline(ctx, userID.Hex(), payment.PurposeInstantPass, PassPricePaise, code,
		func(pricePaise int64, details map[string]string) (*payment.Checkout, error) {
			checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
				UserID:      userID,
				Purpose:     payment.PurposeInstantPass,
				AmountPaise: pricePaise,
				Details:     details,
				Description: "InstantPass (10 spot gigs)",
			})
			return checkout, err
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
	pass, err := s.createActivePass(ctx, order.UserID, PassChannelOnline, order.RazorpayOrderID, order.RazorpayPaymentID, order.AmountPaise)
	if errors.Is(err, ErrPassAlreadyActive) {
		return payment.Unfulfillable("You already have an InstantPass with credits left")
	}
	if err != nil {
		return err
	}
	return s.promo.RedeemOrder(ctx, order, passRef(pass.ID))
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
	return s.endRefundedPass(ctx, pass.ID, true)
}

// revokeWalletPass ends a wallet-bought pass when its dispute is refunded in full. The 24-hour
// limit was checked when the dispute was filed (wallet.PassDisputeWindow).
func (s *InstantWorkServiceImpl) revokeWalletPass(ctx context.Context, tx *wallet.WalletTransaction) error {
	id, _ := tx.Metadata["pass_id"].(string)
	passID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return ErrPassUsed
	}
	return s.endRefundedPass(ctx, passID, false)
}

func (s *InstantWorkServiceImpl) endRefundedPass(ctx context.Context, passID primitive.ObjectID, checkWindow bool) error {
	pass, err := s.repo.RefundUnusedPass(ctx, passID, checkWindow)
	if err != nil {
		return err
	}
	// Gives the coupon use back and takes back any cashback (refused if it was spent)
	if err := s.promo.Reverse(ctx, passRef(pass.ID)); err != nil {
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
