// Package recruiterplan sells recruiters monthly plans (client answers Q4, Q6, Q49, Job Hai style).
// The admin creates plans with a price and limits on job posts, new chats and resume downloads.
// Recruiters without a plan get a small free allowance each calendar month. Limits only block
// anyone once the admin turns enforcement on; until then usage is just counted.
package recruiterplan

import (
	"time"

	"km-backend/internal/common/apperr"
)

// What a plan limits
const (
	KindJobPost        = "job_post"
	KindNewChat        = "new_chat"
	KindResumeDownload = "resume_download"
)

// Channels a plan can be bought through
const (
	ChannelWallet = "wallet"
	ChannelOnline = "online"
)

const (
	StatusActive   = "active"
	StatusRefunded = "refunded"
)

// SettingsKey is where the switch and free allowance live in the platform settings
const SettingsKey = "recruiter_plans"

// MaxQueued is how many bought plans can wait to start after the current one
const MaxQueued = 1

var (
	ErrPlanNotFound    = apperr.New("PLAN_NOT_FOUND", "this plan could not be found")
	ErrPlanInactive    = apperr.New("PLAN_INACTIVE", "this plan is no longer sold")
	ErrPlanName        = apperr.New("PLAN_NAME_REQUIRED", "give the plan a name of up to 60 characters")
	ErrPlanDescription = apperr.New("PLAN_DESCRIPTION_TOO_LONG", "keep the description under 300 characters")
	ErrPlanPrice       = apperr.New("PLAN_PRICE_INVALID", "the price must be between ₹1 and ₹1,00,000")
	ErrPlanPeriod      = apperr.New("PLAN_PERIOD_INVALID", "the plan must last between 1 and 366 days")
	ErrPlanLimit       = apperr.New("PLAN_LIMIT_INVALID", "limits must be 0 or more, or empty for unlimited")
	ErrRecruitersOnly  = apperr.New("PLAN_RECRUITERS_ONLY", "recruiter plans are for employer accounts")
	ErrQueueFull       = apperr.New("PLAN_ALREADY_QUEUED", "you already have a plan waiting to start; buy again once it begins")
	ErrRefundUsed      = apperr.New("PLAN_ALREADY_USED", "this plan has been used, so it can't be refunded")
	ErrJobPostsUsedUp  = apperr.New("PLAN_JOB_POSTS_USED_UP", "you've used all the job posts in your plan; buy a plan or wait for the next one to start")
	ErrChatsUsedUp     = apperr.New("PLAN_CHATS_USED_UP", "you've used all the new chats in your plan; buy a plan or wait for the next one to start")
	ErrResumesUsedUp   = apperr.New("PLAN_RESUMES_USED_UP", "you've used all the resume downloads in your plan")
	ErrSettings        = apperr.New("PLAN_SETTINGS_INVALID", "free limits must be 0 or more, or empty for unlimited")
	ErrBadID           = apperr.New("PLAN_ID_INVALID", "invalid plan id")
)

// Limits caps each kind for one period. nil means unlimited.
type Limits struct {
	JobPosts        *int `json:"job_posts"`
	NewChats        *int `json:"new_chats"`
	ResumeDownloads *int `json:"resume_downloads"`
}

func (l Limits) of(kind string) *int {
	switch kind {
	case KindJobPost:
		return l.JobPosts
	case KindNewChat:
		return l.NewChats
	case KindResumeDownload:
		return l.ResumeDownloads
	}
	return nil
}

// Plan is one plan the admin sells
type Plan struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"` // rupees
	PricePaise  int64   `json:"price_paise"`
	PeriodDays  int     `json:"period_days"`
	Limits
	AIJobWriter bool      `json:"ai_job_writer"`
	SortOrder   int       `json:"sort_order"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PurchaseRequest is the optional body of a plan purchase
type PurchaseRequest struct {
	CouponCode string `json:"coupon_code"`
}

// PlanInput is what the admin sends to create or edit a plan
type PlanInput struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"` // rupees
	PeriodDays  int     `json:"period_days"`
	Limits
	AIJobWriter bool `json:"ai_job_writer"`
	SortOrder   int  `json:"sort_order"`
	IsActive    bool `json:"is_active"`
}

// Subscription is one plan a recruiter bought. Limits are copied at purchase.
type Subscription struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	PlanID     string  `json:"plan_id"`
	PlanName   string  `json:"plan_name"`
	Price      float64 `json:"price"`
	PricePaise int64   `json:"price_paise"`
	Limits
	AIJobWriter       bool      `json:"ai_job_writer"`
	Channel           string    `json:"channel"`
	Status            string    `json:"status"`
	RazorpayOrderID   string    `json:"razorpay_order_id,omitempty"`
	RazorpayPaymentID string    `json:"-"`
	StartsAt          time.Time `json:"starts_at"`
	ExpiresAt         time.Time `json:"expires_at"`
	CreatedAt         time.Time `json:"created_at"`
}

// Settings is the admin's switch and the free allowance per calendar month
type Settings struct {
	// Enforce makes the limits block job posts and new chats. Off by default: usage is only counted.
	Enforce bool `json:"enforce"`
	// Free is what a recruiter without a plan gets each calendar month (India time)
	Free Limits `json:"free"`
}

func intp(n int) *int { return &n }

// DefaultSettings applies until the admin saves their own
func DefaultSettings() Settings {
	return Settings{Enforce: false, Free: Limits{JobPosts: intp(2), NewChats: intp(10), ResumeDownloads: nil}}
}

// Allowance is one limited thing in the recruiter's current period
type Allowance struct {
	Used  int  `json:"used"`
	Limit *int `json:"limit"` // nil = unlimited
}

// Usage is what the recruiter has used in the current period
type Usage struct {
	JobPosts        Allowance `json:"job_posts"`
	NewChats        Allowance `json:"new_chats"`
	ResumeDownloads Allowance `json:"resume_downloads"`
}

// Overview is the recruiter's plan screen
type Overview struct {
	Plans []Plan `json:"plans"`
	// Current is the plan running now; nil means the free allowance applies
	Current *Subscription  `json:"current"`
	Queued  []Subscription `json:"queued"`
	Usage   Usage          `json:"usage"`
	// PeriodEndsAt is when the current plan or free month ends and the counts start again
	PeriodEndsAt time.Time `json:"period_ends_at"`
	Enforced     bool      `json:"enforced"`
	AIJobWriter  bool      `json:"ai_job_writer"`
}

// CheckoutResponse is what the app needs to open Razorpay for a plan
type CheckoutResponse struct {
	KeyID       string  `json:"key_id"`
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	AmountPaise int64   `json:"amount_paise"`
}
