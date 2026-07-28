package job

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

type JobRepository interface {
	Create(ctx context.Context, job *Job) (*Job, error)
	FindByID(ctx context.Context, id string) (*Job, error)
	FindAll(ctx context.Context, filter JobFilter) ([]Job, int64, error)
	FindByRecruiter(ctx context.Context, recruiterID string) ([]Job, error)
	Update(ctx context.Context, id string, job *Job) (*Job, error)
	Delete(ctx context.Context, id string) error
}

type JobRepositoryImpl struct {
	db      *database.MongodbDB
	jobColl *mongo.Collection
}

func NewJobRepository(db *database.MongodbDB) JobRepository {
	return &JobRepositoryImpl{
		db:      db,
		jobColl: db.DB.Collection("jobs"),
	}
}

func (r *JobRepositoryImpl) Create(ctx context.Context, job *Job) (*Job, error) {
	job.CreatedAt = time.Now()
	job.UpdatedAt = time.Now()
	res, err := r.jobColl.InsertOne(ctx, job)
	if err != nil {
		return nil, err
	}
	job.ID = res.InsertedID.(primitive.ObjectID)
	return job, nil
}

func (r *JobRepositoryImpl) FindByID(ctx context.Context, id string) (*Job, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var job Job
	err = r.jobColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&job)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &job, nil
}

func (r *JobRepositoryImpl) FindAll(ctx context.Context, filter JobFilter) ([]Job, int64, error) {
	bsonFilter := bson.M{}

	// Filter logic
	if filter.Search != "" {
		regex := bson.M{"$regex": filter.Search, "$options": "i"}
		bsonFilter["$or"] = []bson.M{
			{"title": regex},
			{"description": regex},
			{"company": regex},
			{"location": regex},
			{"city_name": regex},
		}
	}

	if len(filter.CityIDs) > 0 {
		var oids []primitive.ObjectID
		var names []string
		for _, id := range filter.CityIDs {
			if oid, err := primitive.ObjectIDFromHex(id); err == nil {
				oids = append(oids, oid)
			} else {
				names = append(names, id)
			}
		}

		cityConditions := []bson.M{}
		if len(oids) > 0 {
			cityConditions = append(cityConditions, bson.M{"city_id": bson.M{"$in": oids}})
		}
		if len(names) > 0 {
			// Case-insensitive match for names requires regex ORs if we want strict robust
			// For simplicity in list, we can use $in with exact match or regex for each
			// Using regex for each name to be safe
			orNames := []bson.M{}
			for _, n := range names {
				orNames = append(orNames, bson.M{"city_name": bson.M{"$regex": n, "$options": "i"}})
			}
			cityConditions = append(cityConditions, bson.M{"$or": orNames})
		}

		if len(cityConditions) > 0 {
			if len(cityConditions) == 1 {
				// Merge into top level if possible, but be careful with existing $or from Search
				// To avoid conflict with Search $or, uses $and implicitly by adding to bsonFilter
				// But bsonFilter keys overwrite? "city_id" is unique key. "$or" might conflict.
				// If Search used $or, we can't use another $or at top level easily in simple map.
				// We should ideally use $and: [ {search_or}, {city_or} ]
				// Refactoring to use $and list for safety

				// Let's restart logic below to allow multiple complex conditions using $and
			}
		}
	}

	// Reset bsonFilter to use $and for safety with multiple complex conditions
	andConditions := []bson.M{}

	// Search
	if filter.Search != "" {
		regex := bson.M{"$regex": filter.Search, "$options": "i"}
		andConditions = append(andConditions, bson.M{"$or": []bson.M{
			{"title": regex},
			{"description": regex},
			{"company": regex},
			{"location": regex},
			{"city_name": regex},
		}})
	}

	// City IDs / Names
	if len(filter.CityIDs) > 0 {
		var oids []primitive.ObjectID
		var names []string
		for _, id := range filter.CityIDs {
			if oid, err := primitive.ObjectIDFromHex(id); err == nil {
				oids = append(oids, oid)
			} else {
				names = append(names, id)
			}
		}

		cityOr := []bson.M{}
		if len(oids) > 0 {
			cityOr = append(cityOr, bson.M{"city_id": bson.M{"$in": oids}})
		}
		for _, n := range names {
			cityOr = append(cityOr, bson.M{"city_name": bson.M{"$regex": n, "$options": "i"}})
		}

		if len(cityOr) > 0 {
			andConditions = append(andConditions, bson.M{"$or": cityOr})
		}
	}

	// Job Types
	if len(filter.JobTypes) > 0 {
		jobTypeOr := []bson.M{}
		for _, jt := range filter.JobTypes {
			jobTypeOr = append(jobTypeOr, bson.M{"job_type": bson.M{"$regex": jt, "$options": "i"}})
		}
		if len(jobTypeOr) > 0 {
			andConditions = append(andConditions, bson.M{"$or": jobTypeOr})
		}
	}

	// Genders
	if len(filter.Genders) > 0 {
		gendersOr := []bson.M{}
		for _, g := range filter.Genders {
			gendersOr = append(gendersOr, bson.M{"gender": bson.M{"$regex": g, "$options": "i"}})
		}
		if len(gendersOr) > 0 {
			andConditions = append(andConditions, bson.M{"$or": gendersOr})
		}
	}

	// Education
	if len(filter.Education) > 0 {
		eduOr := []bson.M{}
		for _, e := range filter.Education {
			eduOr = append(eduOr, bson.M{"education": bson.M{"$regex": e, "$options": "i"}})
		}
		if len(eduOr) > 0 {
			andConditions = append(andConditions, bson.M{"$or": eduOr})
		}
	}

	// Salary
	if filter.SalaryMin != nil {
		andConditions = append(andConditions, bson.M{"salary_max": bson.M{"$gte": *filter.SalaryMin}})
	}
	if filter.SalaryMax != nil {
		andConditions = append(andConditions, bson.M{"salary_min": bson.M{"$lte": *filter.SalaryMax}})
	}

	// Experience
	if filter.ExperienceMin != nil {
		andConditions = append(andConditions, bson.M{"experience_max": bson.M{"$gte": *filter.ExperienceMin}})
	}
	if filter.ExperienceMax != nil {
		andConditions = append(andConditions, bson.M{"experience_min": bson.M{"$lte": *filter.ExperienceMax}})
	}

	if len(andConditions) > 0 {
		bsonFilter["$and"] = andConditions
	}

	// Always sort by created_at desc
	opts := options.Find().SetSort(bson.M{"created_at": -1})

	total, err := r.jobColl.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	if filter.Limit > 0 {
		opts.SetLimit(int64(filter.Limit))
		if filter.Page > 1 {
			opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
		}
	}

	cursor, err := r.jobColl.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var jobs []Job = make([]Job, 0)
	if err = cursor.All(ctx, &jobs); err != nil {
		return nil, 0, err
	}
	return jobs, total, nil
}

