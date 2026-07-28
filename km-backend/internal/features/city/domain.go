package city

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type City struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	State     string             `bson:"state" json:"state"`
	Country   string             `bson:"country" json:"country"`
	Active    bool               `bson:"active" json:"active"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type CreateCityRequest struct {
	Name    string `json:"name" validate:"required"`
	State   string `json:"state"`
	Country string `json:"country"`
}

type UpdateCityRequest struct {
	Name    string `json:"name"`
	State   string `json:"state"`
	Country string `json:"country"`
	Active  *bool  `json:"active"`
}

type CityFilter struct {
	Search     string
	Page       int
	Limit      int
	ActiveOnly bool
}
