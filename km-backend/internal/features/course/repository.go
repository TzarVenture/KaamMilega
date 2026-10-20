package course

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"km-backend/internal/database"
)

type CourseRepositoryImpl struct {
	db         *database.MongodbDB
	collection *mongo.Collection
}

func NewCourseRepository(db *database.MongodbDB) CourseRepository {
	coll := db.DB.Collection("courses")

	// Ensure background indexes for fast filtering
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		indexes := []mongo.IndexModel{
			{
				Keys: bson.D{{Key: "expert_id", Value: 1}},
			},
			{
				Keys: bson.D{{Key: "created_at", Value: -1}},
			},
			{
				Keys: bson.D{{Key: "is_published", Value: 1}},
			},
		}
		_, _ = coll.Indexes().CreateMany(ctx, indexes)
	}()

	return &CourseRepositoryImpl{
		db:         db,
		collection: coll,
	}
}

func (r *CourseRepositoryImpl) Create(ctx context.Context, c *Course) (*Course, error) {
	if c.ID.IsZero() {
		c.ID = primitive.NewObjectID()
	}
	c.CreatedAt = time.Now()
	c.UpdatedAt = time.Now()
	c.IsPublished = true

	_, err := r.collection.InsertOne(ctx, c)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CourseRepositoryImpl) FindByID(ctx context.Context, id primitive.ObjectID) (*Course, error) {
	var c Course
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&c)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *CourseRepositoryImpl) Find(ctx context.Context, filter CourseFilter) ([]*Course, int64, error) {
	bsonFilter := bson.M{
		"is_published": true,
	}

	if filter.Search != "" {
		regexPattern := primitive.Regex{Pattern: filter.Search, Options: "i"}
		bsonFilter["$or"] = []bson.M{
			{"title": regexPattern},
			{"description": regexPattern},
			{"expert_name": regexPattern},
			{"category": regexPattern},
		}
	}

	if filter.Category != "" {
		bsonFilter["category"] = primitive.Regex{Pattern: filter.Category, Options: "i"}
	}

	if filter.ExpertID != "" {
		if objID, err := primitive.ObjectIDFromHex(filter.ExpertID); err == nil {
			bsonFilter["expert_id"] = objID
		}
	}

	total, err := r.collection.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 || limit > 100 {
		limit = 10
	}
	skip := int64((page - 1) * limit)

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var courses []*Course
	if err := cursor.All(ctx, &courses); err != nil {
		return nil, 0, err
	}

	if courses == nil {
		courses = []*Course{}
	}

	return courses, total, nil
}

func (r *CourseRepositoryImpl) FindByExpertID(ctx context.Context, expertID primitive.ObjectID, page, limit int) ([]*Course, int64, error) {
	bsonFilter := bson.M{"expert_id": expertID}

	total, err := r.collection.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	skip := int64((page - 1) * limit)

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var courses []*Course
	if err := cursor.All(ctx, &courses); err != nil {
		return nil, 0, err
	}

	if courses == nil {
		courses = []*Course{}
	}

	return courses, total, nil
}

func (r *CourseRepositoryImpl) IncrementViews(ctx context.Context, id primitive.ObjectID) (int64, error) {
	update := bson.M{
		"$inc": bson.M{"views": 1},
		"$set": bson.M{"updated_at": time.Now()},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated Course
	err := r.collection.FindOneAndUpdate(ctx, bson.M{"_id": id}, update, opts).Decode(&updated)
	if err != nil {
		return 0, err
	}
	return updated.Views, nil
}

func (r *CourseRepositoryImpl) Update(ctx context.Context, c *Course) error {
	c.UpdatedAt = time.Now()
	update := bson.M{
		"$set": bson.M{
			"title":            c.Title,
			"description":      c.Description,
			"youtube_url":      c.YouTubeURL,
			"youtube_video_id": c.YouTubeVideoID,
			"thumbnail_url":    c.ThumbnailURL,
			"duration":         c.Duration,
			"category":         c.Category,
			"updated_at":       c.UpdatedAt,
		},
	}
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": c.ID}, update)
	return err
}

func (r *CourseRepositoryImpl) Delete(ctx context.Context, id primitive.ObjectID, expertID primitive.ObjectID) error {
	res, err := r.collection.DeleteOne(ctx, bson.M{"_id": id, "expert_id": expertID})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return errors.New("course not found or unauthorized")
	}
	return nil
}
