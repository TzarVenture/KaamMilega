// Package payment owns every Razorpay payment. A feature creates an order here (amount and
// purpose decided on the server), and registers Handlers that deliver what was paid for. An order
// is settled exactly once, whichever arrives first: the browser callback, the Razorpay webhook or
// the recovery job.
package payment

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Purpose string

const (
	PurposeWalletTopup       Purpose = "wallet_topup"
	PurposeEventTicket       Purpose = "event_ticket"
	PurposeMentorshipBooking Purpose = "mentorship_booking"
	PurposeSubscription      Purpose = "subscription"
	PurposeInstantPass       Purpose = "instant_pass"
)

type Status string

const (
	StatusCreated   Status = "created"    // Waiting for the customer to pay
	StatusPaid      Status = "paid"       // Money received and the item delivered
	StatusExpired   Status = "expired"    // Never paid
	StatusRefundDue Status = "refund_due" // Must go back to the original payment method
	StatusRefunded  Status = "refunded"
)

const CurrencyINR = "INR"

// Order is the server's record of one Razorpay order.
type Order struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RazorpayOrderID   string             `bson:"razorpay_order_id" json:"razorpay_order_id"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id,omitempty" json:"razorpay_payment_id,omitempty"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	Purpose           Purpose            `bson:"purpose" json:"purpose"`
	AmountPaise       int64              `bson:"amount_paise" json:"amount_paise"`
	Currency          string             `bson:"currency" json:"currency"`
	TargetID          string             `bson:"target_id,omitempty" json:"target_id,omitempty"` // The ticket, booking or plan paid for
	Details           map[string]string  `bson:"details,omitempty" json:"details,omitempty"`     // What the feature needs in order to deliver
	Description       string             `bson:"description,omitempty" json:"description,omitempty"`
	Status            Status             `bson:"status" json:"status"`
	LastFailure       string             `bson:"last_failure,omitempty" json:"last_failure,omitempty"`
	RefundPaise       int64              `bson:"refund_paise,omitempty" json:"refund_paise,omitempty"`
	RefundReason      string             `bson:"refund_reason,omitempty" json:"refund_reason,omitempty"`
	RefundID          string             `bson:"refund_id,omitempty" json:"refund_id,omitempty"`
	RefundError       string             `bson:"refund_error,omitempty" json:"refund_error,omitempty"`
	PaidAt            *time.Time         `bson:"paid_at,omitempty" json:"paid_at,omitempty"`
	RefundedAt        *time.Time         `bson:"refunded_at,omitempty" json:"refunded_at,omitempty"`
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`
}

// Amount is the order total in rupees.
func (o *Order) Amount() float64 { return money.ToRupees(o.AmountPaise) }

// CreateOrderInput describes a payment the server has already priced.
type CreateOrderInput struct {
	UserID      primitive.ObjectID
	Purpose     Purpose
	AmountPaise int64
	TargetID    string
	Details     map[string]string
	Description string
}

// Checkout is what the browser needs to open Razorpay.
type Checkout struct {
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	AmountPaise int64   `json:"amount_paise"`
	Currency    string  `json:"currency"`
	KeyID       string  `json:"key_id"`
}

// ConfirmInput is the signed result the Razorpay checkout hands to the browser.
type ConfirmInput struct {
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}

// OrderStatusResponse tells the browser where a payment stands.
type OrderStatusResponse struct {
	OrderID  string  `json:"order_id"`
	Purpose  Purpose `json:"purpose"`
	Status   Status  `json:"status"`
	Amount   float64 `json:"amount"`
	TargetID string  `json:"target_id,omitempty"`
}

// Handlers is how a feature plugs into settlement.
type Handlers struct {
	// Fulfill delivers the item. It runs inside the settlement transaction, so it must only touch
	// the database and must use the ctx it is given. Return Unfulfillable when the item can no
	// longer be delivered (sold out, say): the payment is then refunded automatically.
	Fulfill func(ctx context.Context, order *Order) error
	// AfterPaid runs once after the money is safely recorded. For emails and notifications.
	AfterPaid func(order *Order)
	// Revoke takes back the item when an admin refunds it. It runs in the refund transaction.
	// Purposes without Revoke can't be refunded from the admin panel.
	Revoke func(ctx context.Context, order *Order) error
}

// UnfulfillableError means the money arrived but the item can't be delivered.
type UnfulfillableError struct{ Reason string }

func (e *UnfulfillableError) Error() string { return e.Reason }

// Unfulfillable makes the error a Fulfill handler returns to have the payment refunded.
func Unfulfillable(reason string) error { return &UnfulfillableError{Reason: reason} }

// AdminOrderQuery filters the admin payment list.
type AdminOrderQuery struct {
	Page    int
	Limit   int
	Status  Status
	Purpose Purpose
	Search  string // Razorpay order or payment id
}

// AdminOrderList is one page of payment orders.
type AdminOrderList struct {
	Orders     []AdminOrderItem `json:"orders"`
	Total      int64            `json:"total"`
	Page       int              `json:"page"`
	Limit      int              `json:"limit"`
	TotalPages int              `json:"total_pages"`
}

// AdminOrderItem is an order with its amounts in rupees.
type AdminOrderItem struct {
	Order
	Amount     float64 `json:"amount"`
	Refundable bool    `json:"refundable"`
}

var (
	ErrNotConfigured = apperr.New("PAYMENT_NOT_CONFIGURED", "online payments are not available right now")
	ErrGateway       = apperr.New("PAYMENT_GATEWAY_ERROR", "the payment service is not responding, please try again")
	ErrOrderNotFound = apperr.New("PAYMENT_ORDER_NOT_FOUND", "this payment could not be found")
	ErrSignature     = apperr.New("PAYMENT_SIGNATURE_INVALID", "this payment could not be verified")
	ErrNotComplete   = apperr.New("PAYMENT_NOT_COMPLETE", "this payment has not completed yet")
	ErrRefunding     = apperr.New("PAYMENT_REFUNDING", "we could not complete this purchase, so your payment is being refunded to the original method")
	ErrNotRefundable = apperr.New("PAYMENT_NOT_REFUNDABLE", "this payment can't be refunded from here")

	errUnknownPurpose = errors.New("payment: no handlers registered for this purpose")
)
