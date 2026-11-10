package wallet

import (
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"

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
	CategoryEventTicket    TransactionCategory = "event_ticket"

	StatusCompleted TransactionStatus = "completed"
	StatusPending   TransactionStatus = "pending"
	StatusFailed    TransactionStatus = "failed"
	StatusReversed  TransactionStatus = "reversed"

	WalletActive    = "active"
	WalletFrozen    = "frozen"
	WalletSuspended = "suspended"
	WalletClosed    = "closed"
)

// Limits on money moving in and out of a wallet.
const (
	MinTopupPaise       int64 = 100_00
	MaxTopupPaise       int64 = 50_000_00
	MaxDailyTopupPaise  int64 = 1_00_000_00
	MaxMainBalancePaise int64 = 2_00_000_00

	MinWithdrawalPaise      int64 = 100_00
	MaxDailyWithdrawalPaise int64 = 25_000_00

	// How long after a purchase it can still be disputed
	DisputeWindow = 30 * 24 * time.Hour
)

var (
	ErrInsufficient       = apperr.New("WALLET_INSUFFICIENT", "insufficient balance for transaction")
	ErrFrozen             = apperr.New("WALLET_FROZEN", "this wallet is on hold, please contact support")
	ErrClosed             = apperr.New("WALLET_CLOSED", "this wallet is closed")
	ErrReferenceConflict  = apperr.New("WALLET_REFERENCE_CONFLICT", "this transaction reference has already been used")
	ErrEarningsLow        = apperr.New("EARNINGS_INSUFFICIENT", "you don't have enough earnings to withdraw this amount")
	ErrKYCRequired        = apperr.New("WITHDRAWAL_KYC_REQUIRED", "your KYC must be approved before you can withdraw")
	ErrWithdrawalOpen     = apperr.New("WITHDRAWAL_ALREADY_OPEN", "you already have a withdrawal in progress")
	ErrWithdrawalNotFound = apperr.New("WITHDRAWAL_NOT_FOUND", "withdrawal not found")
	ErrWithdrawalState    = apperr.New("WITHDRAWAL_INVALID_STATE", "this withdrawal has already moved on, please refresh")
	ErrPayoutChanged      = apperr.New("WITHDRAWAL_ACCOUNT_CHANGED", "the payout account changed after this request, mark it as failed")
	ErrDisputeNotEligible = apperr.New("DISPUTE_NOT_ELIGIBLE", "this transaction can't be disputed")
	ErrDisputeExpired     = apperr.New("DISPUTE_WINDOW_CLOSED", "the time to dispute this transaction has passed")
	ErrDisputeExists      = apperr.New("DISPUTE_ALREADY_FILED", "a dispute has already been filed for this transaction")
	ErrDisputeResolved    = apperr.New("DISPUTE_ALREADY_RESOLVED", "this dispute has already been resolved")
	ErrRefundTooLarge     = apperr.New("DISPUTE_REFUND_TOO_LARGE", "the refund can't be more than the amount spent")
	ErrWalletNotFound     = apperr.New("WALLET_NOT_FOUND", "no wallet found for this user")
)

