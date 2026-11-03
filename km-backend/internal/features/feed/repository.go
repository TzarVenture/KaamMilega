package feed

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

type FeedRepository interface {
	CreatePost(ctx context.Context, post *Post) error
	FindPost(ctx context.Context, id primitive.ObjectID) (*Post, error)
	FindPostsByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Post, error)
	// FindPostsAnyStatus is FindPostsByIDs including hidden and removed posts, for moderators
	FindPostsAnyStatus(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Post, error)
	ListPosts(ctx context.Context, q ListQuery, hideAuthors, hidePosts []primitive.ObjectID) ([]Post, error)
	UpdatePost(ctx context.Context, id primitive.ObjectID, content, category string, tags []string, editedAt time.Time) error
	DeletePost(ctx context.Context, id primitive.ObjectID) error
	CountPostsSince(ctx context.Context, authorID primitive.ObjectID, since time.Time) (int64, error)
	IncrementImpressions(ctx context.Context, postID primitive.ObjectID) error
	// TrendingTags is the hashtags most used by active posts since a time
	TrendingTags(ctx context.Context, since time.Time, limit int) ([]TrendingTag, error)

	// ClaimMedia checks each photo is a feed upload by this member that no other post uses,
	// and ties it to the post
	ClaimMedia(ctx context.Context, userID, postID primitive.ObjectID, in []MediaInput) ([]Media, error)
	// ReleaseMedia drops the upload records of a post's photos and returns their storage keys
	ReleaseMedia(ctx context.Context, fileIDs []primitive.ObjectID) ([]string, error)

	// SetReaction stores the member's reaction and returns the one it replaced ("" if none)
	SetReaction(ctx context.Context, postID, userID primitive.ObjectID, reaction string) (string, error)
	// RemoveReaction deletes the member's reaction and returns it ("" if there was none)
	RemoveReaction(ctx context.Context, postID, userID primitive.ObjectID) (string, error)
	ViewerReactions(ctx context.Context, userID primitive.ObjectID, postIDs []primitive.ObjectID) (map[primitive.ObjectID]string, error)

	SavePost(ctx context.Context, userID, postID primitive.ObjectID) error
	UnsavePost(ctx context.Context, userID, postID primitive.ObjectID) error
	ViewerSaves(ctx context.Context, userID primitive.ObjectID, postIDs []primitive.ObjectID) (map[primitive.ObjectID]bool, error)
	ListSaves(ctx context.Context, userID primitive.ObjectID, before *primitive.ObjectID, limit int) ([]Save, error)

	CreateComment(ctx context.Context, c *Comment) error
	FindComment(ctx context.Context, id primitive.ObjectID) (*Comment, error)
	ListComments(ctx context.Context, postID primitive.ObjectID, before *primitive.ObjectID, limit int, hideAuthors []primitive.ObjectID) ([]Comment, error)
	DeleteComment(ctx context.Context, c *Comment) error
	CountCommentsSince(ctx context.Context, authorID primitive.ObjectID, since time.Time) (int64, error)

	CreateReport(ctx context.Context, r *Report) error
	ReportedPostIDs(ctx context.Context, reporterID primitive.ObjectID) ([]primitive.ObjectID, error)
	CountPendingReports(ctx context.Context, postID primitive.ObjectID) (int64, error)
	// SetPostStatus moves a post to status `to` only if it is in one of `from`; false if it wasn't
	SetPostStatus(ctx context.Context, postID primitive.ObjectID, from []string, to string) (bool, error)
	// ResolveReports closes every open report on a post with the moderator's decision
	ResolveReports(ctx context.Context, postID primitive.ObjectID, status string, by primitive.ObjectID, at time.Time) error
	// ReportQueue is reported posts grouped by post, open ones by latest report and closed ones by
	// latest decision, plus how many posts there are in all
	ReportQueue(ctx context.Context, open bool, skip, limit int) ([]ReportedPost, int, error)
	ReportsForPost(ctx context.Context, postID primitive.ObjectID) ([]Report, error)
	// BlockedUserIDs is everyone this member blocked or was blocked by
	BlockedUserIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
}

