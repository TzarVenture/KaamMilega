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

// workerStaleAfter is how long a worker stays on the radar without a location ping
const workerStaleAfter = 5 * time.Minute

// Statuses in which a job still needs its worker
var candidateActiveStatuses = []JobStatus{JobStatusAccepted, JobStatusInProgress, JobStatusCompleted}

// Statuses in which a hirer's job is still open
var recruiterActiveStatuses = []JobStatus{JobStatusDispatching, JobStatusAccepted, JobStatusInProgress, JobStatusCompleted}

type InstantWorkRepository interface {
	EnsureIndexes(ctx context.Context) error

	// Workers
	SetWorkerAvailability(ctx context.Context, worker *InstantWorker, updateLocation bool) (*InstantWorker, error)
	GetWorkerByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantWorker, error)
	UpdateWorkerPing(ctx context.Context, userID primitive.ObjectID, location GeoJSONPoint) error
	SetWorkerFreeNow(ctx context.Context, userID primitive.ObjectID, free bool) error
	IncrementWorkerGigs(ctx context.Context, userID primitive.ObjectID) error
	FindNearbyWorkers(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, limit int) ([]NearbyCandidateResult, error)

	// Passes
	CreatePass(ctx context.Context, pass *InstantPass) error
	GetActivePassByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error)
	GetPassByID(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error)
	GetPassByOrderID(ctx context.Context, orderID string) (*InstantPass, error)
	RetireFinishedPasses(ctx context.Context, userID primitive.ObjectID) error
	RefundUnusedPass(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error)
	UseCredit(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error)
	SyncWorkerPass(ctx context.Context, userID primitive.ObjectID, quota int, expiresAt time.Time) error

	// Jobs
	CreateJob(ctx context.Context, job *InstantJob) error
	GetJobByID(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error)
	FindNearbyJobsForWorker(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, excludeRecruiter primitive.ObjectID) ([]InstantJob, error)
	GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error)
	GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error)
	ExpireStaleJobs(ctx context.Context, recruiterID primitive.ObjectID) error
	ClaimJobAtomic(ctx context.Context, jobID primitive.ObjectID, candidateID primitive.ObjectID, candidateName string, candidateMobile string) (*InstantJob, error)
	CompleteJob(ctx context.Context, jobID, candidateID primitive.ObjectID) (*InstantJob, error)
	CloseJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error)
	CancelJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error)
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

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := repo.EnsureIndexes(ctx); err != nil {
			log.Printf("[InstantWork] Error creating indexes: %v", err)
		}
	}()

	return repo
}

// EnsureIndexes creates the geo and lookup indexes, and the one-current-pass-per-user rule
func (r *InstantWorkRepositoryImpl) EnsureIndexes(ctx context.Context) error {
	workerIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "location", Value: "2dsphere"}}, Options: options.Index().SetName("idx_instant_workers_2dsphere")},
		{Keys: bson.D{{Key: "user_id", Value: 1}}, Options: options.Index().SetName("idx_instant_workers_user_id").SetUnique(true)},
		{Keys: bson.D{{Key: "is_free_now", Value: 1}, {Key: "last_ping_at", Value: -1}}, Options: options.Index().SetName("idx_instant_workers_availability_ping")},
		{Keys: bson.D{{Key: "active_skill", Value: 1}, {Key: "is_free_now", Value: 1}}, Options: options.Index().SetName("idx_instant_workers_skill_status")},
	}
	if _, err := r.workersColl.Indexes().CreateMany(ctx, workerIndexes); err != nil {
		return err
	}

	jobIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "location", Value: "2dsphere"}}, Options: options.Index().SetName("idx_instant_jobs_2dsphere")},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "expires_at", Value: -1}}, Options: options.Index().SetName("idx_instant_jobs_status_expires")},
		{Keys: bson.D{{Key: "candidate_id", Value: 1}, {Key: "status", Value: 1}}, Options: options.Index().SetName("idx_instant_jobs_candidate_status")},
		{Keys: bson.D{{Key: "recruiter_id", Value: 1}, {Key: "status", Value: 1}}, Options: options.Index().SetName("idx_instant_jobs_recruiter_status")},
	}
	if _, err := r.jobsColl.Indexes().CreateMany(ctx, jobIndexes); err != nil {
		return err
	}

	passIndexes := []mongo.IndexModel{
		{
			// At most one current pass per user, so two purchases at the same moment can't both win
			Keys: bson.D{{Key: "user_id", Value: 1}},
			Options: options.Index().SetName("idx_instant_passes_one_current").SetUnique(true).
				SetPartialFilterExpression(bson.M{"has_active_pass": true}),
		},
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}, {Key: "has_active_pass", Value: 1}, {Key: "expires_at", Value: -1}},
			Options: options.Index().SetName("idx_instant_passes_active"),
		},
		{
			Keys:    bson.D{{Key: "razorpay_order_id", Value: 1}},
			Options: options.Index().SetName("idx_instant_passes_order").SetSparse(true),
		},
	}
	_, err := r.passesColl.Indexes().CreateMany(ctx, passIndexes)
	return err
}

