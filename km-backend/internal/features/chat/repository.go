package chat

import (
	"context"
	"fmt"
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

func (r *repository) GetMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID, limit int, beforeID *primitive.ObjectID, since *time.Time) ([]Message, error) {
	filter := bson.M{"conversation_id": conversationID}

	createdAtFilter := bson.M{}
	if since != nil && !since.IsZero() {
		createdAtFilter["$gt"] = *since
	}
	if beforeID != nil && !beforeID.IsZero() {
		beforeMsg, err := r.GetMessageByID(ctx, *beforeID)
		if err == nil && beforeMsg != nil {
			createdAtFilter["$lt"] = beforeMsg.CreatedAt
		} else {
			// Fallback to ObjectID timestamp order
			filter["_id"] = bson.M{"$lt": *beforeID}
		}
	}
	if len(createdAtFilter) > 0 {
		filter["created_at"] = createdAtFilter
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	opts := options.Find().
		SetSort(bson.M{"created_at": -1}). // Newest first to get recent messages
		SetLimit(int64(limit))

	cursor, err := r.db.DB.Collection("messages").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}

	var messages []Message
	if err = cursor.All(ctx, &messages); err != nil {
		return nil, err
	}

	// Reverse to chronological order (oldest to newest)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
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

func (r *repository) MarkMessagesAsRead(ctx context.Context, conversationID, readerID primitive.ObjectID) error {
	filter := bson.M{
		"conversation_id": conversationID,
		"sender_id":       bson.M{"$ne": readerID},
		"is_read":         false,
	}
	update := bson.M{
		"$set": bson.M{
			"is_read": true,
		},
	}
	_, err := r.db.DB.Collection("messages").UpdateMany(ctx, filter, update)
	return err
}

func (r *repository) CountUnreadMessages(ctx context.Context, conversationID, recipientID primitive.ObjectID) (int, error) {
	filter := bson.M{
		"conversation_id": conversationID,
		"sender_id":       bson.M{"$ne": recipientID},
		"is_read":         false,
	}
	count, err := r.db.DB.Collection("messages").CountDocuments(ctx, filter)
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

func (r *repository) GetMessageByID(ctx context.Context, id primitive.ObjectID) (*Message, error) {
	var msg Message
	err := r.db.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&msg)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (r *repository) GetLatestMessage(ctx context.Context, conversationID primitive.ObjectID) (*Message, error) {
	opts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var msg Message
	err := r.db.DB.Collection("messages").FindOne(ctx, bson.M{"conversation_id": conversationID}, opts).Decode(&msg)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (r *repository) MarkMessageDeleted(ctx context.Context, messageID primitive.ObjectID) error {
	now := time.Now()
	filter := bson.M{"_id": messageID}
	update := bson.M{
		"$set": bson.M{
			"is_deleted":      true,
			"deleted_at":      now,
			"content":         "",
			"attachment_url":  "",
			"attachment_type": "",
			"attachment_name": "",
			"attachment_size": 0,
		},
	}
	_, err := r.db.DB.Collection("messages").UpdateOne(ctx, filter, update)
	return err
}

func (r *repository) ClearConversationForUser(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	filter := bson.M{"_id": conversationID}
	update := bson.M{
		"$set": bson.M{
			"cleared_at." + userID.Hex(): time.Now(),
		},
	}
	_, err := r.db.DB.Collection("conversations").UpdateOne(ctx, filter, update)
	return err
}

func (r *repository) DeleteMessage(ctx context.Context, messageID primitive.ObjectID) error {
	_, err := r.db.DB.Collection("messages").DeleteOne(ctx, bson.M{"_id": messageID})
	return err
}

func (r *repository) DeleteConversation(ctx context.Context, id primitive.ObjectID) error {
	_, _ = r.db.DB.Collection("messages").DeleteMany(ctx, bson.M{"conversation_id": id})
	_, err := r.db.DB.Collection("conversations").DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *repository) DeleteMessagesByConversationID(ctx context.Context, conversationID primitive.ObjectID) error {
	_, err := r.db.DB.Collection("messages").DeleteMany(ctx, bson.M{"conversation_id": conversationID})
	if err != nil {
		return err
	}
	_, err = r.db.DB.Collection("conversations").UpdateOne(ctx, bson.M{"_id": conversationID}, bson.M{
		"$set": bson.M{
			"last_message":    "",
			"last_message_id": primitive.NilObjectID,
			"updated_at":      time.Now(),
		},
	})
	return err
}

// Block & Safety repository methods

func (r *repository) BlockUser(ctx context.Context, userID, blockedUserID primitive.ObjectID) error {
	filter := bson.M{
		"user_id":         userID,
		"blocked_user_id": blockedUserID,
	}
	count, err := r.db.DB.Collection("user_blocks").CountDocuments(ctx, filter)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil // Already blocked
	}

	block := UserBlock{
		ID:            primitive.NewObjectID(),
		UserID:        userID,
		BlockedUserID: blockedUserID,
		CreatedAt:     time.Now(),
	}
	_, err = r.db.DB.Collection("user_blocks").InsertOne(ctx, block)
	return err
}

func (r *repository) UnblockUser(ctx context.Context, userID, blockedUserID primitive.ObjectID) error {
	filter := bson.M{
		"user_id":         userID,
		"blocked_user_id": blockedUserID,
	}
	_, err := r.db.DB.Collection("user_blocks").DeleteMany(ctx, filter)
	return err
}

func (r *repository) GetBlockStatus(ctx context.Context, userID, otherUserID primitive.ObjectID) (bool, bool, error) {
	// 1. Did current user block the other user?
	countByMe, err := r.db.DB.Collection("user_blocks").CountDocuments(ctx, bson.M{
		"user_id":         userID,
		"blocked_user_id": otherUserID,
	})
	if err != nil {
		return false, false, err
	}

	// 2. Did the other user block current user?
	countByOther, err := r.db.DB.Collection("user_blocks").CountDocuments(ctx, bson.M{
		"user_id":         otherUserID,
		"blocked_user_id": userID,
	})
	if err != nil {
		return false, false, err
	}

	return countByMe > 0, countByOther > 0, nil
}

func (r *repository) IsBlockedEitherWay(ctx context.Context, userA, userB primitive.ObjectID) (bool, error) {
	filter := bson.M{
		"$or": []bson.M{
			{"user_id": userA, "blocked_user_id": userB},
			{"user_id": userB, "blocked_user_id": userA},
		},
	}
	count, err := r.db.DB.Collection("user_blocks").CountDocuments(ctx, filter)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// Report & Moderation repository methods

func (r *repository) CreateChatReport(ctx context.Context, report *ChatReport) (*ChatReport, error) {
	report.ID = primitive.NewObjectID()
	report.CreatedAt = time.Now()
	report.UpdatedAt = time.Now()
	if report.Status == "" {
		report.Status = "pending"
	}
	if report.ReportNumber == "" {
		report.ReportNumber = fmt.Sprintf("REP-%d", time.Now().Unix()%1000000)
	}

	_, err := r.db.DB.Collection("chat_reports").InsertOne(ctx, report)
	if err != nil {
		return nil, err
	}
	return report, nil
}

func (r *repository) GetChatReports(ctx context.Context, status string, page, limit int) ([]ChatReport, int, error) {
	filter := bson.M{}
	if status != "" && status != "all" {
		filter["status"] = status
	}

	total, err := r.db.DB.Collection("chat_reports").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 15
	}
	skip := (page - 1) * limit

	opts := options.Find().
		SetSort(bson.M{"created_at": -1}).
		SetSkip(int64(skip)).
		SetLimit(int64(limit))

	cursor, err := r.db.DB.Collection("chat_reports").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}

	var reports []ChatReport
	if err = cursor.All(ctx, &reports); err != nil {
		return nil, 0, err
	}
	if reports == nil {
		reports = []ChatReport{}
	}

	return reports, int(total), nil
}

func (r *repository) GetChatReportByID(ctx context.Context, id primitive.ObjectID) (*ChatReport, error) {
	var report ChatReport
	err := r.db.DB.Collection("chat_reports").FindOne(ctx, bson.M{"_id": id}).Decode(&report)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *repository) ResolveChatReport(ctx context.Context, id primitive.ObjectID, status, actionTaken, adminNotes string, adminID *primitive.ObjectID, adminName string) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":           status,
			"action_taken":     actionTaken,
			"admin_notes":      adminNotes,
			"resolved_by":      adminID,
			"resolved_by_name": adminName,
			"resolved_at":      &now,
			"updated_at":       now,
		},
	}
	_, err := r.db.DB.Collection("chat_reports").UpdateOne(ctx, bson.M{"_id": id}, update)
	return err
}

