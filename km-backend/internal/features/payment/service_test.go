package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type memRepo struct {
	Repository
	mu     sync.Mutex
	orders map[primitive.ObjectID]*Order
}

func newMemRepo() *memRepo { return &memRepo{orders: map[primitive.ObjectID]*Order{}} }

func (r *memRepo) Insert(ctx context.Context, o *Order) error {
	o.ID = primitive.NewObjectID()
	copied := *o
	r.orders[o.ID] = &copied
	return nil
}

func (r *memRepo) get(match func(*Order) bool) *Order {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, o := range r.orders {
		if match(o) {
			copied := *o
			return &copied
		}
	}
	return nil
}

func (r *memRepo) FindByID(ctx context.Context, id primitive.ObjectID) (*Order, error) {
	return r.get(func(o *Order) bool { return o.ID == id }), nil
}

func (r *memRepo) FindByRazorpayOrderID(ctx context.Context, id string) (*Order, error) {
	return r.get(func(o *Order) bool { return o.RazorpayOrderID == id }), nil
}

func (r *memRepo) FindByRazorpayPaymentID(ctx context.Context, id string) (*Order, error) {
	return r.get(func(o *Order) bool { return o.RazorpayPaymentID == id }), nil
}

func (r *memRepo) ClaimPaid(ctx context.Context, id primitive.ObjectID, paymentID string, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	o := r.orders[id]
	if o.Status != StatusCreated && o.Status != StatusExpired {
		return false, nil
	}
	o.Status, o.RazorpayPaymentID = StatusPaid, paymentID
	return true, nil
}

func (r *memRepo) MarkRefundDue(ctx context.Context, id primitive.ObjectID, from []Status, paymentID string, paise int64, reason string, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	o := r.orders[id]
	for _, s := range from {
		if o.Status == s {
			o.Status, o.RazorpayPaymentID, o.RefundPaise, o.RefundReason = StatusRefundDue, paymentID, paise, reason
			return true, nil
		}
	}
	return false, nil
}

func (r *memRepo) MarkRefunded(ctx context.Context, id primitive.ObjectID, refundID string, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	o := r.orders[id]
	if o.Status != StatusRefundDue {
		return false, nil
	}
	o.Status, o.RefundID = StatusRefunded, refundID
	return true, nil
}

func (r *memRepo) ReopenRefund(ctx context.Context, id primitive.ObjectID, message string) error {
	r.orders[id].Status, r.orders[id].RefundError = StatusRefundDue, message
	return nil
}

func (r *memRepo) SetRefundError(ctx context.Context, id primitive.ObjectID, message string) error {
	r.orders[id].RefundError = message
	return nil
}

func (r *memRepo) SetLastFailure(ctx context.Context, id primitive.ObjectID, message string) error {
	r.orders[id].LastFailure = message
	return nil
}

func (r *memRepo) ListCreatedBefore(ctx context.Context, before time.Time, limit int64) ([]Order, error) {
	var out []Order
	for _, o := range r.orders {
		if o.Status == StatusCreated && !o.CreatedAt.After(before) {
			out = append(out, *o)
		}
	}
	return out, nil
}

func (r *memRepo) ListRefundDue(ctx context.Context, limit int64) ([]Order, error) {
	var out []Order
	for _, o := range r.orders {
		if o.Status == StatusRefundDue {
			out = append(out, *o)
		}
	}
	return out, nil
}

func (r *memRepo) MarkExpired(ctx context.Context, id primitive.ObjectID, now time.Time) error {
	r.orders[id].Status = StatusExpired
	return nil
}

// rollbackTx undoes the repository's writes on failure, like a real transaction.
type rollbackTx struct{ repo *memRepo }

func (t rollbackTx) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	saved := make(map[primitive.ObjectID]Order, len(t.repo.orders))
	for id, o := range t.repo.orders {
		saved[id] = *o
	}
	err := fn(ctx)
	if err != nil {
		for id := range saved {
			restored := saved[id]
			t.repo.orders[id] = &restored
		}
	}
	return err
}

