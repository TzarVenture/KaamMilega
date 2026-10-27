// Package account implements the account lifecycle: deactivation (reversible), deletion requests
// with a grace period, final anonymisation by a background worker, and a personal data export.
//
// Lifecycle (users.account_status):
//
//	active ──deactivate──▶ deactivated ──reactivate──▶ active
//	active / deactivated ──request deletion──▶ pending_deletion ──cancel──▶ active
//	pending_deletion ──grace period ends (worker)──▶ deleted (anonymised)
//
// Every transition away from active bumps users.session_version, which signs the user out on
// every device (middleware.AuthMiddleware). Destructive actions need a fresh verification code
// (or the password, when one is set).
package account

import (
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// DeletionGracePeriod is how long a deletion request can be cancelled by signing in
	DeletionGracePeriod = 30 * 24 * time.Hour

	codeTTL            = 5 * time.Minute // matches the expiry stated in the code email
	codeResendCooldown = 30 * time.Second
	codeMaxPerHour     = 5
	codeMaxAttempts    = 5

	// ConfirmDeletionPhrase must be typed to request deletion
	ConfirmDeletionPhrase = "DELETE"
)

var (
	ErrNotFound          = errors.New("account not found")
	ErrInvalidState      = errors.New("this action isn't available for your account right now")
	ErrReauthRequired    = errors.New("enter the verification code we sent you, or your password")
	ErrInvalidCode       = errors.New("that code is incorrect or has expired")
	ErrTooManyAttempts   = errors.New("too many incorrect attempts. Request a new code")
	ErrIncorrectPassword = errors.New("incorrect password")
	ErrCodeCooldown      = errors.New("please wait a few seconds before requesting another code")
	ErrCodeLimit         = errors.New("too many codes requested. Try again in an hour")
	ErrNoChannel         = errors.New("add a verified email or mobile number to receive a code")
	ErrConfirmPhrase     = errors.New(`type DELETE to confirm`)
	ErrAcknowledge       = errors.New("please confirm you understand what happens to your subscription and job posts")
	ErrBlocked           = errors.New("resolve the items listed before deleting your account")
)

// ActionCode is a short-lived verification code for a destructive account action. Only a hash of
// the code is stored; documents expire via a TTL index on expires_at.
type ActionCode struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	CodeHash  string             `bson:"code_hash"`
	Channel   string             `bson:"channel"` // "email" | "sms"
	ExpiresAt time.Time          `bson:"expires_at"`
	Used      bool               `bson:"used"`
	Attempts  int                `bson:"attempts"`
	CreatedAt time.Time          `bson:"created_at"`
}

// Reauth proves the person acting is the account owner (code from SendCode, or the password)
type Reauth struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

type DeactivateRequest struct {
	Reauth
	Reason   string `json:"reason"`
	Feedback string `json:"feedback"`
}

type DeleteRequest struct {
	Reauth
	Reason   string `json:"reason"`
	Feedback string `json:"feedback"`
	// Confirm must equal ConfirmDeletionPhrase
	Confirm string `json:"confirm"`
	// AcknowledgeWarnings is required when the preview lists warnings (subscription, job posts)
	AcknowledgeWarnings bool `json:"acknowledge_warnings"`
}

// Blocker must be resolved before deletion is allowed
type Blocker struct {
	Code        string `json:"code"`
	Title       string `json:"title"`
	Detail      string `json:"detail"`
	ActionLabel string `json:"action_label,omitempty"`
	ActionURL   string `json:"action_url,omitempty"`
}

// Warning is shown before deletion and must be acknowledged, but doesn't block it
type Warning struct {
	Code   string `json:"code"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

// CodeChannel tells the UI where the verification code goes
type CodeChannel struct {
	Channel     string `json:"channel"`     // "email" | "sms" | "" (none available)
	Destination string `json:"destination"` // masked, e.g. "ra•••@gmail.com" or "•••••• 4321"
}

// Overview powers the Account section of Settings
type Overview struct {
	AccountStatus        string       `json:"account_status"` // "active" | "deactivated" | "pending_deletion"
	DeactivatedAt        *time.Time   `json:"deactivated_at,omitempty"`
	DeletionScheduledFor *time.Time   `json:"deletion_scheduled_for,omitempty"`
	GracePeriodDays      int          `json:"grace_period_days"`
	HasPassword          bool         `json:"has_password"`
	CodeChannel          CodeChannel  `json:"code_channel"`
	Blockers             []Blocker    `json:"blockers"`
	Warnings             []Warning    `json:"warnings"`
	CanDelete            bool         `json:"can_delete"`
}

type SendCodeResponse struct {
	CodeChannel
	ExpiresInSeconds int `json:"expires_in_seconds"`
}

// walletState is the slice of a wallet the deletion checks need
type walletState struct {
	Main     float64 `bson:"main_balance"`
	Earnings float64 `bson:"earnings_balance"`
	Locked   float64 `bson:"locked_balance"`
	Bonus    float64 `bson:"bonus_balance"`
}

// deletionChecks are the cross-feature facts that decide blockers and warnings
type deletionChecks struct {
	Wallet              *walletState
	PendingTransactions int64
	OpenDisputes        int64
	UpcomingSessions    int64
	SubscriptionEndsAt  *time.Time
	OpenJobs            int64
}
