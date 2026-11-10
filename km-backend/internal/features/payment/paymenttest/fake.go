// Package paymenttest is an in-memory payment.Service for testing the features that sell things.
package paymenttest

import (
	"context"
	"errors"
	"fmt"
	"time"

	"km-backend/internal/features/payment"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Fake settles orders by running the registered handlers directly, without Razorpay.
type Fake struct {
	payment.Service
	Handlers map[payment.Purpose]payment.Handlers
	Orders   map[string]*payment.Order
	Refunds  []string
	nextID   int
}

func New() *Fake {
	return &Fake{Handlers: map[payment.Purpose]payment.Handlers{}, Orders: map[string]*payment.Order{}}
}

func (f *Fake) Register(purpose payment.Purpose, handlers payment.Handlers) {
	f.Handlers[purpose] = handlers
}

func (f *Fake) CreateOrder(ctx context.Context, input payment.CreateOrderInput) (*payment.Checkout, *payment.Order, error) {
	f.nextID++
	id := fmt.Sprintf("order_test_%d", f.nextID)
	order := &payment.Order{
		ID:              primitive.NewObjectID(),
		RazorpayOrderID: id,
		UserID:          input.UserID,
		Purpose:         input.Purpose,
		AmountPaise:     input.AmountPaise,
		Currency:        payment.CurrencyINR,
		TargetID:        input.TargetID,
		Details:         input.Details,
		Status:          payment.StatusCreated,
		CreatedAt:       time.Now(),
	}
	f.Orders[id] = order
	return &payment.Checkout{
		OrderID:     id,
		Amount:      order.Amount(),
		AmountPaise: input.AmountPaise,
		Currency:    payment.CurrencyINR,
		KeyID:       "rzp_test_fake",
	}, order, nil
}

// Confirm mirrors the real rules: owner and purpose must match, and an order settles once.
func (f *Fake) Confirm(ctx context.Context, userID primitive.ObjectID, purpose payment.Purpose, input payment.ConfirmInput) (*payment.Order, error) {
	order, ok := f.Orders[input.RazorpayOrderID]
	if !ok || order.UserID != userID || order.Purpose != purpose {
		return nil, payment.ErrOrderNotFound
	}
	if order.Status == payment.StatusPaid {
		return order, nil
	}
	order.RazorpayPaymentID = input.RazorpayPaymentID
	err := f.Handlers[purpose].Fulfill(ctx, order)
	var unfulfillable *payment.UnfulfillableError
	if errors.As(err, &unfulfillable) {
		order.Status = payment.StatusRefundDue
		return order, payment.ErrRefunding
	}
	if err != nil {
		return nil, err
	}
	order.Status = payment.StatusPaid
	return order, nil
}

func (f *Fake) MarkRefundDue(ctx context.Context, razorpayOrderID string, paise int64, reason string) (*payment.Order, error) {
	order, ok := f.Orders[razorpayOrderID]
	if !ok {
		return nil, payment.ErrOrderNotFound
	}
	order.Status = payment.StatusRefundDue
	order.RefundPaise = paise
	f.Refunds = append(f.Refunds, razorpayOrderID)
	return order, nil
}

func (f *Fake) ProcessRefundByRazorpayOrder(ctx context.Context, razorpayOrderID string) error {
	return nil
}

func (f *Fake) SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose payment.Purpose, since time.Time) (int64, error) {
	var total int64
	for _, order := range f.Orders {
		if order.UserID == userID && order.Purpose == purpose && order.Status == payment.StatusPaid {
			total += order.AmountPaise
		}
	}
	return total, nil
}
