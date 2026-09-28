package instant_work

import (
	"context"
	"errors"
	"log"
	"regexp"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type InstantWorkRepository interface {
	// Indexes
	EnsureIndexes(ctx context.Context) error

	// Worker operations
	UpsertWorker(ctx context.Context, worker *InstantWorker) error
	GetWorkerByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantWorker, error)
	UpdateWorkerPing(ctx context.Context, userID primitive.ObjectID, location GeoJSONPoint) error
	SetWorkerAvailability(ctx context.Context, userID primitive.ObjectID, isFreeNow bool, skill string, hourlyRate float64, location GeoJSONPoint) (*InstantWorker, error)
	FindNearbyWorkers(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, limit int) ([]NearbyCandidateResult, error)

	// Pass & Quota operations
	CreatePass(ctx context.Context, pass *InstantPass) error
	GetActivePassByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error)
	GetPassByOrderID(ctx context.Context, orderID string) (*InstantPass, error)
	ActivatePass(ctx context.Context, orderID string, paymentID string) (*InstantPass, error)
	DecrementQuota(ctx context.Context, userID primitive.ObjectID) (int, error)

	// Spot Job operations
	CreateJob(ctx context.Context, job *InstantJob) error
	GetJobByID(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error)
	FindNearbyJobsForWorker(ctx context.Context, lng, lat float64, radiusMeters float64, skill string) ([]InstantJob, error)
	GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error)
	GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error)
	ClaimJobAtomic(ctx context.Context, jobID primitive.ObjectID, candidateID primitive.ObjectID, candidateName string, candidateMobile string) (*InstantJob, error)
	UpdateJobStatus(ctx context.Context, jobID primitive.ObjectID, status JobStatus) (*InstantJob, error)
	CompleteJob(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error)
	CloseJob(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error)
}

type InstantWorkRepositoryImpl struct {
	db          *database.MongodbDB
	workersColl *mongo.Collection
	passesColl  *mongo.Collection
	jobsColl    *mongo.Collection
}

func NewInstantWorkRepository(db *database.MongodbDB) InstantWorkRepository {
	repo := &InstantWorkRepositoryImpl{
		db:          db,
		workersColl: db.DB.Collection("instant_workers"),
		passesColl:  db.DB.Collection("instant_passes"),
		jobsColl:    db.DB.Collection("instant_jobs"),
	}

	// Initialize MongoDB 2dsphere and compound indexes asynchronously
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := repo.EnsureIndexes(ctx); err != nil {
			log.Printf("[InstantWork] Error creating spatial indexes: %v", err)
		} else {
			log.Println("[InstantWork] MongoDB 2dsphere and compound spatial indexes successfully initialized.")
		}
	}()

	return repo
}

// EnsureIndexes creates MongoDB 2dsphere spatial indexes and compound query indexes
func (r *InstantWorkRepositoryImpl) EnsureIndexes(ctx context.Context) error {
	// 1. instant_workers collection indexes
	workerIndexes := []mongo.IndexModel{
		{
			// 2dsphere index for candidate GPS radar search
			Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_instant_workers_2dsphere"),
		},
		{
			// Unique index by user_id
			Keys:    bson.D{{Key: "user_id", Value: 1}},
			Options: options.Index().SetName("idx_instant_workers_user_id").SetUnique(true),
		},
		{
			// Compound index for active availability and ping recency
			Keys: bson.D{
				{Key: "is_free_now", Value: 1},
				{Key: "last_ping_at", Value: -1},
			},
			Options: options.Index().SetName("idx_instant_workers_availability_ping"),
		},
		{
			// Compound index for skill filtering
			Keys: bson.D{
				{Key: "active_skill", Value: 1},
				{Key: "is_free_now", Value: 1},
			},
			Options: options.Index().SetName("idx_instant_workers_skill_status"),
		},
	}
	if _, err := r.workersColl.Indexes().CreateMany(ctx, workerIndexes); err != nil {
		return err
	}

	// 2. instant_jobs collection indexes
	jobIndexes := []mongo.IndexModel{
		{
			// 2dsphere index for finding spot jobs near candidate
			Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_instant_jobs_2dsphere"),
		},
		{
			// Status and expiration index for broadcast filtering
			Keys: bson.D{
				{Key: "status", Value: 1},
				{Key: "expires_at", Value: -1},
			},
			Options: options.Index().SetName("idx_instant_jobs_status_expires"),
		},
		{
			// Candidate active job lookup
			Keys: bson.D{
				{Key: "candidate_id", Value: 1},
				{Key: "status", Value: 1},
			},
			Options: options.Index().SetName("idx_instant_jobs_candidate_status"),
		},
		{
			// Recruiter active job lookup
			Keys: bson.D{
				{Key: "recruiter_id", Value: 1},
				{Key: "status", Value: 1},
			},
			Options: options.Index().SetName("idx_instant_jobs_recruiter_status"),
		},
	}
	if _, err := r.jobsColl.Indexes().CreateMany(ctx, jobIndexes); err != nil {
		return err
	}

	// 3. instant_passes collection indexes
	passIndexes := []mongo.IndexModel{
		{
			// Active pass lookup
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "has_active_pass", Value: 1},
				{Key: "expires_at", Value: -1},
			},
			Options: options.Index().SetName("idx_instant_passes_active"),
		},
		{
			// Razorpay order index
			Keys:    bson.D{{Key: "razorpay_order_id", Value: 1}},
			Options: options.Index().SetName("idx_instant_passes_order").SetSparse(true),
		},
	}
	if _, err := r.passesColl.Indexes().CreateMany(ctx, passIndexes); err != nil {
		return err
	}

	return nil
}

