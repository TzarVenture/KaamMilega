package course

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Course struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title          string             `bson:"title" json:"title"`
	Description    string             `bson:"description" json:"description"`
	YouTubeURL     string             `bson:"youtube_url" json:"youtube_url"`
	YouTubeVideoID string             `bson:"youtube_video_id" json:"youtube_video_id"`
	ThumbnailURL   string             `bson:"thumbnail_url" json:"thumbnail_url"`
	Duration       string             `bson:"duration" json:"duration"`
	Category       string             `bson:"category" json:"category"`
	ExpertID       primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	ExpertName     string             `bson:"expert_name" json:"expert_name"`
	ExpertAvatar   string             `bson:"expert_avatar,omitempty" json:"expert_avatar,omitempty"`
	Views          int64              `bson:"views" json:"views"`
	IsPublished    bool               `bson:"is_published" json:"is_published"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at,omitempty" json:"updated_at,omitempty"`
}

type CreateCourseRequest struct {
	Title       string `json:"title" validate:"required"`
	YouTubeURL  string `json:"youtube_url" validate:"required"`
	Duration    string `json:"duration" validate:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

type UpdateCourseRequest struct {
	Title       string `json:"title,omitempty"`
	YouTubeURL  string `json:"youtube_url,omitempty"`
	Duration    string `json:"duration,omitempty"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
}

type CourseFilter struct {
	Search   string
	Category string
	ExpertID string
	Page     int
	Limit    int
}

type CourseListResponse struct {
	Data       []*Course `json:"data"`
	Total      int64     `json:"total"`
	Page       int       `json:"page"`
	Limit      int       `json:"limit"`
	TotalPages int64     `json:"total_pages"`
}

type CourseRepository interface {
	Create(ctx context.Context, course *Course) (*Course, error)
	FindByID(ctx context.Context, id primitive.ObjectID) (*Course, error)
	Find(ctx context.Context, filter CourseFilter) ([]*Course, int64, error)
	FindByExpertID(ctx context.Context, expertID primitive.ObjectID, page, limit int) ([]*Course, int64, error)
	IncrementViews(ctx context.Context, id primitive.ObjectID) (int64, error)
	Update(ctx context.Context, course *Course) error
	Delete(ctx context.Context, id primitive.ObjectID, expertID primitive.ObjectID) error
}

type CourseService interface {
	CreateCourse(ctx context.Context, expertID string, req CreateCourseRequest) (*Course, error)
	GetCourse(ctx context.Context, id string) (*Course, error)
	GetCourses(ctx context.Context, filter CourseFilter) (*CourseListResponse, error)
	GetMyCourses(ctx context.Context, expertID string, page, limit int) (*CourseListResponse, error)
	RecordView(ctx context.Context, id string, viewerID string) (int64, error)
	UpdateCourse(ctx context.Context, id string, expertID string, req UpdateCourseRequest) (*Course, error)
	DeleteCourse(ctx context.Context, id string, expertID string) error
}
