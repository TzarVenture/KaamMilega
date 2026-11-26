// Package adsales sells ads to recruiters (F89). The admin sets ad packages: a number of days at
// a price, shown in the slots the admin picks. A recruiter writes an image ad, pays for a package
// from the wallet or online (coupons work like recruiter plans), and an admin approves the ad.
//
//   - The days count from approval, so nothing is lost while the ad waits.
//   - A rejected ad is refunded in full to the KaamMilega wallet: bonus credit back to bonus, the
//     rest to the main balance. Coupon cashback that was already spent is kept out of the refund.
//   - An approved ad runs as an ads.Campaign. A change to a running ad waits for an admin while
//     the approved version keeps running.
//
// The money and the review queue live in Postgres (ad_packages, recruiter_ads); the running ad and
// its counts live in MongoDB with the admin's own campaigns.
package adsales

import (
	"net/url"
	"path"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/ads"
)

const (
	StatusUnpaid   = "unpaid"
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusRejected = "rejected"
	StatusRefunded = "refunded"

	ChannelWallet = "wallet"
	ChannelOnline = "online"
)

// Package is what a recruiter buys: days in the admin's chosen slots
type Package struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Days        int       `json:"days"`
	Price       float64   `json:"price"`
	PricePaise  int64     `json:"price_paise"`
	Placements  []string  `json:"placements"`
	SortOrder   int       `json:"sort_order"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PackageInput is the admin's package form. Price is in rupees.
type PackageInput struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Days        int      `json:"days"`
	Price       float64  `json:"price"`
	Placements  []string `json:"placements"`
	SortOrder   int      `json:"sort_order"`
	IsActive    bool     `json:"is_active"`
}

// Content is the part of the ad the recruiter writes
type Content struct {
	Advertiser string   `json:"advertiser"`
	Headline   string   `json:"headline"`
	Body       string   `json:"body"`
	CTALabel   string   `json:"cta_label"`
	ImageURL   string   `json:"image_url"`
	LinkURL    string   `json:"link_url"`
	Cities     []string `json:"cities"`
	Audiences  []string `json:"audiences"`
}

// Ad is one recruiter ad and what was paid for it
type Ad struct {
	ID          string   `json:"id"`
	UserID      string   `json:"user_id"`
	PackageID   string   `json:"package_id"`
	PackageName string   `json:"package_name"`
	Days        int      `json:"days"`
	Placements  []string `json:"placements"`
	Content

	Status          string  `json:"status"`
	Channel         string  `json:"channel,omitempty"`
	Price           float64 `json:"price"`
	PricePaise      int64   `json:"price_paise"`
	PaidBonusPaise  int64   `json:"-"`
	PaidMainPaise   int64   `json:"-"`
	PaidOnlinePaise int64   `json:"-"`
	RazorpayOrderID string  `json:"-"`
	Refunded        float64 `json:"refunded"`
	RefundedPaise   int64   `json:"-"`

	CampaignID string     `json:"-"`
	StartsAt   *time.Time `json:"starts_at,omitempty"`
	EndsAt     *time.Time `json:"ends_at,omitempty"`

	// A change waiting for an admin, and why the last one was refused
	Revision     *Content   `json:"revision,omitempty"`
	RevisionAt   *time.Time `json:"revision_at,omitempty"`
	RevisionNote string     `json:"revision_note,omitempty"`

	RejectReason string     `json:"reject_reason,omitempty"`
	HandledBy    string     `json:"-"`
	PaidAt       *time.Time `json:"paid_at,omitempty"`
	DecidedAt    *time.Time `json:"decided_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// Filled in for lists
	State       string `json:"state"`
	Impressions int64  `json:"impressions"`
	Clicks      int64  `json:"clicks"`
	UserName    string `json:"user_name,omitempty"`
	UserEmail   string `json:"user_email,omitempty"`
}

// StateAt is what the recruiter sees: unpaid, pending, running, ended, rejected or refunded
func (a *Ad) StateAt(now time.Time) string {
	if a.Status == StatusApproved {
		if a.EndsAt != nil && !now.Before(*a.EndsAt) {
			return "ended"
		}
		return "running"
	}
	return a.Status
}

// Ref is how the ad's payment and coupon use are named in the ledger
func Ref(adID string) string { return "recruiter_ad:" + adID }

// Overview is the recruiter's ads page
type Overview struct {
	Packages   []Package       `json:"packages"`
	Ads        []Ad            `json:"ads"`
	Placements []ads.Placement `json:"placements"`
	Audiences  []string        `json:"audiences"`
}

// SaveRequest writes a new ad, or changes one
type SaveRequest struct {
	PackageID string `json:"package_id"`
	Content
}

// PurchaseRequest pays for an ad
type PurchaseRequest struct {
	CouponCode string `json:"coupon_code"`
}

// CheckoutResponse opens Razorpay
type CheckoutResponse struct {
	KeyID       string  `json:"key_id"`
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	AmountPaise int64   `json:"amount_paise"`
}

// RejectRequest is the admin's reason, shown to the recruiter
type RejectRequest struct {
	Reason string `json:"reason"`
}

// AdminQuery filters the admin's review list. Status "review" is new ads and changes waiting.
type AdminQuery struct {
	Status string
	Page   int
	Limit  int
}

