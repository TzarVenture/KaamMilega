package event

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"km-backend/internal/database"
)

type EventRepositoryImpl struct {
	db         *database.MongodbDB
	collection *mongo.Collection
	ticketColl *mongo.Collection
}

func NewEventRepository(db *database.MongodbDB) EventRepository {
	return &EventRepositoryImpl{
		db:         db,
		collection: db.DB.Collection("events"),
		ticketColl: db.DB.Collection("event_tickets"),
	}
}

func (r *EventRepositoryImpl) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	e.CreatedAt = time.Now()
	e.UpdatedAt = time.Now()
	if e.ID.IsZero() {
		e.ID = primitive.NewObjectID()
	}
	if e.Capacity > 0 && e.AvailableSeats == 0 {
		e.AvailableSeats = e.Capacity
	}
	if e.Participants == nil {
		e.Participants = []primitive.ObjectID{}
	}
	_, err := r.collection.InsertOne(ctx, e)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *EventRepositoryImpl) GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error) {
	bsonFilter := bson.M{}
	if filter.Search != "" {
		regex := bson.M{"$regex": filter.Search, "$options": "i"}
		bsonFilter["$or"] = []bson.M{
			{"title": regex},
			{"organizer": regex},
			{"category": regex},
		}
	}

	if filter.Location != "" {
		bsonFilter["location"] = bson.M{"$regex": filter.Location, "$options": "i"}
	}

	if filter.IsPaid != nil {
		bsonFilter["is_paid"] = *filter.IsPaid
	}

	opts := options.Find()
	if filter.Sort == "Upcoming" {
		opts.SetSort(bson.M{"date": 1})
	} else {
		opts.SetSort(bson.M{"created_at": -1})
	}

	total, err := r.collection.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	if filter.Limit > 0 {
		opts.SetLimit(int64(filter.Limit))
		if filter.Page > 1 {
			opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
		}
	}

	cursor, err := r.collection.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var events []Event
	if err := cursor.All(ctx, &events); err != nil {
		return nil, 0, err
	}
	
	if events == nil {
		events = []Event{}
	}

	return events, total, nil
}

func (r *EventRepositoryImpl) GetEventByID(ctx context.Context, id primitive.ObjectID) (*Event, error) {
	var e Event
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&e)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *EventRepositoryImpl) RegisterUser(ctx context.Context, eventID, userID primitive.ObjectID) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": eventID},
		bson.M{"$addToSet": bson.M{"participants": userID}},
	)
	return err
}

func (r *EventRepositoryImpl) DecrementAvailableSeats(ctx context.Context, eventID primitive.ObjectID) error {
	filter := bson.M{
		"_id": eventID,
		"capacity": bson.M{"$gt": 0},
		"available_seats": bson.M{"$gt": 0},
	}
	update := bson.M{
		"$inc": bson.M{"available_seats": -1},
	}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}

