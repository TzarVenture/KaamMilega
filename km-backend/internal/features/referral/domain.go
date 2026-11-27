// Package referral rewards members for inviting people (client answers Q31-Q36, rules agreed
// 27 Nov 2026).
//
// Every member has an invite code. A new member who signs up through it is linked to the inviter
// for good. The referral counts once the new member makes their first real payment: anything paid
// online except a wallet top-up, or money spent from the wallet's main balance. Thirty days later,
// if their purchases weren't refunded, the referral is released:
//   - a normal member gets the amount the admin set, as wallet credit (bonus balance). It starts
//     at ₹0, which means members get nothing until the admin turns it on;
//   - an admin-approved aggregator gets nothing per referral, but every 20 released referrals
//     earn ₹5,000: half as wallet credit straight away, half recorded as cash owed. Cash payouts
//     aren't built yet, so an admin records when the cash was paid outside the app.
//
// Payments are found by reading the payment and wallet tables on a timer, so no payment code
// changes; the 30-day wait makes the few minutes' delay irrelevant.
package referral

import (
	"time"

	"km-backend/internal/common/apperr"
)

// Referral states
const (
	StatusPending   = "pending"
	StatusPaid      = "paid"
	StatusReleased  = "released"
	StatusCancelled = "cancelled"
)

// What a released referral gave its referrer
const (
	RewardMember     = "member"
	RewardAggregator = "aggregator"
	RewardNone       = "none"
)

// SettingsKey is where the admin's referral settings live in the platform settings
const SettingsKey = "referrals"

// ClaimWindow is how soon after creating an account a code can still be added
const ClaimWindow = 24 * time.Hour

// Settings are the amounts and rules the admin can change. Money is in rupees.
type Settings struct {
	// Enabled: when off, no new referrals are linked; ones already linked still finish
	Enabled bool `json:"enabled"`
	// MemberReward is what a normal member gets per released referral (0 = nothing)
	MemberReward float64 `json:"member_reward"`
	// Aggregators get AggregatorCredit + AggregatorCash for every AggregatorGroup referrals
	AggregatorGroup  int     `json:"aggregator_group"`
	AggregatorCredit float64 `json:"aggregator_credit"`
	AggregatorCash   float64 `json:"aggregator_cash"`
	// WaitDays is how long after the first payment a referral is rewarded
	WaitDays int `json:"wait_days"`
}

// DefaultSettings are the client's numbers: ₹5,000 per 20 for aggregators, half and half, a
// 30-day wait, and nothing yet for normal members
func DefaultSettings() Settings {
	return Settings{Enabled: true, MemberReward: 0, AggregatorGroup: 20, AggregatorCredit: 2500, AggregatorCash: 2500, WaitDays: 30}
}

// Referral is one invited member and how far along its reward is
type Referral struct {
	ID           string     `json:"id"`
	ReferrerID   string     `json:"referrer_id"`
	ReferredID   string     `json:"referred_id"`
	Status       string     `json:"status"`
	FirstPayment string     `json:"first_payment,omitempty"`
	PaidAt       *time.Time `json:"paid_at,omitempty"`
	ReleaseAt    *time.Time `json:"release_at,omitempty"`
	ReleasedAt   *time.Time `json:"released_at,omitempty"`
	RewardKind   string     `json:"reward_kind,omitempty"`
	Reward       float64    `json:"reward"`
	PayoutID     string     `json:"payout_id,omitempty"`
	CancelReason string     `json:"cancel_reason,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// Payout is one aggregator group reward
type Payout struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	BatchNo    int        `json:"batch_no"`
	Referrals  int        `json:"referrals"`
	Credit     float64    `json:"credit"`
	Cash       float64    `json:"cash"`
	CashPaidAt *time.Time `json:"cash_paid_at,omitempty"`
	CashPaidBy string     `json:"cash_paid_by,omitempty"`
	CashNote   string     `json:"cash_note,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	// Filled in for the admin list
	UserName   string `json:"user_name,omitempty"`
	UserMobile string `json:"user_mobile,omitempty"`
}

