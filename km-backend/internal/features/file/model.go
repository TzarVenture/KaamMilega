package file

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type File struct {
	ID               primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	OriginalFilename string             `json:"original_filename" bson:"original_filename"`
	// URL is the CDN address of a public file, or /api/files/{id} for a private one
	URL        string `json:"url" bson:"url"`
	Kind       string `json:"kind,omitempty" bson:"kind,omitempty"`
	Visibility string `json:"visibility,omitempty" bson:"visibility,omitempty"` // "public" or "private"
	// Key is the object name in storage; never sent to clients
	Key string `json:"-" bson:"key,omitempty"`
	// Path is where files from before cloud storage sat on the API server's disk
	Path       string             `json:"-" bson:"path,omitempty"`
	Size       int64              `json:"size" bson:"size"`
	MimeType   string             `json:"mime_type" bson:"mime_type"`
	ModuleName string             `json:"module_name,omitempty" bson:"module_name,omitempty"`
	RecordID   string             `json:"record_id,omitempty" bson:"record_id,omitempty"`
	UploadedBy primitive.ObjectID `json:"uploaded_by" bson:"uploaded_by"`
	CreatedAt  time.Time          `json:"created_at" bson:"created_at"`
}
