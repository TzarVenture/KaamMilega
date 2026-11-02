package analytics

import (
	"context"
	"log"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// metric picks the collection and the field that holds the member the numbers belong to
type metric int

const (
	metricProfileViews metric = iota
	metricSearchAppearances
	metricPostImpressions
)

type Repository interface {
	// RecordProfileView stores the visit; mode is how the viewer appears (ViewAsName and so on)
	RecordProfileView(ctx context.Context, profileID, viewerID primitive.ObjectID, mode string, at time.Time) error
	RecordSearchAppearances(ctx context.Context, searcherID primitive.ObjectID, userIDs []primitive.ObjectID, at time.Time) error
	// RecordPostImpression reports whether this is the viewer's first impression of the post today
	RecordPostImpression(ctx context.Context, postID, authorID primitive.ObjectID, viewer Viewer, at time.Time) (bool, error)

	// DailyCounts is the number of events per day, between two days inclusive
	DailyCounts(ctx context.Context, m metric, ownerID primitive.ObjectID, fromDay, toDay string) (map[string]int64, error)
	// DistinctViewers is how many different people viewed the profile between two days inclusive
	DistinctViewers(ctx context.Context, profileID primitive.ObjectID, fromDay, toDay string) (int64, error)
	// RecentViewers is the latest viewers since a day, newest first
	RecentViewers(ctx context.Context, profileID primitive.ObjectID, fromDay string, limit int) ([]RecentViewer, error)
}

type repository struct {
	views       *mongo.Collection
	searches    *mongo.Collection
	impressions *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	r := &repository{
		views:       db.DB.Collection(ProfileViewsCollection),
		searches:    db.DB.Collection(SearchAppearancesCollection),
		impressions: db.DB.Collection(PostImpressionsCollection),
	}
	go r.ensureIndexes()
	return r
}

func (r *repository) ensureIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// Fresh options for every index: the driver writes the generated name into the options it's
	// given, so sharing one value gave every index the first one's name
	unique := func() *options.IndexOptions { return options.Index().SetUnique(true) }
	expire := func() *options.IndexOptions {
		return options.Index().SetExpireAfterSeconds(int32(Retention / time.Second))
	}
	sets := []struct {
		coll   *mongo.Collection
		models []mongo.IndexModel
	}{
		{r.views, []mongo.IndexModel{
			{Keys: bson.D{{Key: "profile_id", Value: 1}, {Key: "viewer_id", Value: 1}, {Key: "day", Value: 1}}, Options: unique()},
			{Keys: bson.D{{Key: "profile_id", Value: 1}, {Key: "day", Value: 1}}},
			{Keys: bson.D{{Key: "viewer_id", Value: 1}}},
			{Keys: bson.D{{Key: "first_at", Value: 1}}, Options: expire()},
		}},
		{r.searches, []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "searcher_id", Value: 1}, {Key: "day", Value: 1}}, Options: unique()},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "day", Value: 1}}},
			{Keys: bson.D{{Key: "searcher_id", Value: 1}}},
			{Keys: bson.D{{Key: "at", Value: 1}}, Options: expire()},
		}},
		{r.impressions, []mongo.IndexModel{
			{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "visitor", Value: 1}, {Key: "day", Value: 1}}, Options: unique()},
			{Keys: bson.D{{Key: "author_id", Value: 1}, {Key: "day", Value: 1}}},
			{Keys: bson.D{{Key: "viewer_id", Value: 1}}},
			{Keys: bson.D{{Key: "at", Value: 1}}, Options: expire()},
		}},
	}
	if err := r.migrateImpressions(ctx); err != nil {
		log.Printf("analytics: migrating impressions: %v", err)
		return
	}
	// Impressions used to be one per member; that unique index would stop a second guest
	// from counting on the same day
	oldImpressions := bson.D{{Key: "post_id", Value: 1}, {Key: "viewer_id", Value: 1}, {Key: "day", Value: 1}}
	for _, s := range sets {
		var obsolete []bson.D
		if s.coll == r.impressions {
			obsolete = append(obsolete, oldImpressions)
		}
		database.SyncIndexes(ctx, s.coll, s.models, obsolete...)
	}
}

// migrateImpressions moves impressions from one-per-member (viewer_id) to one-per-visitor, so
// guests can be counted too. It's a no-op once done.
func (r *repository) migrateImpressions(ctx context.Context) error {
	_, err := r.impressions.UpdateMany(ctx,
		bson.M{"visitor": bson.M{"$exists": false}, "viewer_id": bson.M{"$exists": true}},
		mongo.Pipeline{{{Key: "$set", Value: bson.M{"visitor": bson.M{"$toString": "$viewer_id"}}}}})
	return err
}