type feedRepository struct {
	posts     *mongo.Collection
	comments  *mongo.Collection
	reactions *mongo.Collection
	saves     *mongo.Collection
	reports   *mongo.Collection
	files     *mongo.Collection
	blocks    *mongo.Collection
}

func NewFeedRepository(db *database.MongodbDB) FeedRepository {
	r := &feedRepository{
		posts:     db.DB.Collection("feed_posts"),
		comments:  db.DB.Collection("feed_comments"),
		reactions: db.DB.Collection("feed_reactions"),
		saves:     db.DB.Collection("feed_saves"),
		reports:   db.DB.Collection("feed_reports"),
		files:     db.DB.Collection("files"),
		blocks:    db.DB.Collection("user_blocks"),
	}
	go r.ensureIndexes()
	return r
}

func (r *feedRepository) ensureIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// Fresh options for every index: the driver writes the generated name into the options it's
	// given, so sharing one value gave every index the first one's name
	unique := func() *options.IndexOptions { return options.Index().SetUnique(true) }
	sets := []struct {
		coll   *mongo.Collection
		models []mongo.IndexModel
	}{
		{r.posts, []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "category", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "author_id", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "tags", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
		{r.comments, []mongo.IndexModel{
			{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "author_id", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
		{r.reactions, []mongo.IndexModel{
			{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "user_id", Value: 1}}, Options: unique()},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "post_id", Value: 1}}},
		}},
		{r.saves, []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "post_id", Value: 1}}, Options: unique()},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "post_id", Value: 1}}},
		}},
		{r.reports, []mongo.IndexModel{
			{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "reporter_id", Value: 1}}, Options: unique()},
			{Keys: bson.D{{Key: "reporter_id", Value: 1}, {Key: "_id", Value: -1}}},
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: -1}}},
			{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "status", Value: 1}}},
		}},
	}
	for _, s := range sets {
		database.SyncIndexes(ctx, s.coll, s.models)
	}
}

// ─── Posts ──────────────────────────────────────────────────────────────────────

func (r *feedRepository) CreatePost(ctx context.Context, post *Post) error {
	if post.ID.IsZero() {
		post.ID = primitive.NewObjectID()
	}
	_, err := r.posts.InsertOne(ctx, post)
	return err
}

func (r *feedRepository) FindPost(ctx context.Context, id primitive.ObjectID) (*Post, error) {
	var p Post
	err := r.posts.FindOne(ctx, bson.M{"_id": id}).Decode(&p)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *feedRepository) FindPostsByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Post, error) {
	return r.findPosts(ctx, bson.M{"_id": bson.M{"$in": ids}, "status": PostActive}, len(ids))
}

func (r *feedRepository) FindPostsAnyStatus(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Post, error) {
	return r.findPosts(ctx, bson.M{"_id": bson.M{"$in": ids}}, len(ids))
}

func (r *feedRepository) findPosts(ctx context.Context, filter bson.M, n int) (map[primitive.ObjectID]*Post, error) {
	out := make(map[primitive.ObjectID]*Post, n)
	if n == 0 {
		return out, nil
	}
	cur, err := r.posts.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	var posts []Post
	if err := cur.All(ctx, &posts); err != nil {
		return nil, err
	}
	for i := range posts {
		out[posts[i].ID] = &posts[i]
	}
	return out, nil
}

func (r *feedRepository) IncrementImpressions(ctx context.Context, postID primitive.ObjectID) error {
	_, err := r.posts.UpdateOne(ctx, bson.M{"_id": postID}, bson.M{"$inc": bson.M{"impressions": 1}})
	return err
}

func (r *feedRepository) TrendingTags(ctx context.Context, since time.Time, limit int) ([]TrendingTag, error) {
	cur, err := r.posts.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"status": PostActive, "created_at": bson.M{"$gte": since}, "tags.0": bson.M{"$exists": true}}}},
		{{Key: "$unwind", Value: "$tags"}},
		{{Key: "$group", Value: bson.M{"_id": "$tags", "posts": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.D{{Key: "posts", Value: -1}, {Key: "_id", Value: 1}}}},
		{{Key: "$limit", Value: limit}},
	})
	if err != nil {
		return nil, err
	}
	tags := []TrendingTag{}
	if err := cur.All(ctx, &tags); err != nil {
		return nil, err
	}
	return tags, nil
}