// --- Workers ---

// SetWorkerAvailability saves the worker's Free Now state, skill and rate. A new worker starts
// with no rating and no gigs. The location is only changed when updateLocation is set.
func (r *InstantWorkRepositoryImpl) SetWorkerAvailability(ctx context.Context, w *InstantWorker, updateLocation bool) (*InstantWorker, error) {
	now := time.Now()
	set := bson.M{
		"name":            w.Name,
		"avatar":          w.Avatar,
		"mobile":          w.Mobile,
		"is_free_now":     w.IsFreeNow,
		"quota_remaining": w.QuotaRemaining,
		"pass_expires_at": w.PassExpiresAt,
		"updated_at":      now,
	}
	if w.ActiveSkill != "" {
		set["active_skill"] = w.ActiveSkill
		set["hourly_rate"] = w.HourlyRate
	}
	if updateLocation {
		set["location"] = w.Location
		set["last_ping_at"] = now
	}
	update := bson.M{
		"$set":         set,
		"$setOnInsert": bson.M{"rating": 0.0, "total_gigs": 0},
	}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	var updated InstantWorker
	if err := r.workersColl.FindOneAndUpdate(ctx, bson.M{"user_id": w.UserID}, update, opts).Decode(&updated); err != nil {
		return nil, err
	}
	return &updated, nil
}

func (r *InstantWorkRepositoryImpl) GetWorkerByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantWorker, error) {
	var worker InstantWorker
	err := r.workersColl.FindOne(ctx, bson.M{"user_id": userID}).Decode(&worker)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &worker, nil
}

func (r *InstantWorkRepositoryImpl) UpdateWorkerPing(ctx context.Context, userID primitive.ObjectID, location GeoJSONPoint) error {
	now := time.Now()
	_, err := r.workersColl.UpdateOne(ctx, bson.M{"user_id": userID}, bson.M{
		"$set": bson.M{"location": location, "last_ping_at": now, "updated_at": now},
	})
	return err
}

func (r *InstantWorkRepositoryImpl) SetWorkerFreeNow(ctx context.Context, userID primitive.ObjectID, free bool) error {
	_, err := r.workersColl.UpdateOne(ctx, bson.M{"user_id": userID}, bson.M{
		"$set": bson.M{"is_free_now": free, "updated_at": time.Now()},
	})
	return err
}

func (r *InstantWorkRepositoryImpl) IncrementWorkerGigs(ctx context.Context, userID primitive.ObjectID) error {
	// Upsert: a worker can take a gig from the feed without ever going Free Now
	_, err := r.workersColl.UpdateOne(ctx, bson.M{"user_id": userID}, bson.M{
		"$inc":         bson.M{"total_gigs": 1},
		"$set":         bson.M{"updated_at": time.Now()},
		"$setOnInsert": bson.M{"rating": 0.0, "is_free_now": false},
	}, options.Update().SetUpsert(true))
	return err
}

