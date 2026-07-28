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

type Message struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ConversationID primitive.ObjectID `bson:"conversation_id" json:"conversation_id"`
	SenderID       primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	Content        string             `bson:"content" json:"content"`
	IsRead         bool               `bson:"is_read" json:"is_read"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type CreateMessageRequest struct {
	ReceiverID primitive.ObjectID `json:"receiver_id"`
	Content    string             `json:"content"`
}

type ChatRepository interface {
	CreateConversation(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error)
	GetConversationByParticipants(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error)
	GetConversationsByUserID(ctx context.Context, userID primitive.ObjectID) ([]Conversation, error)
	GetConversationByID(ctx context.Context, id primitive.ObjectID) (*Conversation, error)

	CreateMessage(ctx context.Context, msg *Message) (*Message, error)
	GetMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID, limit, offset int) ([]Message, error)
	UpdateLastMessage(ctx context.Context, conversationID, messageID primitive.ObjectID, content string) error
}

type ChatService interface {
	GetConversations(ctx context.Context, userID primitive.ObjectID) ([]Conversation, error)
	SendMessage(ctx context.Context, senderID primitive.ObjectID, req CreateMessageRequest) (*Message, error)
	GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit, offset int) ([]Message, error)
}
