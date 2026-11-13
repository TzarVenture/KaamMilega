package notification

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// In-App Notification Categories
const (
	CategoryAll      = "all"
	CategoryMessages = "messages"
	CategoryJobs     = "jobs"
	CategoryNetwork  = "network"
	CategorySystem   = "system"
)

// In-App Notification Types
const (
	TypeChatMessage         = "chat_message"
	TypeApplicationReceived = "application_received"
	TypeApplicationStatus   = "application_status"
	TypeInterviewScheduled  = "interview_scheduled"
	TypeConnectionRequest   = "connection_request"
	TypeConnectionAccepted  = "connection_accepted"
	TypeSystemAlert         = "system_alert"
	TypeExpertApplication   = "expert_application"
	TypeFeedComment         = "feed_comment"
	TypeSkillEndorsement    = "skill_endorsement"
	TypeCertificateReview   = "certificate_review"
	TypeFeedReaction        = "feed_reaction"
	TypeJobAlert            = "job_alert"
	TypeReminder            = "reminder"
	TypeAccount             = "account"
)

// Notification represents an in-app notification document in MongoDB
type Notification struct {
	ID          primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID     `bson:"user_id" json:"user_id"`
	ActorID     *primitive.ObjectID    `bson:"actor_id,omitempty" json:"actor_id,omitempty"`
	ActorName   string                 `bson:"actor_name,omitempty" json:"actor_name,omitempty"`
	ActorAvatar string                 `bson:"actor_avatar,omitempty" json:"actor_avatar,omitempty"`
	Type        string                 `bson:"type" json:"type"`
	Category    string                 `bson:"category" json:"category"`
	Title       string                 `bson:"title" json:"title"`
	Message     string                 `bson:"message" json:"message"`
	Link        string                 `bson:"link,omitempty" json:"link,omitempty"`
	Metadata    map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"`
	IsRead      bool                   `bson:"is_read" json:"is_read"`
	// IsSeen: the member opened the bell or the page since it arrived. The badge counts unread
	// notifications not seen yet; each stays unread until opened.
	IsSeen bool `bson:"is_seen" json:"is_seen"`
	CreatedAt   time.Time              `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time              `bson:"updated_at" json:"updated_at"`
}

// NotificationFilter specifies query parameters for fetching notifications
type NotificationFilter struct {
	Category   string
	UnreadOnly bool
	Limit      int
	Offset     int
	// Before and BeforeID page by the last item shown (newer arrivals don't shift the pages);
	// Offset is ignored when they are set
	Before   *time.Time
	BeforeID *primitive.ObjectID
}

// CreateNotificationRequest carries payload to create and broadcast an in-app notification
type CreateNotificationRequest struct {
	UserID      primitive.ObjectID     `json:"user_id"`
	ActorID     *primitive.ObjectID    `json:"actor_id,omitempty"`
	ActorName   string                 `json:"actor_name,omitempty"`
	ActorAvatar string                 `json:"actor_avatar,omitempty"`
	Type        string                 `json:"type"`
	Category    string                 `json:"category"`
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Link        string                 `json:"link,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// NotificationRepository defines persistence operations for notifications
type NotificationRepository interface {
	Create(ctx context.Context, n *Notification) (*Notification, error)
	Find(ctx context.Context, userID primitive.ObjectID, filter NotificationFilter) ([]Notification, int64, error)
	FindRecentUnreadByActor(ctx context.Context, userID, actorID primitive.ObjectID, notifType string, since time.Time) (*Notification, error)
	UpdateMessage(ctx context.Context, id primitive.ObjectID, message string, metadata map[string]interface{}) error
	CountUnread(ctx context.Context, userID primitive.ObjectID) (int64, error)
	CountUnseen(ctx context.Context, userID primitive.ObjectID) (int64, error)
	// FindUnreadGroup is the unread notification already standing for this group, if any
	FindUnreadGroup(ctx context.Context, userID primitive.ObjectID, groupKey string) (*Notification, error)
	// Regroup refreshes a grouped notification with the newest activity and moves it to the top
	Regroup(ctx context.Context, n *Notification) error
	MarkAllSeen(ctx context.Context, userID primitive.ObjectID) error
	CountUnreadByCategory(ctx context.Context, userID primitive.ObjectID) (map[string]int64, error)
	MarkAsRead(ctx context.Context, id, userID primitive.ObjectID) error
	MarkAllAsRead(ctx context.Context, userID primitive.ObjectID) error
	// MarkChatRead marks the unread "new message" notifications of one conversation as read and
	// returns their IDs
	MarkChatRead(ctx context.Context, userID primitive.ObjectID, conversationID string) ([]primitive.ObjectID, error)
	Delete(ctx context.Context, id, userID primitive.ObjectID) error
}

// NotificationService defines business logic and real-time dispatch for in-app notifications
type NotificationService interface {
	CreateNotification(ctx context.Context, req CreateNotificationRequest) (*Notification, error)
	CreateOrDebounceChatNotification(ctx context.Context, req CreateNotificationRequest) (*Notification, error)
	// CreateOrGroup folds repeated activity (reactions on one post) into the unread notification
	// with the same group key, or creates it
	CreateOrGroup(ctx context.Context, req CreateNotificationRequest, groupKey string) (*Notification, error)
	GetNotifications(ctx context.Context, userID primitive.ObjectID, filter NotificationFilter) ([]Notification, int64, error)
	GetUnreadCount(ctx context.Context, userID primitive.ObjectID) (int64, error)
	GetUnseenCount(ctx context.Context, userID primitive.ObjectID) (int64, error)
	// MarkAllSeen clears the badge (the bell or the page was opened); nothing becomes read
	MarkAllSeen(ctx context.Context, userID primitive.ObjectID) error
	GetUnreadByCategory(ctx context.Context, userID primitive.ObjectID) (map[string]int64, error)
	MarkAsRead(ctx context.Context, id, userID primitive.ObjectID) error
	MarkAllAsRead(ctx context.Context, userID primitive.ObjectID) error
	// MarkChatRead clears a conversation's message notifications once the member has read it
	MarkChatRead(ctx context.Context, userID primitive.ObjectID, conversationID string) error
	DeleteNotification(ctx context.Context, id, userID primitive.ObjectID) error
}