// FindNearbyWorkers lists free workers with credits and a valid pass who pinged recently,
// best rated first, then nearest
func (r *InstantWorkRepositoryImpl) FindNearbyWorkers(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, limit int) ([]NearbyCandidateResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 25
	}
	now := time.Now()
	geoQuery := bson.M{
		"is_free_now":     true,
		"quota_remaining": bson.M{"$gt": 0},
		"pass_expires_at": bson.M{"$gt": now},
		"last_ping_at":    bson.M{"$gte": now.Add(-workerStaleAfter)},
	}
	if skill != "" && skill != "all" {
		geoQuery["active_skill"] = bson.M{
			"$regex": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(skill) + "$", Options: "i"},
		}
	}

	pipeline := mongo.Pipeline{
		{{Key: "$geoNear", Value: bson.M{
			"near":          bson.M{"type": "Point", "coordinates": []float64{lng, lat}},
			"distanceField": "distance_meters",
			"maxDistance":   radiusMeters,
			"spherical":     true,
			"query":         geoQuery,
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "rating", Value: -1}, {Key: "distance_meters", Value: 1}}}},
		{{Key: "$limit", Value: limit}},
	}

	cursor, err := r.workersColl.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := []NearbyCandidateResult{}
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	for i := range results {
		results[i].DistanceKm = results[i].DistanceMeters / 1000.0
	}
	return results, nil
}

// --- Passes ---

// CreatePass inserts a new current pass. ErrPassAlreadyActive means the user already has one.
func (r *InstantWorkRepositoryImpl) CreatePass(ctx context.Context, pass *InstantPass) error {
	now := time.Now()
	pass.CreatedAt = now
	pass.UpdatedAt = now
	res, err := r.passesColl.InsertOne(ctx, pass)
	if mongo.IsDuplicateKeyError(err) {
		return ErrPassAlreadyActive
	}
	if err != nil {
		return err
	}
	pass.ID = res.InsertedID.(primitive.ObjectID)
	return nil
}

// GetActivePassByUserID returns the user's current pass if it hasn't expired, even with no credits left
func (r *InstantWorkRepositoryImpl) GetActivePassByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error) {
	return r.findPass(ctx, bson.M{
		"user_id":         userID,
		"has_active_pass": true,
		"expires_at":      bson.M{"$gt": time.Now()},
	})
}

func (r *InstantWorkRepositoryImpl) GetPassByID(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error) {
	return r.findPass(ctx, bson.M{"_id": passID})
}

func (r *InstantWorkRepositoryImpl) GetPassByOrderID(ctx context.Context, orderID string) (*InstantPass, error) {
	return r.findPass(ctx, bson.M{"razorpay_order_id": orderID})
}

func (r *InstantWorkRepositoryImpl) findPass(ctx context.Context, filter bson.M) (*InstantPass, error) {
	var pass InstantPass
	err := r.passesColl.FindOne(ctx, filter).Decode(&pass)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &pass, nil
}

// RetireFinishedPasses ends the user's current pass if it has expired or has no credits left,
// so a new one can replace it
func (r *InstantWorkRepositoryImpl) RetireFinishedPasses(ctx context.Context, userID primitive.ObjectID) error {
	now := time.Now()
	_, err := r.passesColl.UpdateMany(ctx, bson.M{
		"user_id":         userID,
		"has_active_pass": true,
		"$or": bson.A{
			bson.M{"expires_at": bson.M{"$lte": now}},
			bson.M{"quota_remaining": bson.M{"$lte": 0}},
		},
	}, bson.M{"$set": bson.M{"has_active_pass": false, "ended_reason": "replaced", "updated_at": now}})
	return err
}

