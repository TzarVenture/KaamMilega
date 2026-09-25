package mentorship

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Mentorship struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ExpertID    primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Category    string             `bson:"category" json:"category"`
	Duration    int                `bson:"duration" json:"duration"` // Duration in minutes
	Price       float64            `bson:"price" json:"price"`
	Rating      float64            `bson:"rating,omitempty" json:"rating,omitempty"`
	Reviews     int                `bson:"reviews,omitempty" json:"reviews,omitempty"`
	Status      string             `bson:"status" json:"status"` // "active", "inactive"
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type Booking struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	MentorshipID      primitive.ObjectID `bson:"mentorship_id" json:"mentorship_id"`
	ExpertID          primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	ScheduledAt       time.Time          `bson:"scheduled_at" json:"scheduled_at"`
	Status            string             `bson:"status" json:"status"` // "pending", "confirmed", "cancelled", "completed"
	Amount            float64            `bson:"amount" json:"amount"`
	PaymentStatus     string             `bson:"payment_status" json:"payment_status"` // "pending", "paid", "refunded"
	PaymentMethod     string             `bson:"payment_method,omitempty" json:"payment_method,omitempty"` // "wallet", "razorpay"
	RazorpayOrderID   string             `bson:"razorpay_order_id,omitempty" json:"razorpay_order_id,omitempty"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id,omitempty" json:"razorpay_payment_id,omitempty"`
	MeetingLink       string             `bson:"meeting_link,omitempty" json:"meeting_link,omitempty"`
	Notes             string             `bson:"notes,omitempty" json:"notes,omitempty"`
	Rating            float64            `bson:"rating,omitempty" json:"rating,omitempty"`
	Review            string             `bson:"review,omitempty" json:"review,omitempty"`
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`

	// Enriched fields for Expert and Mentee views
	MentorshipTitle   string             `bson:"mentorship_title,omitempty" json:"mentorship_title,omitempty"`
	MenteeName        string             `bson:"mentee_name,omitempty" json:"mentee_name,omitempty"`
	MenteeEmail       string             `bson:"mentee_email,omitempty" json:"mentee_email,omitempty"`
	ExpertName        string             `bson:"expert_name,omitempty" json:"expert_name,omitempty"`
	ExpertHeadline    string             `bson:"expert_headline,omitempty" json:"expert_headline,omitempty"`
	ExpertImage       string             `bson:"expert_image,omitempty" json:"expert_image,omitempty"`
}

type Availability struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ExpertID  primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	DayOfWeek int                `bson:"day_of_week" json:"day_of_week"` // 0 for Sunday, 1 for Monday, etc.
	StartTime string             `bson:"start_time" json:"start_time"`   // "09:00"
	EndTime   string             `bson:"end_time" json:"end_time"`       // "17:00"
	IsActive  bool               `bson:"is_active" json:"is_active"`
}

type MentorshipDetail struct {
	Mentorship Mentorship `json:"mentorship"`
	Expert     ExpertInfo `json:"expert"`
}

type ExpertInfo struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Headline     string  `json:"headline"`
	ProfileImage string  `json:"profile_image"`
	Bio          string  `json:"bio"`
	Rating       float64 `json:"rating"`
}

type CreateMentorshipRequest struct {
	Title       string  `json:"title" validate:"required"`
	Description string  `json:"description" validate:"required"`
	Category    string  `json:"category" validate:"required"`
	Duration    int     `json:"duration" validate:"required"`
	Price       float64 `json:"price" validate:"required"`
}

type BookMentorshipRequest struct {
	MentorshipID string    `json:"mentorship_id" validate:"required"`
	ScheduledAt  time.Time `json:"scheduled_at" validate:"required"`
	Notes        string    `json:"notes"`
}

type AvailabilityRequest struct {
	DayOfWeek int    `json:"day_of_week" validate:"required"`
	StartTime string `json:"start_time" validate:"required"`
	EndTime   string `json:"end_time" validate:"required"`
}

// Payment & Checkout Request/Response Types for F76

type BookWithWalletRequest struct {
	MentorshipID string    `json:"mentorship_id" validate:"required"`
	ScheduledAt  time.Time `json:"scheduled_at" validate:"required"`
	Notes        string    `json:"notes"`
}

type CreateMentorshipOrderRequest struct {
	MentorshipID string    `json:"mentorship_id" validate:"required"`
	ScheduledAt  time.Time `json:"scheduled_at" validate:"required"`
	Notes        string    `json:"notes"`
}

type CreateMentorshipOrderResponse struct {
	BookingID   string  `json:"booking_id"`
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`       // in INR
	AmountPaise int64   `json:"amount_paise"` // in paise
	Currency    string  `json:"currency"`     // "INR"
	KeyID       string  `json:"key_id"`
}

type VerifyMentorshipPaymentRequest struct {
	BookingID         string `json:"booking_id" validate:"required"`
	RazorpayOrderID   string `json:"razorpay_order_id" validate:"required"`
	RazorpayPaymentID string `json:"razorpay_payment_id" validate:"required"`
	RazorpaySignature string `json:"razorpay_signature" validate:"required"`
}

type SubmitBookingReviewRequest struct {
	Rating float64 `json:"rating" validate:"required,min=1,max=5"`
	Review string  `json:"review"`
}
