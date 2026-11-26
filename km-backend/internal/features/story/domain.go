// Package story is 24-hour stories: one photo or video with an optional caption.
//
// Who sees a story: the owner's connections, and for a recruiter also the people who follow
// their company. Nobody blocked either way, and only while the owner's account is active. The
// owner sees who viewed it. A reply is a chat message that quotes the story, under the usual
// chat rules. Three open reports hide a story until a moderator decides; a reported story is
// kept past its 24 hours (hidden from members) so there is something to review, for up to 7 days.
package story

import (
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// Lifetime is how long a story is shown
	Lifetime = 24 * time.Hour
	// KeepReported is how long an expired story with open reports waits for a moderator
	KeepReported = 7 * 24 * time.Hour
	// MaxPerDay is how many stories one member can share in 24 hours
	MaxPerDay = 10
	// MaxCaption is the longest caption, in characters
	MaxCaption = 200
	// AutoHideReports open reports take a story down until a moderator decides
	AutoHideReports = 3
	// MaxReportDetails is the longest note on a report
	MaxReportDetails = 500

	MediaImage = "image"
	MediaVideo = "video"

	StatusActive  = "active"
	StatusHidden  = "hidden"  // reported enough to hide; a moderator decides
	StatusRemoved = "removed" // a moderator took it down; its files are gone

	ReportPending  = "pending"
	ReportResolved = "resolved"

	DecisionKeep   = "keep"
	DecisionRemove = "remove"
)

var reportReasons = map[string]bool{
	"spam": true, "harassment": true, "misleading": true, "inappropriate": true, "other": true,
}

var (
	ErrNotFound       = apperr.New("STORY_NOT_FOUND", "This story has ended or isn't available.")
	ErrNotOwner       = apperr.New("STORY_NOT_YOURS", "Only the person who shared this story can do that.")
	ErrMediaMissing   = apperr.New("STORY_MEDIA_MISSING", "Add a photo or video to share a story.")
	ErrInvalidMedia   = apperr.New("STORY_INVALID_MEDIA", "The photo or video couldn't be attached. Please add it again.")
	ErrCaptionTooLong = apperr.New("STORY_CAPTION_TOO_LONG", "Captions can be up to 200 characters.")
	ErrVideoNotReady  = apperr.New("STORY_VIDEO_NOT_READY", "Your video is still being prepared. Please wait a moment and try again.")
	ErrDailyLimit     = apperr.New("STORY_DAILY_LIMIT", "You have shared 10 stories in the last 24 hours. Please try again later.")
	ErrReportReason   = apperr.New("STORY_REPORT_REASON_EMPTY", "Please choose why you are reporting this story.")
	ErrReportOwn      = apperr.New("STORY_REPORT_OWN", "You can't report your own story.")
	ErrDecision       = apperr.New("STORY_DECISION_INVALID", "Choose whether to keep or remove the story.")
)

// Media is the story's one photo or video. FileID points at the upload record, which holds the
// storage key used to delete the file when the story ends.
type Media struct {
	Type         string             `bson:"type" json:"type"`
	FileID       primitive.ObjectID `bson:"file_id" json:"-"`
	URL          string             `bson:"url" json:"url"`
	Width        int                `bson:"width,omitempty" json:"width,omitempty"`
	Height       int                `bson:"height,omitempty" json:"height,omitempty"`
	PosterFileID primitive.ObjectID `bson:"poster_file_id,omitempty" json:"-"`
	PosterURL    string             `bson:"poster_url,omitempty" json:"poster_url,omitempty"`
	Duration     int                `bson:"duration,omitempty" json:"duration,omitempty"`
}

// fileIDs are the uploads behind the media, poster included
func (m Media) fileIDs() []primitive.ObjectID {
	ids := []primitive.ObjectID{m.FileID}
	if !m.PosterFileID.IsZero() {
		ids = append(ids, m.PosterFileID)
	}
	return ids
}

// Story is one story. Views and reports live in their own collections.
type Story struct {
	ID      primitive.ObjectID `bson:"_id"`
	OwnerID primitive.ObjectID `bson:"owner_id"`
	Media   Media              `bson:"media"`
	Caption string             `bson:"caption,omitempty"`
	Status  string             `bson:"status"`
	// Views counts distinct viewers, the owner not included
	Views     int       `bson:"views"`
	CreatedAt time.Time `bson:"created_at"`
	ExpiresAt time.Time `bson:"expires_at"`
	// PurgeAt is when its files and record go: when it ends, or later while reports wait for a
	// moderator
	PurgeAt time.Time `bson:"purge_at"`
	// DeletedByOwner: the owner deleted it while reports were open, so it is only kept for the
	// moderator and never shown again, whatever the decision
	DeletedByOwner bool `bson:"deleted_by_owner,omitempty"`
}