// RefundUnusedPass ends a current pass that has all its credits. ErrPassUsed if any were spent.
func (r *InstantWorkRepositoryImpl) RefundUnusedPass(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error) {
	now := time.Now()
	filter := bson.M{
		"_id":             passID,
		"has_active_pass": true,
		"$expr":           bson.M{"$eq": bson.A{"$quota_remaining", "$quota_total"}},
	}
	update := bson.M{"$set": bson.M{"has_active_pass": false, "ended_reason": "refunded", "quota_remaining": 0, "updated_at": now}}
	var pass InstantPass
	err := r.passesColl.FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&pass)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrPassUsed
	}
	if err != nil {
		return nil, err
	}
	return &pass, nil
}

// UseCredit takes one credit from the current, unexpired pass. ErrPassQuotaExhausted if there's none.
// Run it in the same transaction as the claim, so a failed claim gives the credit back.
func (r *InstantWorkRepositoryImpl) UseCredit(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error) {
	now := time.Now()
	filter := bson.M{
		"user_id":         userID,
		"has_active_pass": true,
		"quota_remaining": bson.M{"$gt": 0},
		"expires_at":      bson.M{"$gt": now},
	}
	update := bson.M{"$inc": bson.M{"quota_remaining": -1}, "$set": bson.M{"updated_at": now}}
	var pass InstantPass
	err := r.passesColl.FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&pass)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrPassQuotaExhausted
	}
	if err != nil {
		return nil, err
	}
	return &pass, nil
}

// SyncWorkerPass copies the pass credits and expiry onto the worker's radar record
func (r *InstantWorkRepositoryImpl) SyncWorkerPass(ctx context.Context, userID primitive.ObjectID, quota int, expiresAt time.Time) error {
	_, err := r.workersColl.UpdateOne(ctx, bson.M{"user_id": userID}, bson.M{
		"$set": bson.M{"quota_remaining": quota, "pass_expires_at": expiresAt, "updated_at": time.Now()},
	})
	return err
}

// --- Jobs ---

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

func (r *InstantWorkRepositoryImpl) GetJobByID(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error) {
	return r.findJob(ctx, bson.M{"_id": jobID}, nil)
}

func (r *InstantWorkRepositoryImpl) findJob(ctx context.Context, filter bson.M, opts *options.FindOneOptions) (*InstantJob, error) {
	var job InstantJob
	err := r.jobsColl.FindOne(ctx, filter, opts).Decode(&job)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// FindNearbyJobsForWorker lists open jobs near the worker, leaving out the worker's own
func (r *InstantWorkRepositoryImpl) FindNearbyJobsForWorker(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, excludeRecruiter primitive.ObjectID) ([]InstantJob, error) {
	geoQuery := bson.M{
		"status":       JobStatusDispatching,
		"expires_at":   bson.M{"$gt": time.Now()},
		"recruiter_id": bson.M{"$ne": excludeRecruiter},
	}
	if skill != "" && skill != "all" {
		geoQuery["skill"] = bson.M{
			"$regex": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(skill) + "$", Options: "i"},
		}
	}

	pipeline := mongo.Pipeline{
		{{Key: "$geoNear", Value: bson.M{
			"near":          bson.M{"type": "Point", "coordinates": []float64{lng, lat}},
			"distanceField": "distance_meters",
			"maxDistance":   radiusMeters,
			"spherical":     true,
			"query":         geoQuery,
		}}},
		{{Key: "$sort", Value: bson.M{"created_at": -1}}},
		{{Key: "$limit", Value: 20}},
		// The hirer's number is only shared once a worker has accepted
		{{Key: "$project", Value: bson.M{"recruiter_mobile": 0}}},
	}

	cursor, err := r.jobsColl.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	jobs := []InstantJob{}
	if err := cursor.All(ctx, &jobs); err != nil {
		return nil, err
	}
	for i := range jobs {
		jobs[i].DistanceKm = jobs[i].DistanceMeters / 1000.0
	}
	return jobs, nil
}

