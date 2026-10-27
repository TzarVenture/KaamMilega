package app_waitlist

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"km-backend/internal/database"
)

type mongoRepository struct {
	coll *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	coll := db.DB.Collection("app_waitlist")
	_, _ = coll.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: bson.D{{Key: "mobile", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "interest", Value: 1}, {Key: "created_at", Value: -1}}},
	})
	return &mongoRepository{coll: coll}
}

func (r *mongoRepository) Upsert(ctx context.Context, e *Entry) error {
	now := time.Now()
	set := bson.M{"interest": e.Interest, "updated_at": now}
	if e.Trade != "" {
		set["trade"] = e.Trade
	}
	_, err := r.coll.UpdateOne(ctx,
		bson.M{"mobile": e.Mobile},
		bson.M{"$set": set, "$setOnInsert": bson.M{"mobile": e.Mobile, "created_at": now}},
		options.Update().SetUpsert(true),
	)
	return err
}

func (r *mongoRepository) List(ctx context.Context, interest string, limit, skip int64) ([]*Entry, int64, error) {
	filter := bson.M{}
	if interest != "" {
		filter["interest"] = interest
	}
	total, err := r.coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(limit).SetSkip(skip)
	cursor, err := r.coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	list := []*Entry{}
	if err := cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}
