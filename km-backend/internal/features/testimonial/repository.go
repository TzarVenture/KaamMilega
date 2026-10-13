package testimonial

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"km-backend/internal/database"
)

type MongoTestimonialRepository struct {
	coll *mongo.Collection
}

func NewTestimonialRepository(db *database.MongodbDB) TestimonialRepository {
	repo := &MongoTestimonialRepository{
		coll: db.DB.Collection("testimonials"),
	}

	// Seed defaults in background if empty
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = repo.SeedDefaultsIfEmpty(ctx)
	}()

	return repo
}

func (r *MongoTestimonialRepository) SeedDefaultsIfEmpty(ctx context.Context) error {
	count, err := r.coll.CountDocuments(ctx, bson.M{})
	if err == nil && count > 0 {
		// Backfill existing documents if review is blank
		emptyReviews := bson.M{"$or": []bson.M{{"review": ""}, {"review": bson.M{"$exists": false}}}}
		nameReviews := map[string]string{
			"Dharmender Kumar": "Zero brokerage and direct HR call. Joined warehouse team within 48 hrs!",
			"Sachin Singh":     "Verified company with prompt salary. Best job platform for drivers.",
			"Pooja Verma":      "Direct HR round at Tata Croma with transparent joining terms.",
			"Raju Yadav":       "Verified technician badge helped me get instant site work & weekly pay.",
			"Jignesh Bharatia": "Super smooth interview and direct offer without paying any middleman.",
			"SamSum":           "Instant interview scheduling and transparent salary offer with zero cuts!",
			"Mangesh Manojia":  "Genuine verified platform. Received company HR call the very next day.",
		}
		for name, rev := range nameReviews {
			_, _ = r.coll.UpdateOne(ctx, bson.M{"name": name, "$or": []bson.M{{"review": ""}, {"review": bson.M{"$exists": false}}}}, bson.M{"$set": bson.M{"review": rev}})
		}
		_, _ = r.coll.UpdateMany(ctx, emptyReviews, bson.M{"$set": bson.M{"review": "Direct HR interview call within 48 hours and zero brokerage."}})
		return nil
	}
	if err != nil {
		return err
	}

	defaults := []Testimonial{
		{
			ID:             primitive.NewObjectID(),
			Name:           "Dharmender Kumar",
			Role:           "Warehouse Operations Supervisor",
			Company:        "Technova Logistics",
			City:           "Bhiwandi, Thane",
			TradeTag:       "Logistics & Warehousing",
			Rating:         5,
			Review:         "Zero brokerage and direct HR call. Joined Technova in 3 days!",
			YouTubeURL:     "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			YouTubeVideoID: "dQw4w9WgXcQ",
			ThumbnailURL:   "/asset/trades/warehouse.jpg",
			IsActive:       true,
			Order:          1,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
		{
			ID:             primitive.NewObjectID(),
			Name:           "Sachin Singh",
			Role:           "Heavy Commercial Driver",
			Company:        "City Fleet Transport",
			City:           "Surat, Gujarat",
			TradeTag:       "Commercial Transport",
			Rating:         5,
			Review:         "Verified company with punctual salary. Best job platform for drivers.",
			YouTubeURL:     "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			YouTubeVideoID: "dQw4w9WgXcQ",
			ThumbnailURL:   "/asset/trades/driver.jpg",
			IsActive:       true,
			Order:          2,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
		{
			ID:             primitive.NewObjectID(),
			Name:           "Pooja Verma",
			Role:           "Retail Store Executive",
			Company:        "Tata Croma",
			City:           "Mumbai, Maharashtra",
			TradeTag:       "Retail & Customer Ops",
			Rating:         5,
			Review:         "Instant interview schedule without middlemen. Very smooth onboarding.",
			YouTubeURL:     "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			YouTubeVideoID: "dQw4w9WgXcQ",
			ThumbnailURL:   "/asset/trades/office-executive.jpg",
			IsActive:       true,
			Order:          3,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
		{
			ID:             primitive.NewObjectID(),
			Name:           "Raju Yadav",
			Role:           "Certified Industrial Electrician",
			Company:        "InstantMilega™ Partner",
			City:           "Delhi NCR",
			TradeTag:       "Technical Services",
			Rating:         5,
			Review:         "Direct corporate booking and verified partner technical trade jobs.",
			YouTubeURL:     "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			YouTubeVideoID: "dQw4w9WgXcQ",
			ThumbnailURL:   "/asset/trades/electrician.jpg",
			IsActive:       true,
			Order:          4,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
	}

	var docs []any
	for _, item := range defaults {
		docs = append(docs, item)
	}

	_, err = r.coll.InsertMany(ctx, docs)
	return err
}

func (r *MongoTestimonialRepository) GetActive(ctx context.Context) ([]*Testimonial, error) {
	opts := options.Find().SetSort(bson.D{{Key: "order", Value: 1}, {Key: "created_at", Value: -1}})
	cursor, err := r.coll.Find(ctx, bson.M{"is_active": true}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []*Testimonial
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []*Testimonial{}
	}
	return list, nil
}

func (r *MongoTestimonialRepository) GetAll(ctx context.Context) ([]*Testimonial, error) {
	opts := options.Find().SetSort(bson.D{{Key: "order", Value: 1}, {Key: "created_at", Value: -1}})
	cursor, err := r.coll.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []*Testimonial
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []*Testimonial{}
	}
	return list, nil
}

func (r *MongoTestimonialRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*Testimonial, error) {
	var t Testimonial
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *MongoTestimonialRepository) Create(ctx context.Context, t *Testimonial) (*Testimonial, error) {
	t.ID = primitive.NewObjectID()
	t.CreatedAt = time.Now()
	t.UpdatedAt = time.Now()

	_, err := r.coll.InsertOne(ctx, t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *MongoTestimonialRepository) Update(ctx context.Context, t *Testimonial) error {
	t.UpdatedAt = time.Now()
	res, err := r.coll.ReplaceOne(ctx, bson.M{"_id": t.ID}, t)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (r *MongoTestimonialRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}
