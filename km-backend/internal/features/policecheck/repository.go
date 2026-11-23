package policecheck

import (
	"context"
	"errors"
	"strings"

	"km-backend/internal/database"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Repository reads and writes the police_verification field on users
type Repository interface {
	Get(ctx context.Context, userID primitive.ObjectID) (*user.PoliceVerification, error)
	Save(ctx context.Context, userID primitive.ObjectID, v *user.PoliceVerification) error
	// Decide records a review only if the same pending certificate is still there
	Decide(ctx context.Context, userID primitive.ObjectID, pendingFileID string, v *user.PoliceVerification) (bool, error)
	List(ctx context.Context, status string, page, limit int) ([]QueueItem, int64, error)
}

type repository struct {
	users *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	return &repository{users: db.DB.Collection("users")}
}

type memberDoc struct {
	ID                 primitive.ObjectID       `bson:"_id"`
	Name               string                   `bson:"name"`
	FirstName          string                   `bson:"first_name"`
	LastName           string                   `bson:"last_name"`
	ProfileImage       string                   `bson:"profile_image"`
	City               string                   `bson:"city"`
	Roles              []string                 `bson:"roles"`
	PoliceVerification *user.PoliceVerification `bson:"police_verification"`
}

func (r *repository) Get(ctx context.Context, userID primitive.ObjectID) (*user.PoliceVerification, error) {
	var doc memberDoc
	err := r.users.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(bson.M{"police_verification": 1})).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.PoliceVerification, nil
}

func (r *repository) Save(ctx context.Context, userID primitive.ObjectID, v *user.PoliceVerification) error {
	res, err := r.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$set": bson.M{"police_verification": v}})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) Decide(ctx context.Context, userID primitive.ObjectID, pendingFileID string, v *user.PoliceVerification) (bool, error) {
	res, err := r.users.UpdateOne(ctx, bson.M{
		"_id":                         userID,
		"police_verification.status":  user.PoliceStatusPending,
		"police_verification.file_id": pendingFileID,
	}, bson.M{"$set": bson.M{"police_verification": v}})
	if err != nil {
		return false, err
	}
	return res.ModifiedCount == 1, nil
}

func (r *repository) List(ctx context.Context, status string, page, limit int) ([]QueueItem, int64, error) {
	filter := bson.M{"police_verification.status": status}
	total, err := r.users.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	// The oldest waiting certificate first; reviewed ones newest first
	order := -1
	if status == user.PoliceStatusPending {
		order = 1
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "police_verification.submitted_at", Value: order}}).
		SetSkip(int64((page - 1) * limit)).SetLimit(int64(limit)).
		SetProjection(bson.M{"name": 1, "first_name": 1, "last_name": 1, "profile_image": 1, "city": 1, "roles": 1, "police_verification": 1})
	cur, err := r.users.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var docs []memberDoc
	if err := cur.All(ctx, &docs); err != nil {
		return nil, 0, err
	}
	items := make([]QueueItem, 0, len(docs))
	for _, d := range docs {
		name := strings.TrimSpace(d.Name)
		if name == "" {
			name = strings.TrimSpace(d.FirstName + " " + d.LastName)
		}
		roles := d.Roles
		if roles == nil {
			roles = []string{}
		}
		items = append(items, QueueItem{
			Member:       Member{ID: d.ID.Hex(), Name: name, Avatar: d.ProfileImage, City: d.City, Roles: roles},
			Verification: d.PoliceVerification,
		})
	}
	return items, total, nil
}
