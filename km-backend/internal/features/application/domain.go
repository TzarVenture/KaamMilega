package application

import (
	"km-backend/internal/common/apperr"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrJobNotFound      = apperr.New("JOB_NOT_FOUND", "job not found")
	ErrAlreadyApplied   = apperr.New("ALREADY_APPLIED", "already applied for this job")
	ErrInvalidJobID     = apperr.New("INVALID_JOB_ID", "invalid job ID format")
	ErrInvalidCandidate = apperr.New("INVALID_CANDIDATE_ID", "invalid candidate ID format")
	ErrJobClosed        = apperr.New("JOB_CLOSED", "job is closed and no longer accepting applications")
	ErrCannotApplyOwn   = apperr.New("CANNOT_APPLY_OWN_JOB", "recruiters cannot apply to their own job postings")
)

type Application struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	JobID       primitive.ObjectID `bson:"job_id" json:"job_id"`
	RecruiterID primitive.ObjectID `bson:"recruiter_id" json:"recruiter_id"`
	CandidateID primitive.ObjectID `bson:"candidate_id" json:"candidate_id"`
	Status      string             `bson:"status" json:"status"` // Applied, Shortlisted, Interviewing, Rejected, Hired
	CoverLetter string             `bson:"cover_letter" json:"cover_letter"`
	ResumeURL   string             `bson:"resume_url" json:"resume_url"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type CreateApplicationRequest struct {
	JobID       string `json:"job_id" validate:"required"`
	CoverLetter string `json:"cover_letter"`
	ResumeURL   string `json:"resume_url"` // Optional if already in profile
}

type UpdateApplicationStatusRequest struct {
	Status string `json:"status" validate:"required"`
}

type ApplicationFilter struct {
	JobID       string
	RecruiterID string
	CandidateID string
	Status      string
}

type ApplicationDetail struct {
	ID          string         `json:"id"`
	JobID       string         `json:"job_id"`
	RecruiterID string         `json:"recruiter_id"`
	CandidateID string         `json:"candidate_id"`
	Status      string         `json:"status"`
	CoverLetter string         `json:"cover_letter"`
	ResumeURL   string         `json:"resume_url"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	Job         *JobInfo       `json:"job,omitempty"`
	Candidate   *CandidateInfo `json:"candidate,omitempty"`
}

type CandidateInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Email        string   `json:"email"`
	Mobile       string   `json:"mobile"`
	ProfileImage string   `json:"profile_image"`
	Headline     string   `json:"headline"`
	City         string   `json:"city"`
	Skills       []string `json:"skills"`
}

type JobInfo struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Company       string  `json:"company"`
	CompanyID     string  `json:"company_id"`
	Location      string  `json:"location"`
	CityName      string  `json:"city_name"`
	SalaryMin     int     `json:"salary_min"`
	SalaryMax     int     `json:"salary_max"`
	JobType       string  `json:"job_type"`
	Status        string  `json:"status"`
	ExperienceMin int     `json:"experience_min"`
	ExperienceMax int     `json:"experience_max"`
	Rating        float64 `json:"rating"`        // Mocked for now
	Reviews       string  `json:"reviews_count"` // Mocked for now
	StatusText    string  `json:"status_text"`   // e.g. "Resume viewed 7 week ago"
	LastActive    string  `json:"last_active"`   // e.g. "Recruiter last active 5w ago"
}
