package city

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

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
	city.Name = strings.TrimSpace(city.Name)
	city.State = strings.TrimSpace(city.State)
	city.Country = strings.TrimSpace(city.Country)

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
	city.Name = strings.TrimSpace(city.Name)
	city.State = strings.TrimSpace(city.State)
	city.Country = strings.TrimSpace(city.Country)
	return &city, nil
}

func (r *CityRepositoryImpl) FindCities(ctx context.Context, filter CityFilter) ([]City, int64, error) {
	matchStage := bson.M{}

	if filter.ActiveOnly {
		matchStage["active"] = true
	}

	if filter.Search != "" {
		trimmedSearch := strings.TrimSpace(filter.Search)
		matchStage["$or"] = []bson.M{
			{"name": bson.M{"$regex": trimmedSearch, "$options": "i"}},
			{"state": bson.M{"$regex": trimmedSearch, "$options": "i"}},
			{"country": bson.M{"$regex": trimmedSearch, "$options": "i"}},
		}
	}

	total, _ := r.cityColl.CountDocuments(ctx, matchStage)

	// Build aggregation pipeline to lookup jobs for each city
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: matchStage}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "name", Value: 1}}}},
	}

	if filter.Limit > 0 {
		skip := int64((filter.Page - 1) * filter.Limit)
		if skip > 0 {
			pipeline = append(pipeline, bson.D{{Key: "$skip", Value: skip}})
		}
		pipeline = append(pipeline, bson.D{{Key: "$limit", Value: int64(filter.Limit)}})
	}

	// Lookup active jobs matching city_id OR city_name
	pipeline = append(pipeline,
		bson.D{{Key: "$lookup", Value: bson.M{
			"from": "jobs",
			"let":  bson.M{"cId": "$_id", "cName": "$name"},
			"pipeline": mongo.Pipeline{
				bson.D{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$and": []bson.M{
							{
								"$or": []bson.M{
									{"$eq": []any{"$city_id", "$$cId"}},
									{"$eq": []any{"$city_name", "$$cName"}},
									{"$regexMatch": bson.M{"input": "$city_name", "regex": "$$cName", "options": "i"}},
								},
							},
							{"$ne": []any{"$status", "Deleted"}},
							{"$ne": []any{"$status", "Closed"}},
						},
					},
				}}},
			},
			"as": "matched_jobs",
		}}},
		bson.D{{Key: "$addFields", Value: bson.M{
			"jobs_count": bson.M{"$size": "$matched_jobs"},
		}}},
	)

	cursor, err := r.cityColl.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var rawCities []struct {
		ID        primitive.ObjectID `bson:"_id,omitempty"`
		Name      string             `bson:"name"`
		State     string             `bson:"state"`
		Country   string             `bson:"country"`
		Active    bool               `bson:"active"`
		JobsCount int                `bson:"jobs_count"`
		CreatedAt time.Time          `bson:"created_at"`
		UpdatedAt time.Time          `bson:"updated_at"`
	}

	if err = cursor.All(ctx, &rawCities); err != nil {
		return nil, 0, err
	}

	var cities []City
	for _, rc := range rawCities {
		cName := strings.TrimSpace(rc.Name)
		vacanciesStr := "0 Vacancies"
		if rc.JobsCount > 0 {
			vacanciesStr = fmt.Sprintf("%d Active Vacancies", rc.JobsCount)
		}

		cities = append(cities, City{
			ID:             rc.ID,
			Name:           cName,
			State:          strings.TrimSpace(rc.State),
			Country:        strings.TrimSpace(rc.Country),
			Active:         rc.Active,
			Vacancies:      vacanciesStr,
			JobsCount:      rc.JobsCount,
			TotalVacancies: rc.JobsCount,
			CreatedAt:      rc.CreatedAt,
			UpdatedAt:      rc.UpdatedAt,
		})
	}

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
			"name":       strings.TrimSpace(city.Name),
			"state":      strings.TrimSpace(city.State),
			"country":    strings.TrimSpace(city.Country),
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
