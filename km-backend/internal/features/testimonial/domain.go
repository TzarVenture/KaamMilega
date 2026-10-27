package testimonial

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Testimonial struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name           string             `bson:"name" json:"name"`
	Role           string             `bson:"role" json:"role"`
	Company        string             `bson:"company" json:"company"`
	City           string             `bson:"city" json:"city"`
	TradeTag       string             `bson:"trade_tag" json:"trade_tag"`
	Rating         int                `bson:"rating" json:"rating"`
	Review         string             `bson:"review" json:"review"`
	YouTubeURL     string             `bson:"youtube_url" json:"youtube_url"`
	YouTubeVideoID string             `bson:"youtube_video_id" json:"youtube_video_id"`
	ThumbnailURL   string             `bson:"thumbnail_url" json:"thumbnail_url"`
	IsActive       bool               `bson:"is_active" json:"is_active"`
	Order          int                `bson:"order" json:"order"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at,omitempty" json:"updated_at,omitempty"`
}

type CreateTestimonialRequest struct {
	Name         string `json:"name" validate:"required"`
	Role         string `json:"role" validate:"required"`
	Company      string `json:"company" validate:"required"`
	City         string `json:"city" validate:"required"`
	TradeTag     string `json:"trade_tag"`
	Rating       int    `json:"rating"`
	Review       string `json:"review"`
	YouTubeURL   string `json:"youtube_url" validate:"required"`
	ThumbnailURL string `json:"thumbnail_url"`
	IsActive     *bool  `json:"is_active"`
	Order        int    `json:"order"`
}

type UpdateTestimonialRequest struct {
	Name         string `json:"name,omitempty"`
	Role         string `json:"role,omitempty"`
	Company      string `json:"company,omitempty"`
	City         string `json:"city,omitempty"`
	TradeTag     string `json:"trade_tag,omitempty"`
	Rating       int    `json:"rating,omitempty"`
	Review       string `json:"review,omitempty"`
	YouTubeURL   string `json:"youtube_url,omitempty"`
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
	IsActive     *bool  `json:"is_active,omitempty"`
	Order        *int   `json:"order,omitempty"`
}

type TestimonialRepository interface {
	GetActive(ctx context.Context) ([]*Testimonial, error)
	GetAll(ctx context.Context) ([]*Testimonial, error)
	GetByID(ctx context.Context, id primitive.ObjectID) (*Testimonial, error)
	Create(ctx context.Context, t *Testimonial) (*Testimonial, error)
	Update(ctx context.Context, t *Testimonial) error
	Delete(ctx context.Context, id primitive.ObjectID) error
}

type TestimonialService interface {
	GetActiveTestimonials(ctx context.Context) ([]*Testimonial, error)
	GetAllTestimonials(ctx context.Context) ([]*Testimonial, error)
	GetTestimonialByID(ctx context.Context, id string) (*Testimonial, error)
	CreateTestimonial(ctx context.Context, req CreateTestimonialRequest) (*Testimonial, error)
	UpdateTestimonial(ctx context.Context, id string, req UpdateTestimonialRequest) (*Testimonial, error)
	DeleteTestimonial(ctx context.Context, id string) error
}