func (r *InstantWorkRepositoryImpl) GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error) {
	return r.findJob(ctx, bson.M{
		"candidate_id": candidateID,
		"status":       bson.M{"$in": candidateActiveStatuses},
	}, nil)
}

func (r *InstantWorkRepositoryImpl) GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error) {
	return r.findJob(ctx, bson.M{
		"recruiter_id": recruiterID,
		"status":       bson.M{"$in": recruiterActiveStatuses},
	}, options.FindOne().SetSort(bson.M{"created_at": -1}))
}

// ExpireStaleJobs marks the hirer's jobs that nobody accepted in time as expired
func (r *InstantWorkRepositoryImpl) ExpireStaleJobs(ctx context.Context, recruiterID primitive.ObjectID) error {
	now := time.Now()
	_, err := r.jobsColl.UpdateMany(ctx, bson.M{
		"recruiter_id": recruiterID,
		"status":       JobStatusDispatching,
		"expires_at":   bson.M{"$lte": now},
	}, bson.M{"$set": bson.M{"status": JobStatusExpired, "updated_at": now}})
	return err
}

// ClaimJobAtomic gives an open job to the worker. Only one claim can win.
func (r *InstantWorkRepositoryImpl) ClaimJobAtomic(ctx context.Context, jobID primitive.ObjectID, candidateID primitive.ObjectID, candidateName string, candidateMobile string) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{
		"_id":          jobID,
		"status":       JobStatusDispatching,
		"expires_at":   bson.M{"$gt": now},
		"recruiter_id": bson.M{"$ne": candidateID},
	}
	update := bson.M{"$set": bson.M{
		"status":           JobStatusAccepted,
		"candidate_id":     candidateID,
		"candidate_name":   candidateName,
		"candidate_mobile": candidateMobile,
		"matched_at":       now,
		"updated_at":       now,
	}}
	return r.moveJob(ctx, filter, update, ErrGigUnavailable)
}

// CompleteJob is the worker marking their accepted job as done
func (r *InstantWorkRepositoryImpl) CompleteJob(ctx context.Context, jobID, candidateID primitive.ObjectID) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{
		"_id":          jobID,
		"candidate_id": candidateID,
		"status":       bson.M{"$in": []JobStatus{JobStatusAccepted, JobStatusInProgress}},
	}
	update := bson.M{"$set": bson.M{"status": JobStatusCompleted, "completed_at": now, "updated_at": now}}
	return r.moveJob(ctx, filter, update, ErrJobWrongState)
}

// CloseJob is the hirer approving a completed job
func (r *InstantWorkRepositoryImpl) CloseJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{"_id": jobID, "recruiter_id": recruiterID, "status": JobStatusCompleted}
	update := bson.M{"$set": bson.M{"status": JobStatusClosed, "closed_at": now, "updated_at": now}}
	return r.moveJob(ctx, filter, update, ErrJobNotCompleted)
}

// CancelJob is the hirer withdrawing a job before any worker accepts it
func (r *InstantWorkRepositoryImpl) CancelJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error) {
	now := time.Now()
	filter := bson.M{"_id": jobID, "recruiter_id": recruiterID, "status": JobStatusDispatching}
	update := bson.M{"$set": bson.M{"status": JobStatusCancelled, "cancelled_at": now, "updated_at": now}}
	return r.moveJob(ctx, filter, update, ErrJobWrongState)
}

// moveJob applies a status change guarded by filter, returning notMatched when the job isn't in that state
func (r *InstantWorkRepositoryImpl) moveJob(ctx context.Context, filter, update bson.M, notMatched error) (*InstantJob, error) {
	var job InstantJob
	err := r.jobsColl.FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&job)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, notMatched
	}
	if err != nil {
		return nil, err
	}
	return &job, nil
}
