package user

import "time"

// Badges shown next to a member's name (client answer Q60). They are worked out from what the
// team has checked, never set by hand, so they can't drift from the facts behind them.
const (
	// BadgeVerified: our team checked their documents (company verification or Expert KYC)
	BadgeVerified = "verified"
	// BadgeTopRated: at least TopRatedMinReviews reviews averaging TopRatedMinAverage or more
	BadgeTopRated = "top_rated"
	// BadgePoliceChecked: an admin approved their police verification certificate and it hasn't expired
	BadgePoliceChecked = "police_checked"

	TopRatedMinReviews = 10
	TopRatedMinAverage = 4.5
)

// Police verification statuses
const (
	PoliceStatusPending  = "pending"
	PoliceStatusApproved = "approved"
	PoliceStatusRejected = "rejected"
)

// PoliceCheckValidMonths is how long a police certificate counts after the date it was issued
const PoliceCheckValidMonths = 12

// PoliceVerification is a member's police verification certificate (client answer Q52). The file
// is private: only the member and admins can open it, through signed links.
type PoliceVerification struct {
	Status          string     `bson:"status" json:"status"`
	FileID          string     `bson:"file_id" json:"file_id"`
	FileURL         string     `bson:"file_url" json:"-"`
	IssuedOn        time.Time  `bson:"issued_on" json:"issued_on"`
	ExpiresAt       time.Time  `bson:"expires_at" json:"expires_at"`
	SubmittedAt     time.Time  `bson:"submitted_at" json:"submitted_at"`
	ReviewedAt      *time.Time `bson:"reviewed_at,omitempty" json:"reviewed_at,omitempty"`
	ReviewedBy      string     `bson:"reviewed_by,omitempty" json:"-"`
	RejectionReason string     `bson:"rejection_reason,omitempty" json:"rejection_reason,omitempty"`
}

// PoliceCheckExpiry is when a certificate issued on that date stops counting
func PoliceCheckExpiry(issuedOn time.Time) time.Time {
	return issuedOn.AddDate(0, PoliceCheckValidMonths, 0)
}

// Valid reports whether the certificate is approved and still in date
func (p *PoliceVerification) Valid(now time.Time) bool {
	return p != nil && p.Status == PoliceStatusApproved && now.Before(p.ExpiresAt)
}

// IsTopRated applies the Top rated rule to a rating summary
func IsTopRated(average float64, count int) bool {
	return count >= TopRatedMinReviews && average >= TopRatedMinAverage
}

// BadgesOf lists the member's badges, in display order. It needs verification_status,
// expert_approval_status, police_verification, rating_average and rating_count.
func BadgesOf(u *User, now time.Time) []string {
	if u == nil {
		return nil
	}
	out := []string{}
	if u.VerificationStatus == "verified" || u.ExpertApprovalStatus == ExpertStatusApproved {
		out = append(out, BadgeVerified)
	}
	if IsTopRated(u.RatingAverage, u.RatingCount) {
		out = append(out, BadgeTopRated)
	}
	if u.PoliceVerification.Valid(now) {
		out = append(out, BadgePoliceChecked)
	}
	return out
}

// HasBadge reports whether badges contains badge
func HasBadge(badges []string, badge string) bool {
	for _, b := range badges {
		if b == badge {
			return true
		}
	}
	return false
}
