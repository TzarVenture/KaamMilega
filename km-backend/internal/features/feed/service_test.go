package feed

import (
	"context"
	"testing"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type mockFeedRepo struct {
	FeedRepository
}

func (m *mockFeedRepo) CreatePost(ctx context.Context, post *Post) (*Post, error) {
	post.ID = primitive.NewObjectID()
	return post, nil
}

func TestFeedService_CreatePost_Validation(t *testing.T) {
	svc := NewFeedService(&mockFeedRepo{}, nil, nil, &config.Config{})
	userID := primitive.NewObjectID()

	// 1. Empty content and empty media should fail with FEED_CONTENT_EMPTY
	_, err := svc.CreatePost(context.Background(), userID, CreatePostRequest{
		Content:  "   ",
		MediaURL: "",
	})
	if err == nil {
		t.Fatalf("expected error for empty post, got nil")
	}
	if apperr.CodeOf(err) != "FEED_CONTENT_EMPTY" {
		t.Fatalf("expected code FEED_CONTENT_EMPTY, got %s (err: %v)", apperr.CodeOf(err), err)
	}

	// 2. Invalid media path should fail with FEED_INVALID_MEDIA
	_, err = svc.CreatePost(context.Background(), userID, CreatePostRequest{
		Content:  "Valid content",
		MediaURL: "https://cdn.example.com/malicious/file.exe",
	})
	if err == nil {
		t.Fatalf("expected error for invalid media prefix, got nil")
	}
	if apperr.CodeOf(err) != "FEED_INVALID_MEDIA" {
		t.Fatalf("expected code FEED_INVALID_MEDIA, got %s (err: %v)", apperr.CodeOf(err), err)
	}
}

func TestFeedConstants(t *testing.T) {
	reactions := []string{ReactionLike, ReactionCelebrate, ReactionSupport, ReactionLove, ReactionInsightful}
	if len(reactions) != 5 {
		t.Fatalf("expected 5 reaction types, got %d", len(reactions))
	}

	categories := []string{CategoryAll, CategoryJobs, CategorySkills, CategoryMentors}
	if len(categories) != 4 {
		t.Fatalf("expected 4 categories, got %d", len(categories))
	}
}