func (r *feedRepository) ListPosts(ctx context.Context, q ListQuery, hideAuthors, hidePosts []primitive.ObjectID) ([]Post, error) {
	filter := bson.M{"status": PostActive}
	if q.Category != "" && q.Category != CategoryAll {
		filter["category"] = q.Category
	}
	if q.Tag != "" {
		filter["tags"] = q.Tag
	}
	authorCond := bson.M{}
	if q.AuthorID != nil {
		authorCond["$eq"] = *q.AuthorID
	}
	if len(hideAuthors) > 0 {
		authorCond["$nin"] = hideAuthors
	}
	if len(authorCond) > 0 {
		filter["author_id"] = authorCond
	}
	idCond := bson.M{}
	if q.Before != nil {
		idCond["$lt"] = *q.Before
	}
	if len(hidePosts) > 0 {
		idCond["$nin"] = hidePosts
	}
	if len(idCond) > 0 {
		filter["_id"] = idCond
	}

	opts := options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(q.Limit))
	cur, err := r.posts.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	posts := make([]Post, 0, q.Limit)
	if err := cur.All(ctx, &posts); err != nil {
		return nil, err
	}
	return posts, nil
}

func (r *feedRepository) UpdatePost(ctx context.Context, id primitive.ObjectID, content, category string, tags []string, editedAt time.Time) error {
	_, err := r.posts.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{
		"content":    content,
		"category":   category,
		"tags":       tags,
		"edited_at":  editedAt,
		"updated_at": editedAt,
	}})
	return err
}

// DeletePost removes the post and everything hanging off it
func (r *feedRepository) DeletePost(ctx context.Context, id primitive.ObjectID) error {
	if _, err := r.posts.DeleteOne(ctx, bson.M{"_id": id}); err != nil {
		return err
	}
	for _, c := range []*mongo.Collection{r.comments, r.reactions, r.saves, r.reports} {
		if _, err := c.DeleteMany(ctx, bson.M{"post_id": id}); err != nil {
			return err
		}
	}
	return nil
}

func (r *feedRepository) CountPostsSince(ctx context.Context, authorID primitive.ObjectID, since time.Time) (int64, error) {
	return r.posts.CountDocuments(ctx, bson.M{"author_id": authorID, "_id": bson.M{"$gte": primitive.NewObjectIDFromTimestamp(since)}})
}

// ─── Photos ─────────────────────────────────────────────────────────────────────

