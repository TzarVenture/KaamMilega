package story

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/database"
	"km-backend/internal/features/file"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Collections, also named in account deletion
const (
	StoriesCollection = "stories"
	ViewsCollection   = "story_views"
	ReportsCollection = "story_reports"
	// SharesCollection logs each story shared, for the daily limit; entries go after a day
	SharesCollection = "story_shares"
)

type Repository interface {
	Insert(ctx context.Context, s *Story) error
	Get(ctx context.Context, id primitive.ObjectID) (*Story, error)
	// CountSince counts stories shared since then, deleted ones included
	CountSince(ctx context.Context, owner primitive.ObjectID, since time.Time) (int64, error)
	LogShare(ctx context.Context, owner primitive.ObjectID, at time.Time) error
	// ClaimMedia checks the upload is the member's own and on nothing else, and ties it to the story
	ClaimMedia(ctx context.Context, owner, storyID primitive.ObjectID, in MediaInput) (Media, error)
	// Unclaim frees files a story took, when the story couldn't be saved
	Unclaim(ctx context.Context, storyID primitive.ObjectID, ids []primitive.ObjectID)
	// FileKeys are the storage keys of these uploads
	FileKeys(ctx context.Context, ids []primitive.ObjectID) ([]string, error)
	DeleteFileRecords(ctx context.Context, ids []primitive.ObjectID) error

	// Connections are the members connected to userID, in either direction
	Connections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	IsConnected(ctx context.Context, a, b primitive.ObjectID) (bool, error)
	// FollowedCompanies are the recruiters whose company userID follows
	FollowedCompanies(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	Follows(ctx context.Context, userID, companyID primitive.ObjectID) (bool, error)
	BlockedEitherWay(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)

	// Live are the active, unexpired stories of these members, oldest first
	Live(ctx context.Context, owners []primitive.ObjectID, now time.Time) ([]Story, error)
	SeenBy(ctx context.Context, viewer primitive.ObjectID, storyIDs []primitive.ObjectID) (map[primitive.ObjectID]bool, error)
	// AddView records a view once; added is true the first time
	AddView(ctx context.Context, s *Story, viewer primitive.ObjectID, at time.Time) (added bool, err error)
	Viewers(ctx context.Context, storyID primitive.ObjectID, limit int) ([]View, error)

	SetStatus(ctx context.Context, id primitive.ObjectID, from []string, to string) (bool, error)
	// HideForReview takes down a reported story its owner deleted, keeping it for the moderator.
	// wasShowing: it was on show until now (not already hidden by reports).
	HideForReview(ctx context.Context, id primitive.ObjectID) (wasShowing bool, err error)
	// FileKey is the storage key of one upload
	FileKey(ctx context.Context, id primitive.ObjectID) (string, error)
	// MoveFile records a file's new storage key and address
	MoveFile(ctx context.Context, id primitive.ObjectID, key, url string) error
	// SetMediaURLs points the story at its files' new addresses
	SetMediaURLs(ctx context.Context, id primitive.ObjectID, url, posterURL string) error
	// Delete removes the story and its views; reports stay as the moderation record
	Delete(ctx context.Context, id primitive.ObjectID) error

	CreateReport(ctx context.Context, r *Report) error
	CountPendingReports(ctx context.Context, storyID primitive.ObjectID) (int64, error)
	PendingReports(ctx context.Context, storyID primitive.ObjectID) ([]Report, error)
	ResolveReports(ctx context.Context, storyID, adminID primitive.ObjectID, decision string, at time.Time) error
	// ReportedStoryIDs are stories with open reports, most recently reported first
	ReportedStoryIDs(ctx context.Context, skip, limit int) ([]primitive.ObjectID, int64, error)
	FindByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Story, error)

	// Due are stories whose purge time has come, up to limit, oldest first
	Due(ctx context.Context, now time.Time, limit int) ([]Story, error)
	SetPurgeAt(ctx context.Context, id primitive.ObjectID, at time.Time) error
	// CloseOrphanReports closes open reports whose story is gone (reported as it was deleted)
	CloseOrphanReports(ctx context.Context, at time.Time) error
}

