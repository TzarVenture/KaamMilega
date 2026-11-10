package payment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// An order younger than this is probably still being paid in the customer's browser
	reconcileAfter = 2 * time.Minute
	// An order with no payment after this long has been abandoned
	expireAfter = 24 * time.Hour
)

// Service is the single way to take and return Razorpay payments.
type Service interface {
	Register(purpose Purpose, handlers Handlers)
	CreateOrder(ctx context.Context, input CreateOrderInput) (*Checkout, *Order, error)
	Confirm(ctx context.Context, userID primitive.ObjectID, purpose Purpose, input ConfirmInput) (*Order, error)
	ConfirmAny(ctx context.Context, userID primitive.ObjectID, input ConfirmInput) (*Order, error)
	OrderStatus(ctx context.Context, userID primitive.ObjectID, razorpayOrderID string) (*OrderStatusResponse, error)
	HandleWebhook(ctx context.Context, body []byte, signature string) error
	Reconcile(ctx context.Context) error
	SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) (int64, error)

	// MarkRefundDue queues a refund to the original payment method. It joins the caller's
	// transaction; call ProcessRefund after that commits (the recovery job also picks it up).
	MarkRefundDue(ctx context.Context, razorpayOrderID string, paise int64, reason string) (*Order, error)
	ProcessRefund(ctx context.Context, orderID primitive.ObjectID) error
	ProcessRefundByRazorpayOrder(ctx context.Context, razorpayOrderID string) error

	AdminList(ctx context.Context, query AdminOrderQuery) (*AdminOrderList, error)
	AdminRefund(ctx context.Context, orderID, reason string) (*Order, error)
}

type service struct {
	repo    Repository
	gateway Gateway
	tx      database.Transactor

	mu       sync.RWMutex
	handlers map[Purpose]Handlers
}

// NewService creates the payment service. Features register their handlers when constructed.
func NewService(repo Repository, gateway Gateway, tx database.Transactor) Service {
	return &service{repo: repo, gateway: gateway, tx: tx, handlers: map[Purpose]Handlers{}}
}

func (s *service) Register(purpose Purpose, handlers Handlers) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers[purpose] = handlers
}

func (s *service) handlersFor(purpose Purpose) (Handlers, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	h, ok := s.handlers[purpose]
	return h, ok
}

