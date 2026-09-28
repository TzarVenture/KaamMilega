package instant_work

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GeoJSONPoint represents a GeoJSON 2dsphere Point [longitude, latitude]
type GeoJSONPoint struct {
	Type        string    `bson:"type" json:"type"`               // Always "Point"
	Coordinates []float64 `bson:"coordinates" json:"coordinates"` // [Longitude, Latitude]
}

// JobStatus represents the state of a spot hiring job
type JobStatus string

const (
	JobStatusDispatching JobStatus = "DISPATCHING" // Broadcasted to nearby candidates, awaiting first claim
	JobStatusAccepted    JobStatus = "ACCEPTED"    // Claimed by a candidate via atomic CAS lock
	JobStatusInProgress  JobStatus = "IN_PROGRESS" // Worker is on-site / work initiated
	JobStatusCompleted   JobStatus = "COMPLETED"   // Finished, awaiting recruiter payment approval
	JobStatusClosed      JobStatus = "CLOSED"      // Approved & payment settled
	JobStatusCancelled   JobStatus = "CANCELLED"   // Cancelled before claim
	JobStatusExpired     JobStatus = "EXPIRED"     // Broadcast timed out with no candidates
)

// InstantWorker represents the live availability and positioning of a gig worker
type InstantWorker struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID         primitive.ObjectID `bson:"user_id" json:"user_id"`
	Name           string             `bson:"name" json:"name"`
	Avatar         string             `bson:"avatar" json:"avatar"`
	Mobile         string             `bson:"mobile" json:"mobile"`
	ActiveSkill    string             `bson:"active_skill" json:"active_skill"` // e.g. "driver", "electrician", "plumber"
	HourlyRate     float64            `bson:"hourly_rate" json:"hourly_rate"`
	Rating         float64            `bson:"rating" json:"rating"`             // e.g. 4.9
	TotalGigs      int                `bson:"total_gigs" json:"total_gigs"`     // e.g. 24
	Location       GeoJSONPoint       `bson:"location" json:"location"`         // [lng, lat]
	IsFreeNow      bool               `bson:"is_free_now" json:"is_free_now"`
	LastPingAt     time.Time          `bson:"last_ping_at" json:"last_ping_at"`
	QuotaRemaining int                `bson:"quota_remaining" json:"quota_remaining"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}

// InstantPass represents the ₹99 access pass granting 10 accepted gig dispatches
type InstantPass struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	HasActivePass     bool               `bson:"has_active_pass" json:"has_active_pass"`
	QuotaTotal        int                `bson:"quota_total" json:"quota_total"`         // 10
	QuotaRemaining    int                `bson:"quota_remaining" json:"quota_remaining"` // decrements on accepted claim
	PriceINR          float64            `bson:"price_inr" json:"price_inr"`             // 99.00
	RazorpayOrderID   string             `bson:"razorpay_order_id,omitempty" json:"razorpay_order_id,omitempty"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id,omitempty" json:"razorpay_payment_id,omitempty"`
	ActivatedAt       time.Time          `bson:"activated_at" json:"activated_at"`
	ExpiresAt         time.Time          `bson:"expires_at" json:"expires_at"` // 30-day validity
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`
}

// InstantJob represents an on-demand spot hiring demand posted by a recruiter
type InstantJob struct {
	ID              primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	RecruiterID     primitive.ObjectID  `bson:"recruiter_id" json:"recruiter_id"`
	RecruiterName   string              `bson:"recruiter_name" json:"recruiter_name"`
	RecruiterMobile string              `bson:"recruiter_mobile,omitempty" json:"recruiter_mobile,omitempty"`
	CompanyName     string              `bson:"company_name" json:"company_name"`
	Skill           string              `bson:"skill" json:"skill"`
	Location        GeoJSONPoint        `bson:"location" json:"location"` // [lng, lat]
	Address         string              `bson:"address" json:"address"`
	PayRate         float64             `bson:"pay_rate" json:"pay_rate"`
	RateType        string              `bson:"rate_type" json:"rate_type"` // "hourly" or "flat"
	DurationHours   int                 `bson:"duration_hours" json:"duration_hours"`
	RequiredWorkers int                 `bson:"required_workers" json:"required_workers"`
	Notes           string              `bson:"notes" json:"notes"`
	Status          JobStatus           `bson:"status" json:"status"`
	CandidateID     *primitive.ObjectID `bson:"candidate_id,omitempty" json:"candidate_id,omitempty"`
	CandidateName   string              `bson:"candidate_name,omitempty" json:"candidate_name,omitempty"`
	CandidateMobile string              `bson:"candidate_mobile,omitempty" json:"candidate_mobile,omitempty"`
	MatchedAt       *time.Time          `bson:"matched_at,omitempty" json:"matched_at,omitempty"`
	CompletedAt     *time.Time          `bson:"completed_at,omitempty" json:"completed_at,omitempty"`
	ExpiresAt       time.Time           `bson:"expires_at" json:"expires_at"` // 3-minute broadcast window
	DistanceMeters  float64             `bson:"distance_meters,omitempty" json:"distance_meters,omitempty"`
	DistanceKm      float64             `bson:"-" json:"distance_km,omitempty"`
	CreatedAt       time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time           `bson:"updated_at" json:"updated_at"`
}

// NearbyCandidateResult represents a candidate pin returned from $geoNear aggregation
type NearbyCandidateResult struct {
	ID             primitive.ObjectID `bson:"_id" json:"id"`
	UserID         primitive.ObjectID `bson:"user_id" json:"user_id"`
	Name           string             `bson:"name" json:"name"`
	Avatar         string             `bson:"avatar" json:"avatar"`
	ActiveSkill    string             `bson:"active_skill" json:"active_skill"`
	HourlyRate     float64            `bson:"hourly_rate" json:"hourly_rate"`
	Rating         float64            `bson:"rating" json:"rating"`
	TotalGigs      int                `bson:"total_gigs" json:"total_gigs"`
	Location       GeoJSONPoint       `bson:"location" json:"location"`
	DistanceMeters float64            `bson:"distance_meters" json:"distance_meters"`
	DistanceKm     float64            `json:"distance_km"`
	IsMasked       bool               `json:"is_masked"` // If true, coordinates were jittered for privacy
}

// --- DTO Request & Response Structures ---

type ToggleAvailabilityRequest struct {
	IsFreeNow  bool    `json:"is_free_now"`
	Skill      string  `json:"skill"`
	HourlyRate float64 `json:"hourly_rate"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
}

