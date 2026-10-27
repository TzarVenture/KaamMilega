package app_waitlist

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// People who asked to be told when the KaamMilega mobile app launches (InstantMilega runs in the
// app only: it needs live location). One entry per mobile number; signing up again updates it.
type Entry struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Mobile    string             `bson:"mobile" json:"mobile"`
	Interest  string             `bson:"interest" json:"interest"` // "hire" or "work"
	Trade     string             `bson:"trade,omitempty" json:"trade,omitempty"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type JoinRequest struct {
	Mobile   string `json:"mobile"`
	Interest string `json:"interest"`
	Trade    string `json:"trade"`
}

var (
	ErrInvalidMobile   = errors.New("Enter a valid 10-digit mobile number")
	ErrInvalidInterest = errors.New("Choose whether you want to hire or work")
)

var indianMobile = regexp.MustCompile(`^[6-9][0-9]{9}$`)

const maxTradeLength = 60

// Normalize validates a request and returns the entry to store. Accepts "+91 98765 43210" style
// input; stores the bare 10 digits.
func (r JoinRequest) Normalize() (*Entry, error) {
	digits := strings.Map(func(c rune) rune {
		if c >= '0' && c <= '9' {
			return c
		}
		return -1
	}, r.Mobile)
	if len(digits) == 12 && strings.HasPrefix(digits, "91") {
		digits = digits[2:]
	}
	if !indianMobile.MatchString(digits) {
		return nil, ErrInvalidMobile
	}
	interest := strings.ToLower(strings.TrimSpace(r.Interest))
	if interest != "hire" && interest != "work" {
		return nil, ErrInvalidInterest
	}
	trade := strings.TrimSpace(r.Trade)
	if len([]rune(trade)) > maxTradeLength {
		trade = string([]rune(trade)[:maxTradeLength])
	}
	return &Entry{Mobile: digits, Interest: interest, Trade: trade}, nil
}

type Repository interface {
	Upsert(ctx context.Context, e *Entry) error
	List(ctx context.Context, interest string, limit, skip int64) ([]*Entry, int64, error)
}
