package subscription

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type SubscriptionRepository interface {
	CreateSubscription(ctx context.Context, sub *ExpertSubscription) (*ExpertSubscription, error)
	GetActiveSubscription(ctx context.Context, userID string) (*ExpertSubscription, error)
	GetSubscriptionByID(ctx context.Context, id string) (*ExpertSubscription, error)
	UpdateSubscriptionStatus(ctx context.Context, id string, status string) error
}

type SubscriptionRepositoryImpl struct {
	coll *mongo.Collection
}

func NewSubscriptionRepository(db *database.MongodbDB) SubscriptionRepository {
	return &SubscriptionRepositoryImpl{
		coll: db.DB.Collection("expert_subscriptions"),
	}
}

func (r *SubscriptionRepositoryImpl) CreateSubscription(ctx context.Context, sub *ExpertSubscription) (*ExpertSubscription, error) {
	now := time.Now()
	sub.CreatedAt = now
	sub.UpdatedAt = now
	res, err := r.coll.InsertOne(ctx, sub)
	if err != nil {
		return nil, err
	}
	sub.ID = res.InsertedID.(primitive.ObjectID)
	return sub, nil
}

func (r *SubscriptionRepositoryImpl) GetActiveSubscription(ctx context.Context, userID string) (*ExpertSubscription, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}

	filter := bson.M{
		"user_id":    oid,
		"status":     StatusActive,
		"expires_at": bson.M{"$gt": time.Now()},
	}

	// Sort by expires_at desc to find latest active subscription
	opts := options.FindOne().SetSort(bson.M{"expires_at": -1})
	var sub ExpertSubscription
	err = r.coll.FindOne(ctx, filter, opts).Decode(&sub)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

func (r *SubscriptionRepositoryImpl) GetSubscriptionByID(ctx context.Context, id string) (*ExpertSubscription, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var sub ExpertSubscription
	err = r.coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&sub)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

func (r *SubscriptionRepositoryImpl) UpdateSubscriptionStatus(ctx context.Context, id string, status string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.coll.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	})
	return err
}
