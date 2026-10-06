package chat

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Conversation struct {
	ID            primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Participants  []primitive.ObjectID `bson:"participants" json:"participants"`
	LastMessageID primitive.ObjectID   `bson:"last_message_id,omitempty" json:"last_message_id,omitempty"`
	LastMessage   string               `bson:"last_message,omitempty" json:"last_message,omitempty"`
	UpdatedAt     time.Time            `bson:"updated_at" json:"updated_at"`
	CreatedAt     time.Time            `bson:"created_at" json:"created_at"`
	ClearedAt     map[string]time.Time `bson:"cleared_at,omitempty" json:"cleared_at,omitempty"`
}

type ParticipantInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	ProfileImage string   `json:"profile_image,omitempty"`
	Headline     string   `json:"headline,omitempty"`
	Roles        []string `json:"roles,omitempty"`
	IsOnline     bool     `json:"is_online"`
}

type ConversationResponse struct {
	ID            primitive.ObjectID   `json:"id"`
	Participants  []primitive.ObjectID `json:"participants"`
	LastMessageID primitive.ObjectID   `json:"last_message_id,omitempty"`
	LastMessage   string               `json:"last_message,omitempty"`
	UpdatedAt     time.Time            `json:"updated_at"`
	CreatedAt     time.Time            `json:"created_at"`
	OtherUser     *ParticipantInfo     `json:"otherUser,omitempty"`
	UnreadCount   int                  `json:"unread_count"`
}

type Message struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ConversationID primitive.ObjectID `bson:"conversation_id" json:"conversation_id"`
	SenderID       primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	Content        string             `bson:"content" json:"content"`
	AttachmentURL  string             `bson:"attachment_url,omitempty" json:"attachment_url,omitempty"`
	AttachmentType string             `bson:"attachment_type,omitempty" json:"attachment_type,omitempty"` // "image", "document", etc.
	AttachmentName string             `bson:"attachment_name,omitempty" json:"attachment_name,omitempty"`
	AttachmentSize int64              `bson:"attachment_size,omitempty" json:"attachment_size,omitempty"`
	IsRead         bool               `bson:"is_read" json:"is_read"`
	IsDeleted      bool               `bson:"is_deleted" json:"is_deleted"`
	DeletedAt      *time.Time         `bson:"deleted_at,omitempty" json:"deleted_at,omitempty"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type CreateMessageRequest struct {
	ReceiverID     primitive.ObjectID `json:"receiver_id"`
	Content        string             `json:"content"`
	AttachmentURL  string             `json:"attachment_url,omitempty"`
	AttachmentType string             `json:"attachment_type,omitempty"`
	AttachmentName string             `json:"attachment_name,omitempty"`
	AttachmentSize int64              `json:"attachment_size,omitempty"`
}

// UserBlock represents a block record between two users
type UserBlock struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"user_id"`                 // User who initiated block
	BlockedUserID primitive.ObjectID `bson:"blocked_user_id" json:"blocked_user_id"` // User who is blocked
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
}

type BlockStatusResponse struct {
	IsBlockedByMe    bool `json:"is_blocked_by_me"`
	IsBlockedByOther bool `json:"is_blocked_by_other"`
}

