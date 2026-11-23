// Package promo runs coupon codes: discounts that lower a price, and cashback that adds bonus
// credit after a purchase. Features that sell something (the InstantPass, recruiter plans) ask it
// for the price to charge and tell it when the purchase is paid or refunded.
package promo

import (
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/payment"
)

const (
	KindDiscount = "discount"
	KindCashback = "cashback"

	ValueFlat    = "flat"
	ValuePercent = "percent"

	ChannelWallet = "wallet"
	ChannelOnline = "online"

	StatusReserved = "reserved"
	StatusRedeemed = "redeemed"
	StatusReleased = "released"
	StatusReversed = "reversed"

	// Razorpay can't take less than ₹1, so a discounted price is either free or at least this
	MinChargePaise int64 = 100

	// DetailKey is where an online order keeps the coupon use it was made with
	DetailKey = "coupon_redemption_id"
)

// Purposes coupons can be used on. Matches the coupons.applies_to check in the database.
var Purposes = []payment.Purpose{payment.PurposeInstantPass, payment.PurposeRecruiterPlan}

var (
	// Shown to customers
	ErrInvalid       = apperr.New("COUPON_INVALID", "this code isn't valid")
	ErrNotStarted    = apperr.New("COUPON_NOT_STARTED", "this code can't be used yet")
	ErrExpired       = apperr.New("COUPON_EXPIRED", "this code has expired")
	ErrNotApplicable = apperr.New("COUPON_NOT_APPLICABLE", "this code doesn't work on this purchase")
	ErrMinOrder      = apperr.New("COUPON_MIN_ORDER", "this purchase is below the code's minimum amount")
	ErrUsedUp        = apperr.New("COUPON_USED_UP", "this code has been fully used")
	ErrAlreadyUsed   = apperr.New("COUPON_ALREADY_USED", "you've already used this code")
	ErrOrderFree     = apperr.New("COUPON_ORDER_FREE", "nothing to pay with this code, use the wallet option")
	ErrCashbackSpent = apperr.New("COUPON_CASHBACK_SPENT", "the cashback from this purchase has already been spent, so it can't be refunded in full")
	ErrNothingToSell = apperr.New("COUPON_PURPOSE_INVALID", "coupons can't be used on this")

	// Shown to admins
	ErrNotFound           = apperr.New("COUPON_NOT_FOUND", "coupon not found")
	ErrCodeInvalid        = apperr.New("COUPON_CODE_INVALID", "use 3 to 24 letters, numbers, dashes or underscores, starting with a letter or number")
	ErrCodeTaken          = apperr.New("COUPON_CODE_TAKEN", "another coupon already uses this code")
	ErrKindInvalid        = apperr.New("COUPON_KIND_INVALID", "choose discount or cashback, and flat or percent")
	ErrValueInvalid       = apperr.New("COUPON_VALUE_INVALID", "enter an amount above ₹0, or a percent from 1 to 100")
	ErrCapInvalid         = apperr.New("COUPON_CAP_INVALID", "the most a use can be worth must be above ₹0")
	ErrMinOrderInvalid    = apperr.New("COUPON_MIN_ORDER_INVALID", "the minimum amount can't be below ₹0")
	ErrDatesInvalid       = apperr.New("COUPON_DATES_INVALID", "the end date must be after the start date")
	ErrLimitInvalid       = apperr.New("COUPON_LIMIT_INVALID", "limits must be at least 1, or empty for no limit")
	ErrAppliesToInvalid   = apperr.New("COUPON_APPLIES_TO_INVALID", "choose at least one purchase the code works on")
	ErrDescriptionTooLong = apperr.New("COUPON_DESCRIPTION_TOO_LONG", "keep the description under 200 characters")
)

