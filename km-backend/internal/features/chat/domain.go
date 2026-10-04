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

type ChatRepository interface {
	CreateConversation(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error)
	GetConversationByParticipants(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error)
	GetConversationsByUserID(ctx context.Context, userID primitive.ObjectID) ([]Conversation, error)
	GetConversationByID(ctx context.Context, id primitive.ObjectID) (*Conversation, error)

	CreateMessage(ctx context.Context, msg *Message) (*Message, error)
	GetMessageByID(ctx context.Context, id primitive.ObjectID) (*Message, error)
	GetMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID, limit, offset int) ([]Message, error)
	GetLatestMessage(ctx context.Context, conversationID primitive.ObjectID) (*Message, error)
	UpdateLastMessage(ctx context.Context, conversationID, messageID primitive.ObjectID, content string) error
	MarkMessagesAsRead(ctx context.Context, conversationID, readerID primitive.ObjectID) error
	CountUnreadMessages(ctx context.Context, conversationID, recipientID primitive.ObjectID) (int, error)
	DeleteMessage(ctx context.Context, messageID primitive.ObjectID) error
	DeleteConversation(ctx context.Context, id primitive.ObjectID) error
	DeleteMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID) error
}

type ChatService interface {
	GetConversations(ctx context.Context, userID primitive.ObjectID) ([]ConversationResponse, error)
	SendMessage(ctx context.Context, senderID primitive.ObjectID, req CreateMessageRequest) (*Message, error)
	GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit, offset int) ([]Message, error)
	MarkConversationAsRead(ctx context.Context, conversationID, userID primitive.ObjectID) error
	DeleteMessage(ctx context.Context, messageID, userID primitive.ObjectID) error
	DeleteConversation(ctx context.Context, conversationID, userID primitive.ObjectID) error
	ClearMessages(ctx context.Context, conversationID, userID primitive.ObjectID) error
}
