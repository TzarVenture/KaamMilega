package event

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"km-backend/internal/database"
)

type EventRepositoryImpl struct {
	db         *database.MongodbDB
	collection *mongo.Collection
}

func NewEventRepository(db *database.MongodbDB) EventRepository {
	return &EventRepositoryImpl{
		db:         db,
		collection: db.DB.Collection("events"),
	}
}

func (r *EventRepositoryImpl) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	e.CreatedAt = time.Now()
	e.ID = primitive.NewObjectID()
	_, err := r.collection.InsertOne(ctx, e)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *EventRepositoryImpl) GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error) {
	bsonFilter := bson.M{}
	if filter.Search != "" {
		regex := bson.M{"$regex": filter.Search, "$options": "i"}
		// If $or is already populated, we wrap it in an $and later, but here we can just assign
		bsonFilter["$or"] = []bson.M{
			{"title": regex},
			{"organizer": regex},
		}
	}

	if filter.Location != "" {
		bsonFilter["location"] = bson.M{"$regex": filter.Location, "$options": "i"}
	}

	opts := options.Find()
	if filter.Sort == "Upcoming" {
		opts.SetSort(bson.M{"date": 1}) // A simplistic approach if dates sortlexicographically or just map logic locally. Actually `created_at` could be used.
	} else {
		opts.SetSort(bson.M{"created_at": -1}) // Recently added (default)
	}

	total, err := r.collection.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	if filter.Limit > 0 {
		opts.SetLimit(int64(filter.Limit))
		if filter.Page > 1 {
			opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
		}
	}

	cursor, err := r.collection.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var events []Event
	if err := cursor.All(ctx, &events); err != nil {
		return nil, 0, err
	}
	
	if events == nil {
		events = []Event{}
	}

	return events, total, nil
}

func (r *EventRepositoryImpl) GetEventByID(ctx context.Context, id primitive.ObjectID) (*Event, error) {
	var e Event
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&e)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *EventRepositoryImpl) RegisterUser(ctx context.Context, eventID, userID primitive.ObjectID) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": eventID},
		bson.M{"$addToSet": bson.M{"participants": userID}},
	)
	return err
}
