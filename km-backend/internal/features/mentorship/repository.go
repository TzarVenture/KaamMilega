package mentorship

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"km-backend/internal/database"
)

type MentorshipRepository interface {
	CreateMentorship(ctx context.Context, mentorship *Mentorship) (*Mentorship, error)
	GetMentorshipByID(ctx context.Context, id string) (*Mentorship, error)
	ListMentorships(ctx context.Context, category string) ([]Mentorship, error)
	GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error)
	UpdateMentorship(ctx context.Context, id string, mentorship *Mentorship) (*Mentorship, error)
	DeleteMentorship(ctx context.Context, id string) error

	CreateBooking(ctx context.Context, booking *Booking) (*Booking, error)
	GetBookingByID(ctx context.Context, id string) (*Booking, error)
	ListBookingsByUser(ctx context.Context, userID string) ([]Booking, error)
	ListBookingsByExpert(ctx context.Context, expertID string) ([]Booking, error)
	UpdateBookingStatus(ctx context.Context, id string, status string) error

	UpdateAvailability(ctx context.Context, expertID string, availabilities []Availability) error
	GetAvailabilityByExpert(ctx context.Context, expertID string) ([]Availability, error)
}

type MentorshipRepositoryImpl struct {
	db               *database.MongodbDB
	mentorshipColl   *mongo.Collection
	bookingColl      *mongo.Collection
	availabilityColl *mongo.Collection
}

func NewMentorshipRepository(db *database.MongodbDB) MentorshipRepository {
	return &MentorshipRepositoryImpl{
		db:               db,
		mentorshipColl:   db.DB.Collection("mentorships"),
		bookingColl:      db.DB.Collection("mentorship_bookings"),
		availabilityColl: db.DB.Collection("expert_availability"),
	}
}

func (r *MentorshipRepositoryImpl) CreateMentorship(ctx context.Context, mentorship *Mentorship) (*Mentorship, error) {
	mentorship.CreatedAt = time.Now()
	mentorship.UpdatedAt = time.Now()
	res, err := r.mentorshipColl.InsertOne(ctx, mentorship)
	if err != nil {
		return nil, err
	}
	mentorship.ID = res.InsertedID.(primitive.ObjectID)
	return mentorship, nil
}

func (r *MentorshipRepositoryImpl) GetMentorshipByID(ctx context.Context, id string) (*Mentorship, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var m Mentorship
	err = r.mentorshipColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&m)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

func (r *MentorshipRepositoryImpl) ListMentorships(ctx context.Context, category string) ([]Mentorship, error) {
	filter := bson.M{"status": "active"}
	if category != "" {
		filter["category"] = category
	}
	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.mentorshipColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []Mentorship
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *MentorshipRepositoryImpl) GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error) {
	oid, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return nil, err
	}
	cursor, err := r.mentorshipColl.Find(ctx, bson.M{"expert_id": oid})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []Mentorship
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *MentorshipRepositoryImpl) UpdateMentorship(ctx context.Context, id string, mentorship *Mentorship) (*Mentorship, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	mentorship.UpdatedAt = time.Now()
	update := bson.M{"$set": mentorship}
	_, err = r.mentorshipColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		return nil, err
	}
	return mentorship, nil
}

func (r *MentorshipRepositoryImpl) DeleteMentorship(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.mentorshipColl.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}

func (r *MentorshipRepositoryImpl) CreateBooking(ctx context.Context, booking *Booking) (*Booking, error) {
	booking.CreatedAt = time.Now()
	booking.UpdatedAt = time.Now()
	res, err := r.bookingColl.InsertOne(ctx, booking)
	if err != nil {
		return nil, err
	}
	booking.ID = res.InsertedID.(primitive.ObjectID)
	return booking, nil
}

func (r *MentorshipRepositoryImpl) GetBookingByID(ctx context.Context, id string) (*Booking, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var b Booking
	err = r.bookingColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&b)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *MentorshipRepositoryImpl) ListBookingsByUser(ctx context.Context, userID string) ([]Booking, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}
	cursor, err := r.bookingColl.Find(ctx, bson.M{"user_id": oid}, options.Find().SetSort(bson.M{"scheduled_at": -1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []Booking
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *MentorshipRepositoryImpl) ListBookingsByExpert(ctx context.Context, expertID string) ([]Booking, error) {
	oid, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return nil, err
	}
	cursor, err := r.bookingColl.Find(ctx, bson.M{"expert_id": oid}, options.Find().SetSort(bson.M{"scheduled_at": -1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []Booking
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *MentorshipRepositoryImpl) UpdateBookingStatus(ctx context.Context, id string, status string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.bookingColl.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now()}})
	return err
}

func (r *MentorshipRepositoryImpl) UpdateAvailability(ctx context.Context, expertID string, availabilities []Availability) error {
	oid, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return err
	}
	// Delete existing and insert new
	_, err = r.availabilityColl.DeleteMany(ctx, bson.M{"expert_id": oid})
	if err != nil {
		return err
	}
	if len(availabilities) > 0 {
		var docs []interface{}
		for _, a := range availabilities {
			a.ExpertID = oid
			docs = append(docs, a)
		}
		_, err = r.availabilityColl.InsertMany(ctx, docs)
	}
	return err
}

func (r *MentorshipRepositoryImpl) GetAvailabilityByExpert(ctx context.Context, expertID string) ([]Availability, error) {
	oid, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return nil, err
	}
	cursor, err := r.availabilityColl.Find(ctx, bson.M{"expert_id": oid})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []Availability
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}