func (r *feedRepository) ClaimMedia(ctx context.Context, userID, postID primitive.ObjectID, in []MediaInput) ([]Media, error) {
	out := make([]Media, 0, len(in))
	seen := make(map[primitive.ObjectID]bool, len(in))
	for _, m := range in {
		id, err := primitive.ObjectIDFromHex(m.FileID)
		if err != nil || seen[id] {
			return nil, ErrInvalidMedia
		}
		seen[id] = true
		var f struct {
			URL      string `bson:"url"`
			RecordID string `bson:"record_id"`
		}
		err = r.files.FindOne(ctx, bson.M{
			"_id": id, "uploaded_by": userID, "kind": "feed_image", "visibility": "public",
		}).Decode(&f)
		if err != nil || f.URL == "" {
			return nil, ErrInvalidMedia
		}
		// A photo already on another post stays there
		if f.RecordID != "" && f.RecordID != postID.Hex() {
			return nil, ErrInvalidMedia
		}
		out = append(out, Media{FileID: id, URL: f.URL, Width: clampDimension(m.Width), Height: clampDimension(m.Height)})
	}
	for _, m := range out {
		if _, err := r.files.UpdateOne(ctx, bson.M{"_id": m.FileID}, bson.M{"$set": bson.M{"module_name": "feed", "record_id": postID.Hex()}}); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// clampDimension keeps a client-reported photo size sane; 0 means unknown
func clampDimension(v int) int {
	if v <= 0 || v > 20000 {
		return 0
	}
	return v
}

func (r *feedRepository) ReleaseMedia(ctx context.Context, fileIDs []primitive.ObjectID) ([]string, error) {
	if len(fileIDs) == 0 {
		return nil, nil
	}
	cur, err := r.files.Find(ctx, bson.M{"_id": bson.M{"$in": fileIDs}}, options.Find().SetProjection(bson.M{"key": 1}))
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
	if _, err := r.files.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": fileIDs}}); err != nil {
		return nil, err
	}
	return keys, nil
}

// ─── Reactions ──────────────────────────────────────────────────────────────────

func (r *feedRepository) SetReaction(ctx context.Context, postID, userID primitive.ObjectID, reaction string) (string, error) {
	filter := bson.M{"post_id": postID, "user_id": userID}
	update := bson.M{
		"$set":         bson.M{"type": reaction},
		"$setOnInsert": bson.M{"created_at": time.Now()},
	}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.Before)

	var before Reaction
	err := r.reactions.FindOneAndUpdate(ctx, filter, update, opts).Decode(&before)
	// Two first taps at once: the unique index rejects one upsert; the retry updates instead
	if mongo.IsDuplicateKeyError(err) {
		err = r.reactions.FindOneAndUpdate(ctx, filter, update, opts).Decode(&before)
	}
	old := ""
	switch {
	case errors.Is(err, mongo.ErrNoDocuments):
	case err != nil:
		return "", err
	default:
		old = before.Type
	}

	inc := bson.M{}
	switch {
	case old == "":
		inc["reactions_total"] = 1
		inc["reaction_counts."+reaction] = 1
	case old != reaction:
		inc["reaction_counts."+reaction] = 1
		inc["reaction_counts."+old] = -1
	}
	if len(inc) > 0 {
		if _, err := r.posts.UpdateOne(ctx, bson.M{"_id": postID}, bson.M{"$inc": inc}); err != nil {
			return old, err
		}
	}
	return old, nil
}

func (r *feedRepository) RemoveReaction(ctx context.Context, postID, userID primitive.ObjectID) (string, error) {
	var removed Reaction
	err := r.reactions.FindOneAndDelete(ctx, bson.M{"post_id": postID, "user_id": userID}).Decode(&removed)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	_, err = r.posts.UpdateOne(ctx, bson.M{"_id": postID}, bson.M{"$inc": bson.M{
		"reactions_total":                 -1,
		"reaction_counts." + removed.Type: -1,
	}})
	return removed.Type, err
}

func (r *feedRepository) ViewerReactions(ctx context.Context, userID primitive.ObjectID, postIDs []primitive.ObjectID) (map[primitive.ObjectID]string, error) {
	out := make(map[primitive.ObjectID]string)
	if len(postIDs) == 0 {
		return out, nil
	}
	cur, err := r.reactions.Find(ctx, bson.M{"user_id": userID, "post_id": bson.M{"$in": postIDs}})
	if err != nil {
		return nil, err
	}
	var rs []Reaction
	if err := cur.All(ctx, &rs); err != nil {
		return nil, err
	}
	for _, x := range rs {
		out[x.PostID] = x.Type
	}
	return out, nil
}

// ─── Saves ──────────────────────────────────────────────────────────────────────

func (r *feedRepository) SavePost(ctx context.Context, userID, postID primitive.ObjectID) error {
	_, err := r.saves.UpdateOne(ctx,
		bson.M{"user_id": userID, "post_id": postID},
		bson.M{"$setOnInsert": bson.M{"created_at": time.Now()}},
		options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		return nil // saved by a parallel request
	}
	return err
}

func (r *feedRepository) UnsavePost(ctx context.Context, userID, postID primitive.ObjectID) error {
	_, err := r.saves.DeleteOne(ctx, bson.M{"user_id": userID, "post_id": postID})
	return err
}

