package interview

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Interview struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ApplicationID primitive.ObjectID `bson:"application_id" json:"application_id"`
	RecruiterID   primitive.ObjectID `bson:"recruiter_id" json:"recruiter_id"`
	CandidateID   primitive.ObjectID `bson:"candidate_id" json:"candidate_id"`
	ScheduledAt   time.Time          `bson:"scheduled_at" json:"scheduled_at"`
	Type          string             `bson:"type" json:"type"`         // Phone, Video, In-person
	Location      string             `bson:"location" json:"location"` // Address or Link
	Status        string             `bson:"status" json:"status"`     // Scheduled, Completed, Cancelled
	Notes         string             `bson:"notes" json:"notes"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
}

type ScheduleInterviewRequest struct {
	ApplicationID string    `json:"application_id" validate:"required"`
	ScheduledAt   time.Time `json:"scheduled_at" validate:"required"`
	Type          string    `json:"type" validate:"required"`
	Location      string    `json:"location"`
	Notes         string    `json:"notes"`
}

type UpdateInterviewStatusRequest struct {
	Status string `json:"status" validate:"required"`
}

type InterviewDetail struct {
	ID            string             `json:"id"`
	ApplicationID string             `json:"application_id"`
	RecruiterID   string             `json:"recruiter_id"`
	CandidateID   string             `json:"candidate_id"`
	ScheduledAt   time.Time          `json:"scheduled_at"`
	Type          string             `json:"type"`
	Location      string             `json:"location"`
	Status        string             `json:"status"`
	Notes         string             `json:"notes"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
	Job           *InterviewJobInfo  `json:"job"`
	Candidate     *InterviewUserInfo `json:"candidate"`
	Recruiter     *InterviewUserInfo `json:"recruiter"`
}

type InterviewJobInfo struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Company string `json:"company"`
}

type InterviewUserInfo struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}