type fakeGateway struct {
	payments  map[string]*GatewayPayment
	refunds   []string
	refundErr error
	captured  []string
}

func (g *fakeGateway) KeyID() string    { return "rzp_test_key" }
func (g *fakeGateway) Configured() bool { return true }
func (g *fakeGateway) CreateOrder(ctx context.Context, amountPaise int64, receipt string, notes map[string]string) (string, error) {
	return "order_" + primitive.NewObjectID().Hex(), nil
}
func (g *fakeGateway) FetchPayment(ctx context.Context, id string) (*GatewayPayment, error) {
	p, ok := g.payments[id]
	if !ok {
		return nil, ErrGateway
	}
	copied := *p
	return &copied, nil
}
func (g *fakeGateway) CapturePayment(ctx context.Context, id string, amount int64) (*GatewayPayment, error) {
	g.captured = append(g.captured, id)
	g.payments[id].Status = gatewayCaptured
	return g.FetchPayment(ctx, id)
}
func (g *fakeGateway) OrderPayments(ctx context.Context, orderID string) ([]GatewayPayment, error) {
	var out []GatewayPayment
	for _, p := range g.payments {
		if p.OrderID == orderID {
			out = append(out, *p)
		}
	}
	return out, nil
}
func (g *fakeGateway) Refund(ctx context.Context, id string, amount int64, key string) (string, error) {
	if g.refundErr != nil {
		return "", g.refundErr
	}
	g.refunds = append(g.refunds, id)
	g.payments[id].AmountRefunded += amount
	return "rfnd_1", nil
}
func (g *fakeGateway) CheckoutSignatureValid(orderID, paymentID, signature string) bool {
	return signature == "good"
}
func (g *fakeGateway) WebhookSignatureValid(body []byte, signature string) bool {
	return signature == "good"
}

type harness struct {
	svc       *service
	repo      *memRepo
	gateway   *fakeGateway
	fulfilled int
	failWith  error
	user      primitive.ObjectID
}

func newHarness() *harness {
	h := &harness{repo: newMemRepo(), gateway: &fakeGateway{payments: map[string]*GatewayPayment{}}, user: primitive.NewObjectID()}
	h.svc = NewService(h.repo, h.gateway, rollbackTx{h.repo}).(*service)
	h.svc.Register(PurposeWalletTopup, Handlers{
		Fulfill: func(ctx context.Context, o *Order) error {
			if h.failWith != nil {
				return h.failWith
			}
			h.fulfilled++
			return nil
		},
		Revoke: func(ctx context.Context, o *Order) error { return nil },
	})
	return h
}

func (h *harness) order(t *testing.T, paise int64) string {
	t.Helper()
	checkout, _, err := h.svc.CreateOrder(context.Background(), CreateOrderInput{UserID: h.user, Purpose: PurposeWalletTopup, AmountPaise: paise})
	if err != nil {
		t.Fatal(err)
	}
	return checkout.OrderID
}

func (h *harness) pay(orderID, paymentID, status string, paise int64) {
	h.gateway.payments[paymentID] = &GatewayPayment{ID: paymentID, OrderID: orderID, Status: status, Currency: "INR", Amount: paise}
}

func (h *harness) confirm(orderID, paymentID string) (*Order, error) {
	return h.svc.Confirm(context.Background(), h.user, PurposeWalletTopup, ConfirmInput{RazorpayOrderID: orderID, RazorpayPaymentID: paymentID, RazorpaySignature: "good"})
}