// ReportedMessageSnapshot preserves message context for admin moderation
type ReportedMessageSnapshot struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SenderID      primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	SenderName    string             `bson:"sender_name,omitempty" json:"sender_name,omitempty"`
	Content       string             `bson:"content" json:"content"`
	AttachmentURL string             `bson:"attachment_url,omitempty" json:"attachment_url,omitempty"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
}

// ChatReport represents an offensive chat or user report submitted for admin moderation
type ChatReport struct {
	ID               primitive.ObjectID        `bson:"_id,omitempty" json:"id"`
	ReportNumber     string                    `bson:"report_number" json:"report_number"` // e.g. "REP-2026-001"
	ReporterID       primitive.ObjectID        `bson:"reporter_id" json:"reporter_id"`
	ReporterName     string                    `bson:"reporter_name" json:"reporter_name"`
	ReporterRole     string                    `bson:"reporter_role" json:"reporter_role"`
	ReportedUserID   primitive.ObjectID        `bson:"reported_user_id" json:"reported_user_id"`
	ReportedUserName string                    `bson:"reported_user_name" json:"reported_user_name"`
	ReportedUserRole string                    `bson:"reported_user_role" json:"reported_user_role"`
	ConversationID   primitive.ObjectID        `bson:"conversation_id" json:"conversation_id"`
	Reason           string                    `bson:"reason" json:"reason"` // "harassment", "fraud", "fake_job", "spam", "other"
	Description      string                    `bson:"description" json:"description"`
	Evidence         []ReportedMessageSnapshot `bson:"evidence,omitempty" json:"evidence,omitempty"`
	Status           string                    `bson:"status" json:"status"` // "pending", "under_review", "resolved", "dismissed"
	AdminNotes       string                    `bson:"admin_notes,omitempty" json:"admin_notes,omitempty"`
	ActionTaken      string                    `bson:"action_taken,omitempty" json:"action_taken,omitempty"` // "warning", "user_suspended", "dismissed", "none"
	ResolvedBy       *primitive.ObjectID       `bson:"resolved_by,omitempty" json:"resolved_by,omitempty"`
	ResolvedByName   string                    `bson:"resolved_by_name,omitempty" json:"resolved_by_name,omitempty"`
	ResolvedAt       *time.Time                `bson:"resolved_at,omitempty" json:"resolved_at,omitempty"`
	CreatedAt        time.Time                 `bson:"created_at" json:"created_at"`
	UpdatedAt        time.Time                 `bson:"updated_at" json:"updated_at"`
}

type CreateReportRequest struct {
	Reason      string `json:"reason"`
	Description string `json:"description"`
	BlockUser   bool   `json:"block_user"`
}

type ResolveReportRequest struct {
	Status      string `json:"status"`       // "resolved", "dismissed", "under_review"
	ActionTaken string `json:"action_taken"` // "warning", "user_suspended", "dismissed", "none"
	AdminNotes  string `json:"admin_notes"`
}

type ChatReportListResponse struct {
	Reports    []ChatReport `json:"reports"`
	Total      int          `json:"total"`
	Page       int          `json:"page"`
	TotalPages int          `json:"total_pages"`
}

type ChatRepository interface {
	CreateConversation(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error)
	GetConversationByParticipants(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error)
	GetConversationsByUserID(ctx context.Context, userID primitive.ObjectID) ([]Conversation, error)
	GetConversationByID(ctx context.Context, id primitive.ObjectID) (*Conversation, error)

	CreateMessage(ctx context.Context, msg *Message) (*Message, error)
	GetMessageByID(ctx context.Context, id primitive.ObjectID) (*Message, error)
	GetMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID, limit int, beforeID *primitive.ObjectID, since *time.Time) ([]Message, error)
	GetLatestMessage(ctx context.Context, conversationID primitive.ObjectID) (*Message, error)
	UpdateLastMessage(ctx context.Context, conversationID, messageID primitive.ObjectID, content string) error
	MarkMessagesAsRead(ctx context.Context, conversationID, readerID primitive.ObjectID) error
	CountUnreadMessages(ctx context.Context, conversationID, recipientID primitive.ObjectID) (int, error)
	MarkMessageDeleted(ctx context.Context, messageID primitive.ObjectID) error
	ClearConversationForUser(ctx context.Context, conversationID, userID primitive.ObjectID) error
	DeleteMessage(ctx context.Context, messageID primitive.ObjectID) error
	DeleteConversation(ctx context.Context, id primitive.ObjectID) error
	DeleteMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID) error

	// Block & Safety
	BlockUser(ctx context.Context, userID, blockedUserID primitive.ObjectID) error
	UnblockUser(ctx context.Context, userID, blockedUserID primitive.ObjectID) error
	GetBlockStatus(ctx context.Context, userID, otherUserID primitive.ObjectID) (bool, bool, error)
	IsBlockedEitherWay(ctx context.Context, userA, userB primitive.ObjectID) (bool, error)

	// Report & Moderation
	CreateChatReport(ctx context.Context, report *ChatReport) (*ChatReport, error)
	GetChatReports(ctx context.Context, status string, page, limit int) ([]ChatReport, int, error)
	GetChatReportByID(ctx context.Context, id primitive.ObjectID) (*ChatReport, error)
	ResolveChatReport(ctx context.Context, id primitive.ObjectID, status, actionTaken, adminNotes string, adminID *primitive.ObjectID, adminName string) error
}

type ChatService interface {
	GetConversations(ctx context.Context, userID primitive.ObjectID) ([]ConversationResponse, error)
	SendMessage(ctx context.Context, senderID primitive.ObjectID, req CreateMessageRequest) (*Message, error)
	GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit int, beforeID *primitive.ObjectID) ([]Message, error)
	GetTotalUnreadCount(ctx context.Context, userID primitive.ObjectID) (int, error)
	MarkConversationAsRead(ctx context.Context, conversationID, userID primitive.ObjectID) error
	DeleteMessage(ctx context.Context, messageID, userID primitive.ObjectID) error
	DeleteConversation(ctx context.Context, conversationID, userID primitive.ObjectID) error
	ClearMessages(ctx context.Context, conversationID, userID primitive.ObjectID) error

	// Block & Safety
	BlockUser(ctx context.Context, userID, targetUserID primitive.ObjectID) error
	UnblockUser(ctx context.Context, userID, targetUserID primitive.ObjectID) error
	GetBlockStatus(ctx context.Context, userID, otherUserID primitive.ObjectID) (*BlockStatusResponse, error)

	// Report & Moderation
	CreateChatReport(ctx context.Context, reporterID primitive.ObjectID, conversationID primitive.ObjectID, req CreateReportRequest) (*ChatReport, error)
	GetAdminChatReports(ctx context.Context, status string, page, limit int) (*ChatReportListResponse, error)
	GetAdminChatReportByID(ctx context.Context, id primitive.ObjectID) (*ChatReport, error)
	ResolveAdminChatReport(ctx context.Context, id primitive.ObjectID, adminID primitive.ObjectID, adminName string, req ResolveReportRequest) error
}