// UpsertWorker updates or inserts an InstantWorker record
func (r *InstantWorkRepositoryImpl) UpsertWorker(ctx context.Context, worker *InstantWorker) error {
	worker.UpdatedAt = time.Now()
	filter := bson.M{"user_id": worker.UserID}
	update := bson.M{
		"$set": worker,
	}
	opts := options.Update().SetUpsert(true)
	_, err := r.workersColl.UpdateOne(ctx, filter, update, opts)
	return err
}

// GetWorkerByUserID fetches the worker availability record for a given user
func (r *InstantWorkRepositoryImpl) GetWorkerByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantWorker, error) {
	var worker InstantWorker
	err := r.workersColl.FindOne(ctx, bson.M{"user_id": userID}).Decode(&worker)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &worker, nil
}

// UpdateWorkerPing updates candidate's GPS location and sets last ping timestamp
func (r *InstantWorkRepositoryImpl) UpdateWorkerPing(ctx context.Context, userID primitive.ObjectID, location GeoJSONPoint) error {
	now := time.Now()
	filter := bson.M{"user_id": userID}
	update := bson.M{
		"$set": bson.M{
			"location":     location,
			"last_ping_at": now,
			"updated_at":   now,
		},
	}
	_, err := r.workersColl.UpdateOne(ctx, filter, update)
	return err
}

// SetWorkerAvailability toggles Free Now state and updates live skill & hourly rate
func (r *InstantWorkRepositoryImpl) SetWorkerAvailability(ctx context.Context, userID primitive.ObjectID, isFreeNow bool, skill string, hourlyRate float64, location GeoJSONPoint) (*InstantWorker, error) {
	now := time.Now()
	filter := bson.M{"user_id": userID}
	update := bson.M{
		"$set": bson.M{
			"is_free_now":  isFreeNow,
			"active_skill": skill,
			"hourly_rate":  hourlyRate,
			"location":     location,
			"last_ping_at": now,
			"updated_at":   now,
		},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After).SetUpsert(true)
	var updated InstantWorker
	err := r.workersColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updated)
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// FindNearbyWorkers performs a 2dsphere $geoNear aggregation within radiusMeters
func (r *InstantWorkRepositoryImpl) FindNearbyWorkers(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, limit int) ([]NearbyCandidateResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 25
	}
	if radiusMeters <= 0 {
		radiusMeters = 5000.0 // Default 5 km
	}

	geoQuery := bson.M{
		"is_free_now":     true,
		"quota_remaining": bson.M{"$gt": 0},
		// ping within last 30 minutes
		"last_ping_at": bson.M{"$gte": time.Now().Add(-30 * time.Minute)},
	}

	if skill != "" && skill != "all" {
		geoQuery["active_skill"] = bson.M{
			"$regex": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(skill) + "$", Options: "i"},
		}
	}

	pipeline := mongo.Pipeline{
		bson.D{
			{Key: "$geoNear", Value: bson.M{
				"near": bson.M{
					"type":        "Point",
					"coordinates": []float64{lng, lat},
				},
				"distanceField": "distance_meters",
				"maxDistance":   radiusMeters,
				"spherical":     true,
				"query":         geoQuery,
			}},
		},
		bson.D{{Key: "$limit", Value: limit}},
	}

	cursor, err := r.workersColl.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []NearbyCandidateResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	for i := range results {
		results[i].DistanceKm = results[i].DistanceMeters / 1000.0
	}

	return results, nil
}