// View is one member having seen a story (once, however often they open it)
type View struct {
	ID       primitive.ObjectID `bson:"_id,omitempty"`
	StoryID  primitive.ObjectID `bson:"story_id"`
	OwnerID  primitive.ObjectID `bson:"owner_id"`
	ViewerID primitive.ObjectID `bson:"viewer_id"`
	ViewedAt time.Time          `bson:"viewed_at"`
}

type Report struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	StoryID    primitive.ObjectID `bson:"story_id"`
	OwnerID    primitive.ObjectID `bson:"owner_id"`
	ReporterID primitive.ObjectID `bson:"reporter_id"`
	Reason     string             `bson:"reason"`
	Details    string             `bson:"details,omitempty"`
	Status     string             `bson:"status"`
	CreatedAt  time.Time          `bson:"created_at"`
	ResolvedAt *time.Time         `bson:"resolved_at,omitempty"`
	ResolvedBy primitive.ObjectID `bson:"resolved_by,omitempty"`
	Decision   string             `bson:"decision,omitempty"`
}

// ─── Requests ───────────────────────────────────────────────────────────────────

// MediaInput is a photo (kind story_image) or a video (kind story_video) uploaded beforehand.
// For a video, poster_file_id is an optional story_image still. Its length and size are taken
// from the server's own check of the file; duration, width and height sent for a video are ignored.
type MediaInput struct {
	FileID       string `json:"file_id"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	PosterFileID string `json:"poster_file_id,omitempty"`
	Duration     int    `json:"duration,omitempty"`
}

type CreateRequest struct {
	Media   *MediaInput `json:"media"`
	Caption string      `json:"caption"`
}

type ReportRequest struct {
	Reason  string `json:"reason"`
	Details string `json:"details"`
}

type DecisionRequest struct {
	Action string `json:"action"`
}

// ─── Responses ──────────────────────────────────────────────────────────────────

type Owner = user.Byline

// StoryResponse is one story as the apps show it
type StoryResponse struct {
	ID        string    `json:"id"`
	Media     Media     `json:"media"`
	Caption   string    `json:"caption,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	// Seen: the viewer has opened it
	Seen bool `json:"seen"`
	// Views is only filled in for the owner
	Views *int `json:"views,omitempty"`
}

// Group is one member's stories in the bar, oldest first
type Group struct {
	Owner   Owner           `json:"owner"`
	Stories []StoryResponse `json:"stories"`
	// AllSeen: the viewer has opened every story here, so the ring is shown as seen
	AllSeen bool `json:"all_seen"`
	IsOwn   bool `json:"is_own"`
}

// ViewerResponse is one person who viewed the owner's story
type ViewerResponse struct {
	Viewer   Owner     `json:"viewer"`
	ViewedAt time.Time `json:"viewed_at"`
}

// Quote is what a chat reply keeps of the story, so the quote shows after the story ends
type Quote struct {
	ID        primitive.ObjectID `bson:"id" json:"id"`
	OwnerID   primitive.ObjectID `bson:"owner_id" json:"owner_id"`
	MediaType string             `bson:"media_type" json:"media_type"`
	ThumbURL  string             `bson:"thumb_url,omitempty" json:"thumb_url,omitempty"`
	Caption   string             `bson:"caption,omitempty" json:"caption,omitempty"`
	ExpiresAt time.Time          `bson:"expires_at" json:"expires_at"`
}

// ModerationItem is a reported story for moderators
type ModerationItem struct {
	ID        string    `json:"id"`
	Owner     *Owner    `json:"owner,omitempty"`
	Media     Media     `json:"media"`
	Caption   string    `json:"caption,omitempty"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Views     int       `json:"views"`
	// DeletedByOwner: it goes whatever the decision; keeping it only closes the reports
	DeletedByOwner bool `json:"deleted_by_owner,omitempty"`
	// Reports counts the open ones
	Reports int            `json:"reports"`
	Reasons map[string]int `json:"reasons"`
	// Notes are the reporters' own words, newest first
	Notes      []string  `json:"notes,omitempty"`
	LastReport time.Time `json:"last_report"`
}
