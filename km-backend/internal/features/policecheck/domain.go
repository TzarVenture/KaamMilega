// Package policecheck lets members upload their police verification certificate and admins
// approve it (client answer Q52). An approved certificate gives the "Police checked" badge for
// 12 months from the date it was issued (user.PoliceCheckValidMonths).
package policecheck

import (
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/user"
)

// FileKind is the private upload kind for certificates (see file/kinds.go)
const FileKind = "police_certificate"

// RenewWindow: a member with a valid approved certificate can upload a new one only this close
// to its expiry, so an approved badge isn't swapped for a pending review by accident
const RenewWindow = 30 * 24 * time.Hour

var (
	ErrFile       = apperr.New("POLICE_FILE_INVALID", "upload your police verification certificate as a PDF or photo")
	ErrIssuedOn   = apperr.New("POLICE_ISSUED_ON_INVALID", "enter the date printed on the certificate")
	ErrFutureDate = apperr.New("POLICE_ISSUED_ON_FUTURE", "the issue date can't be in the future")
	ErrTooOld     = apperr.New("POLICE_CERTIFICATE_EXPIRED", "this certificate is more than 12 months old; get a new one from the police")
	ErrStillValid = apperr.New("POLICE_CERTIFICATE_STILL_VALID", "your approved certificate is still valid; you can upload a new one in the last 30 days before it expires")
	ErrDecision   = apperr.New("POLICE_REVIEW_DECISION_INVALID", "choose approve or reject")
	ErrReason     = apperr.New("POLICE_REVIEW_REASON_REQUIRED", "give a reason so the member knows what to fix")
	ErrNotPending = apperr.New("POLICE_REVIEW_NOT_PENDING", "this certificate has already been reviewed or was replaced, please refresh")
	ErrNotFound   = apperr.New("POLICE_VERIFICATION_NOT_FOUND", "no police verification found for this member")
	ErrBadUserID  = apperr.New("USER_ID_INVALID", "invalid user id")
)

// SubmitRequest is a member uploading their certificate
type SubmitRequest struct {
	FileID   string `json:"file_id"`
	IssuedOn string `json:"issued_on"` // YYYY-MM-DD, as printed on the certificate
}

// ReviewRequest is an admin's decision
type ReviewRequest struct {
	Status string `json:"status"` // approved or rejected
	Reason string `json:"reason"`
	// FileID is the certificate the admin looked at; if the member has sent a newer one since,
	// the decision is refused (optional, but the admin page always sends it)
	FileID string `json:"file_id,omitempty"`
}

// MyStatus is what the member sees about their own certificate
type MyStatus struct {
	Verification *user.PoliceVerification `json:"verification"`
	// Badge is true while the "Police checked" badge shows on their profile
	Badge       bool `json:"badge"`
	ValidMonths int  `json:"valid_months"`
	// CanSubmit is false while an approved certificate is valid and not yet in its renewal window
	CanSubmit bool `json:"can_submit"`
}

// Member is who a certificate in the review queue belongs to
type Member struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Avatar string   `json:"avatar,omitempty"`
	City   string   `json:"city,omitempty"`
	Roles  []string `json:"roles"`
}

// QueueItem is one certificate in the admin review list
type QueueItem struct {
	Member       Member                   `json:"member"`
	Verification *user.PoliceVerification `json:"verification"`
}

// QueuePage is one page of the review list
type QueuePage struct {
	Items []QueueItem `json:"items"`
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}
