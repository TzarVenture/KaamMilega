package feed

import (
	"context"
	"errors"
	"log"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type FeedRepository interface {
	CreatePost(ctx context.Context, post *Post) (*Post, error)
	FindPostByID(ctx context.Context, id primitive.ObjectID) (*Post, error)
	FindPosts(ctx context.Context, category string, before time.Time, limit int, authorID *primitive.ObjectID, savedByUserID string) ([]Post, error)
	DeletePost(ctx context.Context, id primitive.ObjectID) error
	SetReaction(ctx context.Context, postID primitive.ObjectID, userID string, reaction string) (*Post, error)
	ToggleSave(ctx context.Context, postID primitive.ObjectID, userID string) (isSaved bool, err error)
	ToggleRepost(ctx context.Context, postID primitive.ObjectID, userID string) (isReposted bool, repostsCount int, err error)
	CreateComment(ctx context.Context, comment *Comment) (*Comment, error)
	FindCommentsByPostID(ctx context.Context, postID primitive.ObjectID, limit int) ([]Comment, error)
	FindCommentByID(ctx context.Context, id primitive.ObjectID) (*Comment, error)
	DeleteComment(ctx context.Context, commentID primitive.ObjectID, postID primitive.ObjectID) error
	CreateReport(ctx context.Context, report *PostReport) error
}

type feedRepository struct {
	postColl    *mongo.Collection
	commentColl *mongo.Collection
	reportColl  *mongo.Collection
}

func NewFeedRepository(db *database.MongodbDB) FeedRepository {
	postColl := db.DB.Collection("feed_posts")
	commentColl := db.DB.Collection("feed_comments")
	reportColl := db.DB.Collection("feed_reports")

	// Ensure background indexes
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		postIndexes := []mongo.IndexModel{
			{
				Keys:    bson.D{{Key: "created_at", Value: -1}, {Key: "category", Value: 1}},
				Options: options.Index().SetName("idx_feed_posts_created_category"),
			},
			{
				Keys:    bson.D{{Key: "author_id", Value: 1}, {Key: "created_at", Value: -1}},
				Options: options.Index().SetName("idx_feed_posts_author_created"),
			},
			{
				Keys:    bson.D{{Key: "saved_by", Value: 1}, {Key: "created_at", Value: -1}},
				Options: options.Index().SetName("idx_feed_posts_saved_created"),
			},
		}
		if _, err := postColl.Indexes().CreateMany(ctx, postIndexes); err != nil {
			log.Printf("[feedRepository] Post index creation error: %v", err)
		}

		commentIndexes := []mongo.IndexModel{
			{
				Keys:    bson.D{{Key: "post_id", Value: 1}, {Key: "created_at", Value: 1}},
				Options: options.Index().SetName("idx_feed_comments_post_created"),
			},
		}
		if _, err := commentColl.Indexes().CreateMany(ctx, commentIndexes); err != nil {
			log.Printf("[feedRepository] Comment index creation error: %v", err)
		}
	}()

	return &feedRepository{
		postColl:    postColl,
		commentColl: commentColl,
		reportColl:  reportColl,
	}
}

func (r *feedRepository) CreatePost(ctx context.Context, post *Post) (*Post, error) {
	now := time.Now()
	post.CreatedAt = now
	post.UpdatedAt = now
	if post.Reactions == nil {
		post.Reactions = make(map[string]string)
	}
	if post.SavedBy == nil {
		post.SavedBy = make([]string, 0)
	}
	if post.RepostedBy == nil {
		post.RepostedBy = make([]string, 0)
	}

	res, err := r.postColl.InsertOne(ctx, post)
	if err != nil {
		return nil, err
	}
	post.ID = res.InsertedID.(primitive.ObjectID)
	return post, nil
}

func (r *feedRepository) FindPostByID(ctx context.Context, id primitive.ObjectID) (*Post, error) {
	var post Post
	err := r.postColl.FindOne(ctx, bson.M{"_id": id}).Decode(&post)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &post, nil
}