// CreateOrder opens a Razorpay order and remembers who it's for, what for and how much.
func (s *service) CreateOrder(ctx context.Context, input CreateOrderInput) (*Checkout, *Order, error) {
	if !s.gateway.Configured() {
		return nil, nil, ErrNotConfigured
	}
	if input.AmountPaise <= 0 {
		return nil, nil, errors.New("payment amount must be greater than zero")
	}

	receipt := fmt.Sprintf("%s_%s", input.Purpose, primitive.NewObjectID().Hex())
	if len(receipt) > 40 { // Razorpay's limit
		receipt = receipt[len(receipt)-40:]
	}
	notes := map[string]string{"user_id": input.UserID.Hex(), "purpose": string(input.Purpose)}
	if input.TargetID != "" {
		notes["target_id"] = input.TargetID
	}

	razorpayOrderID, err := s.gateway.CreateOrder(ctx, input.AmountPaise, receipt, notes)
	if err != nil {
		return nil, nil, err
	}

	now := time.Now()
	order := &Order{
		RazorpayOrderID: razorpayOrderID,
		UserID:          input.UserID,
		Purpose:         input.Purpose,
		AmountPaise:     input.AmountPaise,
		Currency:        CurrencyINR,
		TargetID:        input.TargetID,
		Details:         input.Details,
		Description:     input.Description,
		Status:          StatusCreated,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.repo.Insert(ctx, order); err != nil {
		return nil, nil, fmt.Errorf("saving payment order: %w", err)
	}

	return &Checkout{
		OrderID:     razorpayOrderID,
		Amount:      money.ToRupees(input.AmountPaise),
		AmountPaise: input.AmountPaise,
		Currency:    CurrencyINR,
		KeyID:       s.gateway.KeyID(),
	}, order, nil
}

// Confirm settles a payment the browser reports, and only for the expected purpose.
func (s *service) Confirm(ctx context.Context, userID primitive.ObjectID, purpose Purpose, input ConfirmInput) (*Order, error) {
	return s.confirm(ctx, userID, purpose, input)
}

// ConfirmAny settles a payment without knowing its purpose in advance (the shared endpoint).
func (s *service) ConfirmAny(ctx context.Context, userID primitive.ObjectID, input ConfirmInput) (*Order, error) {
	return s.confirm(ctx, userID, "", input)
}

func (s *service) confirm(ctx context.Context, userID primitive.ObjectID, purpose Purpose, input ConfirmInput) (*Order, error) {
	if input.RazorpayOrderID == "" || input.RazorpayPaymentID == "" || input.RazorpaySignature == "" {
		return nil, ErrSignature
	}

	order, err := s.repo.FindByRazorpayOrderID(ctx, input.RazorpayOrderID)
	if err != nil {
		return nil, err
	}
	if order == nil || order.UserID != userID || (purpose != "" && order.Purpose != purpose) {
		return nil, ErrOrderNotFound
	}
	if !s.gateway.CheckoutSignatureValid(input.RazorpayOrderID, input.RazorpayPaymentID, input.RazorpaySignature) {
		return nil, ErrSignature
	}

	if order.Status == StatusPaid && order.RazorpayPaymentID == input.RazorpayPaymentID {
		return order, nil
	}

	payment, err := s.gateway.FetchPayment(ctx, input.RazorpayPaymentID)
	if err != nil {
		return nil, err
	}
	payment, err = s.ensureCaptured(ctx, order, payment)
	if err != nil {
		return nil, err
	}

	settled, err := s.settle(ctx, order, payment)
	if err != nil {
		return nil, err
	}
	if settled.Status == StatusRefundDue || settled.Status == StatusRefunded {
		return settled, ErrRefunding
	}
	return settled, nil
}

// ensureCaptured takes the money for an authorized payment. Anything else isn't paid yet.
func (s *service) ensureCaptured(ctx context.Context, order *Order, payment *GatewayPayment) (*GatewayPayment, error) {
	if payment.OrderID != order.RazorpayOrderID {
		return nil, ErrOrderNotFound
	}
	switch payment.Status {
	case gatewayCaptured:
		return payment, nil
	case gatewayAuthorized:
		return s.gateway.CapturePayment(ctx, payment.ID, order.AmountPaise)
	default:
		return nil, ErrNotComplete
	}
}

// settle applies a captured payment to its order: the status change and the delivery commit
// together or not at all. Safe to call any number of times.
func (s *service) settle(ctx context.Context, order *Order, payment *GatewayPayment) (*Order, error) {
	handlers, ok := s.handlersFor(order.Purpose)
	if !ok {
		return nil, fmt.Errorf("%w: %s", errUnknownPurpose, order.Purpose)
	}

	if payment.Amount != order.AmountPaise || !strings.EqualFold(payment.Currency, order.Currency) {
		log.Printf("[payment] order %s: payment %s is %d %s, expected %d %s",
			order.RazorpayOrderID, payment.ID, payment.Amount, payment.Currency, order.AmountPaise, order.Currency)
		return s.refundUndeliverable(ctx, order, payment, "Amount paid doesn't match the order")
	}

	won := false
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		won = false
		claimed, err := s.repo.ClaimPaid(ctx, order.ID, payment.ID, time.Now())
		if err != nil || !claimed {
			return err
		}
		won = true
		paid := *order
		paid.Status = StatusPaid
		paid.RazorpayPaymentID = payment.ID
		return handlers.Fulfill(ctx, &paid)
	})

	var unfulfillable *UnfulfillableError
	if errors.As(err, &unfulfillable) {
		return s.refundUndeliverable(ctx, order, payment, unfulfillable.Reason)
	}
	if err != nil {
		return nil, err
	}

	latest, err := s.repo.FindByID(ctx, order.ID)
	if err != nil {
		return nil, err
	}
	if won && handlers.AfterPaid != nil {
		go handlers.AfterPaid(latest)
	}
	// A second successful payment on an order already settled by another payment
	if !won && latest != nil && latest.RazorpayPaymentID != payment.ID {
		s.refundDuplicate(ctx, latest, payment)
	}
	return latest, nil
}

func (s *service) refundUndeliverable(ctx context.Context, order *Order, payment *GatewayPayment, reason string) (*Order, error) {
	_, err := s.repo.MarkRefundDue(ctx, order.ID, []Status{StatusCreated, StatusExpired}, payment.ID, payment.Amount, reason, time.Now())
	if err != nil {
		return nil, err
	}
	if err := s.ProcessRefund(ctx, order.ID); err != nil {
		log.Printf("[payment] order %s: refund will be retried: %v", order.RazorpayOrderID, err)
	}
	return s.repo.FindByID(ctx, order.ID)
}

