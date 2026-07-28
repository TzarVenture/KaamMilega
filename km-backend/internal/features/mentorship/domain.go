package mentorship

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Mentorship struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ExpertID    primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Category    string             `bson:"category" json:"category"`
	Duration    int                `bson:"duration" json:"duration"` // Duration in minutes
	Price       float64            `bson:"price" json:"price"`
	Rating      float64            `bson:"rating,omitempty" json:"rating,omitempty"`
	Reviews     int                `bson:"reviews,omitempty" json:"reviews,omitempty"`
	Status      string             `bson:"status" json:"status"` // "active", "inactive"
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type Booking struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	MentorshipID primitive.ObjectID `bson:"mentorship_id" json:"mentorship_id"`
	ExpertID     primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	UserID       primitive.ObjectID `bson:"user_id" json:"user_id"`
	ScheduledAt  time.Time          `bson:"scheduled_at" json:"scheduled_at"`
	Status       string             `bson:"status" json:"status"` // "pending", "confirmed", "cancelled", "completed"
	MeetingLink  string             `bson:"meeting_link,omitempty" json:"meeting_link,omitempty"`
	Notes        string             `bson:"notes,omitempty" json:"notes,omitempty"`
	Rating       float64            `bson:"rating,omitempty" json:"rating,omitempty"`
	Review       string             `bson:"review,omitempty" json:"review,omitempty"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

type Availability struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ExpertID  primitive.ObjectID `bson:"expert_id" json:"expert_id"`
	DayOfWeek int                `bson:"day_of_week" json:"day_of_week"` // 0 for Sunday, 1 for Monday, etc.
	StartTime string             `bson:"start_time" json:"start_time"`   // "09:00"
	EndTime   string             `bson:"end_time" json:"end_time"`       // "17:00"
	IsActive  bool               `bson:"is_active" json:"is_active"`
}

type MentorshipDetail struct {
	Mentorship Mentorship `json:"mentorship"`
	Expert     ExpertInfo `json:"expert"`
}

type ExpertInfo struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Headline     string  `json:"headline"`
	ProfileImage string  `json:"profile_image"`
	Bio          string  `json:"bio"`
	Rating       float64 `json:"rating"`
}

type CreateMentorshipRequest struct {
	Title       string  `json:"title" validate:"required"`
	Description string  `json:"description" validate:"required"`
	Category    string  `json:"category" validate:"required"`
	Duration    int     `json:"duration" validate:"required"`
	Price       float64 `json:"price" validate:"required"`
}

type BookMentorshipRequest struct {
	MentorshipID string    `json:"mentorship_id" validate:"required"`
	ScheduledAt  time.Time `json:"scheduled_at" validate:"required"`
	Notes        string    `json:"notes"`
}

type AvailabilityRequest struct {
	DayOfWeek int    `json:"day_of_week" validate:"required"`
	StartTime string `json:"start_time" validate:"required"`
	EndTime   string `json:"end_time" validate:"required"`
}
