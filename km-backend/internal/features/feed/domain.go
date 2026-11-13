package feed

import (
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Reactions a member can leave on a post (one per member per post)
const (
	ReactionLike       = "like"
	ReactionCelebrate  = "celebrate"
	ReactionSupport    = "support"
	ReactionInsightful = "insightful"
)

var reactionTypes = map[string]bool{
	ReactionLike: true, ReactionCelebrate: true, ReactionSupport: true, ReactionInsightful: true,
}

// Categories a post is filed under. "all" is only a listing filter.
const (
	CategoryAll     = "all"
	CategoryGeneral = "general"
	CategoryJobs    = "jobs"
	CategorySkills  = "skills"
	CategoryMentors = "mentors"
)

var postCategories = map[string]bool{
	CategoryGeneral: true, CategoryJobs: true, CategorySkills: true, CategoryMentors: true,
}

// Report reasons, so moderators can sort reports without reading free text
var reportReasons = map[string]bool{
	"spam": true, "harassment": true, "misleading": true, "inappropriate": true, "other": true,
}

// Limits on what one member can write. Counted in characters (runes), so Hindi text gets the
// same room as English.
const (
	MaxPostLength      = 3000
	MaxCommentLength   = 1250
	MaxReportDetails   = 500
	MaxPostImages      = 4
	MaxTagsPerPost     = 10
	MaxTagLength       = 40
	DefaultPageSize    = 10
	MaxPageSize        = 30
	DefaultCommentPage = 10
	MaxCommentPage     = 50
	DefaultReactorPage = 20

	// Posting limits stop spam floods without getting in the way of real use
	MaxPostsPerHour    = 10
	MaxCommentsPerHour = 60
)

const (
	PostActive  = "active"
	PostHidden  = "hidden"  // reported by enough members; out of the feed until a moderator decides
	PostRemoved = "removed" // taken down by a moderator; never listed
)

// AutoHideReports is how many open reports take a post out of the feed before anyone reviews it
const AutoHideReports = 3

// Report states. A moderator's decision closes every open report on the post.
const (
	ReportPending   = "pending"
	ReportDismissed = "dismissed" // the post was kept
	ReportRemoved   = "removed"   // the post was taken down
)

// Moderation decisions on a reported post
const (
	ModerationKeep   = "keep"
	ModerationRemove = "remove"
)

var (
	ErrPostEmpty        = apperr.New("FEED_CONTENT_EMPTY", "Please write something or add a photo before posting.")
	ErrPostTooLong      = apperr.New("FEED_CONTENT_TOO_LONG", "Posts can be up to 3,000 characters.")
	ErrPostNotFound     = apperr.New("FEED_POST_NOT_FOUND", "This post doesn't exist or was removed.")
	ErrNotAllowed       = apperr.New("FEED_UNAUTHORIZED", "You can't change this post.")
	ErrInvalidMedia     = apperr.New("FEED_INVALID_MEDIA", "One of the photos couldn't be attached. Please add it again.")
	ErrTooManyImages    = apperr.New("FEED_TOO_MANY_IMAGES", "You can add up to 4 photos to a post.")
	ErrInvalidCategory  = apperr.New("FEED_INVALID_CATEGORY", "Please choose what the post is about.")
	ErrInvalidReaction  = apperr.New("FEED_INVALID_REACTION", "Please select a valid reaction.")
	ErrCommentEmpty     = apperr.New("FEED_COMMENT_EMPTY", "Comment cannot be empty.")
	ErrCommentTooLong   = apperr.New("FEED_COMMENT_TOO_LONG", "Comments can be up to 1,250 characters.")
	ErrCommentNotFound  = apperr.New("FEED_COMMENT_NOT_FOUND", "This comment doesn't exist or was removed.")
	ErrReportReason     = apperr.New("FEED_REPORT_REASON_EMPTY", "Please choose why you are reporting this post.")
	ErrReportOwnPost    = apperr.New("FEED_REPORT_OWN_POST", "You can't report your own post.")
	ErrPostRateLimited  = apperr.New("FEED_POST_RATE_LIMITED", "You have posted a lot in the last hour. Please try again later.")
	ErrCommentRateLimit = apperr.New("FEED_COMMENT_RATE_LIMITED", "You have commented a lot in the last hour. Please try again later.")
	ErrModerationAction = apperr.New("FEED_MODERATION_ACTION_INVALID", "Choose whether to keep or remove the post.")
)

// Media is one photo on a post. FileID points at the upload record, which holds the storage
// key used to delete the photo with the post.
type Media struct {
	FileID primitive.ObjectID `bson:"file_id" json:"-"`
	URL    string             `bson:"url" json:"url"`
	Width  int                `bson:"width,omitempty" json:"width,omitempty"`
	Height int                `bson:"height,omitempty" json:"height,omitempty"`
}

// Post is a feed post. Who reacted, saved or reported lives in its own collection, so a
// popular post never grows without bound and two quick taps can't double count.
type Post struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	AuthorID       primitive.ObjectID `bson:"author_id"`
	Content        string             `bson:"content"`
	Category       string             `bson:"category"`
	Tags           []string           `bson:"tags,omitempty"` // lower case, without '#', for the tag filter
	Media          []Media            `bson:"media,omitempty"`
	ReactionCounts map[string]int     `bson:"reaction_counts,omitempty"`
	ReactionsTotal int                `bson:"reactions_total"`
	CommentsCount  int                `bson:"comments_count"`
	// Impressions counts each member once a day (see internal/features/analytics)
	Impressions int        `bson:"impressions"`
	Status      string     `bson:"status"`
	EditedAt    *time.Time `bson:"edited_at,omitempty"`
	CreatedAt   time.Time  `bson:"created_at"`
	UpdatedAt   time.Time  `bson:"updated_at"`
}