type LocationPingRequest struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type CreateInstantJobRequest struct {
	Skill           string  `json:"skill"`
	Lat             float64 `json:"lat"`
	Lng             float64 `json:"lng"`
	Address         string  `json:"address"`
	RadiusKm        float64 `json:"radius_km"` // default 5.0 km
	PayRate         float64 `json:"pay_rate"`
	RateType        string  `json:"rate_type"` // "hourly" or "flat"
	DurationHours   int     `json:"duration_hours"`
	RequiredWorkers int     `json:"required_workers"`
	Notes           string  `json:"notes"`
}

type ClaimGigRequest struct {
	JobID string `json:"job_id"`
}

type CreatePassOrderResponse struct {
	KeyID   string  `json:"key_id"`
	OrderID string  `json:"order_id"`
	Amount  float64 `json:"amount"` // 9900 paise
	PassINR float64 `json:"pass_inr"`
}

type VerifyPassPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}

type CandidateStatusResponse struct {
	IsFreeNow       bool         `json:"is_free_now"`
	ActiveSkill     string       `json:"active_skill"`
	HourlyRate      float64      `json:"hourly_rate"`
	QuotaRemaining  int          `json:"quota_remaining"`
	HasActivePass   bool         `json:"has_active_pass"`
	PassExpiresAt   *time.Time   `json:"pass_expires_at,omitempty"`
	CurrentLocation GeoJSONPoint `json:"current_location"`
	LastPingAt      *time.Time   `json:"last_ping_at,omitempty"`
}