// Wallet holds a user's balances in whole paise. The API reports rupees.
type Wallet struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"user_id"`
	MainPaise     int64              `bson:"main_paise" json:"-"`     // Money added by the user, spendable but not withdrawable
	EarningsPaise int64              `bson:"earnings_paise" json:"-"` // Money earned, withdrawable
	LockedPaise   int64              `bson:"locked_paise" json:"-"`   // Held for sessions that haven't finished
	BonusPaise    int64              `bson:"bonus_paise" json:"-"`    // Promotional credits
	Currency      string             `bson:"currency" json:"currency"`
	Status        string             `bson:"status" json:"status"` // active, frozen, suspended, closed
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
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

// WalletTransaction is one entry in the ledger. Every balance change has exactly one.
type WalletTransaction struct {
	ID                primitive.ObjectID     `bson:"_id,omitempty"`
	WalletID          primitive.ObjectID     `bson:"wallet_id"`
	UserID            primitive.ObjectID     `bson:"user_id"`
	Type              TransactionType        `bson:"type"`           // "credit" or "debit"
	TargetBalance     TargetBalance          `bson:"target_balance"` // "main", "earnings", "locked", "bonus"
	Category          TransactionCategory    `bson:"category"`
	AmountPaise       int64                  `bson:"amount_paise"`
	BalanceAfterPaise int64                  `bson:"balance_after_paise"`
	Status            TransactionStatus      `bson:"status"`
	ReferenceID       string                 `bson:"reference_id"`
	Description       string                 `bson:"description"`
	Metadata          map[string]interface{} `bson:"metadata,omitempty"`
	CreatedAt         time.Time              `bson:"created_at"`
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
	Disputable    bool                   `json:"disputable"`
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

// RecordTransactionInput describes one ledger posting. Amount is in rupees and converted once,
// here at the edge. ReferenceID is required and must be stable for the action it describes:
// posting the same reference twice changes the balance only once.
type RecordTransactionInput struct {
	UserID        primitive.ObjectID
	Type          TransactionType
	TargetBalance TargetBalance
	Category      TransactionCategory
	Amount        float64
	ReferenceID   string
	Description   string
	Metadata      map[string]interface{}
	Status        TransactionStatus // Defaults to completed
}

// Paise is the posting amount in paise.
func (in RecordTransactionInput) Paise() int64 { return money.ToPaise(in.Amount) }

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

// VerifyTopupPaymentRequest is the signed result of the Razorpay checkout. The amount credited
// is always the one saved when the order was created.
type VerifyTopupPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}

// WithdrawalStatus is where a payout stands.
type WithdrawalStatus string

const (
	WithdrawalRequested  WithdrawalStatus = "requested"  // Waiting for an admin
	WithdrawalProcessing WithdrawalStatus = "processing" // Being sent to the bank
	WithdrawalPaid       WithdrawalStatus = "paid"       // Bank confirmed
	WithdrawalFailed     WithdrawalStatus = "failed"     // Money returned to earnings
)

// WithdrawalRequest asks for a payout to the user's own KYC-approved account.
type WithdrawalRequest struct {
	Amount float64 `json:"amount"` // in INR
}

// Withdrawal is one payout. Only the masked account is stored here; the full number stays in the
// user's KYC record.
type Withdrawal struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"user_id"`
	AmountPaise   int64              `bson:"amount_paise" json:"-"`
	Amount        float64            `bson:"-" json:"amount"`
	Status        WithdrawalStatus   `bson:"status" json:"status"`
	PayoutMethod  string             `bson:"payout_method" json:"payout_method"` // "bank" or "upi"
	AccountHolder string             `bson:"account_holder" json:"account_holder"`
	AccountLast4  string             `bson:"account_last4,omitempty" json:"account_last4,omitempty"`
	IFSC          string             `bson:"ifsc,omitempty" json:"ifsc,omitempty"`
	UPIID         string             `bson:"upi_id,omitempty" json:"upi_id,omitempty"`
	ReferenceID   string             `bson:"reference_id" json:"reference_id"`
	BankReference string             `bson:"bank_reference,omitempty" json:"bank_reference,omitempty"` // UTR from the bank
	FailureReason string             `bson:"failure_reason,omitempty" json:"failure_reason,omitempty"`
	HandledBy     string             `bson:"handled_by,omitempty" json:"-"`
	UserName      string             `bson:"-" json:"user_name,omitempty"`
	UserEmail     string             `bson:"-" json:"user_email,omitempty"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	ProcessingAt  *time.Time         `bson:"processing_at,omitempty" json:"processing_at,omitempty"`
	PaidAt        *time.Time         `bson:"paid_at,omitempty" json:"paid_at,omitempty"`
	FailedAt      *time.Time         `bson:"failed_at,omitempty" json:"failed_at,omitempty"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
}