func (r *feedRepository) ViewerSaves(ctx context.Context, userID primitive.ObjectID, postIDs []primitive.ObjectID) (map[primitive.ObjectID]bool, error) {
	out := make(map[primitive.ObjectID]bool)
	if len(postIDs) == 0 {
		return out, nil
	}
	cur, err := r.saves.Find(ctx, bson.M{"user_id": userID, "post_id": bson.M{"$in": postIDs}}, options.Find().SetProjection(bson.M{"post_id": 1}))
	if err != nil {
		return nil, err
	}
	var ss []Save
	if err := cur.All(ctx, &ss); err != nil {
		return nil, err
	}
	for _, s := range ss {
		out[s.PostID] = true
	}
	return out, nil
}

func (r *feedRepository) ListSaves(ctx context.Context, userID primitive.ObjectID, before *primitive.ObjectID, limit int) ([]Save, error) {
	filter := bson.M{"user_id": userID}
	if before != nil {
		filter["_id"] = bson.M{"$lt": *before}
	}
	cur, err := r.saves.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	out := make([]Save, 0, limit)
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ─── Comments ───────────────────────────────────────────────────────────────────

func (r *feedRepository) CreateComment(ctx context.Context, c *Comment) error {
	if c.ID.IsZero() {
		c.ID = primitive.NewObjectID()
	}
	if _, err := r.comments.InsertOne(ctx, c); err != nil {
		return err
	}
	_, err := r.posts.UpdateOne(ctx, bson.M{"_id": c.PostID}, bson.M{"$inc": bson.M{"comments_count": 1}})
	return err
}

func (r *feedRepository) FindComment(ctx context.Context, id primitive.ObjectID) (*Comment, error) {
	var c Comment
	err := r.comments.FindOne(ctx, bson.M{"_id": id}).Decode(&c)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *feedRepository) ListComments(ctx context.Context, postID primitive.ObjectID, before *primitive.ObjectID, limit int, hideAuthors []primitive.ObjectID) ([]Comment, error) {
	filter := bson.M{"post_id": postID}
	if before != nil {
		filter["_id"] = bson.M{"$lt": *before}
	}
	if len(hideAuthors) > 0 {
		filter["author_id"] = bson.M{"$nin": hideAuthors}
	}
	cur, err := r.comments.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	out := make([]Comment, 0, limit)
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *feedRepository) DeleteComment(ctx context.Context, c *Comment) error {
	res, err := r.comments.DeleteOne(ctx, bson.M{"_id": c.ID})
	if err != nil || res.DeletedCount == 0 {
		return err
	}
	_, err = r.posts.UpdateOne(ctx, bson.M{"_id": c.PostID}, bson.M{"$inc": bson.M{"comments_count": -1}})
	return err
}

func (r *feedRepository) CountCommentsSince(ctx context.Context, authorID primitive.ObjectID, since time.Time) (int64, error) {
	return r.comments.CountDocuments(ctx, bson.M{"author_id": authorID, "created_at": bson.M{"$gte": since}})
}

// ─── Reports and blocks ─────────────────────────────────────────────────────────

func (r *feedRepository) CreateReport(ctx context.Context, rep *Report) error {
	// Reporting twice keeps the first report
	_, err := r.reports.UpdateOne(ctx,
		bson.M{"post_id": rep.PostID, "reporter_id": rep.ReporterID},
		bson.M{"$setOnInsert": bson.M{
			"author_id":  rep.AuthorID,
			"reason":     rep.Reason,
			"details":    rep.Details,
			"status":     ReportPending,
			"created_at": time.Now(),
		}},
		options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		return nil
	}
	return err
}

// reportedLimit bounds the hidden-post list; older reports are long out of a scrolling feed
const reportedLimit = 300

func (r *feedRepository) ReportedPostIDs(ctx context.Context, reporterID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cur, err := r.reports.Find(ctx, bson.M{"reporter_id": reporterID},
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(reportedLimit).SetProjection(bson.M{"post_id": 1}))
	if err != nil {
		return nil, err
	}
	var rs []Report
	if err := cur.All(ctx, &rs); err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(rs))
	for _, x := range rs {
		ids = append(ids, x.PostID)
	}
	return ids, nil
}

func (r *feedRepository) CountPendingReports(ctx context.Context, postID primitive.ObjectID) (int64, error) {
	return r.reports.CountDocuments(ctx, bson.M{"post_id": postID, "status": ReportPending})
}

