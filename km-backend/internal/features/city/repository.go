package city

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

type CityRepository interface {
	Create(ctx context.Context, city *City) (*City, error)
	FindByID(ctx context.Context, id string) (*City, error)
	FindCities(ctx context.Context, filter CityFilter) ([]City, int64, error)
	Update(ctx context.Context, id string, city *City) (*City, error)
	Delete(ctx context.Context, id string) error
}

type CityRepositoryImpl struct {
	db       *database.MongodbDB
	cityColl *mongo.Collection
}

func NewCityRepository(db *database.MongodbDB) CityRepository {
	return &CityRepositoryImpl{
		db:       db,
		cityColl: db.DB.Collection("cities"),
	}
}

func (r *CityRepositoryImpl) Create(ctx context.Context, city *City) (*City, error) {
	city.CreatedAt = time.Now()
	city.UpdatedAt = time.Now()
	city.Active = true
	res, err := r.cityColl.InsertOne(ctx, city)
	if err != nil {
		return nil, err
	}
	city.ID = res.InsertedID.(primitive.ObjectID)
	return city, nil
}

func (r *CityRepositoryImpl) FindByID(ctx context.Context, id string) (*City, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var city City
	err = r.cityColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&city)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &city, nil
}

func (r *CityRepositoryImpl) FindCities(ctx context.Context, filter CityFilter) ([]City, int64, error) {
	query := bson.M{}

	if filter.ActiveOnly {
		query["active"] = true
	}

	if filter.Search != "" {
		query["$or"] = []bson.M{
			{"name": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"state": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"country": bson.M{"$regex": filter.Search, "$options": "i"}},
		}
	}

	total, _ := r.cityColl.CountDocuments(ctx, query)

	opts := options.Find().SetSort(bson.M{"name": 1})
	if filter.Limit > 0 {
		opts.SetLimit(int64(filter.Limit))
		opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
	}

	cursor, err := r.cityColl.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var cities []City
	if err = cursor.All(ctx, &cities); err != nil {
		return nil, 0, err
	}
	// Avoid nil slice
	if cities == nil {
		cities = []City{}
	}

	return cities, total, nil
}

func (r *CityRepositoryImpl) Update(ctx context.Context, id string, city *City) (*City, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	city.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"name":       city.Name,
			"state":      city.State,
			"country":    city.Country,
			"active":     city.Active,
			"updated_at": city.UpdatedAt,
		},
	}

	_, err = r.cityColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		return nil, err
	}

	return r.FindByID(ctx, id)
}

func (r *CityRepositoryImpl) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.cityColl.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}