// Aggregator is a member the admin approved to earn group rewards
type Aggregator struct {
	UserID     string    `json:"user_id"`
	Active     bool      `json:"active"`
	Note       string    `json:"note"`
	ApprovedBy string    `json:"approved_by"`
	ApprovedAt time.Time `json:"approved_at"`
	// Filled in for the admin list
	Name         string  `json:"name,omitempty"`
	Mobile       string  `json:"mobile,omitempty"`
	Released     int     `json:"released"`
	Waiting      int     `json:"waiting"`
	CreditEarned float64 `json:"credit_earned"`
	CashOwed     float64 `json:"cash_owed"`
}

// Counts sums one member's referrals by state
type Counts struct {
	Joined    int `json:"joined"`    // signed up, nothing paid yet
	Waiting   int `json:"waiting"`   // paid, waiting out the days
	Released  int `json:"released"`  // rewarded or counted
	Cancelled int `json:"cancelled"` // refunded or erased
}

// InvitedPerson is one line on a member's referral list: first name only, never the number
type InvitedPerson struct {
	FirstName string     `json:"first_name"`
	Status    string     `json:"status"`
	JoinedAt  time.Time  `json:"joined_at"`
	ReleaseAt *time.Time `json:"release_at,omitempty"`
	Reward    float64    `json:"reward"`
}

// Overview is a member's referral page
type Overview struct {
	Enabled      bool            `json:"enabled"`
	Code         string          `json:"code"`
	IsAggregator bool            `json:"is_aggregator"`
	MemberReward float64         `json:"member_reward"`
	WaitDays     int             `json:"wait_days"`
	Counts       Counts          `json:"counts"`
	Earned       float64         `json:"earned"` // wallet credit earned so far, both kinds
	Aggregator   *GroupProgress  `json:"aggregator,omitempty"`
	People       []InvitedPerson `json:"people"`
}

// GroupProgress is an aggregator's progress towards the next group reward
type GroupProgress struct {
	GroupSize    int     `json:"group_size"`
	Credit       float64 `json:"credit"`
	Cash         float64 `json:"cash"`
	TowardsNext  int     `json:"towards_next"`
	Groups       int     `json:"groups"`
	CashOwed     float64 `json:"cash_owed"`
	CashReceived float64 `json:"cash_received"`
}

// AdminReferral is one line of the admin's referral list
type AdminReferral struct {
	Referral
	ReferrerName   string `json:"referrer_name"`
	ReferrerMobile string `json:"referrer_mobile"`
	ReferredName   string `json:"referred_name"`
	ReferredMobile string `json:"referred_mobile"`
}

var (
	ErrDisabled       = apperr.New("REFERRAL_DISABLED", "referrals are switched off right now")
	ErrCodeNotFound   = apperr.New("REFERRAL_CODE_NOT_FOUND", "this invite code doesn't exist")
	ErrOwnCode        = apperr.New("REFERRAL_OWN_CODE", "you can't use your own invite code")
	ErrAlreadyLinked  = apperr.New("REFERRAL_ALREADY_LINKED", "your account is already linked to an invite")
	ErrTooLate        = apperr.New("REFERRAL_TOO_LATE", "invite codes can only be added within a day of joining")
	ErrAlreadyPaid    = apperr.New("REFERRAL_AFTER_PAYMENT", "invite codes can't be added after your first payment")
	ErrInviterGone    = apperr.New("REFERRAL_INVITER_INACTIVE", "the person who invited you can't receive rewards")
	ErrSettings       = apperr.New("REFERRAL_SETTINGS_INVALID", "amounts must be between ₹0 and ₹1,00,000, the group between 1 and 1,000, and the wait between 0 and 365 days")
	ErrUserNotFound   = apperr.New("REFERRAL_USER_NOT_FOUND", "no member with that id or mobile number")
	ErrPayoutNotFound = apperr.New("REFERRAL_PAYOUT_NOT_FOUND", "this reward could not be found")
	ErrCashPaid       = apperr.New("REFERRAL_CASH_ALREADY_PAID", "the cash for this reward is already recorded as paid")
	ErrNote           = apperr.New("REFERRAL_NOTE_TOO_LONG", "keep the note under 200 characters")
)
