package file

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type File struct {
	ID               primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	OriginalFilename string             `json:"original_filename" bson:"original_filename"`
	URL              string             `json:"url" bson:"url"`
	Path             string             `json:"path" bson:"path"`
	Size             int64              `json:"size" bson:"size"`
	MimeType         string             `json:"mime_type" bson:"mime_type"`
	RecordID         string             `json:"record_id,omitempty" bson:"record_id,omitempty"`
	UploadedBy       primitive.ObjectID `json:"uploaded_by" bson:"uploaded_by"`
	CreatedAt        time.Time          `json:"created_at" bson:"created_at"`
}