func (r *feedRepository) FindPosts(ctx context.Context, category string, before time.Time, limit int, authorID *primitive.ObjectID, savedByUserID string) ([]Post, error) {
	if limit <= 0 || limit > 50 {
		limit = 15
	}

	filter := bson.M{}

	if !before.IsZero() {
		filter["created_at"] = bson.M{"$lt": before}
	}

	if category != "" && category != CategoryAll {
		filter["category"] = category
	}

	if authorID != nil && !authorID.IsZero() {
		filter["author_id"] = *authorID
	}

	if savedByUserID != "" {
		filter["saved_by"] = savedByUserID
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(int64(limit))

	cursor, err := r.postColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var posts []Post
	if err := cursor.All(ctx, &posts); err != nil {
		return nil, err
	}
	if posts == nil {
		posts = make([]Post, 0)
	}
	return posts, nil
}

func (r *feedRepository) DeletePost(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.postColl.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	// Also clean up any associated comments
	_, _ = r.commentColl.DeleteMany(ctx, bson.M{"post_id": id})
	return nil
}

func (r *feedRepository) SetReaction(ctx context.Context, postID primitive.ObjectID, userID string, reaction string) (*Post, error) {
	current, err := r.FindPostByID(ctx, postID)
	if err != nil || current == nil {
		return nil, err
	}

	existingReaction, hadReaction := current.Reactions[userID]

	var update bson.M
	if hadReaction && existingReaction == reaction {
		// Toggle off
		update = bson.M{
			"$unset": bson.M{"reactions." + userID: ""},
			"$inc":   bson.M{"likes_count": -1},
			"$set":   bson.M{"updated_at": time.Now()},
		}
	} else if hadReaction && existingReaction != reaction {
		// Switch reaction (count stays same)
		update = bson.M{
			"$set": bson.M{
				"reactions." + userID: reaction,
				"updated_at":           time.Now(),
			},
		}
	} else {
		// New reaction
		update = bson.M{
			"$set": bson.M{
				"reactions." + userID: reaction,
				"updated_at":           time.Now(),
			},
			"$inc": bson.M{"likes_count": 1},
		}
	}

	after := options.After
	opts := options.FindOneAndUpdate().SetReturnDocument(after)

	var updated Post
	err = r.postColl.FindOneAndUpdate(ctx, bson.M{"_id": postID}, update, opts).Decode(&updated)
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

func (r *feedRepository) ToggleSave(ctx context.Context, postID primitive.ObjectID, userID string) (bool, error) {
	post, err := r.FindPostByID(ctx, postID)
	if err != nil || post == nil {
		return false, err
	}

	isSaved := false
	for _, id := range post.SavedBy {
		if id == userID {
			isSaved = true
			break
		}
	}

	var update bson.M
	if isSaved {
		update = bson.M{
			"$pull": bson.M{"saved_by": userID},
			"$set":  bson.M{"updated_at": time.Now()},
		}
		isSaved = false
	} else {
		update = bson.M{
			"$addToSet": bson.M{"saved_by": userID},
			"$set":      bson.M{"updated_at": time.Now()},
		}
		isSaved = true
	}

	_, err = r.postColl.UpdateOne(ctx, bson.M{"_id": postID}, update)
	if err != nil {
		return false, err
	}
	return isSaved, nil
}

func (r *feedRepository) ToggleRepost(ctx context.Context, postID primitive.ObjectID, userID string) (bool, int, error) {
	post, err := r.FindPostByID(ctx, postID)
	if err != nil || post == nil {
		return false, 0, err
	}

	isReposted := false
	for _, id := range post.RepostedBy {
		if id == userID {
			isReposted = true
			break
		}
	}

	var update bson.M
	if isReposted {
		update = bson.M{
			"$pull": bson.M{"reposted_by": userID},
			"$inc":  bson.M{"reposts_count": -1},
			"$set":  bson.M{"updated_at": time.Now()},
		}
		isReposted = false
	} else {
		update = bson.M{
			"$addToSet": bson.M{"reposted_by": userID},
			"$inc":      bson.M{"reposts_count": 1},
			"$set":      bson.M{"updated_at": time.Now()},
		}
		isReposted = true
	}

	after := options.After
	var updated Post
	err = r.postColl.FindOneAndUpdate(ctx, bson.M{"_id": postID}, update, options.FindOneAndUpdate().SetReturnDocument(after)).Decode(&updated)
	if err != nil {
		return false, 0, err
	}
	return isReposted, updated.RepostsCount, nil
}

func (r *feedRepository) CreateComment(ctx context.Context, comment *Comment) (*Comment, error) {
	now := time.Now()
	comment.CreatedAt = now
	comment.UpdatedAt = now
	if comment.LikedBy == nil {
		comment.LikedBy = make([]string, 0)
	}

	res, err := r.commentColl.InsertOne(ctx, comment)
	if err != nil {
		return nil, err
	}
	comment.ID = res.InsertedID.(primitive.ObjectID)

	// Increment comments count on post
	_, _ = r.postColl.UpdateOne(ctx, bson.M{"_id": comment.PostID}, bson.M{
		"$inc": bson.M{"comments_count": 1},
		"$set": bson.M{"updated_at": now},
	})

	return comment, nil
}

func (r *feedRepository) FindCommentsByPostID(ctx context.Context, postID primitive.ObjectID, limit int) ([]Comment, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}).SetLimit(int64(limit))
	cursor, err := r.commentColl.Find(ctx, bson.M{"post_id": postID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var comments []Comment
	if err := cursor.All(ctx, &comments); err != nil {
		return nil, err
	}
	if comments == nil {
		comments = make([]Comment, 0)
	}
	return comments, nil
}

func (r *feedRepository) FindCommentByID(ctx context.Context, id primitive.ObjectID) (*Comment, error) {
	var comment Comment
	err := r.commentColl.FindOne(ctx, bson.M{"_id": id}).Decode(&comment)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &comment, nil
}

func (r *feedRepository) DeleteComment(ctx context.Context, commentID primitive.ObjectID, postID primitive.ObjectID) error {
	res, err := r.commentColl.DeleteOne(ctx, bson.M{"_id": commentID})
	if err != nil {
		return err
	}
	if res.DeletedCount > 0 {
		_, _ = r.postColl.UpdateOne(ctx, bson.M{"_id": postID}, bson.M{
			"$inc": bson.M{"comments_count": -1},
			"$set": bson.M{"updated_at": time.Now()},
		})
	}
	return nil
}

func (r *feedRepository) CreateReport(ctx context.Context, report *PostReport) error {
	report.CreatedAt = time.Now()
	report.Status = "pending"
	_, err := r.reportColl.InsertOne(ctx, report)
	return err
}