type Comment struct {
	ID       primitive.ObjectID `bson:"_id,omitempty"`
	PostID   primitive.ObjectID `bson:"post_id"`
	AuthorID primitive.ObjectID `bson:"author_id"`
	// ParentID is set on a reply. Replies are one level deep: a reply to a reply joins the
	// same thread.
	ParentID *primitive.ObjectID `bson:"parent_id,omitempty"`
	// RepliesCount is kept on top-level comments
	RepliesCount int       `bson:"replies_count,omitempty"`
	Content      string    `bson:"content"`
	CreatedAt    time.Time `bson:"created_at"`
}

type Reaction struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	PostID    primitive.ObjectID `bson:"post_id"`
	UserID    primitive.ObjectID `bson:"user_id"`
	Type      string             `bson:"type"`
	CreatedAt time.Time          `bson:"created_at"`
}

type Save struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	PostID    primitive.ObjectID `bson:"post_id"`
	CreatedAt time.Time          `bson:"created_at"`
}

// Report is a member flagging a post for moderators; one per member per post
type Report struct {
	ID         primitive.ObjectID  `bson:"_id,omitempty"`
	PostID     primitive.ObjectID  `bson:"post_id"`
	AuthorID   primitive.ObjectID  `bson:"author_id"` // the post's author, for moderation lists
	ReporterID primitive.ObjectID  `bson:"reporter_id"`
	Reason     string              `bson:"reason"`
	Details    string              `bson:"details,omitempty"`
	Status     string              `bson:"status"` // ReportPending, ReportDismissed or ReportRemoved
	CreatedAt  time.Time           `bson:"created_at"`
	ResolvedAt *time.Time          `bson:"resolved_at,omitempty"`
	ResolvedBy *primitive.ObjectID `bson:"resolved_by,omitempty"`
}

// ReportedPost is one post's reports, grouped for the moderation queue
type ReportedPost struct {
	PostID         primitive.ObjectID `bson:"_id"`
	Reports        int                `bson:"reports"`
	Reasons        []string           `bson:"reasons"`
	LastReportedAt time.Time          `bson:"last_reported_at"`
	// For closed reports: what the moderator decided, and when
	Outcome    string     `bson:"outcome,omitempty"`
	ResolvedAt *time.Time `bson:"resolved_at,omitempty"`
}

// ─── Requests ───────────────────────────────────────────────────────────────────

type MediaInput struct {
	FileID string `json:"file_id"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

type CreatePostRequest struct {
	Content  string       `json:"content"`
	Category string       `json:"category"`
	Media    []MediaInput `json:"media"`
}

type UpdatePostRequest struct {
	Content  string `json:"content"`
	Category string `json:"category"`
}

type ReactionRequest struct {
	Type string `json:"type"`
}

type CommentRequest struct {
	Content string `json:"content"`
	// ParentID makes this a reply to that comment
	ParentID string `json:"parent_id,omitempty"`
}

type ReportRequest struct {
	Reason  string `json:"reason"`
	Details string `json:"details"`
}

// ListQuery is what a feed listing asks for. Before is the last post ID of the previous page.
type ListQuery struct {
	Category string
	Tag      string
	AuthorID *primitive.ObjectID
	Before   *primitive.ObjectID
	Limit    int
}

// ─── Responses ──────────────────────────────────────────────────────────────────

// AuthorResponse is the member next to a post or comment
type AuthorResponse = user.Byline

type PostResponse struct {
	ID             string         `json:"id"`
	Author         AuthorResponse `json:"author"`
	Content        string         `json:"content"`
	Category       string         `json:"category"`
	Media          []Media        `json:"media"`
	ReactionCounts map[string]int `json:"reaction_counts"`
	ReactionsTotal int            `json:"reactions_total"`
	CommentsCount  int            `json:"comments_count"`
	// LatestComment is the newest top-level comment, shown under the post in the feed
	LatestComment *CommentResponse `json:"latest_comment,omitempty"`
	UserReaction  string           `json:"user_reaction,omitempty"`
	IsSaved       bool             `json:"is_saved"`
	IsOwner       bool             `json:"is_owner"`
	// Impressions is only sent to the author, like the rest of their analytics
	Impressions *int       `json:"impressions,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	EditedAt    *time.Time `json:"edited_at,omitempty"`
}