// CreatePass saves a newly initiated InstantPass
func (r *InstantWorkRepositoryImpl) CreatePass(ctx context.Context, pass *InstantPass) error {
	now := time.Now()
	pass.CreatedAt = now
	pass.UpdatedAt = now
	res, err := r.passesColl.InsertOne(ctx, pass)
	if err != nil {
		return err
	}
	pass.ID = res.InsertedID.(primitive.ObjectID)
	return nil
}

// GetActivePassByUserID retrieves the candidate's active ₹99 pass with remaining quota
func (r *InstantWorkRepositoryImpl) GetActivePassByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error) {
	filter := bson.M{
		"user_id":         userID,
		"has_active_pass": true,
		"quota_remaining": bson.M{"$gt": 0},
		"expires_at":      bson.M{"$gte": time.Now()},
	}
	var pass InstantPass
	err := r.passesColl.FindOne(ctx, filter).Decode(&pass)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &pass, nil
}

// GetPassByOrderID finds a pass by its Razorpay Order ID
func (r *InstantWorkRepositoryImpl) GetPassByOrderID(ctx context.Context, orderID string) (*InstantPass, error) {
	var pass InstantPass
	err := r.passesColl.FindOne(ctx, bson.M{"razorpay_order_id": orderID}).Decode(&pass)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &pass, nil
}

// ActivatePass activates the pass with 10 quota and 30-day validity upon verified payment
func (r *InstantWorkRepositoryImpl) ActivatePass(ctx context.Context, orderID string, paymentID string) (*InstantPass, error) {
	now := time.Now()
	expiresAt := now.Add(30 * 24 * time.Hour)

	filter := bson.M{"razorpay_order_id": orderID}
	update := bson.M{
		"$set": bson.M{
			"has_active_pass":     true,
			"quota_total":         10,
			"quota_remaining":     10,
			"razorpay_payment_id": paymentID,
			"activated_at":        now,
			"expires_at":          expiresAt,
			"updated_at":          now,
		},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var pass InstantPass
	err := r.passesColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&pass)
	if err != nil {
		return nil, err
	}

	// Synchronize worker quota
	workerFilter := bson.M{"user_id": pass.UserID}
	workerUpdate := bson.M{
		"$set": bson.M{
			"quota_remaining": 10,
			"updated_at":      now,
		},
	}
	_, _ = r.workersColl.UpdateOne(ctx, workerFilter, workerUpdate)

	return &pass, nil
}

// DecrementQuota atomically reduces the candidate's remaining pass quota by 1
func (r *InstantWorkRepositoryImpl) DecrementQuota(ctx context.Context, userID primitive.ObjectID) (int, error) {
	now := time.Now()
	filter := bson.M{
		"user_id":         userID,
		"has_active_pass": true,
		"quota_remaining": bson.M{"$gt": 0},
		"expires_at":      bson.M{"$gte": now},
	}
	update := bson.M{
		"$inc": bson.M{"quota_remaining": -1},
		"$set": bson.M{"updated_at": now},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var pass InstantPass
	err := r.passesColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&pass)
	if err != nil {
		return 0, err
	}

	// If quota reached 0, expire active pass status
	if pass.QuotaRemaining <= 0 {
		_, _ = r.passesColl.UpdateOne(ctx, bson.M{"_id": pass.ID}, bson.M{"$set": bson.M{"has_active_pass": false}})
	}

	// Sync quota in worker collection
	_, _ = r.workersColl.UpdateOne(ctx, bson.M{"user_id": userID}, bson.M{
		"$set": bson.M{
			"quota_remaining": pass.QuotaRemaining,
			"updated_at":      now,
		},
	})

	return pass.QuotaRemaining, nil
}

// CreateJob creates a spot hiring job
func (r *InstantWorkRepositoryImpl) CreateJob(ctx context.Context, job *InstantJob) error {
	now := time.Now()
	job.CreatedAt = now
	job.UpdatedAt = now
	res, err := r.jobsColl.InsertOne(ctx, job)
	if err != nil {
		return err
	}
	job.ID = res.InsertedID.(primitive.ObjectID)
	return nil
}

// GetJobByID retrieves a spot hiring job by ID
func (r *InstantWorkRepositoryImpl) GetJobByID(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error) {
	var job InstantJob
	err := r.jobsColl.FindOne(ctx, bson.M{"_id": jobID}).Decode(&job)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &job, nil
}

