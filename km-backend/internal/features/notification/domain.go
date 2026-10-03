package notification

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// In-App Notification Categories
const (
	CategoryAll     = "all"
	CategoryMessages = "messages"
	CategoryJobs    = "jobs"
	CategoryNetwork = "network"
	CategorySystem  = "system"
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
	CreatedAt   time.Time              `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time              `bson:"updated_at" json:"updated_at"`
}

// NotificationFilter specifies query parameters for fetching notifications
type NotificationFilter struct {
	Category   string
	UnreadOnly bool
	Limit      int
	Offset     int
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
	MarkAsRead(ctx context.Context, id, userID primitive.ObjectID) error
	MarkAllAsRead(ctx context.Context, userID primitive.ObjectID) error
	Delete(ctx context.Context, id, userID primitive.ObjectID) error
}

// NotificationService defines business logic and real-time dispatch for in-app notifications
type NotificationService interface {
	CreateNotification(ctx context.Context, req CreateNotificationRequest) (*Notification, error)
	CreateOrDebounceChatNotification(ctx context.Context, req CreateNotificationRequest) (*Notification, error)
	GetNotifications(ctx context.Context, userID primitive.ObjectID, filter NotificationFilter) ([]Notification, int64, error)
	GetUnreadCount(ctx context.Context, userID primitive.ObjectID) (int64, error)
	MarkAsRead(ctx context.Context, id, userID primitive.ObjectID) error
	MarkAllAsRead(ctx context.Context, userID primitive.ObjectID) error
	DeleteNotification(ctx context.Context, id, userID primitive.ObjectID) error
}