type repository struct {
	stories     *mongo.Collection
	views       *mongo.Collection
	reports     *mongo.Collection
	shares      *mongo.Collection
	files       *mongo.Collection
	connections *mongo.Collection
	follows     *mongo.Collection
	blocks      *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	r := &repository{
		stories:     db.DB.Collection(StoriesCollection),
		views:       db.DB.Collection(ViewsCollection),
		reports:     db.DB.Collection(ReportsCollection),
		shares:      db.DB.Collection(SharesCollection),
		files:       db.DB.Collection("files"),
		connections: db.DB.Collection("network_connections"),
		follows:     db.DB.Collection("company_follows"),
		blocks:      db.DB.Collection("user_blocks"),
	}
	database.SyncIndexesInBackground(r.stories, []mongo.IndexModel{
		{Keys: bson.D{{Key: "owner_id", Value: 1}, {Key: "expires_at", Value: 1}}},
		{Keys: bson.D{{Key: "purge_at", Value: 1}}},
	})
	database.SyncIndexesInBackground(r.views, []mongo.IndexModel{
		{Keys: bson.D{{Key: "story_id", Value: 1}, {Key: "viewer_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "viewer_id", Value: 1}}},
		{Keys: bson.D{{Key: "story_id", Value: 1}, {Key: "viewed_at", Value: -1}}},
	})
	database.SyncIndexesInBackground(r.shares, []mongo.IndexModel{
		{Keys: bson.D{{Key: "owner_id", Value: 1}, {Key: "created_at", Value: 1}}},
		{Keys: bson.D{{Key: "created_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(int32((25 * time.Hour).Seconds()))},
	})
	database.SyncIndexesInBackground(r.reports, []mongo.IndexModel{
		{Keys: bson.D{{Key: "story_id", Value: 1}, {Key: "reporter_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: -1}}},
	})
	return r
}

func (r *repository) Insert(ctx context.Context, s *Story) error {
	_, err := r.stories.InsertOne(ctx, s)
	return err
}

func (r *repository) Get(ctx context.Context, id primitive.ObjectID) (*Story, error) {
	var s Story
	err := r.stories.FindOne(ctx, bson.M{"_id": id}).Decode(&s)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *repository) CountSince(ctx context.Context, owner primitive.ObjectID, since time.Time) (int64, error) {
	return r.shares.CountDocuments(ctx, bson.M{"owner_id": owner, "created_at": bson.M{"$gte": since}})
}

func (r *repository) LogShare(ctx context.Context, owner primitive.ObjectID, at time.Time) error {
	_, err := r.shares.InsertOne(ctx, bson.M{"owner_id": owner, "created_at": at})
	return err
}

// ─── Files ──────────────────────────────────────────────────────────────────────

func (r *repository) ClaimMedia(ctx context.Context, owner, storyID primitive.ObjectID, in MediaInput) (Media, error) {
	free := bson.M{"$in": bson.A{nil, ""}}
	type upload struct {
		URL   string          `bson:"url"`
		Kind  string          `bson:"kind"`
		Video *file.VideoInfo `bson:"video"`
	}
	look := func(hexID string, kinds ...string) (primitive.ObjectID, upload, error) {
		var f upload
		id, err := primitive.ObjectIDFromHex(hexID)
		if err != nil {
			return id, f, ErrInvalidMedia
		}
		err = r.files.FindOne(ctx, bson.M{
			"_id": id, "uploaded_by": owner, "kind": bson.M{"$in": kinds}, "visibility": "public", "record_id": free,
		}).Decode(&f)
		if err != nil || f.URL == "" {
			return id, f, ErrInvalidMedia
		}
		return id, f, nil
	}
	id, f, err := look(in.FileID, "story_image", "story_video")
	if err != nil {
		return Media{}, err
	}
	m := Media{Type: MediaImage, FileID: id, URL: f.URL, Width: clamp(in.Width), Height: clamp(in.Height)}
	if f.Kind == "story_video" {
		// The server checked the video after upload; its length and size are what count
		if f.Video == nil || f.Video.State == file.VideoProcessing {
			return Media{}, ErrVideoNotReady
		}
		if f.Video.State != file.VideoReady {
			return Media{}, ErrInvalidMedia
		}
		m.Type, m.Duration = MediaVideo, f.Video.Seconds()
		m.Width, m.Height = clamp(f.Video.Width), clamp(f.Video.Height)
		if in.PosterFileID != "" {
			pid, poster, err := look(in.PosterFileID, "story_image")
			purl := poster.URL
			if err != nil || pid == id {
				return Media{}, ErrInvalidMedia
			}
			m.PosterFileID, m.PosterURL = pid, purl
		}
	} else if in.PosterFileID != "" {
		return Media{}, ErrInvalidMedia
	}

	// Each file is taken only if it is still on nothing, so two stories sent at once can't share one
	var taken []primitive.ObjectID
	for _, fid := range m.fileIDs() {
		res, err := r.files.UpdateOne(ctx, bson.M{"_id": fid, "record_id": free},
			bson.M{"$set": bson.M{"module_name": "story", "record_id": storyID.Hex()}})
		if err == nil && res.MatchedCount == 0 {
			err = ErrInvalidMedia
		}
		if err != nil {
			if len(taken) > 0 {
				_, _ = r.files.UpdateMany(context.Background(), bson.M{"_id": bson.M{"$in": taken}, "record_id": storyID.Hex()},
					bson.M{"$unset": bson.M{"module_name": "", "record_id": ""}})
			}
			return Media{}, err
		}
		taken = append(taken, fid)
	}
	return m, nil
}

func (r *repository) Unclaim(ctx context.Context, storyID primitive.ObjectID, ids []primitive.ObjectID) {
	_, _ = r.files.UpdateMany(ctx, bson.M{"_id": bson.M{"$in": ids}, "record_id": storyID.Hex()},
		bson.M{"$unset": bson.M{"module_name": "", "record_id": ""}})
}

func clamp(v int) int {
	if v <= 0 || v > 20000 {
		return 0
	}
	return v
}

func (r *repository) FileKeys(ctx context.Context, ids []primitive.ObjectID) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	cur, err := r.files.Find(ctx, bson.M{"_id": bson.M{"$in": ids}}, options.Find().SetProjection(bson.M{"key": 1}))
	if err != nil {
		return nil, err
	}
	var recs []struct {
		Key string `bson:"key"`
	}
	if err := cur.All(ctx, &recs); err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(recs))
	for _, f := range recs {
		if f.Key != "" {
			keys = append(keys, f.Key)
		}
	}
	return keys, nil
}

func (r *repository) DeleteFileRecords(ctx context.Context, ids []primitive.ObjectID) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.files.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": ids}})
	return err
}

// ─── Audience ───────────────────────────────────────────────────────────────────

func (r *repository) Connections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cur, err := r.connections.Find(ctx, bson.M{
		"status": "accepted",
		"$or":    []bson.M{{"sender_id": userID}, {"receiver_id": userID}},
	}, options.Find().SetProjection(bson.M{"sender_id": 1, "receiver_id": 1}))
	if err != nil {
		return nil, err
	}
	var rows []struct {
		SenderID   primitive.ObjectID `bson:"sender_id"`
		ReceiverID primitive.ObjectID `bson:"receiver_id"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make([]primitive.ObjectID, 0, len(rows))
	for _, c := range rows {
		if c.SenderID == userID {
			out = append(out, c.ReceiverID)
		} else {
			out = append(out, c.SenderID)
		}
	}
	return out, nil
}

func (r *repository) IsConnected(ctx context.Context, a, b primitive.ObjectID) (bool, error) {
	n, err := r.connections.CountDocuments(ctx, bson.M{
		"status": "accepted",
		"$or":    []bson.M{{"sender_id": a, "receiver_id": b}, {"sender_id": b, "receiver_id": a}},
	}, options.Count().SetLimit(1))
	return n > 0, err
}

func (r *repository) FollowedCompanies(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cur, err := r.follows.Find(ctx, bson.M{"user_id": userID}, options.Find().SetProjection(bson.M{"company_id": 1}))
	if err != nil {
		return nil, err
	}
	var rows []struct {
		CompanyID primitive.ObjectID `bson:"company_id"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make([]primitive.ObjectID, 0, len(rows))
	for _, f := range rows {
		out = append(out, f.CompanyID)
	}
	return out, nil
}

func (r *repository) Follows(ctx context.Context, userID, companyID primitive.ObjectID) (bool, error) {
	n, err := r.follows.CountDocuments(ctx, bson.M{"user_id": userID, "company_id": companyID}, options.Count().SetLimit(1))
	return n > 0, err
}

func (r *repository) BlockedEitherWay(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cur, err := r.blocks.Find(ctx, bson.M{"$or": []bson.M{{"user_id": userID}, {"blocked_user_id": userID}}},
		options.Find().SetProjection(bson.M{"user_id": 1, "blocked_user_id": 1}))
	if err != nil {
		return nil, err
	}
	var rows []struct {
		UserID        primitive.ObjectID `bson:"user_id"`
		BlockedUserID primitive.ObjectID `bson:"blocked_user_id"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make([]primitive.ObjectID, 0, len(rows))
	for _, b := range rows {
		if b.UserID == userID {
			out = append(out, b.BlockedUserID)
		} else {
			out = append(out, b.UserID)
		}
	}
	return out, nil
}

// ─── Showing and viewing ────────────────────────────────────────────────────────

func (r *repository) Live(ctx context.Context, owners []primitive.ObjectID, now time.Time) ([]Story, error) {
	if len(owners) == 0 {
		return nil, nil
	}
	cur, err := r.stories.Find(ctx, bson.M{
		"owner_id": bson.M{"$in": owners}, "status": StatusActive, "expires_at": bson.M{"$gt": now},
	}, options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}).SetLimit(2000))
	if err != nil {
		return nil, err
	}
	var out []Story
	return out, cur.All(ctx, &out)
}

func (r *repository) SeenBy(ctx context.Context, viewer primitive.ObjectID, storyIDs []primitive.ObjectID) (map[primitive.ObjectID]bool, error) {
	out := map[primitive.ObjectID]bool{}
	if len(storyIDs) == 0 {
		return out, nil
	}
	cur, err := r.views.Find(ctx, bson.M{"viewer_id": viewer, "story_id": bson.M{"$in": storyIDs}},
		options.Find().SetProjection(bson.M{"story_id": 1}))
	if err != nil {
		return nil, err
	}
	var rows []View
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, v := range rows {
		out[v.StoryID] = true
	}
	return out, nil
}

func (r *repository) AddView(ctx context.Context, s *Story, viewer primitive.ObjectID, at time.Time) (bool, error) {
	res, err := r.views.UpdateOne(ctx,
		bson.M{"story_id": s.ID, "viewer_id": viewer},
		bson.M{"$setOnInsert": bson.M{"owner_id": s.OwnerID, "viewed_at": at}},
		options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		// Two opens at the same moment: the other one counted it
		return false, nil
	}
	if err != nil || res.UpsertedCount == 0 {
		return false, err
	}
	_, err = r.stories.UpdateByID(ctx, s.ID, bson.M{"$inc": bson.M{"views": 1}})
	return true, err
}

func (r *repository) Viewers(ctx context.Context, storyID primitive.ObjectID, limit int) ([]View, error) {
	cur, err := r.views.Find(ctx, bson.M{"story_id": storyID},
		options.Find().SetSort(bson.D{{Key: "viewed_at", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	var out []View
	return out, cur.All(ctx, &out)
}

func (r *repository) SetStatus(ctx context.Context, id primitive.ObjectID, from []string, to string) (bool, error) {
	res, err := r.stories.UpdateOne(ctx, bson.M{"_id": id, "status": bson.M{"$in": from}}, bson.M{"$set": bson.M{"status": to}})
	if err != nil {
		return false, err
	}
	return res.ModifiedCount > 0, nil
}

func (r *repository) HideForReview(ctx context.Context, id primitive.ObjectID) (bool, error) {
	set := bson.M{"$set": bson.M{"status": StatusHidden, "deleted_by_owner": true}}
	res, err := r.stories.UpdateOne(ctx, bson.M{"_id": id, "status": StatusActive}, set)
	if err != nil || res.MatchedCount > 0 {
		return err == nil, err
	}
	_, err = r.stories.UpdateOne(ctx, bson.M{"_id": id, "status": StatusHidden}, set)
	return false, err
}

func (r *repository) FileKey(ctx context.Context, id primitive.ObjectID) (string, error) {
	var f struct {
		Key string `bson:"key"`
	}
	if err := r.files.FindOne(ctx, bson.M{"_id": id}).Decode(&f); err != nil {
		return "", err
	}
	return f.Key, nil
}

func (r *repository) MoveFile(ctx context.Context, id primitive.ObjectID, key, url string) error {
	_, err := r.files.UpdateByID(ctx, id, bson.M{"$set": bson.M{"key": key, "url": url}})
	return err
}

func (r *repository) SetMediaURLs(ctx context.Context, id primitive.ObjectID, url, posterURL string) error {
	set := bson.M{"media.url": url}
	if posterURL != "" {
		set["media.poster_url"] = posterURL
	}
	_, err := r.stories.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}

func (r *repository) Delete(ctx context.Context, id primitive.ObjectID) error {
	if _, err := r.views.DeleteMany(ctx, bson.M{"story_id": id}); err != nil {
		return err
	}
	_, err := r.stories.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// ─── Reports ────────────────────────────────────────────────────────────────────

func (r *repository) CreateReport(ctx context.Context, rep *Report) error {
	_, err := r.reports.InsertOne(ctx, rep)
	if mongo.IsDuplicateKeyError(err) {
		// One report per member per story; a second one changes nothing
		return nil
	}
	return err
}

func (r *repository) CountPendingReports(ctx context.Context, storyID primitive.ObjectID) (int64, error) {
	return r.reports.CountDocuments(ctx, bson.M{"story_id": storyID, "status": ReportPending})
}

func (r *repository) PendingReports(ctx context.Context, storyID primitive.ObjectID) ([]Report, error) {
	cur, err := r.reports.Find(ctx, bson.M{"story_id": storyID, "status": ReportPending},
		options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if err != nil {
		return nil, err
	}
	var out []Report
	return out, cur.All(ctx, &out)
}

func (r *repository) ResolveReports(ctx context.Context, storyID, adminID primitive.ObjectID, decision string, at time.Time) error {
	_, err := r.reports.UpdateMany(ctx, bson.M{"story_id": storyID, "status": ReportPending}, bson.M{"$set": bson.M{
		"status": ReportResolved, "resolved_at": at, "resolved_by": adminID, "decision": decision,
	}})
	return err
}

func (r *repository) ReportedStoryIDs(ctx context.Context, skip, limit int) ([]primitive.ObjectID, int64, error) {
	pipe := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"status": ReportPending}}},
		{{Key: "$group", Value: bson.M{"_id": "$story_id", "last": bson.M{"$max": "$created_at"}}}},
		{{Key: "$sort", Value: bson.D{{Key: "last", Value: -1}}}},
		{{Key: "$facet", Value: bson.M{
			"page":  bson.A{bson.M{"$skip": skip}, bson.M{"$limit": limit}},
			"total": bson.A{bson.M{"$count": "n"}},
		}}},
	}
	cur, err := r.reports.Aggregate(ctx, pipe)
	if err != nil {
		return nil, 0, err
	}
	var res []struct {
		Page []struct {
			ID primitive.ObjectID `bson:"_id"`
		} `bson:"page"`
		Total []struct {
			N int64 `bson:"n"`
		} `bson:"total"`
	}
	if err := cur.All(ctx, &res); err != nil {
		return nil, 0, err
	}
	if len(res) == 0 {
		return nil, 0, nil
	}
	ids := make([]primitive.ObjectID, 0, len(res[0].Page))
	for _, p := range res[0].Page {
		ids = append(ids, p.ID)
	}
	var total int64
	if len(res[0].Total) > 0 {
		total = res[0].Total[0].N
	}
	return ids, total, nil
}

func (r *repository) FindByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Story, error) {
	out := map[primitive.ObjectID]*Story{}
	if len(ids) == 0 {
		return out, nil
	}
	cur, err := r.stories.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, err
	}
	var rows []Story
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	for i := range rows {
		out[rows[i].ID] = &rows[i]
	}
	return out, nil
}

func (r *repository) CloseOrphanReports(ctx context.Context, at time.Time) error {
	cur, err := r.reports.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"status": ReportPending}}},
		{{Key: "$group", Value: bson.M{"_id": "$story_id"}}},
		{{Key: "$lookup", Value: bson.M{"from": StoriesCollection, "localField": "_id", "foreignField": "_id", "as": "story"}}},
		{{Key: "$match", Value: bson.M{"story": bson.M{"$size": 0}}}},
		{{Key: "$limit", Value: 500}},
	})
	if err != nil {
		return err
	}
	var rows []struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	if err := cur.All(ctx, &rows); err != nil || len(rows) == 0 {
		return err
	}
	ids := make([]primitive.ObjectID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	_, err = r.reports.UpdateMany(ctx, bson.M{"story_id": bson.M{"$in": ids}, "status": ReportPending}, bson.M{"$set": bson.M{
		"status": ReportResolved, "resolved_at": at, "decision": "expired",
	}})
	return err
}

func (r *repository) SetPurgeAt(ctx context.Context, id primitive.ObjectID, at time.Time) error {
	_, err := r.stories.UpdateByID(ctx, id, bson.M{"$set": bson.M{"purge_at": at}})
	return err
}

func (r *repository) Due(ctx context.Context, now time.Time, limit int) ([]Story, error) {
	cur, err := r.stories.Find(ctx, bson.M{"purge_at": bson.M{"$lte": now}},
		options.Find().SetSort(bson.D{{Key: "purge_at", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	var out []Story
	return out, cur.All(ctx, &out)
}
