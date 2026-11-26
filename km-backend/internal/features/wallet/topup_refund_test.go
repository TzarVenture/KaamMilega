package wallet

import (
	"errors"
	"testing"
	"time"

	"km-backend/internal/features/payment"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// topup adds money to a wallet through the (fake) payment flow and dates the payment
func (e *env) topup(t *testing.T, user primitive.ObjectID, amount float64, paymentID string, paidAgo time.Duration) string {
	t.Helper()
	checkout, err := e.svc.CreateTopupOrder(e.ctx, user.Hex(), amount)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.VerifyTopupPayment(e.ctx, user.Hex(), VerifyTopupPaymentRequest{
		RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: paymentID, RazorpaySignature: "sig",
	}); err != nil {
		t.Fatal(err)
	}
	paid := time.Now().Add(-paidAgo)
	e.payments.Orders[checkout.OrderID].PaidAt = &paid
	return checkout.OrderID
}

func TestTopupRefundHoldsMoneyThenRefundsNewestFirst(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	older := e.topup(t, user, 300, "pay_a", 48*time.Hour)
	newer := e.topup(t, user, 200, "pay_b", time.Hour)
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, debit(user, BalanceMain, 100, "spend-1")); err != nil {
		t.Fatal(err)
	}

	info, err := e.svc.GetTopupRefundInfo(e.ctx, user.Hex())
	if err != nil {
		t.Fatal(err)
	}
	if info.Refundable != 400 || info.NotRefundable != 0 {
		t.Fatalf("info = %+v", info)
	}

	refund, err := e.svc.RequestTopupRefund(e.ctx, user.Hex(), TopupRefundRequest{Reason: "Not using the app"})
	if err != nil {
		t.Fatal(err)
	}
	if refund.Amount != 400 || e.wallet(t, user).MainPaise != 0 {
		t.Fatalf("amount = %v, main = %d", refund.Amount, e.wallet(t, user).MainPaise)
	}
	if _, err := e.svc.RequestTopupRefund(e.ctx, user.Hex(), TopupRefundRequest{}); !errors.Is(err, ErrTopupRefundOpen) {
		t.Fatalf("second request: %v", err)
	}

	done, err := e.svc.ApproveTopupRefund(e.ctx, refund.ID.Hex(), "admin-1")
	if err != nil {
		t.Fatal(err)
	}
	if done.Status != TopupRefundRefunded || done.Refunded != 400 || len(done.Parts) != 2 {
		t.Fatalf("approved = %+v", done)
	}
	// Newest top-up first, in full; the rest from the older one
	if done.Parts[0].RazorpayOrderID != newer || done.Parts[0].Paise != 200_00 ||
		done.Parts[1].RazorpayOrderID != older || done.Parts[1].Paise != 200_00 {
		t.Fatalf("parts = %+v", done.Parts)
	}
	if o := e.payments.Orders[older]; o.Status != payment.StatusRefundDue || o.RefundPaise != 200_00 {
		t.Fatalf("older order = %s %d", o.Status, o.RefundPaise)
	}
	if _, err := e.svc.ApproveTopupRefund(e.ctx, refund.ID.Hex(), "admin-1"); !errors.Is(err, ErrTopupRefundState) {
		t.Fatalf("second approve: %v", err)
	}
	if _, err := e.svc.RejectTopupRefund(e.ctx, refund.ID.Hex(), "admin-1", RejectTopupRefundRequest{Reason: "late"}); !errors.Is(err, ErrTopupRefundState) {
		t.Fatalf("reject after approve: %v", err)
	}
	if main := e.wallet(t, user).MainPaise; main != 0 {
		t.Fatalf("main after approve = %d", main)
	}

	var status string
	if err := e.pg.DB.Raw(`SELECT status FROM wallet_transactions WHERE reference_id = ?`, refund.ReferenceID).Scan(&status).Error; err != nil {
		t.Fatal(err)
	}
	if status != string(StatusCompleted) {
		t.Fatalf("hold status = %s", status)
	}
}

func TestRejectedTopupRefundReturnsTheMoneyOnce(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.topup(t, user, 250, "pay_c", time.Hour)

	refund, err := e.svc.RequestTopupRefund(e.ctx, user.Hex(), TopupRefundRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.RejectTopupRefund(e.ctx, refund.ID.Hex(), "admin-1", RejectTopupRefundRequest{}); !errors.Is(err, ErrTopupRefundReason) {
		t.Fatalf("reject without reason: %v", err)
	}
	if _, err := e.svc.RejectTopupRefund(e.ctx, refund.ID.Hex(), "admin-1", RejectTopupRefundRequest{Reason: "Used for a booking"}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.RejectTopupRefund(e.ctx, refund.ID.Hex(), "admin-1", RejectTopupRefundRequest{Reason: "again"}); !errors.Is(err, ErrTopupRefundState) {
		t.Fatalf("second reject: %v", err)
	}
	if main := e.wallet(t, user).MainPaise; main != 250_00 {
		t.Fatalf("main = %d", main)
	}
	if len(e.payments.Refunds) != 0 {
		t.Fatalf("razorpay refunds = %v", e.payments.Refunds)
	}

	// A new request can be made after a decision
	if _, err := e.svc.RequestTopupRefund(e.ctx, user.Hex(), TopupRefundRequest{}); err != nil {
		t.Fatal(err)
	}
}

func TestTopupsOlderThanSixMonthsAreNotRefundable(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.topup(t, user, 500, "pay_d", 200*24*time.Hour)

	info, err := e.svc.GetTopupRefundInfo(e.ctx, user.Hex())
	if err != nil {
		t.Fatal(err)
	}
	if info.Refundable != 0 || info.NotRefundable != 500 {
		t.Fatalf("info = %+v", info)
	}
	if _, err := e.svc.RequestTopupRefund(e.ctx, user.Hex(), TopupRefundRequest{}); !errors.Is(err, ErrNothingToRefund) {
		t.Fatalf("request: %v", err)
	}
}

func TestTopupRefundThatExpiredWhileWaitingGoesBackToTheWallet(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	order := e.topup(t, user, 300, "pay_e", 169*24*time.Hour)

	refund, err := e.svc.RequestTopupRefund(e.ctx, user.Hex(), TopupRefundRequest{})
	if err != nil {
		t.Fatal(err)
	}
	// The admin takes too long: the payment passes Razorpay's limit
	paid := time.Now().Add(-180 * 24 * time.Hour)
	e.payments.Orders[order].PaidAt = &paid

	done, err := e.svc.ApproveTopupRefund(e.ctx, refund.ID.Hex(), "admin-1")
	if err != nil {
		t.Fatal(err)
	}
	if done.Status != TopupRefundRejected || done.RejectReason == "" {
		t.Fatalf("result = %+v", done)
	}
	if main := e.wallet(t, user).MainPaise; main != 300_00 {
		t.Fatalf("main = %d", main)
	}
	if len(e.payments.Refunds) != 0 {
		t.Fatalf("razorpay refunds = %v", e.payments.Refunds)
	}
}