type ListResponse struct {
	Posts      []PostResponse `json:"posts"`
	NextCursor string         `json:"next_cursor,omitempty"`
}

type CommentResponse struct {
	ID           string         `json:"id"`
	PostID       string         `json:"post_id"`
	ParentID     string         `json:"parent_id,omitempty"`
	Author       AuthorResponse `json:"author"`
	Content      string         `json:"content"`
	RepliesCount int            `json:"replies_count"`
	CanDelete    bool           `json:"can_delete"`
	CreatedAt    time.Time      `json:"created_at"`
}

// ReactorResponse is one person in a post's "who reacted" list
type ReactorResponse struct {
	User      AuthorResponse `json:"user"`
	Type      string         `json:"type"`
	CreatedAt time.Time      `json:"created_at"`
}

type ReactorListResponse struct {
	Reactions  []ReactorResponse `json:"reactions"`
	NextCursor string            `json:"next_cursor,omitempty"`
}

type CommentListResponse struct {
	Comments   []CommentResponse `json:"comments"`
	NextCursor string            `json:"next_cursor,omitempty"`
}

type ReactionResponse struct {
	ReactionCounts map[string]int `json:"reaction_counts"`
	ReactionsTotal int            `json:"reactions_total"`
	UserReaction   string         `json:"user_reaction,omitempty"`
}

// ─── Moderation ─────────────────────────────────────────────────────────────────

// ModerationPost is a reported post as a moderator sees it, whatever its status. Author is nil
// when the account is closed.
type ModerationPost struct {
	ID             string          `json:"id"`
	Author         *AuthorResponse `json:"author"`
	Content        string          `json:"content"`
	Category       string          `json:"category"`
	Media          []Media         `json:"media"`
	Status         string          `json:"status"`
	ReactionsTotal int             `json:"reactions_total"`
	CommentsCount  int             `json:"comments_count"`
	CreatedAt      time.Time       `json:"created_at"`
	EditedAt       *time.Time      `json:"edited_at,omitempty"`
}

type ModerationItem struct {
	Post           ModerationPost `json:"post"`
	Reports        int            `json:"reports"`
	Reasons        map[string]int `json:"reasons"`
	LastReportedAt time.Time      `json:"last_reported_at"`
	Outcome        string         `json:"outcome,omitempty"`
	ResolvedAt     *time.Time     `json:"resolved_at,omitempty"`
}

type ModerationQueueResponse struct {
	Items       []ModerationItem `json:"items"`
	Total       int              `json:"total"`
	OpenTotal   int              `json:"open_total"`
	ClosedTotal int              `json:"closed_total"`
}

type ModerationReport struct {
	ID       string          `json:"id"`
	Reporter *AuthorResponse `json:"reporter"`
	Reason   string          `json:"reason"`
	Details  string          `json:"details,omitempty"`
	Status   string          `json:"status"`
	Created  time.Time       `json:"created_at"`
	Resolved *time.Time      `json:"resolved_at,omitempty"`
}

type ModerationDetailResponse struct {
	Post    ModerationPost     `json:"post"`
	Reports []ModerationReport `json:"reports"`
}

type ModerationRequest struct {
	Action string `json:"action"`
}

// ─── Impressions and trending ───────────────────────────────────────────────────

// ImpressionsRequest is the batch of posts the browser saw on screen
type ImpressionsRequest struct {
	PostIDs []string `json:"post_ids"`
}

const (
	// TrendingWindow is how far back trending hashtags look
	TrendingWindow = 7 * 24 * time.Hour
	// TrendingLimit is how many hashtags the trending list shows
	TrendingLimit = 8
	// trendingCacheFor keeps one answer for everyone for a few minutes
	trendingCacheFor = 5 * time.Minute
)

// TrendingTag is a hashtag and how many recent posts used it
type TrendingTag struct {
	Tag   string `bson:"_id" json:"tag"`
	Posts int    `bson:"posts" json:"posts"`
}

type TrendingResponse struct {
	Tags []TrendingTag `json:"tags"`
}