type AdminPage struct {
	Ads        []Ad  `json:"ads"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	TotalPages int   `json:"total_pages"`
}

const (
	maxPricePaise = 10_000_000 // ₹1,00,000
	maxCities     = 20
	maxReason     = 300
)

var (
	ErrPackageNotFound = apperr.New("AD_PACKAGE_NOT_FOUND", "This ad package could not be found.")
	ErrPackageInactive = apperr.New("AD_PACKAGE_INACTIVE", "This ad package is no longer sold. Pick another one.")
	ErrPackageName     = apperr.New("AD_PACKAGE_NAME_REQUIRED", "Give the package a name of up to 60 characters.")
	ErrPackageDesc     = apperr.New("AD_PACKAGE_DESCRIPTION_TOO_LONG", "Keep the description under 300 characters.")
	ErrPackageDays     = apperr.New("AD_PACKAGE_DAYS_INVALID", "A package runs for 1 to 366 days.")
	ErrPackagePrice    = apperr.New("AD_PACKAGE_PRICE_INVALID", "The price must be between ₹1 and ₹1,00,000.")
	ErrPackageSlots    = apperr.New("AD_PACKAGE_PLACEMENTS_REQUIRED", "Pick at least one place on the site.")

	ErrAdNotFound     = apperr.New("RECRUITER_AD_NOT_FOUND", "This ad could not be found.")
	ErrRecruitersOnly = apperr.New("RECRUITER_AD_RECRUITERS_ONLY", "Ads are for employer accounts.")
	ErrAdvertiser     = apperr.New("RECRUITER_AD_ADVERTISER_REQUIRED", "Enter your company or brand name, up to 80 characters.")
	ErrHeadline       = apperr.New("RECRUITER_AD_HEADLINE_REQUIRED", "Enter a headline of up to 80 characters.")
	ErrBody           = apperr.New("RECRUITER_AD_BODY_TOO_LONG", "Keep the text to 160 characters.")
	ErrCTA            = apperr.New("RECRUITER_AD_CTA_TOO_LONG", "Keep the button text to 24 characters.")
	ErrImage          = apperr.New("RECRUITER_AD_IMAGE_REQUIRED", "Upload an image for the ad.")
	ErrLink           = apperr.New("RECRUITER_AD_LINK_INVALID", "Enter the full link people go to, starting with https://.")
	ErrCities         = apperr.New("RECRUITER_AD_CITIES_INVALID", "Pick up to 20 cities.")
	ErrAudience       = apperr.New("RECRUITER_AD_AUDIENCE_INVALID", "Pick audiences from the list.")
	ErrNotUnpaid      = apperr.New("RECRUITER_AD_ALREADY_PAID", "This ad is already paid for.")
	ErrCantEdit       = apperr.New("RECRUITER_AD_CANT_EDIT", "This ad can't be changed any more.")
	ErrCantDelete     = apperr.New("RECRUITER_AD_CANT_DELETE", "Only an ad that isn't paid for can be deleted.")
	ErrNoPackageSwap  = apperr.New("RECRUITER_AD_PACKAGE_FIXED", "The package can't be changed after paying.")
	ErrState          = apperr.New("RECRUITER_AD_ALREADY_DECIDED", "This ad has already been decided.")
	ErrNoRevision     = apperr.New("RECRUITER_AD_NO_CHANGE", "There's no change waiting on this ad.")
	ErrReason         = apperr.New("RECRUITER_AD_REASON_REQUIRED", "Give a reason of up to 300 characters. The recruiter sees it.")
	ErrAlreadyEnded   = apperr.New("RECRUITER_AD_ENDED", "This ad has ended.")
	ErrAlreadyRefund  = apperr.New("RECRUITER_AD_ALREADY_REFUNDED", "This ad was already refunded.")
)

func validLink(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
}

// validImage: an uploaded still image (the ad_image upload kind takes these types)
func validImage(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || len(raw) > 1000 || !validLink(raw) {
		return false
	}
	switch strings.ToLower(path.Ext(u.Path)) {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	}
	return false
}

func cleanList(in []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v == "" || seen[strings.ToLower(v)] {
			continue
		}
		seen[strings.ToLower(v)] = true
		out = append(out, v)
	}
	return out
}

func runes(s string) int { return len([]rune(s)) }

// Clean trims the content and checks it
func (c Content) Clean() (Content, error) {
	out := Content{
		Advertiser: strings.TrimSpace(c.Advertiser),
		Headline:   strings.TrimSpace(c.Headline),
		Body:       strings.TrimSpace(c.Body),
		CTALabel:   strings.TrimSpace(c.CTALabel),
		ImageURL:   strings.TrimSpace(c.ImageURL),
		LinkURL:    strings.TrimSpace(c.LinkURL),
		Cities:     cleanList(c.Cities),
		Audiences:  cleanList(c.Audiences),
	}
	switch {
	case out.Advertiser == "" || runes(out.Advertiser) > 80:
		return out, ErrAdvertiser
	case out.Headline == "" || runes(out.Headline) > 80:
		return out, ErrHeadline
	case runes(out.Body) > 160:
		return out, ErrBody
	case runes(out.CTALabel) > 24:
		return out, ErrCTA
	case !validImage(out.ImageURL):
		return out, ErrImage
	case !validLink(out.LinkURL) || len(out.LinkURL) > 1000:
		return out, ErrLink
	case len(out.Cities) > maxCities:
		return out, ErrCities
	}
	for _, c := range out.Cities {
		if runes(c) > 60 {
			return out, ErrCities
		}
	}
	for _, a := range out.Audiences {
		if !validAudience(a) {
			return out, ErrAudience
		}
	}
	return out, nil
}

func validAudience(a string) bool {
	for _, x := range ads.Audiences {
		if x == a {
			return true
		}
	}
	return false
}

func validPlacement(id string) bool {
	for _, p := range ads.Placements {
		if p.ID == id {
			return true
		}
	}
	return false
}

// Creative is the part of the content a running campaign shows
func (c Content) Creative() ads.Creative {
	return ads.Creative{
		Advertiser: c.Advertiser, Headline: c.Headline, Body: c.Body, CTALabel: c.CTALabel,
		ImageURL: c.ImageURL, LinkURL: c.LinkURL,
	}
}
