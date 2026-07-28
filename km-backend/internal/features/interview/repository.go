package interview

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

type InterviewRepository interface {
	Create(ctx context.Context, interview *Interview) (*Interview, error)
	FindByID(ctx context.Context, id string) (*Interview, error)
	FindByApplication(ctx context.Context, appID string) ([]Interview, error)
	FindByRecruiter(ctx context.Context, recruiterID string) ([]Interview, error)
	FindByParticipant(ctx context.Context, userID string) ([]Interview, error)
	UpdateStatus(ctx context.Context, id string, status string) (*Interview, error)
}

type InterviewRepositoryImpl struct {
	db      *database.MongodbDB
	intColl *mongo.Collection
}

func NewInterviewRepository(db *database.MongodbDB) InterviewRepository {
	return &InterviewRepositoryImpl{
		db:      db,
		intColl: db.DB.Collection("interviews"),
	}
}

func (r *InterviewRepositoryImpl) Create(ctx context.Context, interview *Interview) (*Interview, error) {
	interview.CreatedAt = time.Now()
	interview.UpdatedAt = time.Now()
	res, err := r.intColl.InsertOne(ctx, interview)
	if err != nil {
		return nil, err
	}
	interview.ID = res.InsertedID.(primitive.ObjectID)
	return interview, nil
}

func (r *InterviewRepositoryImpl) FindByID(ctx context.Context, id string) (*Interview, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var interview Interview
	err = r.intColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&interview)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &interview, nil
}

func (r *InterviewRepositoryImpl) FindByApplication(ctx context.Context, appID string) ([]Interview, error) {
	oid, err := primitive.ObjectIDFromHex(appID)
	if err != nil {
		return nil, err
	}
	var interviews []Interview = make([]Interview, 0)
	opts := options.Find().SetSort(bson.M{"scheduled_at": 1})
	cursor, err := r.intColl.Find(ctx, bson.M{"application_id": oid}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if err = cursor.All(ctx, &interviews); err != nil {
		return nil, err
	}
	return interviews, nil
}

func (r *InterviewRepositoryImpl) FindByRecruiter(ctx context.Context, recruiterID string) ([]Interview, error) {
	oid, err := primitive.ObjectIDFromHex(recruiterID)
	if err != nil {
		return nil, err
	}
	var interviews []Interview = make([]Interview, 0)
	opts := options.Find().SetSort(bson.M{"scheduled_at": 1})
	cursor, err := r.intColl.Find(ctx, bson.M{"recruiter_id": oid}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if err = cursor.All(ctx, &interviews); err != nil {
		return nil, err
	}
	return interviews, nil
}

func (r *InterviewRepositoryImpl) FindByParticipant(ctx context.Context, userID string) ([]Interview, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}

	filter := bson.M{
		"$or": []bson.M{
			{"recruiter_id": oid},
			{"candidate_id": oid},
		},
	}

	var interviews []Interview = make([]Interview, 0)
	opts := options.Find().SetSort(bson.M{"scheduled_at": 1})
	cursor, err := r.intColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if err = cursor.All(ctx, &interviews); err != nil {
		return nil, err
	}
	return interviews, nil
}

func (r *InterviewRepositoryImpl) UpdateStatus(ctx context.Context, id string, status string) (*Interview, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	}
	_, err = r.intColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}
