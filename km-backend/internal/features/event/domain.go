package event

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Event struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title        string               `bson:"title" json:"title"`
	Organizer    string               `bson:"organizer" json:"organizer"`
	Description  string               `bson:"description" json:"description"`
	Date         string               `bson:"date" json:"date"`
	Time         string               `bson:"time" json:"time"`
	Location     string               `bson:"location" json:"location"`
	ImageURL     string               `bson:"image_url,omitempty" json:"image_url,omitempty"`
	Participants []primitive.ObjectID `bson:"participants" json:"participants"`
	CreatedAt    time.Time            `bson:"created_at" json:"created_at"`
}

type EventFilter struct {
	Search   string
	Location string
	Sort     string
	Page     int
	Limit    int
}

type EventRepository interface {
	CreateEvent(ctx context.Context, e *Event) (*Event, error)
	GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error)
	GetEventByID(ctx context.Context, id primitive.ObjectID) (*Event, error)
	RegisterUser(ctx context.Context, eventID, userID primitive.ObjectID) error
}

type EventService interface {
	CreateEvent(ctx context.Context, e *Event) (*Event, error)
	GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error)
	GetEventByID(ctx context.Context, id string) (*Event, error)
	RegisterUser(ctx context.Context, eventID, userID string) error
}