func (r *JobRepositoryImpl) FindByRecruiter(ctx context.Context, recruiterID string) ([]Job, error) {
	oid, err := primitive.ObjectIDFromHex(recruiterID)
	if err != nil {
		return nil, err
	}

	filter := bson.M{"recruiter_id": oid}
	opts := options.Find().SetSort(bson.M{"created_at": -1})

	cursor, err := r.jobColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var jobs []Job = make([]Job, 0)
	if err = cursor.All(ctx, &jobs); err != nil {
		return nil, err
	}
	return jobs, nil
}

func (r *JobRepositoryImpl) Update(ctx context.Context, id string, job *Job) (*Job, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	job.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"title":          job.Title,
			"description":    job.Description,
			"company":        job.Company,
			"location":       job.Location,
			"city_id":        job.CityID,
			"city_name":      job.CityName,
			"salary_min":     job.SalaryMin,
			"salary_max":     job.SalaryMax,
			"salary_range":   job.SalaryRange, // Keep if updated
			"job_type":       job.JobType,
			"gender":         job.Gender,
			"education":      job.Education,
			"requirements":   job.Requirements,
			"we_offer":       job.WeOffer,
			"experience_min": job.ExperienceMin,
			"experience_max": job.ExperienceMax,
			"experience":     job.Experience,
			"status":         job.Status,
			"updated_at":     job.UpdatedAt,
		},
	}

	_, err = r.jobColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		return nil, err
	}

	// fetch updated job
	return r.FindByID(ctx, id)
}

func (r *JobRepositoryImpl) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.jobColl.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}