func (s *service) refundDuplicate(ctx context.Context, order *Order, payment *GatewayPayment) {
	if payment.AmountRefunded >= payment.Amount {
		return
	}
	if _, err := s.gateway.Refund(ctx, payment.ID, payment.Amount, "dup_"+payment.ID); err != nil {
		log.Printf("[payment] order %s: refunding duplicate payment %s failed: %v", order.RazorpayOrderID, payment.ID, err)
		return
	}
	log.Printf("[payment] order %s: refunded duplicate payment %s", order.RazorpayOrderID, payment.ID)
}

// OrderStatus lets the browser check on a payment whose confirmation it never saw.
func (s *service) OrderStatus(ctx context.Context, userID primitive.ObjectID, razorpayOrderID string) (*OrderStatusResponse, error) {
	order, err := s.repo.FindByRazorpayOrderID(ctx, razorpayOrderID)
	if err != nil {
		return nil, err
	}
	if order == nil || order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	return &OrderStatusResponse{
		OrderID:  order.RazorpayOrderID,
		Purpose:  order.Purpose,
		Status:   order.Status,
		Amount:   order.Amount(),
		TargetID: order.TargetID,
	}, nil
}

type webhookEvent struct {
	Event   string `json:"event"`
	Payload struct {
		Payment struct {
			Entity struct {
				GatewayPayment
				ErrorDescription string `json:"error_description"`
			} `json:"entity"`
		} `json:"payment"`
		Refund struct {
			Entity struct {
				ID        string `json:"id"`
				PaymentID string `json:"payment_id"`
			} `json:"entity"`
		} `json:"refund"`
	} `json:"payload"`
}

// HandleWebhook applies a signed Razorpay event. A nil error tells Razorpay to stop retrying.
func (s *service) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	if !s.gateway.WebhookSignatureValid(body, signature) {
		return ErrSignature
	}

	var event webhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("[payment] webhook: unreadable event: %v", err)
		return nil
	}

	switch event.Event {
	case "payment.authorized", "payment.captured", "order.paid":
		return s.webhookPayment(ctx, &event.Payload.Payment.Entity.GatewayPayment)
	case "payment.failed":
		entity := event.Payload.Payment.Entity
		order, err := s.repo.FindByRazorpayOrderID(ctx, entity.OrderID)
		if err != nil || order == nil {
			return err
		}
		return s.repo.SetLastFailure(ctx, order.ID, entity.ErrorDescription)
	case "refund.failed":
		order, err := s.repo.FindByRazorpayPaymentID(ctx, event.Payload.Refund.Entity.PaymentID)
		if err != nil || order == nil {
			return err
		}
		// Back in the queue, so the recovery job tries this refund again
		return s.repo.ReopenRefund(ctx, order.ID, "Razorpay reported that the refund failed")
	}
	return nil
}

func (s *service) webhookPayment(ctx context.Context, payment *GatewayPayment) error {
	if payment.OrderID == "" {
		return nil
	}
	order, err := s.repo.FindByRazorpayOrderID(ctx, payment.OrderID)
	if err != nil {
		return err
	}
	if order == nil { // Not one of ours
		return nil
	}
	if order.Status == StatusPaid && order.RazorpayPaymentID == payment.ID {
		return nil
	}
	captured, err := s.ensureCaptured(ctx, order, payment)
	if err != nil {
		if errors.Is(err, ErrNotComplete) {
			return nil
		}
		return err
	}
	_, err = s.settle(ctx, order, captured)
	return err
}

// Reconcile is the safety net behind the browser and the webhook: it finds payments that were
// taken but never recorded, and retries refunds that didn't go through.
func (s *service) Reconcile(ctx context.Context) error {
	now := time.Now()

	stale, err := s.repo.ListCreatedBefore(ctx, now.Add(-reconcileAfter), 200)
	if err != nil {
		return err
	}
	for i := range stale {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		s.reconcileOrder(ctx, &stale[i], now)
	}

	refunds, err := s.repo.ListRefundDue(ctx, 100)
	if err != nil {
		return err
	}
	for i := range refunds {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := s.ProcessRefund(ctx, refunds[i].ID); err != nil {
			log.Printf("[payment] order %s: refund retry failed: %v", refunds[i].RazorpayOrderID, err)
		}
	}
	return nil
}

func (s *service) reconcileOrder(ctx context.Context, order *Order, now time.Time) {
	payments, err := s.gateway.OrderPayments(ctx, order.RazorpayOrderID)
	if err != nil {
		log.Printf("[payment] order %s: checking payments: %v", order.RazorpayOrderID, err)
		return
	}
	for i := range payments {
		if payments[i].Status != gatewayCaptured && payments[i].Status != gatewayAuthorized {
			continue
		}
		captured, err := s.ensureCaptured(ctx, order, &payments[i])
		if err == nil {
			_, err = s.settle(ctx, order, captured)
		}
		if err != nil {
			log.Printf("[payment] order %s: recovering payment: %v", order.RazorpayOrderID, err)
		}
		return
	}
	if now.Sub(order.CreatedAt) > expireAfter {
		if err := s.repo.MarkExpired(ctx, order.ID, now); err != nil {
			log.Printf("[payment] order %s: expiring: %v", order.RazorpayOrderID, err)
		}
	}
}

