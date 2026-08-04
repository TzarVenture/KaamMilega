package user

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Roles
const (
	RoleAdmin     = "admin"
	RoleUser      = "user"
	RoleRecruiter = "recruiter"
	RoleExpert    = "expert"
)

type Document struct {
	Name string `bson:"name" json:"name"`
	URL  string `bson:"url" json:"url"`
}

// User represents the user model in MongoDB
type User struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Mobile        string             `bson:"mobile" json:"mobile"`
	Roles         []string           `bson:"roles" json:"roles"`
	IsRegistered  bool               `bson:"is_registered" json:"is_registered"`
	OTPVerifiedAt *time.Time         `bson:"otp_verified_at,omitempty" json:"otp_verified_at"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`

	// Profile fields
	Name             string   `bson:"name,omitempty" json:"name,omitempty"`
	FirstName        string   `bson:"first_name,omitempty" json:"first_name,omitempty"`
	LastName         string   `bson:"last_name,omitempty" json:"last_name,omitempty"`
	Headline         string   `bson:"headline,omitempty" json:"headline,omitempty"`
	About            string   `bson:"about,omitempty" json:"about,omitempty"`
	AdditionalName   string   `bson:"additional_name,omitempty" json:"additional_name,omitempty"`
	Pronouns         string   `bson:"pronouns,omitempty" json:"pronouns,omitempty"`
	Address          string   `bson:"address,omitempty" json:"address,omitempty"`
	ProfileImage     string   `bson:"profile_image,omitempty" json:"profile_image,omitempty"`
	CoverImage       string   `bson:"cover_image,omitempty" json:"cover_image,omitempty"`
	Gender           string   `bson:"gender,omitempty" json:"gender,omitempty"`
	DateOfBirth      string   `bson:"date_of_birth,omitempty" json:"date_of_birth,omitempty"`
	MaritalStatus    string   `bson:"marital_status,omitempty" json:"marital_status,omitempty"`
	EducationLevel   string   `bson:"education_level,omitempty" json:"education_level,omitempty"`
	WorkExperience   string   `bson:"work_experience,omitempty" json:"work_experience,omitempty"`
	City             string   `bson:"city,omitempty" json:"city,omitempty"`
	State            string   `bson:"state,omitempty" json:"state,omitempty"`
	Country          string   `bson:"country,omitempty" json:"country,omitempty"`
	JobCategories    []string `bson:"job_categories,omitempty" json:"job_categories,omitempty"`
	ExperienceDetail string   `bson:"experience_detail,omitempty" json:"experience_detail,omitempty"`
	Email            string     `bson:"email,omitempty" json:"email,omitempty"`
	IsEmailVerified  bool       `bson:"is_email_verified" json:"is_email_verified"`
	EmailVerifiedAt  *time.Time `bson:"email_verified_at,omitempty" json:"email_verified_at,omitempty"`
	IsConsultant     bool       `bson:"is_consultant,omitempty" json:"is_consultant,omitempty"`

	// New Profile Fields
	Education  []Education  `bson:"education,omitempty" json:"education,omitempty"`
	Experience []Experience `bson:"experience,omitempty" json:"experience,omitempty"`
	Skills     []string     `bson:"skills,omitempty" json:"skills,omitempty"`

	// Recruiter / Company specific fields
	CompanyName        string     `bson:"company_name,omitempty" json:"company_name,omitempty"`
	CompanyLogo        string     `bson:"company_logo,omitempty" json:"company_logo,omitempty"`
	CompanyWebsite     string     `bson:"company_website,omitempty" json:"company_website,omitempty"`
	GST                string     `bson:"gst,omitempty" json:"gst,omitempty"`
	CompanyDocuments   []Document `bson:"company_documents,omitempty" json:"company_documents,omitempty"`
	VerificationStatus string     `bson:"verification_status,omitempty" json:"verification_status,omitempty"` // e.g. "verified", "pending", "rejected"
	LastActiveAt       time.Time  `bson:"last_active_at,omitempty" json:"last_active_at,omitempty"`
	LastLoginLat       float64    `bson:"last_login_lat,omitempty" json:"last_login_lat,omitempty"`
	LastLoginLng       float64    `bson:"last_login_lng,omitempty" json:"last_login_lng,omitempty"`
	
	// Expert Profile specific fields
	ExpertCategory       string     `bson:"expert_category,omitempty" json:"expert_category,omitempty"`
	ExpertBio            string     `bson:"expert_bio,omitempty" json:"expert_bio,omitempty"`
	ExpertPricing        float64    `bson:"expert_pricing,omitempty" json:"expert_pricing,omitempty"`
	ExpertDocuments      []Document `bson:"expert_documents,omitempty" json:"expert_documents,omitempty"`
	ExpertApprovalStatus string     `bson:"expert_approval_status,omitempty" json:"expert_approval_status,omitempty"` // "pending", "approved", "rejected"
}

