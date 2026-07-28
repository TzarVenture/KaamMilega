package skill

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Skill represents a skill in the system
type Skill struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Category  string             `bson:"category,omitempty" json:"category,omitempty"` // e.g., "Technical", "Soft Skill"
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type CreateSkillRequest struct {
	Name     string `json:"name" binding:"required"`
	Category string `json:"category"`
}

type UpdateSkillRequest struct {
	Name     string `json:"name"`
	Category string `json:"category"`
}
