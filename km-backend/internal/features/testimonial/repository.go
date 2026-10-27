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
	// Testimonials are only what admins add (admin/testimonials). The repository used to seed
	// invented stories into an empty collection and write made-up quotes into existing ones;
	// fabricated reviews must never be shown as real customer stories.
	return &MongoTestimonialRepository{
		coll: db.DB.Collection("testimonials"),
	}
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