func TestConfirmSettlesOnceHoweverOftenItIsRepeated(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	for i := 0; i < 3; i++ {
		if _, err := h.confirm(id, "pay_1"); err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if h.fulfilled != 1 {
		t.Fatalf("delivered %d times, want 1", h.fulfilled)
	}
}

func TestConfirmRefusesSomeoneElsesOrder(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	_, err := h.svc.Confirm(context.Background(), primitive.NewObjectID(), PurposeWalletTopup, ConfirmInput{RazorpayOrderID: id, RazorpayPaymentID: "pay_1", RazorpaySignature: "good"})
	if !errors.Is(err, ErrOrderNotFound) || h.fulfilled != 0 {
		t.Fatalf("err = %v, fulfilled = %d", err, h.fulfilled)
	}
}

func TestConfirmRefusesAnOrderBoughtForAnotherPurpose(t *testing.T) {
	h := newHarness()
	id := h.order(t, 100)
	h.pay(id, "pay_1", gatewayCaptured, 100)

	_, err := h.svc.Confirm(context.Background(), h.user, PurposeEventTicket, ConfirmInput{RazorpayOrderID: id, RazorpayPaymentID: "pay_1", RazorpaySignature: "good"})
	if !errors.Is(err, ErrOrderNotFound) || h.fulfilled != 0 {
		t.Fatalf("err = %v, fulfilled = %d", err, h.fulfilled)
	}
}

func TestConfirmRefusesABadSignature(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	_, err := h.svc.Confirm(context.Background(), h.user, PurposeWalletTopup, ConfirmInput{RazorpayOrderID: id, RazorpayPaymentID: "pay_1", RazorpaySignature: "forged"})
	if !errors.Is(err, ErrSignature) || h.fulfilled != 0 {
		t.Fatalf("err = %v, fulfilled = %d", err, h.fulfilled)
	}
}

func TestConfirmRefusesAPaymentFromADifferentOrder(t *testing.T) {
	h := newHarness()
	expensive := h.order(t, 500000)
	cheap := h.order(t, 100)
	h.pay(cheap, "pay_cheap", gatewayCaptured, 100)

	if _, err := h.confirm(expensive, "pay_cheap"); !errors.Is(err, ErrOrderNotFound) {
		t.Fatalf("err = %v", err)
	}
	if h.fulfilled != 0 {
		t.Fatal("a cheap payment must not buy an expensive order")
	}
}

func TestConfirmCapturesAnAuthorizedPayment(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayAuthorized, 50000)

	if _, err := h.confirm(id, "pay_1"); err != nil {
		t.Fatal(err)
	}
	if len(h.gateway.captured) != 1 || h.fulfilled != 1 {
		t.Fatalf("captured = %v, fulfilled = %d", h.gateway.captured, h.fulfilled)
	}
}

func TestConfirmWaitsForAPaymentThatHasNotCompleted(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", "failed", 50000)

	if _, err := h.confirm(id, "pay_1"); !errors.Is(err, ErrNotComplete) || h.fulfilled != 0 {
		t.Fatalf("err = %v, fulfilled = %d", err, h.fulfilled)
	}
}

func TestWrongAmountIsRefundedAndNotDelivered(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 100)

	if _, err := h.confirm(id, "pay_1"); !errors.Is(err, ErrRefunding) {
		t.Fatalf("err = %v", err)
	}
	if h.fulfilled != 0 || len(h.gateway.refunds) != 1 {
		t.Fatalf("fulfilled = %d, refunds = %v", h.fulfilled, h.gateway.refunds)
	}
}

func TestUndeliverableItemIsRefundedAutomatically(t *testing.T) {
	h := newHarness()
	h.failWith = Unfulfillable("sold out")
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	order, err := h.confirm(id, "pay_1")
	if !errors.Is(err, ErrRefunding) || order.Status != StatusRefunded || order.RefundReason != "sold out" {
		t.Fatalf("err = %v, order = %+v", err, order)
	}
}