// Coupon is a code the admin created. Money is in rupees for the API and paise inside.
type Coupon struct {
	ID              string     `json:"id"`
	Code            string     `json:"code"`
	Description     string     `json:"description"`
	Kind            string     `json:"kind"`
	ValueType       string     `json:"value_type"`
	Amount          *float64   `json:"amount"` // flat coupons, rupees
	AmountPaise     *int64     `json:"-"`
	Percent         *int       `json:"percent"`     // percent coupons
	MaxBenefit      *float64   `json:"max_benefit"` // rupees; nil means no cap
	MaxBenefitPaise *int64     `json:"-"`
	MinOrder        float64    `json:"min_order"` // rupees
	MinOrderPaise   int64      `json:"-"`
	AppliesTo       []string   `json:"applies_to"`
	StartsAt        *time.Time `json:"starts_at"`
	EndsAt          *time.Time `json:"ends_at"`
	TotalLimit      *int       `json:"total_limit"`
	PerUserLimit    *int       `json:"per_user_limit"`
	IsActive        bool       `json:"is_active"`
	CreatedBy       string     `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// CouponInput is what the admin sends to create or edit a coupon. The code can't change once set.
type CouponInput struct {
	Code         string     `json:"code"`
	Description  string     `json:"description"`
	Kind         string     `json:"kind"`
	ValueType    string     `json:"value_type"`
	Amount       *float64   `json:"amount"`
	Percent      *int       `json:"percent"`
	MaxBenefit   *float64   `json:"max_benefit"`
	MinOrder     float64    `json:"min_order"`
	AppliesTo    []string   `json:"applies_to"`
	StartsAt     *time.Time `json:"starts_at"`
	EndsAt       *time.Time `json:"ends_at"`
	TotalLimit   *int       `json:"total_limit"`
	PerUserLimit *int       `json:"per_user_limit"`
	IsActive     bool       `json:"is_active"`
}

// CouponStats is a coupon with how much it has been used, for the admin list.
type CouponStats struct {
	Coupon
	Used          int     `json:"used"`       // redeemed and not refunded
	Held          int     `json:"held"`       // waiting for an online payment
	Discounted    float64 `json:"discounted"` // rupees taken off prices
	CashbackGiven float64 `json:"cashback_given"`
}

// Redemption is one use of a coupon.
type Redemption struct {
	ID              string     `json:"id"`
	CouponID        string     `json:"coupon_id"`
	Code            string     `json:"code"`
	UserID          string     `json:"user_id"`
	UserName        string     `json:"user_name,omitempty"`
	Purpose         string     `json:"purpose"`
	Channel         string     `json:"channel"`
	Status          string     `json:"status"`
	ListPrice       float64    `json:"list_price"`
	ListPaise       int64      `json:"-"`
	Discount        float64    `json:"discount"`
	DiscountPaise   int64      `json:"-"`
	Cashback        float64    `json:"cashback"`
	CashbackPaise   int64      `json:"-"`
	RazorpayOrderID string     `json:"razorpay_order_id,omitempty"`
	PurchaseRef     string     `json:"purchase_ref,omitempty"`
	ReservedUntil   *time.Time `json:"reserved_until,omitempty"`
	RedeemedAt      *time.Time `json:"redeemed_at,omitempty"`
	ReversedAt      *time.Time `json:"reversed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// RedemptionPage is a page of coupon uses for the admin.
type RedemptionPage struct {
	Items []Redemption `json:"items"`
	Total int64        `json:"total"`
	Page  int          `json:"page"`
	Limit int          `json:"limit"`
}

// Applied is a price worked out for one purchase, with or without a coupon. Features charge
// PricePaise and pass the Applied back when the purchase is paid.
type Applied struct {
	UserID        string
	Purpose       payment.Purpose
	ListPaise     int64
	DiscountPaise int64
	PricePaise    int64
	coupon        *Coupon
	// The held use, for online checkouts
	RedemptionID string
}

// Coupon is the coupon used, or nil.
func (a *Applied) Coupon() *Coupon { return a.coupon }

// CashbackOn is the cashback earned when this much of the price is paid with real money (main
// balance or online). Bonus credit never earns cashback.
func (a *Applied) CashbackOn(paidPaise int64) int64 {
	if a == nil || a.coupon == nil || a.coupon.Kind != KindCashback || paidPaise <= 0 {
		return 0
	}
	return benefit(a.coupon, paidPaise)
}

// QuoteRequest asks what a purchase would cost with a code.
type QuoteRequest struct {
	Purpose  string `json:"purpose"`
	TargetID string `json:"target_id"` // the plan, for recruiter plans
	Code     string `json:"code"`
}

// WalletQuote is how the price would be paid from the wallet: bonus credit first, then main.
type WalletQuote struct {
	FromBonus float64 `json:"from_bonus"`
	FromMain  float64 `json:"from_main"`
	Cashback  float64 `json:"cashback"`
	Enough    bool    `json:"enough"`
}

// Quote is a price for the checkout screen. It holds nothing; the price is worked out again
// when the customer pays.
type Quote struct {
	Code        string  `json:"code,omitempty"`
	Kind        string  `json:"kind,omitempty"`
	Description string  `json:"description,omitempty"`
	ListPrice   float64 `json:"list_price"`
	Discount    float64 `json:"discount"`
	Price       float64 `json:"price"`
	PricePaise  int64   `json:"price_paise"`
	Free        bool    `json:"free"`
	// Cashback if the whole price is paid online
	OnlineCashback float64     `json:"online_cashback"`
	Wallet         WalletQuote `json:"wallet"`
}

// Receipt is how a wallet purchase was paid, for the response the app shows.
type Receipt struct {
	Code      string  `json:"code,omitempty"`
	ListPrice float64 `json:"list_price"`
	Discount  float64 `json:"discount"`
	Paid      float64 `json:"paid"`
	FromBonus float64 `json:"from_bonus"`
	FromMain  float64 `json:"from_main"`
	Cashback  float64 `json:"cashback"`
}
