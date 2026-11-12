// Package credential adds proof to a member's skills: endorsements from their connections
// and certificates that admins check.
package credential

import (
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// MaxCertifications a member can list
	MaxCertifications = 30
	// MaxEndorsementsPerDay one member can give, so nobody endorses in bulk
	MaxEndorsementsPerDay = 100
	// MaxCertSkills a certificate can cover
	MaxCertSkills = 10
	// EndorsersShown on each skill; the rest are behind "see all"
	EndorsersShown = 3

	FileKindCertificate = "certificate"
)

// A certificate's review state
const (
	// StatusUnverified: no proof was given, so there is nothing to check
	StatusUnverified = "unverified"
	StatusPending    = "pending"
	StatusVerified   = "verified"
	StatusRejected   = "rejected"
)

var (
	ErrUserNotFound     = apperr.New("CREDENTIAL_USER_NOT_FOUND", "This profile doesn't exist or is hidden.")
	ErrEndorseSelf      = apperr.New("ENDORSE_SELF", "You can't endorse your own skills.")
	ErrNotConnected     = apperr.New("ENDORSE_NOT_CONNECTED", "You can endorse skills of people you're connected with.")
	ErrSkillNotListed   = apperr.New("ENDORSE_SKILL_NOT_FOUND", "This skill isn't on their profile.")
	ErrEndorseLimit     = apperr.New("ENDORSE_RATE_LIMITED", "You've endorsed a lot of skills today. Please try again tomorrow.")
	ErrCertNotFound     = apperr.New("CERT_NOT_FOUND", "This certificate doesn't exist or was removed.")
	ErrCertLimit        = apperr.New("CERT_LIMIT", "You can list up to 30 certificates.")
	ErrCertName         = apperr.New("CERT_NAME_REQUIRED", "Add the certificate name (2 to 120 characters).")
	ErrCertIssuer       = apperr.New("CERT_ISSUER_REQUIRED", "Add who issued it (2 to 120 characters).")
	ErrCertDate         = apperr.New("CERT_DATE_INVALID", "Add the month it was issued. An expiry date can't be before it.")
	ErrCertURL          = apperr.New("CERT_URL_INVALID", "The credential link must start with http:// or https://.")
	ErrCertCredentialID = apperr.New("CERT_ID_TOO_LONG", "The credential ID can be up to 100 characters.")
	ErrCertFile         = apperr.New("CERT_FILE_INVALID", "Upload the certificate again and retry.")
	ErrCertSkills       = apperr.New("CERT_SKILLS_INVALID", "Pick up to 10 skills from your profile.")
	ErrReviewDecision   = apperr.New("CERT_REVIEW_INVALID", "Choose verify or reject. A rejection needs a reason the member will see.")
	ErrReviewState      = apperr.New("CERT_REVIEW_STATE", "Only certificates waiting for review can be reviewed.")
)

// Endorsement: one member vouching for one skill on another member's profile
type Endorsement struct {
	ID     primitive.ObjectID `bson:"_id,omitempty"`
	UserID primitive.ObjectID `bson:"user_id"`
	// SkillKey matches skills whatever their case or spacing
	SkillKey   string             `bson:"skill_key"`
	Skill      string             `bson:"skill"`
	EndorserID primitive.ObjectID `bson:"endorser_id"`
	CreatedAt  time.Time          `bson:"created_at"`
}

// Certification a member lists on their profile
type Certification struct {
	ID     primitive.ObjectID `bson:"_id,omitempty"`
	UserID primitive.ObjectID `bson:"user_id"`
	Name   string             `bson:"name"`
	Issuer string             `bson:"issuer"`
	// IssuedOn and ExpiresOn are months: "2024-05"
	IssuedOn      string `bson:"issued_on"`
	ExpiresOn     string `bson:"expires_on,omitempty"`
	CredentialID  string `bson:"credential_id,omitempty"`
	CredentialURL string `bson:"credential_url,omitempty"`
	// The proof file is private: only the member and admins can open it
	FileID     *primitive.ObjectID `bson:"file_id,omitempty"`
	FileURL    string              `bson:"file_url,omitempty"`
	Skills     []string            `bson:"skills,omitempty"`
	Status     string              `bson:"status"`
	ReviewNote string              `bson:"review_note,omitempty"`
	ReviewedBy *primitive.ObjectID `bson:"reviewed_by,omitempty"`
	ReviewedAt *time.Time          `bson:"reviewed_at,omitempty"`
	CreatedAt  time.Time           `bson:"created_at"`
	UpdatedAt  time.Time           `bson:"updated_at"`
}

// Expired is true once the expiry month has passed
func (c *Certification) Expired(now time.Time) bool {
	if c.ExpiresOn == "" {
		return false
	}
	return c.ExpiresOn < now.Format("2006-01")
}

type EndorseRequest struct {
	Skill string `json:"skill"`
}

type CertificationRequest struct {
	Name          string   `json:"name"`
	Issuer        string   `json:"issuer"`
	IssuedOn      string   `json:"issued_on"`
	ExpiresOn     string   `json:"expires_on"`
	CredentialID  string   `json:"credential_id"`
	CredentialURL string   `json:"credential_url"`
	FileID        string   `json:"file_id"`
	Skills        []string `json:"skills"`
}

type ReviewRequest struct {
	// Decision is "verify" or "reject"
	Decision string `json:"decision"`
	Note     string `json:"note"`
}

// SkillView is one skill on a profile with the proof behind it
type SkillView struct {
	Name         string        `json:"name"`
	Endorsements int           `json:"endorsements"`
	EndorsedByMe bool          `json:"endorsed_by_me"`
	Endorsers    []user.Byline `json:"endorsers"`
	// Certified: a verified, unexpired certificate covers this skill
	Certified bool `json:"certified"`
}

type CertificationView struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Issuer        string   `json:"issuer"`
	IssuedOn      string   `json:"issued_on"`
	ExpiresOn     string   `json:"expires_on,omitempty"`
	Expired       bool     `json:"expired"`
	CredentialID  string   `json:"credential_id,omitempty"`
	CredentialURL string   `json:"credential_url,omitempty"`
	Skills        []string `json:"skills"`
	Status        string   `json:"status"`
	// Owner and admins only
	FileID     string     `json:"file_id,omitempty"`
	FileURL    string     `json:"file_url,omitempty"`
	ReviewNote string     `json:"review_note,omitempty"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ProfileCredentials is what a profile page shows under Skills and Certifications
type ProfileCredentials struct {
	Skills         []SkillView         `json:"skills"`
	Certifications []CertificationView `json:"certifications"`
	IsOwner        bool                `json:"is_owner"`
	// CanEndorse: the viewer is signed in, connected to the owner and not the owner
	CanEndorse bool `json:"can_endorse"`
}

type EndorserList struct {
	Skill     string        `json:"skill"`
	Endorsers []user.Byline `json:"endorsers"`
}

// ReviewItem is a certificate in the admin review queue
type ReviewItem struct {
	CertificationView
	Owner user.Byline `json:"owner"`
}

// skillKey folds case and spacing so "React JS" and "react  js" are one skill
func skillKey(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}
