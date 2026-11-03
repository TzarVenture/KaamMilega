package ads

import (
	"context"
	"errors"
	"regexp"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var ErrNotFound = errors.New("campaign not found")

type Repository interface {
	Create(ctx context.Context, c *Campaign) error
	Update(ctx context.Context, id primitive.ObjectID, c *Campaign) error
	SetStatus(ctx context.Context, id primitive.ObjectID, status string) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	Get(ctx context.Context, id primitive.ObjectID) (*Campaign, error)
	List(ctx context.Context, search string) ([]*Campaign, error)

	// Candidates are the campaigns running in a slot now, before audience and city checks
	Candidates(ctx context.Context, placement string, now time.Time) ([]*Campaign, error)
	// ShownToday is how many impressions each campaign has had today for this person
	ShownToday(ctx context.Context, viewer, day string, ids []primitive.ObjectID) (map[primitive.ObjectID]int, error)
	// RecordImpression counts an impression, up to limit for one person a day
	RecordImpression(ctx context.Context, id primitive.ObjectID, viewer, day string, limit int) error
	// RecordClick counts the person's first click on the campaign that day; later ones are ignored
	RecordClick(ctx context.Context, id primitive.ObjectID, viewer, day string) error
	Daily(ctx context.Context, id primitive.ObjectID, fromDay string) ([]DayStats, error)

	UserCity(ctx context.Context, userID primitive.ObjectID) (string, error)
}

type mongoRepository struct {
	campaigns *mongo.Collection
	daily     *mongo.Collection
	views     *mongo.Collection
	users     *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	r := &mongoRepository{
		campaigns: db.DB.Collection(CampaignsCollection),
		daily:     db.DB.Collection(DailyCollection),
		views:     db.DB.Collection(ViewsCollection),
		users:     db.DB.Collection("users"),
	}
	ctx := context.Background()
	database.SyncIndexes(ctx, r.campaigns, []mongo.IndexModel{
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "placements", Value: 1}}, Options: options.Index()},
		{Keys: bson.D{{Key: "created_at", Value: -1}}, Options: options.Index()},
	})
	database.SyncIndexes(ctx, r.daily, []mongo.IndexModel{
		{Keys: bson.D{{Key: "campaign_id", Value: 1}, {Key: "day", Value: 1}}, Options: options.Index().SetUnique(true)},
	})
	database.SyncIndexes(ctx, r.views, []mongo.IndexModel{
		{Keys: bson.D{{Key: "campaign_id", Value: 1}, {Key: "viewer", Value: 1}, {Key: "day", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "viewer", Value: 1}, {Key: "day", Value: 1}}, Options: options.Index()},
		{Keys: bson.D{{Key: "expire_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	return r
}

func (r *mongoRepository) Create(ctx context.Context, c *Campaign) error {
	res, err := r.campaigns.InsertOne(ctx, c)
	if err != nil {
		return err
	}
	c.ID = res.InsertedID.(primitive.ObjectID)
	return nil
}

// Update replaces what the admin edits and keeps the counts and who created it
func (r *mongoRepository) Update(ctx context.Context, id primitive.ObjectID, c *Campaign) error {
	set := bson.M{
		"name": c.Name, "advertiser": c.Advertiser, "headline": c.Headline, "body": c.Body,
		"cta_label": c.CTALabel, "creative_type": c.CreativeType, "creative_url": c.CreativeURL,
		"link_url": c.LinkURL, "placements": c.Placements, "cities": c.Cities, "audiences": c.Audiences,
		"start_at": c.StartAt, "priority": c.Priority, "frequency_cap": c.FreqCap, "status": c.Status,
		"updated_at": c.UpdatedAt,
	}
	update := bson.M{"$set": set}
	if c.EndAt != nil {
		set["end_at"] = c.EndAt
	} else {
		update["$unset"] = bson.M{"end_at": ""}
	}
	res, err := r.campaigns.UpdateByID(ctx, id, update)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mongoRepository) SetStatus(ctx context.Context, id primitive.ObjectID, status string) error {
	res, err := r.campaigns.UpdateByID(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now()}})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mongoRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	res, err := r.campaigns.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return ErrNotFound
	}
	_, _ = r.daily.DeleteMany(ctx, bson.M{"campaign_id": id})
	_, _ = r.views.DeleteMany(ctx, bson.M{"campaign_id": id})
	return nil
}

func (r *mongoRepository) Get(ctx context.Context, id primitive.ObjectID) (*Campaign, error) {
	var c Campaign
	if err := r.campaigns.FindOne(ctx, bson.M{"_id": id}).Decode(&c); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

func (r *mongoRepository) List(ctx context.Context, search string) ([]*Campaign, error) {
	filter := bson.M{}
	if search != "" {
		re := primitive.Regex{Pattern: regexp.QuoteMeta(search), Options: "i"}
		filter["$or"] = bson.A{bson.M{"name": re}, bson.M{"advertiser": re}, bson.M{"headline": re}}
	}
	cur, err := r.campaigns.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(500))
	if err != nil {
		return nil, err
	}
	list := []*Campaign{}
	if err := cur.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *mongoRepository) Candidates(ctx context.Context, placement string, now time.Time) ([]*Campaign, error) {
	filter := bson.M{
		"status":     StatusActive,
		"placements": placement,
		"start_at":   bson.M{"$lte": now},
		"$or":        bson.A{bson.M{"end_at": bson.M{"$exists": false}}, bson.M{"end_at": nil}, bson.M{"end_at": bson.M{"$gt": now}}},
	}
	cur, err := r.campaigns.Find(ctx, filter, options.Find().SetLimit(200))
	if err != nil {
		return nil, err
	}
	list := []*Campaign{}
	if err := cur.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *mongoRepository) ShownToday(ctx context.Context, viewer, day string, ids []primitive.ObjectID) (map[primitive.ObjectID]int, error) {
	out := map[primitive.ObjectID]int{}
	if len(ids) == 0 {
		return out, nil
	}
	cur, err := r.views.Find(ctx, bson.M{"viewer": viewer, "day": day, "campaign_id": bson.M{"$in": ids}},
		options.Find().SetProjection(bson.M{"campaign_id": 1, "count": 1}))
	if err != nil {
		return nil, err
	}
	var rows []struct {
		CampaignID primitive.ObjectID `bson:"campaign_id"`
		Count      int                `bson:"count"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.CampaignID] = row.Count
	}
	return out, nil
}

func (r *mongoRepository) bumpDaily(ctx context.Context, id primitive.ObjectID, day string, inc bson.M) error {
	_, err := r.daily.UpdateOne(ctx,
		bson.M{"campaign_id": id, "day": day},
		bson.M{"$inc": inc, "$setOnInsert": bson.M{"campaign_id": id, "day": day}},
		options.Update().SetUpsert(true))
	return err
}

func (r *mongoRepository) RecordImpression(ctx context.Context, id primitive.ObjectID, viewer, day string, limit int) error {
	var row struct {
		Count int `bson:"count"`
	}
	err := r.views.FindOneAndUpdate(ctx,
		bson.M{"campaign_id": id, "viewer": viewer, "day": day},
		bson.M{
			"$inc":         bson.M{"count": 1},
			"$setOnInsert": bson.M{"campaign_id": id, "viewer": viewer, "day": day, "expire_at": time.Now().Add(viewRetention)},
		},
		options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After).SetProjection(bson.M{"count": 1})).Decode(&row)
	if err != nil {
		return err
	}
	if row.Count > limit {
		return nil
	}
	inc := bson.M{"impressions": 1}
	// The person's first impression today; a click can create their row before it (count 0)
	if row.Count == 1 {
		inc["reach"] = 1
	}
	if _, err := r.campaigns.UpdateByID(ctx, id, bson.M{"$inc": bson.M{"impressions": 1}}); err != nil {
		return err
	}
	return r.bumpDaily(ctx, id, day, inc)
}

func (r *mongoRepository) RecordClick(ctx context.Context, id primitive.ObjectID, viewer, day string) error {
	_, err := r.views.UpdateOne(ctx,
		bson.M{"campaign_id": id, "viewer": viewer, "day": day, "clicked": bson.M{"$ne": true}},
		bson.M{
			"$set":         bson.M{"clicked": true},
			"$setOnInsert": bson.M{"campaign_id": id, "viewer": viewer, "day": day, "count": 0, "expire_at": time.Now().Add(viewRetention)},
		},
		options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		// Already clicked today: the row exists and the filter skipped it
		return nil
	}
	if err != nil {
		return err
	}
	if _, err := r.campaigns.UpdateByID(ctx, id, bson.M{"$inc": bson.M{"clicks": 1}}); err != nil {
		return err
	}
	return r.bumpDaily(ctx, id, day, bson.M{"clicks": 1})
}

func (r *mongoRepository) Daily(ctx context.Context, id primitive.ObjectID, fromDay string) ([]DayStats, error) {
	cur, err := r.daily.Find(ctx, bson.M{"campaign_id": id, "day": bson.M{"$gte": fromDay}},
		options.Find().SetSort(bson.D{{Key: "day", Value: 1}}))
	if err != nil {
		return nil, err
	}
	rows := []DayStats{}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *mongoRepository) UserCity(ctx context.Context, userID primitive.ObjectID) (string, error) {
	var u struct {
		City string `bson:"city"`
	}
	err := r.users.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(bson.M{"city": 1})).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	return u.City, err
}