func dayOf(t time.Time) string { return t.In(dayZone).Format(dayLayout) }

func (r *repository) RecordProfileView(ctx context.Context, profileID, viewerID primitive.ObjectID, mode string, at time.Time) error {
	filter := bson.M{"profile_id": profileID, "viewer_id": viewerID, "day": dayOf(at)}
	// The latest visit of the day decides how the viewer appears
	set := bson.M{"last_at": at, "mode": mode}
	update := bson.M{"$setOnInsert": bson.M{"first_at": at}, "$set": set}
	_, err := r.views.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		// Two visits raced to create the day's record; the other one won, so just update it
		_, err = r.views.UpdateOne(ctx, filter, bson.M{"$set": set})
	}
	return err
}

func (r *repository) RecordSearchAppearances(ctx context.Context, searcherID primitive.ObjectID, userIDs []primitive.ObjectID, at time.Time) error {
	day := dayOf(at)
	for _, id := range userIDs {
		filter := bson.M{"user_id": id, "searcher_id": searcherID, "day": day}
		_, err := r.searches.UpdateOne(ctx, filter, bson.M{"$setOnInsert": bson.M{"at": at}}, options.Update().SetUpsert(true))
		if err != nil && !mongo.IsDuplicateKeyError(err) {
			return err
		}
	}
	return nil
}

func (r *repository) RecordPostImpression(ctx context.Context, postID, authorID primitive.ObjectID, viewer Viewer, at time.Time) (bool, error) {
	filter := bson.M{"post_id": postID, "visitor": viewer.key(), "day": dayOf(at)}
	insert := bson.M{"author_id": authorID, "at": at}
	if !viewer.MemberID.IsZero() {
		insert["viewer_id"] = viewer.MemberID
	}
	res, err := r.impressions.UpdateOne(ctx, filter, bson.M{"$setOnInsert": insert}, options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return res.UpsertedCount == 1, nil
}

func (r *repository) source(m metric) (*mongo.Collection, string) {
	switch m {
	case metricSearchAppearances:
		return r.searches, "user_id"
	case metricPostImpressions:
		return r.impressions, "author_id"
	default:
		return r.views, "profile_id"
	}
}

func (r *repository) DailyCounts(ctx context.Context, m metric, ownerID primitive.ObjectID, fromDay, toDay string) (map[string]int64, error) {
	coll, owner := r.source(m)
	cursor, err := coll.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{owner: ownerID, "day": bson.M{"$gte": fromDay, "$lte": toDay}}}},
		{{Key: "$group", Value: bson.M{"_id": "$day", "n": bson.M{"$sum": 1}}}},
	})
	if err != nil {
		return nil, err
	}
	var rows []struct {
		Day string `bson:"_id"`
		N   int64  `bson:"n"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, row := range rows {
		out[row.Day] = row.N
	}
	return out, nil
}

func (r *repository) DistinctViewers(ctx context.Context, profileID primitive.ObjectID, fromDay, toDay string) (int64, error) {
	cursor, err := r.views.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"profile_id": profileID, "day": bson.M{"$gte": fromDay, "$lte": toDay}}}},
		{{Key: "$group", Value: bson.M{"_id": "$viewer_id"}}},
		{{Key: "$count", Value: "n"}},
	})
	if err != nil {
		return 0, err
	}
	var rows []struct {
		N int64 `bson:"n"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].N, nil
}

func (r *repository) RecentViewers(ctx context.Context, profileID primitive.ObjectID, fromDay string, limit int) ([]RecentViewer, error) {
	cursor, err := r.views.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"profile_id": profileID, "day": bson.M{"$gte": fromDay}}}},
		// Each viewer's latest visit, and how they chose to appear on it
		{{Key: "$sort", Value: bson.D{{Key: "last_at", Value: -1}}}},
		{{Key: "$group", Value: bson.M{"_id": "$viewer_id", "at": bson.M{"$first": "$last_at"}, "mode": bson.M{"$first": "$mode"}}}},
		{{Key: "$sort", Value: bson.D{{Key: "at", Value: -1}, {Key: "_id", Value: 1}}}},
		{{Key: "$limit", Value: limit}},
	})
	if err != nil {
		return nil, err
	}
	var rows []struct {
		ID   primitive.ObjectID `bson:"_id"`
		At   time.Time          `bson:"at"`
		Mode string             `bson:"mode"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make([]RecentViewer, len(rows))
	for i, row := range rows {
		out[i] = RecentViewer{ViewerID: row.ID, ViewedAt: row.At, Mode: row.Mode}
	}
	return out, nil
}
