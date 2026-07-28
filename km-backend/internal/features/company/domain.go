package company

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Company struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RecruiterID primitive.ObjectID `bson:"recruiter_id" json:"recruiter_id"`
	Name        string             `bson:"name" json:"name"`
	Logo        string             `bson:"logo" json:"logo"`
	Website     string             `bson:"website" json:"website"` // Optional
	GST         string             `bson:"gst" json:"gst"`
	Documents   []Document         `bson:"documents" json:"documents"`
	Status      string             `bson:"status" json:"status"` // "verified", "pending", "rejected"
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type Document struct {
	Name string `bson:"name" json:"name"`
	URL  string `bson:"url" json:"url"`
}

type CompanyFilter struct {
	Search string
	Status string
	Page   int
	Limit  int
}

type CreateCompanyRequest struct {
	RecruiterID string     `json:"recruiter_id"`
	Name        string     `json:"name"`
	Logo        string     `json:"logo"`
	Website     string     `json:"website"`
	GST         string     `json:"gst"`
	Documents   []Document `json:"documents"`
}

type UpdateCompanyRequest struct {
	Name      string     `json:"name"`
	Logo      string     `json:"logo"`
	Website   string     `json:"website"`
	GST       string     `json:"gst"`
	Documents []Document `json:"documents"`
	Status    string     `json:"status"`
}

type CompanyResponse struct {
	ID          string        `json:"id"`
	RecruiterID string        `json:"recruiter_id"`
	Name        string        `json:"name"`
	Logo        string        `json:"logo"`
	Website     string        `json:"website"`
	GST         string        `json:"gst"`
	Documents   []Document    `json:"documents"`
	Status      string        `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
	Recruiter   RecruiterInfo `json:"recruiter"`
}

type RecruiterInfo struct {
	Name        string `json:"name"`
	Designation string `json:"designation"`
	LastActive  string `json:"last_active"` // For simplified display
}
