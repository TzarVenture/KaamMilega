package notification

import (
	"context"
	"log"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type notificationRepository struct {
	collection *mongo.Collection
}

// NewNotificationRepository constructs MongoDB repository and creates required indexes.
func NewNotificationRepository(db *database.MongodbDB) NotificationRepository {
	coll := db.DB.Collection("notifications")

	// Ensure indexes for efficient querying
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		indexes := []mongo.IndexModel{
			{
				Keys: bson.D{
					{Key: "user_id", Value: 1},
					{Key: "created_at", Value: -1},
				},
			},
			{
				Keys: bson.D{
					{Key: "user_id", Value: 1},
					{Key: "is_read", Value: 1},
				},
			},
			{
				Keys: bson.D{
					{Key: "created_at", Value: 1},
				},
				Options: options.Index().
					SetExpireAfterSeconds(60 * 24 * 3600).
					SetPartialFilterExpression(bson.M{"is_read": true}),
			},
		}

		_, err := coll.Indexes().CreateMany(ctx, indexes)
		if err != nil {
			log.Printf("[NotificationRepo] Failed to create indexes: %v", err)
		}
	}()

	return &notificationRepository{collection: coll}
}

func (r *notificationRepository) Create(ctx context.Context, n *Notification) (*Notification, error) {
	if n.ID.IsZero() {
		n.ID = primitive.NewObjectID()
	}
	now := time.Now()
	n.CreatedAt = now
	n.UpdatedAt = now

	_, err := r.collection.InsertOne(ctx, n)
	if err != nil {
		return nil, err
	}
	return n, nil
}

func (r *notificationRepository) Find(ctx context.Context, userID primitive.ObjectID, filter NotificationFilter) ([]Notification, int64, error) {
	query := bson.M{"user_id": userID}

	if filter.Category != "" && filter.Category != CategoryAll {
		query["category"] = filter.Category
	}

	if filter.UnreadOnly {
		query["is_read"] = false
	}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	limit := int64(filter.Limit)
	if limit <= 0 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}

	offset := int64(filter.Offset)
	if offset < 0 {
		offset = 0
	}

	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(offset)

	cursor, err := r.collection.Find(ctx, query, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var notifications []Notification
	if err := cursor.All(ctx, &notifications); err != nil {
		return nil, 0, err
	}

	if notifications == nil {
		notifications = []Notification{}
	}

	return notifications, total, nil
}

func (r *notificationRepository) CountUnread(ctx context.Context, userID primitive.ObjectID) (int64, error) {
	query := bson.M{
		"user_id": userID,
		"is_read": false,
	}
	return r.collection.CountDocuments(ctx, query)
}

func (r *notificationRepository) MarkAsRead(ctx context.Context, id, userID primitive.ObjectID) error {
	filter := bson.M{
		"_id":     id,
		"user_id": userID,
	}
	update := bson.M{
		"$set": bson.M{
			"is_read":    true,
			"updated_at": time.Now(),
		},
	}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}

func (r *notificationRepository) MarkAllAsRead(ctx context.Context, userID primitive.ObjectID) error {
	filter := bson.M{
		"user_id": userID,
		"is_read": false,
	}
	update := bson.M{
		"$set": bson.M{
			"is_read":    true,
			"updated_at": time.Now(),
		},
	}
	_, err := r.collection.UpdateMany(ctx, filter, update)
	return err
}

func (r *notificationRepository) Delete(ctx context.Context, id, userID primitive.ObjectID) error {
	filter := bson.M{
		"_id":     id,
		"user_id": userID,
	}
	_, err := r.collection.DeleteOne(ctx, filter)
	return err
}

func (r *notificationRepository) FindRecentUnreadByActor(ctx context.Context, userID, actorID primitive.ObjectID, notifType string, since time.Time) (*Notification, error) {
	filter := bson.M{
		"user_id":    userID,
		"actor_id":   actorID,
		"type":       notifType,
		"is_read":    false,
		"created_at": bson.M{"$gte": since},
	}
	opts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var n Notification
	err := r.collection.FindOne(ctx, filter, opts).Decode(&n)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &n, nil
}

func (r *notificationRepository) UpdateMessage(ctx context.Context, id primitive.ObjectID, message string, metadata map[string]interface{}) error {
	filter := bson.M{"_id": id}
	update := bson.M{
		"$set": bson.M{
			"message":    message,
			"metadata":   metadata,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
	}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}
