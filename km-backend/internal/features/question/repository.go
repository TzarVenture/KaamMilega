package question

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

type QuestionRepository interface {
	Create(ctx context.Context, question *Question) (*Question, error)
	FindByID(ctx context.Context, id string) (*Question, error)
	FindAll(ctx context.Context, filter QuestionFilter) ([]Question, int64, error)
	Update(ctx context.Context, id string, question *Question) (*Question, error)
	Delete(ctx context.Context, id string) error
}

type QuestionRepositoryImpl struct {
	db           *database.MongodbDB
	questionColl *mongo.Collection
}

func NewQuestionRepository(db *database.MongodbDB) QuestionRepository {
	return &QuestionRepositoryImpl{
		db:           db,
		questionColl: db.DB.Collection("questions"),
	}
}

func (r *QuestionRepositoryImpl) Create(ctx context.Context, question *Question) (*Question, error) {
	question.CreatedAt = time.Now()
	question.UpdatedAt = time.Now()
	res, err := r.questionColl.InsertOne(ctx, question)
	if err != nil {
		return nil, err
	}
	question.ID = res.InsertedID.(primitive.ObjectID)
	return question, nil
}

func (r *QuestionRepositoryImpl) FindByID(ctx context.Context, id string) (*Question, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var question Question
	err = r.questionColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&question)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &question, nil
}

func (r *QuestionRepositoryImpl) FindAll(ctx context.Context, filter QuestionFilter) ([]Question, int64, error) {
	query := bson.M{}

	total, _ := r.questionColl.CountDocuments(ctx, query)

	opts := options.Find().SetSort(bson.M{"created_at": -1}) // Newest first
	if filter.Limit > 0 {
		opts.SetLimit(int64(filter.Limit))
		opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
	}

	cursor, err := r.questionColl.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	// Initialize slice to avoid null
	var questions []Question = make([]Question, 0)
	if err = cursor.All(ctx, &questions); err != nil {
		return nil, 0, err
	}
	return questions, total, nil
}

func (r *QuestionRepositoryImpl) Update(ctx context.Context, id string, question *Question) (*Question, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	question.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"question":   question.Question,
			"answer":     question.Answer,
			"updated_at": question.UpdatedAt,
		},
	}

	_, err = r.questionColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		return nil, err
	}

	return r.FindByID(ctx, id)
}

func (r *QuestionRepositoryImpl) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.questionColl.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}
