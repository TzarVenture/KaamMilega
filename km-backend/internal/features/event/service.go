package event

import (
	"context"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type EventServiceImpl struct {
	repo EventRepository
}

func NewEventService(repo EventRepository) EventService {
	return &EventServiceImpl{repo: repo}
}

func (s *EventServiceImpl) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	return s.repo.CreateEvent(ctx, e)
}

func (s *EventServiceImpl) GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error) {
	return s.repo.GetEvents(ctx, filter)
}

func (s *EventServiceImpl) GetEventByID(ctx context.Context, id string) (*Event, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetEventByID(ctx, objID)
}

func (s *EventServiceImpl) RegisterUser(ctx context.Context, eventID, userID string) error {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return err
	}
	uID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}
	return s.repo.RegisterUser(ctx, evID, uID)
}
