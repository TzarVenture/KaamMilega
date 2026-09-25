package wallet

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Transaction enums
type TransactionType string
type TargetBalance string
type TransactionCategory string
type TransactionStatus string

const (
	TypeCredit TransactionType = "credit"
	TypeDebit  TransactionType = "debit"

	BalanceMain     TargetBalance = "main"
	BalanceEarnings TargetBalance = "earnings"
	BalanceLocked   TargetBalance = "locked"
	BalanceBonus    TargetBalance = "bonus"

	CategoryTopup          TransactionCategory = "topup"
	CategoryPassPurchase   TransactionCategory = "pass_purchase"
	CategorySessionBooking TransactionCategory = "session_booking"
	CategorySessionPayout  TransactionCategory = "session_payout"
	CategoryGigPayout      TransactionCategory = "gig_payout"
	CategoryWithdrawal     TransactionCategory = "withdrawal"
	CategoryBonusReward    TransactionCategory = "bonus_reward"
	CategoryRefund         TransactionCategory = "refund"
	CategorySubscription   TransactionCategory = "subscription"

	StatusCompleted TransactionStatus = "completed"
	StatusPending   TransactionStatus = "pending"
	StatusFailed    TransactionStatus = "failed"
	StatusReversed  TransactionStatus = "reversed"
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

// WalletTransaction represents an immutable financial ledger entry in MongoDB
type WalletTransaction struct {
	ID            primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	WalletID      primitive.ObjectID     `bson:"wallet_id" json:"wallet_id"`
	UserID        primitive.ObjectID     `bson:"user_id" json:"user_id"`
	Type          TransactionType        `bson:"type" json:"type"`                     // "credit" or "debit"
	TargetBalance TargetBalance          `bson:"target_balance" json:"target_balance"` // "main", "earnings", "locked", "bonus"
	Category      TransactionCategory    `bson:"category" json:"category"`             // "topup", "pass_purchase", etc.
	Amount        float64                `bson:"amount" json:"amount"`
	BalanceAfter  float64                `bson:"balance_after" json:"balance_after"`
	Status        TransactionStatus      `bson:"status" json:"status"`
	ReferenceID   string                 `bson:"reference_id,omitempty" json:"reference_id,omitempty"`
	Description   string                 `bson:"description" json:"description"`
	Metadata      map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"`
	CreatedAt     time.Time              `bson:"created_at" json:"created_at"`
}

// TransactionItemResponse represents a formatted ledger row for frontend display
type TransactionItemResponse struct {
	ID            string                 `json:"id"`
	WalletID      string                 `json:"wallet_id"`
	Type          TransactionType        `json:"type"`
	TargetBalance TargetBalance          `json:"target_balance"`
	Category      TransactionCategory    `json:"category"`
	Amount        float64                `json:"amount"`
	BalanceAfter  float64                `json:"balance_after"`
	Status        TransactionStatus      `json:"status"`
	ReferenceID   string                 `json:"reference_id,omitempty"`
	Description   string                 `json:"description"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
}

// TransactionQuery provides pagination and filtering options
type TransactionQuery struct {
	Page          int                 `json:"page"`
	Limit         int                 `json:"limit"`
	Type          TransactionType     `json:"type,omitempty"`
	Category      TransactionCategory `json:"category,omitempty"`
	TargetBalance TargetBalance       `json:"target_balance,omitempty"`
}

// TransactionListResponse represents the paginated response for transactions
type TransactionListResponse struct {
	Transactions []TransactionItemResponse `json:"transactions"`
	Total        int64                     `json:"total"`
	Page         int                       `json:"page"`
	Limit        int                       `json:"limit"`
	TotalPages   int                       `json:"total_pages"`
}

// RecordTransactionInput provides input for recording an atomic transaction
type RecordTransactionInput struct {
	UserID        primitive.ObjectID
	Type          TransactionType
	TargetBalance TargetBalance
	Category      TransactionCategory
	Amount        float64
	ReferenceID   string
	Description   string
	Metadata      map[string]interface{}
}

// CreateTopupOrderRequest represents client input for initiating a recharge
type CreateTopupOrderRequest struct {
	Amount float64 `json:"amount"` // in INR (e.g. 100, 500)
}

// CreateTopupOrderResponse represents the generated Razorpay order details returned to client
type CreateTopupOrderResponse struct {
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`       // in INR
	AmountPaise int64   `json:"amount_paise"` // in paise (e.g. 50000)
	Currency    string  `json:"currency"`     // "INR"
	KeyID       string  `json:"key_id"`       // Razorpay Key ID for client checkout
}

// VerifyTopupPaymentRequest represents the client payload after Razorpay checkout finishes
type VerifyTopupPaymentRequest struct {
	RazorpayOrderID   string  `json:"razorpay_order_id"`
	RazorpayPaymentID string  `json:"razorpay_payment_id"`
	RazorpaySignature string  `json:"razorpay_signature"`
	Amount            float64 `json:"amount"` // in INR
}

// WithdrawalRequest represents input for requesting an earnings payout (F71)
type WithdrawalRequest struct {
	Amount        float64 `json:"amount"`         // in INR (e.g. 500)
	PayoutMethod  string  `json:"payout_method"`  // "bank" or "upi"
	AccountHolder string  `json:"account_holder"` // Name on bank account / UPI
	AccountNumber string  `json:"account_number"` // Bank account number
	IFSCCode      string  `json:"ifsc_code"`      // Bank IFSC code
	BankName      string  `json:"bank_name"`      // Bank name
	UPIID         string  `json:"upi_id"`         // VPA / UPI ID (e.g. name@upi)
	PhoneNumber   string  `json:"phone_number"`   // Contact phone for verification
}

// WithdrawalResponse represents response after withdrawal request is submitted
type WithdrawalResponse struct {
	Transaction *TransactionItemResponse `json:"transaction"`
	Wallet      *WalletSummaryResponse   `json:"wallet"`
	Message     string                   `json:"message"`
}