// WithdrawalResponse represents response after withdrawal request is submitted
type WithdrawalResponse struct {
	Withdrawal *Withdrawal            `json:"withdrawal"`
	Wallet     *WalletSummaryResponse `json:"wallet"`
}

// WithdrawalQuery filters withdrawal lists.
type WithdrawalQuery struct {
	Page   int
	Limit  int
	Status WithdrawalStatus
	UserID *primitive.ObjectID
}

// WithdrawalListResponse is one page of withdrawals.
type WithdrawalListResponse struct {
	Withdrawals []Withdrawal `json:"withdrawals"`
	Total       int64        `json:"total"`
	Page        int          `json:"page"`
	Limit       int          `json:"limit"`
	TotalPages  int          `json:"total_pages"`
}

// PayoutAccount is a user's KYC payout details. AccountNumber never goes to the user's own screens.
type PayoutAccount struct {
	Approved      bool
	Method        string
	AccountHolder string
	AccountNumber string
	AccountLast4  string
	IFSC          string
	UPIID         string
}

// PayoutAccountResponse is what the wallet screen shows about where money will be sent.
type PayoutAccountResponse struct {
	Eligible      bool   `json:"eligible"`
	Method        string `json:"method,omitempty"`
	AccountHolder string `json:"account_holder,omitempty"`
	AccountLast4  string `json:"account_last4,omitempty"`
	IFSC          string `json:"ifsc,omitempty"`
	UPIID         string `json:"upi_id,omitempty"`
}

// RevealedAccount is the full destination an admin needs to send a manual payout.
type RevealedAccount struct {
	Method        string `json:"method"`
	AccountHolder string `json:"account_holder"`
	AccountNumber string `json:"account_number,omitempty"`
	IFSC          string `json:"ifsc,omitempty"`
	UPIID         string `json:"upi_id,omitempty"`
}

// UpdateWithdrawalRequest is an admin moving a withdrawal on.
type UpdateWithdrawalRequest struct {
	Status        WithdrawalStatus `json:"status"` // processing, paid or failed
	BankReference string           `json:"bank_reference"`
	FailureReason string           `json:"failure_reason"`
}

// DisputeStatus represents lifecycle states of a refund dispute (F73)
type DisputeStatus string

const (
	DisputeStatusPending     DisputeStatus = "pending"
	DisputeStatusUnderReview DisputeStatus = "under_review"
	DisputeStatusApproved    DisputeStatus = "approved"
	DisputeStatusRejected    DisputeStatus = "rejected"
)

// DisputeReason categories for user refund requests
type DisputeReason string

const (
	DisputeReasonSessionCancelled   DisputeReason = "session_cancelled"
	DisputeReasonServiceNotProvided DisputeReason = "service_not_provided"
	DisputeReasonDuplicateCharge    DisputeReason = "duplicate_charge"
	DisputeReasonTechnicalFailure   DisputeReason = "technical_failure"
	DisputeReasonDissatisfied       DisputeReason = "dissatisfied"
	DisputeReasonOther              DisputeReason = "other"
)