// FindNearbyJobsForWorker finds open DISPATCHING spot jobs near candidate within radiusMeters
func (r *InstantWorkRepositoryImpl) FindNearbyJobsForWorker(ctx context.Context, lng, lat float64, radiusMeters float64, skill string) ([]InstantJob, error) {
	if radiusMeters <= 0 {
		radiusMeters = 10000.0 // 10 km default for jobs feed
	}

	geoQuery := bson.M{
		"status":     JobStatusDispatching,
		"expires_at": bson.M{"$gte": time.Now()},
	}
	if skill != "" && skill != "all" {
		geoQuery["skill"] = bson.M{
			"$regex": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(skill) + "$", Options: "i"},
		}
	}

	pipeline := mongo.Pipeline{
		bson.D{
			{Key: "$geoNear", Value: bson.M{
				"near": bson.M{
					"type":        "Point",
					"coordinates": []float64{lng, lat},
				},
				"distanceField": "distance_meters",
				"maxDistance":   radiusMeters,
				"spherical":     true,
				"query":         geoQuery,
			}},
		},
		bson.D{{Key: "$sort", Value: bson.M{"created_at": -1}}},
		bson.D{{Key: "$limit", Value: 20}},
	}

	cursor, err := r.jobsColl.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var jobs []InstantJob
	if err := cursor.All(ctx, &jobs); err != nil {
		return nil, err
	}

	for i := range jobs {
		jobs[i].DistanceKm = jobs[i].DistanceMeters / 1000.0
	}

	return jobs, nil
}

// GetActiveJobForCandidate finds ongoing job for a candidate
func (r *InstantWorkRepositoryImpl) GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error) {
	filter := bson.M{
		"candidate_id": candidateID,
		"status": bson.M{
			"$in": []JobStatus{JobStatusAccepted, JobStatusInProgress, JobStatusCompleted},
		},
	}
	var job InstantJob
	err := r.jobsColl.FindOne(ctx, filter).Decode(&job)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &job, nil
}

// GetActiveJobForRecruiter finds ongoing spot job posted by a recruiter
func (r *InstantWorkRepositoryImpl) GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error) {
	filter := bson.M{
		"recruiter_id": recruiterID,
		"status": bson.M{
			"$in": []JobStatus{JobStatusDispatching, JobStatusAccepted, JobStatusInProgress, JobStatusCompleted},
		},
	}
	var job InstantJob
	err := r.jobsColl.FindOne(ctx, filter, options.FindOne().SetSort(bson.M{"created_at": -1})).Decode(&job)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &job, nil
}

// ClaimJobAtomic executes the Compare-And-Swap (CAS) atomic lock to claim a spot gig
func (r *InstantWorkRepositoryImpl) ClaimJobAtomic(ctx context.Context, jobID primitive.ObjectID, candidateID primitive.ObjectID, candidateName string, candidateMobile string) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{
		"_id":        jobID,
		"status":     JobStatusDispatching, // Atomic CAS condition: job must still be open
		"expires_at": bson.M{"$gte": now},  // Job must not be expired
	}
	update := bson.M{
		"$set": bson.M{
			"status":           JobStatusAccepted,
			"candidate_id":     candidateID,
			"candidate_name":   candidateName,
			"candidate_mobile": candidateMobile,
			"matched_at":       now,
			"updated_at":       now,
		},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var claimedJob InstantJob
	err := r.jobsColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&claimedJob)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("this gig has already been claimed by another candidate or has expired")
		}
		return nil, err
	}
	return &claimedJob, nil
}

// UpdateJobStatus updates the status of a job
func (r *InstantWorkRepositoryImpl) UpdateJobStatus(ctx context.Context, jobID primitive.ObjectID, status JobStatus) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{"_id": jobID}
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": now,
		},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var job InstantJob
	err := r.jobsColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&job)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// CompleteJob marks the job as completed by candidate, awaiting recruiter approval
func (r *InstantWorkRepositoryImpl) CompleteJob(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{"_id": jobID}
	update := bson.M{
		"$set": bson.M{
			"status":       JobStatusCompleted,
			"completed_at": now,
			"updated_at":   now,
		},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var job InstantJob
	err := r.jobsColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&job)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// CloseJob marks job as closed upon recruiter payment release
func (r *InstantWorkRepositoryImpl) CloseJob(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{"_id": jobID}
	update := bson.M{
		"$set": bson.M{
			"status":     JobStatusClosed,
			"updated_at": now,
		},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var job InstantJob
	err := r.jobsColl.FindOneAndUpdate(ctx, filter, update, opts).Decode(&job)
	if err != nil {
		return nil, err
	}
	return &job, nil
}
