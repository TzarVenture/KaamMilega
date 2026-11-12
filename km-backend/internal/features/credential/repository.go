package credential

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

// MaxEndorsementsLoaded bounds one profile's endorsement read
const MaxEndorsementsLoaded = 5000

type Repository interface {
	// Endorse records an endorsement; created is false when it already existed
	Endorse(ctx context.Context, e *Endorsement) (created bool, err error)
	Unendorse(ctx context.Context, userID primitive.ObjectID, skillKey string, endorserID primitive.ObjectID) error
	EndorsementsFor(ctx context.Context, userID primitive.ObjectID) ([]Endorsement, error)
	EndorsersOf(ctx context.Context, userID primitive.ObjectID, skillKey string, limit int) ([]Endorsement, error)
	CountEndorsementsSince(ctx context.Context, endorserID primitive.ObjectID, since time.Time) (int64, error)
	// Blocked is true when either member blocked the other
	Blocked(ctx context.Context, a, b primitive.ObjectID) (bool, error)

	CreateCertification(ctx context.Context, c *Certification) error
	UpdateCertification(ctx context.Context, c *Certification) error
	DeleteCertification(ctx context.Context, id, userID primitive.ObjectID) (bool, error)
	FindCertification(ctx context.Context, id primitive.ObjectID) (*Certification, error)
	ListCertifications(ctx context.Context, userID primitive.ObjectID) ([]Certification, error)
	CountCertifications(ctx context.Context, userID primitive.ObjectID) (int64, error)
	ListByStatus(ctx context.Context, status string, limit int) ([]Certification, error)
	// Review moves a pending certificate to its decision; ok is false if it wasn't pending
	Review(ctx context.Context, id primitive.ObjectID, status, note string, by primitive.ObjectID, at time.Time) (ok bool, err error)
}

type repository struct {
	endorsements *mongo.Collection
	certs        *mongo.Collection
	blocks       *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	r := &repository{
		endorsements: db.DB.Collection("skill_endorsements"),
		certs:        db.DB.Collection("certifications"),
		blocks:       db.DB.Collection("user_blocks"),
	}
	go r.ensureIndexes()
	return r
}

func (r *repository) ensureIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	database.SyncIndexes(ctx, r.endorsements, []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "skill_key", Value: 1}, {Key: "endorser_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "endorser_id", Value: 1}, {Key: "created_at", Value: -1}}},
	})
	database.SyncIndexes(ctx, r.certs, []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "issued_on", Value: -1}}},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updated_at", Value: 1}}},
	})
}

func (r *repository) Endorse(ctx context.Context, e *Endorsement) (bool, error) {
	if e.ID.IsZero() {
		e.ID = primitive.NewObjectID()
	}
	_, err := r.endorsements.InsertOne(ctx, e)
	if mongo.IsDuplicateKeyError(err) {
		return false, nil
	}
	return err == nil, err
}

func (r *repository) Unendorse(ctx context.Context, userID primitive.ObjectID, skillKey string, endorserID primitive.ObjectID) error {
	_, err := r.endorsements.DeleteOne(ctx, bson.M{"user_id": userID, "skill_key": skillKey, "endorser_id": endorserID})
	return err
}

func (r *repository) EndorsementsFor(ctx context.Context, userID primitive.ObjectID) ([]Endorsement, error) {
	return r.findEndorsements(ctx, bson.M{"user_id": userID}, MaxEndorsementsLoaded)
}

func (r *repository) EndorsersOf(ctx context.Context, userID primitive.ObjectID, skillKey string, limit int) ([]Endorsement, error) {
	return r.findEndorsements(ctx, bson.M{"user_id": userID, "skill_key": skillKey}, limit)
}

func (r *repository) findEndorsements(ctx context.Context, filter bson.M, limit int) ([]Endorsement, error) {
	cur, err := r.endorsements.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	out := []Endorsement{}
	err = cur.All(ctx, &out)
	return out, err
}

func (r *repository) CountEndorsementsSince(ctx context.Context, endorserID primitive.ObjectID, since time.Time) (int64, error) {
	return r.endorsements.CountDocuments(ctx, bson.M{"endorser_id": endorserID, "created_at": bson.M{"$gte": since}})
}

func (r *repository) Blocked(ctx context.Context, a, b primitive.ObjectID) (bool, error) {
	n, err := r.blocks.CountDocuments(ctx, bson.M{"$or": []bson.M{
		{"user_id": a, "blocked_user_id": b},
		{"user_id": b, "blocked_user_id": a},
	}}, options.Count().SetLimit(1))
	return n > 0, err
}

func (r *repository) CreateCertification(ctx context.Context, c *Certification) error {
	if c.ID.IsZero() {
		c.ID = primitive.NewObjectID()
	}
	_, err := r.certs.InsertOne(ctx, c)
	return err
}

func (r *repository) UpdateCertification(ctx context.Context, c *Certification) error {
	_, err := r.certs.ReplaceOne(ctx, bson.M{"_id": c.ID, "user_id": c.UserID}, c)
	return err
}

func (r *repository) DeleteCertification(ctx context.Context, id, userID primitive.ObjectID) (bool, error) {
	res, err := r.certs.DeleteOne(ctx, bson.M{"_id": id, "user_id": userID})
	if err != nil {
		return false, err
	}
	return res.DeletedCount > 0, nil
}

func (r *repository) FindCertification(ctx context.Context, id primitive.ObjectID) (*Certification, error) {
	var c Certification
	err := r.certs.FindOne(ctx, bson.M{"_id": id}).Decode(&c)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *repository) ListCertifications(ctx context.Context, userID primitive.ObjectID) ([]Certification, error) {
	cur, err := r.certs.Find(ctx, bson.M{"user_id": userID},
		options.Find().SetSort(bson.D{{Key: "issued_on", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(MaxCertifications))
	if err != nil {
		return nil, err
	}
	out := []Certification{}
	err = cur.All(ctx, &out)
	return out, err
}

func (r *repository) CountCertifications(ctx context.Context, userID primitive.ObjectID) (int64, error) {
	return r.certs.CountDocuments(ctx, bson.M{"user_id": userID})
}

func (r *repository) ListByStatus(ctx context.Context, status string, limit int) ([]Certification, error) {
	filter := bson.M{}
	sort := bson.D{{Key: "updated_at", Value: -1}}
	if status != "" {
		filter["status"] = status
	}
	if status == StatusPending {
		// Oldest first, so nobody waits longest
		sort = bson.D{{Key: "updated_at", Value: 1}}
	}
	cur, err := r.certs.Find(ctx, filter, options.Find().SetSort(sort).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	out := []Certification{}
	err = cur.All(ctx, &out)
	return out, err
}

func (r *repository) Review(ctx context.Context, id primitive.ObjectID, status, note string, by primitive.ObjectID, at time.Time) (bool, error) {
	set := bson.M{"status": status, "reviewed_by": by, "reviewed_at": at}
	update := bson.M{"$set": set}
	if note != "" {
		set["review_note"] = note
	} else {
		update["$unset"] = bson.M{"review_note": ""}
	}
	res, err := r.certs.UpdateOne(ctx, bson.M{"_id": id, "status": StatusPending}, update)
	if err != nil {
		return false, err
	}
	return res.MatchedCount > 0, nil
}
