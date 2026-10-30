package feed

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Allowed reaction types per feed-backend-handoff.md & feedTypes.ts
const (
	ReactionLike       = "like"
	ReactionCelebrate  = "celebrate"
	ReactionSupport    = "support"
	ReactionLove       = "love"
	ReactionInsightful = "insightful"
)

// Allowed feed categories
const (
	CategoryAll     = "all"
	CategoryJobs    = "jobs"
	CategorySkills  = "skills"
	CategoryMentors = "mentors"
)

// Post represents a persistent feed post in MongoDB
type Post struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	AuthorID      primitive.ObjectID `bson:"author_id" json:"author_id"`
	Content       string             `bson:"content" json:"content"`
	Category      string             `bson:"category" json:"category"`
	Tags          []string           `bson:"tags,omitempty" json:"tags,omitempty"`
	MediaURL      string             `bson:"media_url,omitempty" json:"media_url,omitempty"`
	MediaType     string             `bson:"media_type,omitempty" json:"media_type,omitempty"`
	Reactions     map[string]string  `bson:"reactions,omitempty" json:"-"` // userID string -> reaction type
	LikesCount    int                `bson:"likes_count" json:"likes_count"`
	RepostsCount  int                `bson:"reposts_count" json:"reposts_count"`
	CommentsCount int                `bson:"comments_count" json:"comments_count"`
	SavedBy       []string           `bson:"saved_by,omitempty" json:"-"`    // slice of userID strings
	RepostedBy    []string           `bson:"reposted_by,omitempty" json:"-"` // slice of userID strings
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
}

// Comment represents a post comment in MongoDB
type Comment struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PostID     primitive.ObjectID `bson:"post_id" json:"post_id"`
	AuthorID   primitive.ObjectID `bson:"author_id" json:"author_id"`
	Content    string             `bson:"content" json:"content"`
	LikesCount int                `bson:"likes_count" json:"likes_count"`
	LikedBy    []string           `bson:"liked_by,omitempty" json:"-"` // slice of userID strings
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}

// PostReport represents an abuse/moderation report for a feed post
type PostReport struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PostID     primitive.ObjectID `bson:"post_id" json:"post_id"`
	ReporterID primitive.ObjectID `bson:"reporter_id" json:"reporter_id"`
	Reason     string             `bson:"reason" json:"reason"`
	Status     string             `bson:"status" json:"status"` // pending, reviewed, dismissed
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
}

// DTOs for HTTP Requests

type CreatePostRequest struct {
	Content  string   `json:"content"`
	Category string   `json:"category"`
	MediaURL string   `json:"media_url,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

type ReactionRequest struct {
	Reaction string `json:"reaction"` // like, celebrate, support, love, insightful
}

type CommentRequest struct {
	Content string `json:"content"`
}

type ReportPostRequest struct {
	Reason string `json:"reason"`
}

// DTOs for HTTP Responses

type FeedAuthorResponse struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Headline   string `json:"headline"`
	Avatar     string `json:"avatar,omitempty"`
	IsVerified bool   `json:"is_verified"`
	Role       string `json:"role,omitempty"`
	Badge      string `json:"badge,omitempty"`
}

type FeedCommentResponse struct {
	ID         string             `json:"id"`
	PostID     string             `json:"post_id"`
	Author     FeedAuthorResponse `json:"author"`
	CreatedAt  string             `json:"created_at"`
	Content    string             `json:"content"`
	LikesCount int                `json:"likes_count"`
	IsLiked    bool               `json:"is_liked"`
}

type FeedPostResponse struct {
	ID             string                `json:"id"`
	Author         FeedAuthorResponse    `json:"author"`
	CreatedAt      string                `json:"created_at"`
	TimestampMs    int64                 `json:"timestamp_ms"`
	Content        string                `json:"content"`
	Tags           []string              `json:"tags,omitempty"`
	Category       string                `json:"category"`
	MediaURL       string                `json:"media_url,omitempty"`
	MediaType      string                `json:"media_type,omitempty"`
	LikesCount     int                   `json:"likes_count"`
	RepostsCount   int                   `json:"reposts_count"`
	CommentsCount  int                   `json:"comments_count"`
	IsLiked        bool                  `json:"is_liked"`
	UserReaction   string                `json:"user_reaction,omitempty"`
	IsReposted     bool                  `json:"is_reposted"`
	IsSaved        bool                  `json:"is_saved"`
	RecentComments []FeedCommentResponse `json:"comments,omitempty"`
}

type FeedListResponse struct {
	Posts      []FeedPostResponse `json:"posts"`
	NextCursor string             `json:"next_cursor,omitempty"`
	HasMore    bool               `json:"has_more"`
}