func TestDatabaseFailureLeavesTheOrderToBeRecovered(t *testing.T) {
	h := newHarness()
	h.failWith = errors.New("database down")
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	if _, err := h.confirm(id, "pay_1"); err == nil {
		t.Fatal("expected the failure to surface")
	}
	if len(h.gateway.refunds) != 0 {
		t.Fatal("a temporary failure must not refund the payment")
	}
	order, _ := h.repo.FindByRazorpayOrderID(context.Background(), id)
	if order.Status != StatusCreated {
		t.Fatalf("status = %s, want it left open for the recovery job", order.Status)
	}

	h.failWith = nil
	if _, err := h.confirm(id, "pay_1"); err != nil || h.fulfilled != 1 {
		t.Fatalf("retry: err = %v, fulfilled = %d", err, h.fulfilled)
	}
}

func TestReconcileRecoversAPaymentNobodyReported(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)
	order, _ := h.repo.FindByRazorpayOrderID(context.Background(), id)
	h.repo.orders[order.ID].CreatedAt = time.Now().Add(-10 * time.Minute)

	if err := h.svc.Reconcile(context.Background()); err != nil {
		t.Fatal(err)
	}
	if h.fulfilled != 1 {
		t.Fatalf("fulfilled = %d", h.fulfilled)
	}
}

func TestReconcileExpiresAbandonedOrders(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	order, _ := h.repo.FindByRazorpayOrderID(context.Background(), id)
	h.repo.orders[order.ID].CreatedAt = time.Now().Add(-25 * time.Hour)

	if err := h.svc.Reconcile(context.Background()); err != nil {
		t.Fatal(err)
	}
	if h.repo.orders[order.ID].Status != StatusExpired {
		t.Fatalf("status = %s", h.repo.orders[order.ID].Status)
	}
}

func TestLatePaymentOnAnExpiredOrderIsStillDelivered(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	order, _ := h.repo.FindByRazorpayOrderID(context.Background(), id)
	h.repo.orders[order.ID].Status = StatusExpired
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	if _, err := h.confirm(id, "pay_1"); err != nil || h.fulfilled != 1 {
		t.Fatalf("err = %v, fulfilled = %d", err, h.fulfilled)
	}
}

func TestSecondPaymentOnASettledOrderIsRefunded(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)
	h.pay(id, "pay_2", gatewayCaptured, 50000)

	if _, err := h.confirm(id, "pay_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := h.confirm(id, "pay_2"); err != nil {
		t.Fatal(err)
	}
	if h.fulfilled != 1 || len(h.gateway.refunds) != 1 || h.gateway.refunds[0] != "pay_2" {
		t.Fatalf("fulfilled = %d, refunds = %v", h.fulfilled, h.gateway.refunds)
	}
}

