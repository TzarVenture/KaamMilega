package instant_work

import (
	"context"
	"errors"
	"testing"

	"km-backend/internal/features/payment"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func (e *env) passCoupon(t *testing.T, in promo.CouponInput) {
	t.Helper()
	in.AppliesTo, in.IsActive = []string{string(payment.PurposeInstantPass)}, true
	if _, err := e.coupons.CreateCoupon(e.ctx, primitive.NewObjectID().Hex(), in); err != nil {
		t.Fatal(err)
	}
}

func (e *env) useStatus(t *testing.T, purchaseRef string) string {
	t.Helper()
	var s string
	if err := e.pg.DB.Raw(`SELECT status FROM coupon_redemptions WHERE purchase_ref = ?`, purchaseRef).Scan(&s).Error; err != nil {
		t.Fatal(err)
	}
	return s
}

// A discounted pass bought from the wallet, then refunded in full through a dispute
func TestPassCouponFromWalletAndDisputeRefund(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.fund(t, buyer, 99)
	half := 50
	e.passCoupon(t, promo.CouponInput{Code: "HALFPASS", Kind: promo.KindDiscount, ValueType: promo.ValuePercent, Percent: &half})

	pass, summary, receipt, err := e.svc.PurchasePassWithWallet(e.ctx, buyer, "halfpass")
	if err != nil {
		t.Fatal(err)
	}
	if pass.PriceINR != 49.5 || receipt.Paid != 49.5 || receipt.Discount != 49.5 || receipt.Code != "HALFPASS" || summary.MainBalance != 49.5 {
		t.Fatalf("pass %+v receipt %+v main %v", pass, receipt, summary.MainBalance)
	}
	if got := e.useStatus(t, passRef(pass.ID)); got != promo.StatusRedeemed {
		t.Fatalf("coupon use %s", got)
	}

	list, _ := e.wallet.GetTransactions(e.ctx, buyer.Hex(), wallet.TransactionQuery{Category: wallet.CategoryPassPurchase})
	d, err := e.wallet.CreateDispute(e.ctx, buyer.Hex(), wallet.CreateDisputeRequest{
		TransactionID: list.Transactions[0].ID, Reason: wallet.DisputeReasonTechnicalFailure, Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.wallet.ResolveDispute(e.ctx, d.ID.Hex(), primitive.NewObjectID().Hex(), wallet.ResolveDisputeRequest{Action: "approve"}); err != nil {
		t.Fatal(err)
	}
	if got := e.useStatus(t, passRef(pass.ID)); got != promo.StatusReversed {
		t.Fatalf("coupon use after refund %s", got)
	}
	if s, _ := e.wallet.GetWalletSummary(e.ctx, buyer.Hex()); s.MainBalance != 99 {
		t.Fatalf("main after refund %v, want 99", s.MainBalance)
	}
}

// A cashback pass paid online: cashback arrives with the payment and leaves with the refund
func TestPassCouponOnlineCashbackAndRefund(t *testing.T) {
	e := setup(t)
	e.fake.OnCreate = func(ctx context.Context, o *payment.Order) error {
		return e.pg.DB.WithContext(ctx).Exec(`INSERT INTO payment_orders (id, razorpay_order_id, user_id, purpose, amount_paise, status)
			VALUES (?, ?, ?, ?, ?, 'created')`, o.ID.Hex(), o.RazorpayOrderID, o.UserID.Hex(), string(o.Purpose), o.AmountPaise).Error
	}
	buyer := primitive.NewObjectID()
	twenty := 20.0
	e.passCoupon(t, promo.CouponInput{Code: "BACK20", Kind: promo.KindCashback, ValueType: promo.ValueFlat, Amount: &twenty})

	checkout, err := e.svc.CreatePassOrder(e.ctx, buyer, "BACK20")
	if err != nil {
		t.Fatal(err)
	}
	if checkout.Amount != float64(PassPricePaise) {
		t.Fatalf("checkout %+v", checkout)
	}
	pass, err := e.svc.VerifyPassPayment(e.ctx, buyer, VerifyPassPaymentRequest{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_test"})
	if err != nil {
		t.Fatal(err)
	}
	if s, _ := e.wallet.GetWalletSummary(e.ctx, buyer.Hex()); s.BonusBalance != 20 {
		t.Fatalf("bonus after payment %v, want 20", s.BonusBalance)
	}

	// Refunded from the admin payments page
	if err := e.svc.tx.Run(e.ctx, func(ctx context.Context) error { return e.svc.revokePass(ctx, e.fake.Orders[checkout.OrderID]) }); err != nil {
		t.Fatal(err)
	}
	if s, _ := e.wallet.GetWalletSummary(e.ctx, buyer.Hex()); s.BonusBalance != 0 {
		t.Fatalf("bonus after refund %v, want 0", s.BonusBalance)
	}
	if got := e.useStatus(t, passRef(pass.ID)); got != promo.StatusReversed {
		t.Fatalf("coupon use after refund %s", got)
	}

	// A bad code refuses the checkout before any order is made
	before := len(e.fake.Orders)
	if _, err := e.svc.CreatePassOrder(e.ctx, buyer, "NOSUCH"); !errors.Is(err, promo.ErrInvalid) {
		t.Fatalf("bad code: %v", err)
	}
	if len(e.fake.Orders) != before {
		t.Fatal("an order was made for a bad code")
	}
}