func (r *feedRepository) SetPostStatus(ctx context.Context, postID primitive.ObjectID, from []string, to string) (bool, error) {
	res, err := r.posts.UpdateOne(ctx,
		bson.M{"_id": postID, "status": bson.M{"$in": from}},
		bson.M{"$set": bson.M{"status": to, "updated_at": time.Now()}})
	if err != nil {
		return false, err
	}
	return res.ModifiedCount > 0, nil
}

func (r *feedRepository) ResolveReports(ctx context.Context, postID primitive.ObjectID, status string, by primitive.ObjectID, at time.Time) error {
	_, err := r.reports.UpdateMany(ctx,
		bson.M{"post_id": postID, "status": ReportPending},
		bson.M{"$set": bson.M{"status": status, "resolved_by": by, "resolved_at": at}})
	return err
}

func (r *feedRepository) ReportQueue(ctx context.Context, open bool, skip, limit int) ([]ReportedPost, int, error) {
	match := bson.M{"status": ReportPending}
	group := bson.M{
		"_id":              "$post_id",
		"reports":          bson.M{"$sum": 1},
		"reasons":          bson.M{"$push": "$reason"},
		"last_reported_at": bson.M{"$max": "$created_at"},
	}
	sortBy := "last_reported_at"
	if !open {
		match = bson.M{"status": bson.M{"$in": bson.A{ReportDismissed, ReportRemoved}}}
		// Sorted by decision first, so $last is the latest decision on the post
		group["outcome"] = bson.M{"$last": "$status"}
		group["resolved_at"] = bson.M{"$max": "$resolved_at"}
		sortBy = "resolved_at"
	}
	page := bson.A{bson.M{"$skip": skip}}
	if limit > 0 {
		page = append(page, bson.M{"$limit": limit})
	}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$sort", Value: bson.D{{Key: "resolved_at", Value: 1}, {Key: "created_at", Value: 1}}}},
		{{Key: "$group", Value: group}},
		{{Key: "$sort", Value: bson.D{{Key: sortBy, Value: -1}, {Key: "_id", Value: -1}}}},
		{{Key: "$facet", Value: bson.M{
			"page":  page,
			"total": bson.A{bson.M{"$count": "n"}},
		}}},
	}
	cur, err := r.reports.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, 0, err
	}
	var out []struct {
		Page  []ReportedPost `bson:"page"`
		Total []struct {
			N int `bson:"n"`
		} `bson:"total"`
	}
	if err := cur.All(ctx, &out); err != nil {
		return nil, 0, err
	}
	if len(out) == 0 {
		return []ReportedPost{}, 0, nil
	}
	total := 0
	if len(out[0].Total) > 0 {
		total = out[0].Total[0].N
	}
	if limit == 0 {
		return []ReportedPost{}, total, nil
	}
	return out[0].Page, total, nil
}

// reportsPerPostLimit bounds the detail view; a post with more reports than this is clear enough
const reportsPerPostLimit = 200

func (r *feedRepository) ReportsForPost(ctx context.Context, postID primitive.ObjectID) ([]Report, error) {
	cur, err := r.reports.Find(ctx, bson.M{"post_id": postID},
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(reportsPerPostLimit))
	if err != nil {
		return nil, err
	}
	out := []Report{}
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *feedRepository) BlockedUserIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cur, err := r.blocks.Find(ctx, bson.M{"$or": []bson.M{{"user_id": userID}, {"blocked_user_id": userID}}},
		options.Find().SetProjection(bson.M{"user_id": 1, "blocked_user_id": 1}))
	if err != nil {
		return nil, err
	}
	var bs []struct {
		UserID        primitive.ObjectID `bson:"user_id"`
		BlockedUserID primitive.ObjectID `bson:"blocked_user_id"`
	}
	if err := cur.All(ctx, &bs); err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(bs))
	for _, b := range bs {
		if b.UserID == userID {
			ids = append(ids, b.BlockedUserID)
		} else {
			ids = append(ids, b.UserID)
		}
	}
	return ids, nil
}
