package wallet

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Wallet represents the multi-type user balance ledger document
type Wallet struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID `bson:"user_id" json:"user_id"`
	MainBalance     float64            `bson:"main_balance" json:"main_balance"`         // Funds deposited for passes, jobs, bookings
	EarningsBalance float64            `bson:"earnings_balance" json:"earnings_balance"` // Funds earned by experts (withdrawable)
	LockedBalance   float64            `bson:"locked_balance" json:"locked_balance"`     // Escrow funds held during active mentorships/tasks
	BonusBalance    float64            `bson:"bonus_balance" json:"bonus_balance"`       // Promotional reward credits (non-withdrawable)
	Currency        string             `bson:"currency" json:"currency"`                 // e.g. "INR"
	Status          string             `bson:"status" json:"status"`                     // "active", "suspended", "frozen"
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

// WalletSummaryResponse represents the formatted response for the frontend wallet dashboard
type WalletSummaryResponse struct {
	WalletID            string    `json:"wallet_id"`
	UserID              string    `json:"user_id"`
	TotalBalance        float64   `json:"total_balance"`        // Main + Earnings + Bonus
	WithdrawableBalance float64   `json:"withdrawable_balance"` // Only Earnings
	MainBalance         float64   `json:"main_balance"`
	EarningsBalance     float64   `json:"earnings_balance"`
	LockedBalance       float64   `json:"locked_balance"`
	BonusBalance        float64   `json:"bonus_balance"`
	Currency            string    `json:"currency"`
	Status              string    `json:"status"`
	UpdatedAt           time.Time `json:"updated_at"`
}