func TestFailedRefundIsRetriedAndNeverPaidTwice(t *testing.T) {
	h := newHarness()
	h.failWith = Unfulfillable("sold out")
	h.gateway.refundErr = ErrGateway
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)

	order, _ := h.confirm(id, "pay_1")
	if order.Status != StatusRefundDue {
		t.Fatalf("status = %s", order.Status)
	}

	h.gateway.refundErr = nil
	for i := 0; i < 2; i++ {
		if err := h.svc.Reconcile(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	if len(h.gateway.refunds) != 1 {
		t.Fatalf("refunds = %v", h.gateway.refunds)
	}
}

func TestRetryDoesNotRefundWhatRazorpayAlreadyRefunded(t *testing.T) {
	h := newHarness()
	h.failWith = Unfulfillable("sold out")
	h.gateway.refundErr = ErrGateway
	id := h.order(t, 50000)
	h.pay(id, "pay_1", gatewayCaptured, 50000)
	_, _ = h.confirm(id, "pay_1")

	// Razorpay processed the refund but its response was lost
	h.gateway.refundErr = nil
	h.gateway.payments["pay_1"].AmountRefunded = 50000
	if err := h.svc.Reconcile(context.Background()); err != nil {
		t.Fatal(err)
	}
	order, _ := h.repo.FindByRazorpayOrderID(context.Background(), id)
	if len(h.gateway.refunds) != 0 || order.Status != StatusRefunded {
		t.Fatalf("refunds = %v, status = %s", h.gateway.refunds, order.Status)
	}
}

func webhookBody(orderID, paymentID string, paise int64, status string) []byte {
	return []byte(`{"event":"payment.captured","payload":{"payment":{"entity":{"id":"` + paymentID + `","order_id":"` + orderID + `","status":"` + status + `","currency":"INR","amount":` + itoa(paise) + `}}}}`)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	digits := ""
	for ; n > 0; n /= 10 {
		digits = string(rune('0'+n%10)) + digits
	}
	return digits
}

func TestWebhookDeliversEvenIfTheBrowserNeverReturned(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	body := webhookBody(id, "pay_1", 50000, gatewayCaptured)

	for i := 0; i < 2; i++ {
		if err := h.svc.HandleWebhook(context.Background(), body, "good"); err != nil {
			t.Fatal(err)
		}
	}
	if h.fulfilled != 1 {
		t.Fatalf("fulfilled = %d", h.fulfilled)
	}
}

func TestWebhookRefusesABadSignature(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	if err := h.svc.HandleWebhook(context.Background(), webhookBody(id, "pay_1", 50000, gatewayCaptured), "forged"); !errors.Is(err, ErrSignature) {
		t.Fatalf("err = %v", err)
	}
	if h.fulfilled != 0 {
		t.Fatal("a forged webhook must not deliver anything")
	}
}

func TestWebhookIgnoresOrdersThatAreNotOurs(t *testing.T) {
	h := newHarness()
	if err := h.svc.HandleWebhook(context.Background(), webhookBody("order_elsewhere", "pay_1", 100, gatewayCaptured), "good"); err != nil {
		t.Fatal(err)
	}
}

func TestAdminRefundOnlyWorksOnPaidOrders(t *testing.T) {
	h := newHarness()
	id := h.order(t, 50000)
	order, _ := h.repo.FindByRazorpayOrderID(context.Background(), id)

	if _, err := h.svc.AdminRefund(context.Background(), order.ID.Hex(), "test"); !errors.Is(err, ErrNotRefundable) {
		t.Fatalf("err = %v", err)
	}

	h.pay(id, "pay_1", gatewayCaptured, 50000)
	if _, err := h.confirm(id, "pay_1"); err != nil {
		t.Fatal(err)
	}
	refunded, err := h.svc.AdminRefund(context.Background(), order.ID.Hex(), "test")
	if err != nil || refunded.Status != StatusRefunded {
		t.Fatalf("err = %v, order = %+v", err, refunded)
	}
	if _, err := h.svc.AdminRefund(context.Background(), order.ID.Hex(), "again"); !errors.Is(err, ErrNotRefundable) {
		t.Fatalf("second refund: err = %v", err)
	}
	if len(h.gateway.refunds) != 1 {
		t.Fatalf("refunds = %v", h.gateway.refunds)
	}
}

func TestRazorpaySignatureCheck(t *testing.T) {
	g := NewGateway(&config.Config{RazorpayKeyID: "k", RazorpayKeySecret: "secret", RazorpayWebhookSecret: "hook"})
	sign := func(secret, message string) string {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(message))
		return hex.EncodeToString(mac.Sum(nil))
	}

	if !g.CheckoutSignatureValid("o", "p", sign("secret", "o|p")) {
		t.Error("a correct checkout signature was refused")
	}
	if g.CheckoutSignatureValid("o", "p2", sign("secret", "o|p")) {
		t.Error("a signature for another payment was accepted")
	}
	if !g.WebhookSignatureValid([]byte("body"), sign("hook", "body")) {
		t.Error("a correct webhook signature was refused")
	}
	if g.WebhookSignatureValid([]byte("body"), sign("secret", "body")) {
		t.Error("a webhook signed with the wrong secret was accepted")
	}

	unconfigured := NewGateway(&config.Config{})
	if unconfigured.CheckoutSignatureValid("o", "p", sign("", "o|p")) || unconfigured.WebhookSignatureValid([]byte("b"), sign("", "b")) {
		t.Error("an empty secret must never validate")
	}
}
