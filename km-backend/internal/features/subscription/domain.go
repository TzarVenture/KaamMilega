package subscription

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	PlanMonthly = "monthly"
	PlanYearly  = "yearly"

	StatusActive    = "active"
	StatusExpired   = "expired"
	StatusCancelled = "cancelled"

	MonthlyPrice = 499.00
	YearlyPrice  = 4499.00
)

type PlanDetails struct {
	PlanType       string   `json:"plan_type"`
	Name           string   `json:"name"`
	Price          float64  `json:"price"`
	DurationDays   int      `json:"duration_days"`
	SavingsPercent int      `json:"savings_percent"`
	Description    string   `json:"description"`
	Perks          []string `json:"perks"`
}

type ExpertSubscription struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	PlanType          string             `bson:"plan_type" json:"plan_type"` // "monthly", "yearly"
	Amount            float64            `bson:"amount" json:"amount"`
	PaymentMethod     string             `bson:"payment_method" json:"payment_method"` // "razorpay", "wallet"
	PaymentStatus     string             `bson:"payment_status" json:"payment_status"` // "paid", "pending"
	Status            string             `bson:"status" json:"status"`                 // "active", "expired"
	RazorpayOrderID   string             `bson:"razorpay_order_id,omitempty" json:"razorpay_order_id,omitempty"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id,omitempty" json:"razorpay_payment_id,omitempty"`
	StartsAt          time.Time          `bson:"starts_at" json:"starts_at"`
	ExpiresAt         time.Time          `bson:"expires_at" json:"expires_at"`
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`
}

type CreateSubscriptionOrderRequest struct {
	PlanType string `json:"plan_type" validate:"required"`
}

type CreateSubscriptionOrderResponse struct {
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	AmountPaise int64   `json:"amount_paise"`
	Currency    string  `json:"currency"`
	KeyID       string  `json:"key_id"`
	PlanType    string  `json:"plan_type"`
	PlanName    string  `json:"plan_name"`
}

type VerifySubscriptionPaymentRequest struct {
	PlanType          string `json:"plan_type" validate:"required"`
	RazorpayOrderID   string `json:"razorpay_order_id" validate:"required"`
	RazorpayPaymentID string `json:"razorpay_payment_id" validate:"required"`
	RazorpaySignature string `json:"razorpay_signature" validate:"required"`
}

type SubscribeWithWalletRequest struct {
	PlanType string `json:"plan_type" validate:"required"`
}

type SubscriptionStatusResponse struct {
	IsActive      bool                `json:"is_active"`
	Subscription  *ExpertSubscription `json:"subscription,omitempty"`
	DaysRemaining int                 `json:"days_remaining"`
	PlanType      string              `json:"plan_type,omitempty"`
	ExpiresAt     *time.Time          `json:"expires_at,omitempty"`
}
