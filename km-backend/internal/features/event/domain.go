package event

import (
	"context"
	"time"

	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Event struct {
	ID             primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Title          string               `bson:"title" json:"title"`
	Organizer      string               `bson:"organizer" json:"organizer"`
	Description    string               `bson:"description" json:"description"`
	Date           string               `bson:"date" json:"date"`
	Time           string               `bson:"time" json:"time"`
	Location       string               `bson:"location" json:"location"`
	ImageURL       string               `bson:"image_url,omitempty" json:"image_url,omitempty"`
	Category       string               `bson:"category,omitempty" json:"category,omitempty"`
	IsPaid         bool                 `bson:"is_paid" json:"is_paid"`
	Price          float64              `bson:"price" json:"price"`                         // In INR (0 if free)
	Currency       string               `bson:"currency,omitempty" json:"currency,omitempty"` // default "INR"
	Capacity       int                  `bson:"capacity,omitempty" json:"capacity,omitempty"` // Max seats (0 = unlimited)
	AvailableSeats int                  `bson:"available_seats,omitempty" json:"available_seats,omitempty"`
	Participants   []primitive.ObjectID `bson:"participants" json:"participants"`
	CreatedAt      time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time            `bson:"updated_at,omitempty" json:"updated_at,omitempty"`
}

type EventTicket struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TicketNumber      string             `bson:"ticket_number" json:"ticket_number"` // e.g. TKT-EVT-XXXXXX
	EventID           primitive.ObjectID `bson:"event_id" json:"event_id"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	AttendeeName      string             `bson:"attendee_name" json:"attendee_name"`
	AttendeeEmail     string             `bson:"attendee_email" json:"attendee_email"`
	AttendeePhone     string             `bson:"attendee_phone,omitempty" json:"attendee_phone,omitempty"`
	Amount            float64            `bson:"amount" json:"amount"`
	PaymentStatus     string             `bson:"payment_status" json:"payment_status"` // "free", "paid", "refunded"
	PaymentMethod     string             `bson:"payment_method" json:"payment_method"` // "free", "razorpay", "wallet"
	RazorpayOrderID   string             `bson:"razorpay_order_id,omitempty" json:"razorpay_order_id,omitempty"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id,omitempty" json:"razorpay_payment_id,omitempty"`
	Status            string             `bson:"status" json:"status"` // "confirmed", "cancelled"
	QRCodeData        string             `bson:"qr_code_data" json:"qr_code_data"`
	EventTitle        string             `bson:"event_title,omitempty" json:"event_title,omitempty"`
	EventDate         string             `bson:"event_date,omitempty" json:"event_date,omitempty"`
	EventTime         string             `bson:"event_time,omitempty" json:"event_time,omitempty"`
	EventLocation     string             `bson:"event_location,omitempty" json:"event_location,omitempty"`
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
}

type EventFilter struct {
	Search   string
	Location string
	Sort     string
	IsPaid   *bool
	Page     int
	Limit    int
}

type CreateEventOrderRequest struct {
	AttendeeName  string `json:"attendee_name" validate:"required"`
	AttendeeEmail string `json:"attendee_email" validate:"required"`
	AttendeePhone string `json:"attendee_phone"`
}

type CreateEventOrderResponse struct {
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	AmountPaise int64   `json:"amount_paise"`
	Currency    string  `json:"currency"`
	KeyID       string  `json:"key_id"`
	EventTitle  string  `json:"event_title"`
}

type VerifyEventPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id" validate:"required"`
	RazorpayPaymentID string `json:"razorpay_payment_id" validate:"required"`
	RazorpaySignature string `json:"razorpay_signature" validate:"required"`
	AttendeeName      string `json:"attendee_name"`
	AttendeeEmail     string `json:"attendee_email"`
	AttendeePhone     string `json:"attendee_phone"`
}

type EventWalletCheckoutRequest struct {
	AttendeeName  string `json:"attendee_name" validate:"required"`
	AttendeeEmail string `json:"attendee_email" validate:"required"`
	AttendeePhone string `json:"attendee_phone"`
}

type EventTicketResponse struct {
	Ticket EventTicket `json:"ticket"`
	Event  Event       `json:"event"`
}

type EventRepository interface {
	CreateEvent(ctx context.Context, e *Event) (*Event, error)
	GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error)
	GetEventByID(ctx context.Context, id primitive.ObjectID) (*Event, error)
	RegisterUser(ctx context.Context, eventID, userID primitive.ObjectID) error

	// Ticket & Registration operations (F63)
	CreateTicket(ctx context.Context, ticket *EventTicket) (*EventTicket, error)
	GetTicketByID(ctx context.Context, id primitive.ObjectID) (*EventTicket, error)
	GetTicketByEventAndUser(ctx context.Context, eventID, userID primitive.ObjectID) (*EventTicket, error)
	GetTicketsByUser(ctx context.Context, userID primitive.ObjectID) ([]EventTicket, error)
	GetTicketsByEvent(ctx context.Context, eventID primitive.ObjectID) ([]EventTicket, error)
	DecrementAvailableSeats(ctx context.Context, eventID primitive.ObjectID) error
}

type EventService interface {
	CreateEvent(ctx context.Context, e *Event) (*Event, error)
	GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error)
	GetEventByID(ctx context.Context, id string) (*Event, error)
	RegisterUser(ctx context.Context, eventID, userID string) error

	// Paid Ticket & Checkout operations for F63
	CreateEventOrder(ctx context.Context, userID string, eventID string, req CreateEventOrderRequest) (*CreateEventOrderResponse, error)
	VerifyEventPayment(ctx context.Context, userID string, eventID string, req VerifyEventPaymentRequest) (*EventTicket, error)
	BookTicketWithWallet(ctx context.Context, userID string, eventID string, req EventWalletCheckoutRequest) (*EventTicket, *wallet.WalletSummaryResponse, error)
	GetMyTickets(ctx context.Context, userID string) ([]EventTicket, error)
	GetEventTicket(ctx context.Context, userID string, eventID string) (*EventTicket, error)
}
