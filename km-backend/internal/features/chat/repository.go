package chat

import (
	"context"
	"km-backend/internal/database"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type repository struct {
	db *database.MongodbDB
}

func NewRepository(db *database.MongodbDB) ChatRepository {
	return &repository{db: db}
}

func (r *repository) CreateConversation(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error) {
	conv := &Conversation{
		ID:           primitive.NewObjectID(),
		Participants: participants,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	_, err := r.db.DB.Collection("conversations").InsertOne(ctx, conv)
	if err != nil {
		return nil, err
	}
	return conv, nil
}

func (r *repository) GetConversationByParticipants(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error) {
	filter := bson.M{
		"participants": bson.M{
			"$all":  participants,
			"$size": 2,
		},
	}
	var conv Conversation
	err := r.db.DB.Collection("conversations").FindOne(ctx, filter).Decode(&conv)
	if err != nil {
		return nil, nil
	}
	return &conv, nil
}

func (r *repository) GetConversationsByUserID(ctx context.Context, userID primitive.ObjectID) ([]Conversation, error) {
	filter := bson.M{
		"participants": userID,
	}

	opts := options.Find().SetSort(bson.M{"updated_at": -1}) // Sort by most recently updated
	cursor, err := r.db.DB.Collection("conversations").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}

	var conversations []Conversation
	if err = cursor.All(ctx, &conversations); err != nil {
		return nil, err
	}
	return conversations, nil
}

func (r *repository) GetConversationByID(ctx context.Context, id primitive.ObjectID) (*Conversation, error) {
	filter := bson.M{"_id": id}
	var conv Conversation
	err := r.db.DB.Collection("conversations").FindOne(ctx, filter).Decode(&conv)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *repository) CreateMessage(ctx context.Context, msg *Message) (*Message, error) {
	msg.ID = primitive.NewObjectID()
	msg.CreatedAt = time.Now()
	_, err := r.db.DB.Collection("messages").InsertOne(ctx, msg)
	if err != nil {
		return nil, err
	}
	return msg, nil
}

func (r *repository) GetMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID, limit, offset int) ([]Message, error) {
	filter := bson.M{"conversation_id": conversationID}
	opts := options.Find().
		SetSort(bson.M{"created_at": 1}). // Oldest first (or newest via descending, depends on UI)
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := r.db.DB.Collection("messages").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}

	var messages []Message
	if err = cursor.All(ctx, &messages); err != nil {
		return nil, err
	}
	return messages, nil
}

func (r *repository) UpdateLastMessage(ctx context.Context, conversationID, messageID primitive.ObjectID, content string) error {
	filter := bson.M{"_id": conversationID}
	update := bson.M{
		"$set": bson.M{
			"last_message_id": messageID,
			"last_message":    content,
			"updated_at":      time.Now(),
		},
	}
	_, err := r.db.DB.Collection("conversations").UpdateOne(ctx, filter, update)
	return err
}