// WalletDispute represents a user's refund request on a wallet purchase (F73)
type WalletDispute struct {
	ID                  primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	UserID              primitive.ObjectID  `bson:"user_id" json:"user_id"`
	UserName            string              `bson:"user_name,omitempty" json:"user_name,omitempty"`
	UserEmail           string              `bson:"user_email,omitempty" json:"user_email,omitempty"`
	TransactionID       primitive.ObjectID  `bson:"transaction_id" json:"transaction_id"`
	ReferenceID         string              `bson:"reference_id" json:"reference_id"`
	AmountPaise         int64               `bson:"amount_paise" json:"-"`
	Amount              float64             `bson:"-" json:"amount"`
	RefundPaise         int64               `bson:"refund_paise,omitempty" json:"-"`
	RefundAmount        float64             `bson:"-" json:"refund_amount,omitempty"`
	TargetBalance       TargetBalance       `bson:"target_balance" json:"target_balance"`
	Category            TransactionCategory `bson:"category" json:"category"`
	Reason              DisputeReason       `bson:"reason" json:"reason"`
	Description         string              `bson:"description" json:"description"`
	Status              DisputeStatus       `bson:"status" json:"status"` // pending, under_review, approved, rejected
	AdminNotes          string              `bson:"admin_notes,omitempty" json:"admin_notes,omitempty"`
	RefundTransactionID *primitive.ObjectID `bson:"refund_transaction_id,omitempty" json:"refund_transaction_id,omitempty"`
	ResolvedBy          string              `bson:"resolved_by,omitempty" json:"resolved_by,omitempty"`
	ResolvedAt          *time.Time          `bson:"resolved_at,omitempty" json:"resolved_at,omitempty"`
	CreatedAt           time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt           time.Time           `bson:"updated_at" json:"updated_at"`
}

// CreateDisputeRequest payload from client to raise a dispute
type CreateDisputeRequest struct {
	TransactionID string        `json:"transaction_id" validate:"required"`
	Reason        DisputeReason `json:"reason" validate:"required"`
	Description   string        `json:"description" validate:"required"`
}

// ResolveDisputeRequest payload from admin to act on a dispute
type ResolveDisputeRequest struct {
	Action       string   `json:"action"` // "approve", "reject" or "under_review"
	Status       string   `json:"status"` // Older clients send the target status instead of an action
	AdminNotes   string   `json:"admin_notes"`
	RefundAmount *float64 `json:"refund_amount,omitempty"` // Less than the full amount, for a partial refund
}

// DisputeQuery filters for dispute pagination
type DisputeQuery struct {
	Page   int           `json:"page"`
	Limit  int           `json:"limit"`
	Status DisputeStatus `json:"status"`
	UserID string        `json:"user_id"`
}

// DisputeListResponse represents paginated disputes returned to client/admin
type DisputeListResponse struct {
	Disputes   []WalletDispute `json:"disputes"`
	Total      int64           `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
	TotalPages int             `json:"total_pages"`
}

// FinanceOverview is the admin's view of all money in the system.
type FinanceOverview struct {
	Wallets           int64             `json:"wallets"`
	MainBalance       float64           `json:"main_balance"`
	EarningsBalance   float64           `json:"earnings_balance"`
	LockedBalance     float64           `json:"locked_balance"`
	BonusBalance      float64           `json:"bonus_balance"`
	OpenWithdrawals   int64             `json:"open_withdrawals"`
	OpenWithdrawalSum float64           `json:"open_withdrawal_sum"`
	OpenDisputes      int64             `json:"open_disputes"`
	Mismatches        []BalanceMismatch `json:"mismatches"`
	MismatchesTotal   int               `json:"mismatches_total"`
}

// BalanceMismatch is a balance that differs from what its ledger adds up to. There should be none.
type BalanceMismatch struct {
	UserID   string        `json:"user_id"`
	Balance  TargetBalance `json:"balance"`
	Stored   float64       `json:"stored"`
	Computed float64       `json:"computed"`
}

// WalletLookupResponse is one user's wallet for the admin finance page.
type WalletLookupResponse struct {
	UserID       string                    `json:"user_id"`
	Name         string                    `json:"name"`
	Email        string                    `json:"email"`
	Mobile       string                    `json:"mobile"`
	Wallet       *WalletSummaryResponse    `json:"wallet"`
	Transactions []TransactionItemResponse `json:"transactions"`
}

// UserContact is who a wallet belongs to.
type UserContact struct {
	ID     primitive.ObjectID
	Name   string
	Email  string
	Mobile string
}
