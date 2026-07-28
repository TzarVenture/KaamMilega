package job

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Job struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RecruiterID primitive.ObjectID `bson:"recruiter_id,omitempty" json:"recruiter_id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Company     string             `bson:"company" json:"company"`
	CityID      primitive.ObjectID `bson:"city_id,omitempty" json:"city_id"`
	CityName    string             `bson:"city_name" json:"city_name"`
	Location    string             `bson:"location" json:"location"` // Specific address if needed

	SalaryMin   int    `bson:"salary_min" json:"salary_min"`
	SalaryMax   int    `bson:"salary_max" json:"salary_max"`
	SalaryRange string `bson:"salary_range,omitempty" json:"salary_range,omitempty"` // Deprecated but kept for backward compat if needed, or removed. I'll remove it to force new usage.

	JobType      string   `bson:"job_type" json:"job_type"`
	Status       string   `bson:"status" json:"status"`
	Requirements []string `bson:"requirements" json:"requirements"`
	WeOffer      []string `bson:"we_offer" json:"we_offer"`

	Gender    string `bson:"gender,omitempty" json:"gender,omitempty"`
	Education string `bson:"education,omitempty" json:"education,omitempty"`

	ExperienceMin int    `bson:"experience_min" json:"experience_min"`
	ExperienceMax int    `bson:"experience_max" json:"experience_max"`
	Experience    string `bson:"experience,omitempty" json:"experience,omitempty"` // Deprecated

	CreatedAt      time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time `bson:"updated_at" json:"updated_at"`
	ApplicantCount int       `bson:"-" json:"applicant_count"`
}

type CreateJobRequest struct {
	Title         string   `json:"title" validate:"required"`
	Description   string   `json:"description" validate:"required"`
	Company       string   `json:"company" validate:"required"`
	CityID        string   `json:"city_id" validate:"required"`
	Location      string   `json:"location"` // Optional specific address
	SalaryMin     int      `json:"salary_min"`
	SalaryMax     int      `json:"salary_max"`
	JobType       string   `json:"job_type" validate:"required"`
	Requirements  []string `json:"requirements"`
	WeOffer       []string `json:"we_offer"`
	Gender        string   `json:"gender"`
	Education     string   `json:"education"`
	ExperienceMin int      `json:"experience_min"`
	ExperienceMax int      `json:"experience_max"`
}

type UpdateJobRequest struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Company       string   `json:"company"`
	CityID        string   `json:"city_id"`
	Location      string   `json:"location"`
	SalaryMin     *int     `json:"salary_min"` // Pointer to distinguish 0 from unset
	SalaryMax     *int     `json:"salary_max"`
	JobType       string   `json:"job_type"`
	Status        string   `json:"status"`
	Requirements  []string `json:"requirements"`
	WeOffer       []string `json:"we_offer"`
	Gender        *string  `json:"gender"`
	Education     *string  `json:"education"`
	ExperienceMin *int     `json:"experience_min"`
	ExperienceMax *int     `json:"experience_max"`
}

type JobFilter struct {
	Search    string   // Search inside Title, Description, Company
	CityIDs   []string // Multi-select
	JobTypes  []string // Multi-select
	Genders   []string // Multi-select
	Education []string // Multi-select

	// Range filters
	SalaryMin     *int
	SalaryMax     *int
	ExperienceMin *int
	ExperienceMax *int

	Page  int
	Limit int
}