func (s *service) MarkRefundDue(ctx context.Context, razorpayOrderID string, paise int64, reason string) (*Order, error) {
	order, err := s.repo.FindByRazorpayOrderID(ctx, razorpayOrderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	if paise <= 0 || paise > order.AmountPaise {
		paise = order.AmountPaise
	}
	claimed, err := s.repo.MarkRefundDue(ctx, order.ID, []Status{StatusPaid}, order.RazorpayPaymentID, paise, reason, time.Now())
	if err != nil {
		return nil, err
	}
	if !claimed {
		return nil, ErrNotRefundable
	}
	return order, nil
}

// ProcessRefund sends a queued refund to Razorpay. Checking what Razorpay has already refunded
// first means a retry after a lost response can't pay out twice.
func (s *service) ProcessRefund(ctx context.Context, orderID primitive.ObjectID) error {
	order, err := s.repo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order == nil || order.Status != StatusRefundDue {
		return nil
	}

	payment, err := s.gateway.FetchPayment(ctx, order.RazorpayPaymentID)
	if err != nil {
		_ = s.repo.SetRefundError(ctx, order.ID, err.Error())
		return err
	}
	if payment.AmountRefunded >= order.RefundPaise {
		_, err = s.repo.MarkRefunded(ctx, order.ID, "", time.Now())
		return err
	}

	refundID, err := s.gateway.Refund(ctx, order.RazorpayPaymentID, order.RefundPaise, "refund_"+order.ID.Hex())
	if err != nil {
		_ = s.repo.SetRefundError(ctx, order.ID, err.Error())
		return err
	}
	// Razorpay has accepted it. If it fails later, the refund.failed webhook reopens it.
	_, err = s.repo.MarkRefunded(ctx, order.ID, refundID, time.Now())
	return err
}

func (s *service) SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) (int64, error) {
	return s.repo.SumPaidSince(ctx, userID, purpose, since)
}

func (s *service) AdminList(ctx context.Context, query AdminOrderQuery) (*AdminOrderList, error) {
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 100 {
		query.Limit = 20
	}
	orders, total, err := s.repo.AdminList(ctx, query)
	if err != nil {
		return nil, err
	}
	items := make([]AdminOrderItem, 0, len(orders))
	for _, order := range orders {
		handlers, ok := s.handlersFor(order.Purpose)
		items = append(items, AdminOrderItem{
			Order:      order,
			Amount:     order.Amount(),
			Refundable: ok && handlers.Revoke != nil && order.Status == StatusPaid,
		})
	}
	return &AdminOrderList{
		Orders:     items,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	}, nil
}

// AdminRefund returns a whole payment to its original method and takes back what it bought.
func (s *service) AdminRefund(ctx context.Context, orderID, reason string) (*Order, error) {
	id, err := primitive.ObjectIDFromHex(orderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}
	order, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	handlers, ok := s.handlersFor(order.Purpose)
	if !ok || handlers.Revoke == nil || order.Status != StatusPaid {
		return nil, ErrNotRefundable
	}

	err = s.tx.Run(ctx, func(ctx context.Context) error {
		claimed, err := s.repo.MarkRefundDue(ctx, order.ID, []Status{StatusPaid}, order.RazorpayPaymentID, order.AmountPaise, reason, time.Now())
		if err != nil {
			return err
		}
		if !claimed {
			return ErrNotRefundable
		}
		return handlers.Revoke(ctx, order)
	})
	if err != nil {
		return nil, err
	}

	if err := s.ProcessRefund(ctx, order.ID); err != nil {
		log.Printf("[payment] order %s: refund will be retried: %v", order.RazorpayOrderID, err)
	}
	return s.repo.FindByID(ctx, order.ID)
}

// ProcessRefundByRazorpayOrder sends a queued refund for a feature that only knows the order id.
func (s *service) ProcessRefundByRazorpayOrder(ctx context.Context, razorpayOrderID string) error {
	order, err := s.repo.FindByRazorpayOrderID(ctx, razorpayOrderID)
	if err != nil || order == nil {
		return err
	}
	return s.ProcessRefund(ctx, order.ID)
}
