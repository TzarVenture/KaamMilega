package policies

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

type Repository interface {
	Get(ctx context.Context, slug string) (*Policy, error)
	All(ctx context.Context) (map[string]*Policy, error)
	// Publish stores a new version if the policy is still at baseVersion (0 = never published)
	Publish(ctx context.Context, slug, title, content string, baseVersion int, by primitive.ObjectID, at time.Time) (*Policy, error)
	// Versions lists every version without its text, newest first
	Versions(ctx context.Context, slug string) ([]Version, error)
	Version(ctx context.Context, slug string, version int) (*Version, error)
}

type mongoRepository struct {
	policies *mongo.Collection
	versions *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	r := &mongoRepository{
		policies: db.DB.Collection(PoliciesCollection),
		versions: db.DB.Collection(VersionsCollection),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	database.SyncIndexes(ctx, r.versions, []mongo.IndexModel{
		{Keys: bson.D{{Key: "slug", Value: 1}, {Key: "version", Value: -1}}, Options: options.Index().SetUnique(true)},
	})
	return r
}

func (r *mongoRepository) Get(ctx context.Context, slug string) (*Policy, error) {
	var p Policy
	err := r.policies.FindOne(ctx, bson.M{"_id": slug}).Decode(&p)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *mongoRepository) All(ctx context.Context) (map[string]*Policy, error) {
	cur, err := r.policies.Find(ctx, bson.M{}, options.Find().SetProjection(bson.M{"content": 0}))
	if err != nil {
		return nil, err
	}
	var list []Policy
	if err := cur.All(ctx, &list); err != nil {
		return nil, err
	}
	out := make(map[string]*Policy, len(list))
	for i := range list {
		out[list[i].Slug] = &list[i]
	}
	return out, nil
}

func (r *mongoRepository) Publish(ctx context.Context, slug, title, content string, baseVersion int, by primitive.ObjectID, at time.Time) (*Policy, error) {
	next := baseVersion + 1
	set := bson.M{"title": title, "content": content, "version": next, "published_at": at, "published_by": by}
	var err error
	if baseVersion == 0 {
		// First version: the insert fails if someone else published first
		_, err = r.policies.InsertOne(ctx, bson.M{"_id": slug, "title": title, "content": content, "version": next, "published_at": at, "published_by": by})
		if mongo.IsDuplicateKeyError(err) {
			return nil, errVersionConflict
		}
	} else {
		var res *mongo.UpdateResult
		res, err = r.policies.UpdateOne(ctx, bson.M{"_id": slug, "version": baseVersion}, bson.M{"$set": set})
		if err == nil && res.MatchedCount == 0 {
			return nil, errVersionConflict
		}
	}
	if err != nil {
		return nil, err
	}
	// The record of versions is written after the live copy; the unique index keeps it to one per
	// version even if this is retried
	if _, err := r.versions.InsertOne(ctx, Version{Slug: slug, Version: next, Title: title, Content: content, PublishedAt: at, PublishedBy: by}); err != nil && !mongo.IsDuplicateKeyError(err) {
		return nil, err
	}
	return &Policy{Slug: slug, Title: title, Content: content, Version: next, PublishedAt: at, PublishedBy: by}, nil
}

// versionsLimit bounds the history list; policies change a few times a year
const versionsLimit = 100

func (r *mongoRepository) Versions(ctx context.Context, slug string) ([]Version, error) {
	cur, err := r.versions.Find(ctx, bson.M{"slug": slug},
		options.Find().SetSort(bson.D{{Key: "version", Value: -1}}).SetLimit(versionsLimit).SetProjection(bson.M{"content": 0}))
	if err != nil {
		return nil, err
	}
	out := []Version{}
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *mongoRepository) Version(ctx context.Context, slug string, version int) (*Version, error) {
	var v Version
	err := r.versions.FindOne(ctx, bson.M{"slug": slug, "version": version}).Decode(&v)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}