type Education struct {
	ID           string `bson:"id" json:"id"` // Unique ID for the entry
	SchoolName   string `bson:"school_name" json:"school_name"`
	Degree       string `bson:"degree" json:"degree"`
	FieldOfStudy string `bson:"field_of_study" json:"field_of_study"`
	StartDate    string `bson:"start_date" json:"start_date"` // e.g. "2020-09"
	EndDate      string `bson:"end_date" json:"end_date"`     // e.g. "2024-06" or empty
	Grade        string `bson:"grade" json:"grade"`
	Description  string `bson:"description" json:"description"`
}

type Experience struct {
	ID             string   `bson:"id" json:"id"` // Unique ID for the entry
	Title          string   `bson:"title" json:"title"`
	EmploymentType string   `bson:"employment_type" json:"employment_type"`
	CompanyName    string   `bson:"company_name" json:"company_name"`
	Location       string   `bson:"location" json:"location"`
	StartDate      string   `bson:"start_date" json:"start_date"`
	EndDate        string   `bson:"end_date" json:"end_date"`
	Description    string   `bson:"description" json:"description"`
	Skills         []string `bson:"skills" json:"skills"`
}

// OTP represents an OTP entry
type OTP struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Mobile    string             `bson:"mobile,omitempty" json:"mobile,omitempty"`
	Email     string             `bson:"email,omitempty" json:"email,omitempty"`
	Code      string             `bson:"code" json:"code"`
	ExpiresAt time.Time          `bson:"expires_at" json:"expires_at"`
	Used      bool               `bson:"used" json:"used"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

// Requests/Responses

type SendOTPRequest struct {
	Mobile string `json:"mobile"`
	Role   string `json:"role"` // "user" or "recruiter"
}

type VerifyOTPRequest struct {
	Mobile string `json:"mobile"`
	Code   string `json:"code"`
	Role   string `json:"role"` // "user" or "recruiter"
}

type VerifyOTPResponse struct {
	Token        string `json:"token"`
	IsRegistered bool   `json:"is_registered"`
	User         *User  `json:"user"`
}

type RegisterRequest struct {
	Mobile           string   `json:"mobile"` // Should match token claim normally
	Roles            []string `json:"roles"`
	Name             string   `json:"name"`
	Gender           string   `json:"gender"`
	EducationLevel   string   `json:"education_level"`
	WorkExperience   string   `json:"work_experience"`
	City             string   `json:"city"`
	JobCategories    []string `json:"job_categories"`
	ExperienceDetail string   `json:"experience_detail"`
	Email            string   `json:"email"`
	IsEmailVerified  bool     `json:"is_email_verified"`
	IsConsultant     bool     `json:"is_consultant"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type SendEmailOTPRequest struct {
	Email string `json:"email"`
}

type VerifyEmailOTPRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type UserFilter struct {
	Role                 string
	Search               string
	CompanyName          string
	VerificationStatus   string
	ExpertApprovalStatus string
	Page                 int
	Limit                int
}

type ApplyExpertRequest struct {
	ExpertCategory  string     `json:"expert_category"`
	ExpertBio       string     `json:"expert_bio"`
	ExpertPricing   float64    `json:"expert_pricing"`
	ExpertDocuments []Document `json:"expert_documents"`
}

type ApproveExpertRequest struct {
	Status string `json:"status"` // "approved" or "rejected"
}
