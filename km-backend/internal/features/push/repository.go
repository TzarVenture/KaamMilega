package push

import (
	"context"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const collectionName = "push_tokens"

type Repository interface {
	// Upsert stores the token for the user; a token that belonged to another account (shared
	// browser, account switch) moves to this user
	Upsert(ctx context.Context, t *Token) error
	// Delete removes the token only when it belongs to the user
	Delete(ctx context.Context, userID primitive.ObjectID, token string) error
	// DeleteTokens removes tokens FCM reported as no longer registered
	DeleteTokens(ctx context.Context, tokens []string) error
	// ForSession lists the user's tokens registered in their current session version
	ForSession(ctx context.Context, userID primitive.ObjectID, sessionVersion int) ([]Token, error)
	// Trim keeps only the newest `keep` tokens of the user
	Trim(ctx context.Context, userID primitive.ObjectID, keep int) error
}

type mongoRepository struct {
	tokens *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	tokens := db.DB.Collection(collectionName)
	_, _ = tokens.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: bson.D{{Key: "token", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "last_seen_at", Value: -1}}},
		// Devices that stop opening the site are forgotten automatically
		{Keys: bson.D{{Key: "last_seen_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(int32(staleAfter / time.Second))},
	})
	return &mongoRepository{tokens: tokens}
}

func (r *mongoRepository) Upsert(ctx context.Context, t *Token) error {
	_, err := r.tokens.UpdateOne(ctx,
		bson.M{"token": t.Token},
		bson.M{
			"$set": bson.M{
				"user_id":         t.UserID,
				"platform":        t.Platform,
				"user_agent":      t.UserAgent,
				"session_version": t.SessionVersion,
				"last_seen_at":    t.LastSeenAt,
			},
			"$setOnInsert": bson.M{"created_at": t.LastSeenAt},
		},
		options.Update().SetUpsert(true),
	)
	return err
}

func (r *mongoRepository) Delete(ctx context.Context, userID primitive.ObjectID, token string) error {
	_, err := r.tokens.DeleteOne(ctx, bson.M{"token": token, "user_id": userID})
	return err
}

func (r *mongoRepository) DeleteTokens(ctx context.Context, tokens []string) error {
	if len(tokens) == 0 {
		return nil
	}
	_, err := r.tokens.DeleteMany(ctx, bson.M{"token": bson.M{"$in": tokens}})
	return err
}

func (r *mongoRepository) ForSession(ctx context.Context, userID primitive.ObjectID, sessionVersion int) ([]Token, error) {
	cur, err := r.tokens.Find(ctx,
		bson.M{"user_id": userID, "session_version": sessionVersion},
		options.Find().SetSort(bson.D{{Key: "last_seen_at", Value: -1}}).SetLimit(maxTokensPerUser),
	)
	if err != nil {
		return nil, err
	}
	var out []Token
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *mongoRepository) Trim(ctx context.Context, userID primitive.ObjectID, keep int) error {
	cur, err := r.tokens.Find(ctx,
		bson.M{"user_id": userID},
		options.Find().SetSort(bson.D{{Key: "last_seen_at", Value: -1}}).SetSkip(int64(keep)).SetProjection(bson.M{"_id": 1}),
	)
	if err != nil {
		return err
	}
	var old []struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	if err := cur.All(ctx, &old); err != nil || len(old) == 0 {
		return err
	}
	ids := make([]primitive.ObjectID, len(old))
	for i, o := range old {
		ids[i] = o.ID
	}
	_, err = r.tokens.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": ids}})
	return err
}