func (r *EventRepositoryImpl) CreateTicket(ctx context.Context, ticket *EventTicket) (*EventTicket, error) {
	ticket.CreatedAt = time.Now()
	if ticket.ID.IsZero() {
		ticket.ID = primitive.NewObjectID()
	}
	_, err := r.ticketColl.InsertOne(ctx, ticket)
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

func (r *EventRepositoryImpl) GetTicketByID(ctx context.Context, id primitive.ObjectID) (*EventTicket, error) {
	var t EventTicket
	err := r.ticketColl.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *EventRepositoryImpl) GetTicketByEventAndUser(ctx context.Context, eventID, userID primitive.ObjectID) (*EventTicket, error) {
	var t EventTicket
	err := r.ticketColl.FindOne(ctx, bson.M{
		"event_id": eventID,
		"user_id":  userID,
		"status":   "confirmed",
	}).Decode(&t)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *EventRepositoryImpl) GetTicketsByUser(ctx context.Context, userID primitive.ObjectID) ([]EventTicket, error) {
	cursor, err := r.ticketColl.Find(ctx, bson.M{
		"user_id": userID,
		"status":  "confirmed",
	}, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var tickets []EventTicket
	if err := cursor.All(ctx, &tickets); err != nil {
		return nil, err
	}
	if tickets == nil {
		tickets = []EventTicket{}
	}
	return tickets, nil
}

func (r *EventRepositoryImpl) GetTicketsByEvent(ctx context.Context, eventID primitive.ObjectID) ([]EventTicket, error) {
	cursor, err := r.ticketColl.Find(ctx, bson.M{
		"event_id": eventID,
		"status":   "confirmed",
	}, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var tickets []EventTicket
	if err := cursor.All(ctx, &tickets); err != nil {
		return nil, err
	}
	if tickets == nil {
		tickets = []EventTicket{}
	}
	return tickets, nil
}

// GetEventAttendees fetches attendee profiles for all confirmed participants of an event (F64)
func (r *EventRepositoryImpl) GetEventAttendees(ctx context.Context, eventID primitive.ObjectID) ([]EventAttendeeItem, error) {
	event, err := r.GetEventByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, errors.New("event not found")
	}

	if len(event.Participants) == 0 {
		return []EventAttendeeItem{}, nil
	}

	userColl := r.db.DB.Collection("users")
	cursor, err := userColl.Find(ctx, bson.M{
		"_id": bson.M{"$in": event.Participants},
	}, options.Find().SetProjection(bson.M{
		"_id":           1,
		"name":          1,
		"first_name":    1,
		"last_name":     1,
		"headline":      1,
		"profile_image": 1,
		"city":          1,
		"roles":         1,
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	type rawUser struct {
		ID           primitive.ObjectID `bson:"_id"`
		Name         string             `bson:"name"`
		FirstName    string             `bson:"first_name"`
		LastName     string             `bson:"last_name"`
		Headline     string             `bson:"headline"`
		ProfileImage string             `bson:"profile_image"`
		City         string             `bson:"city"`
		Roles        []string           `bson:"roles"`
	}

	var users []rawUser
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}

	userMap := make(map[primitive.ObjectID]rawUser)
	for _, u := range users {
		userMap[u.ID] = u
	}

	// Fetch confirmed tickets for this event
	tickets, _ := r.GetTicketsByEvent(ctx, eventID)
	ticketMap := make(map[primitive.ObjectID]EventTicket)
	for _, t := range tickets {
		ticketMap[t.UserID] = t
	}

	attendees := make([]EventAttendeeItem, 0, len(event.Participants))
	for _, uid := range event.Participants {
		u, found := userMap[uid]
		name := u.Name
		if name == "" && found {
			if u.FirstName != "" || u.LastName != "" {
				name = fmt.Sprintf("%s %s", u.FirstName, u.LastName)
			}
		}

		ticket, hasTicket := ticketMap[uid]
		if name == "" && hasTicket && ticket.AttendeeName != "" {
			name = ticket.AttendeeName
		}
		if name == "" {
			name = "Participant"
		}

		headline := u.Headline
		if headline == "" {
			headline = "KaamMilega Member"
		}

		role := "user"
		if len(u.Roles) > 0 {
			role = u.Roles[0]
		}

		paymentType := "free"
		var ticketNum string
		var joinedAt time.Time

		if hasTicket {
			paymentType = ticket.PaymentStatus
			ticketNum = ticket.TicketNumber
			joinedAt = ticket.CreatedAt
		} else {
			joinedAt = event.CreatedAt
		}

		attendees = append(attendees, EventAttendeeItem{
			ID:           uid.Hex(),
			Name:         name,
			Headline:     headline,
			ProfileImage: u.ProfileImage,
			City:         u.City,
			Role:         role,
			TicketNumber: ticketNum,
			PaymentType:  paymentType,
			JoinedAt:     joinedAt,
		})
	}

	return attendees, nil
}

