package application

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

type ApplicationRepository interface {
	Create(ctx context.Context, app *Application) (*Application, error)
	FindByID(ctx context.Context, id string) (*Application, error)
	FindAll(ctx context.Context, filter ApplicationFilter) ([]Application, error)
	UpdateStatus(ctx context.Context, id string, status string) (*Application, error)
	Delete(ctx context.Context, id string) error

	// Helper to check if candidate already applied for a job
	HasApplied(ctx context.Context, candidateID, jobID string) (bool, error)
	CountByJob(ctx context.Context, jobID string) (int, error)
}

type ApplicationRepositoryImpl struct {
	db      *database.MongodbDB
	appColl *mongo.Collection
}

func NewApplicationRepository(db *database.MongodbDB) ApplicationRepository {
	return &ApplicationRepositoryImpl{
		db:      db,
		appColl: db.DB.Collection("applications"),
	}
}

func (r *ApplicationRepositoryImpl) Create(ctx context.Context, app *Application) (*Application, error) {
	app.CreatedAt = time.Now()
	app.UpdatedAt = time.Now()
	res, err := r.appColl.InsertOne(ctx, app)
	if err != nil {
		return nil, err
	}
	app.ID = res.InsertedID.(primitive.ObjectID)
	return app, nil
}

func (r *ApplicationRepositoryImpl) FindByID(ctx context.Context, id string) (*Application, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var app Application
	err = r.appColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&app)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &app, nil
}

func (r *ApplicationRepositoryImpl) FindAll(ctx context.Context, filter ApplicationFilter) ([]Application, error) {
	bsonFilter := bson.M{}

	if filter.JobID != "" {
		oid, err := primitive.ObjectIDFromHex(filter.JobID)
		if err == nil {
			bsonFilter["job_id"] = oid
		}
	}
	if filter.RecruiterID != "" {
		oid, err := primitive.ObjectIDFromHex(filter.RecruiterID)
		if err == nil {
			bsonFilter["recruiter_id"] = oid
		}
	}
	if filter.CandidateID != "" {
		oid, err := primitive.ObjectIDFromHex(filter.CandidateID)
		if err == nil {
			bsonFilter["candidate_id"] = oid
		}
	}
	if filter.Status != "" {
		bsonFilter["status"] = filter.Status
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.appColl.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var apps []Application = make([]Application, 0)
	if err = cursor.All(ctx, &apps); err != nil {
		return nil, err
	}
	return apps, nil
}

func (r *ApplicationRepositoryImpl) UpdateStatus(ctx context.Context, id string, status string) (*Application, error) {
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

	_, err = r.appColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *ApplicationRepositoryImpl) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.appColl.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}

func (r *ApplicationRepositoryImpl) HasApplied(ctx context.Context, candidateID, jobID string) (bool, error) {
	cOID, err := primitive.ObjectIDFromHex(candidateID)
	if err != nil {
		return false, err
	}
	jOID, err := primitive.ObjectIDFromHex(jobID)
	if err != nil {
		return false, err
	}

	count, err := r.appColl.CountDocuments(ctx, bson.M{
		"candidate_id": cOID,
		"job_id":       jOID,
	})
	return count > 0, err
}

func (r *ApplicationRepositoryImpl) CountByJob(ctx context.Context, jobID string) (int, error) {
	jOID, err := primitive.ObjectIDFromHex(jobID)
	if err != nil {
		return 0, err
	}
	count, err := r.appColl.CountDocuments(ctx, bson.M{"job_id": jOID})
	return int(count), err
}
