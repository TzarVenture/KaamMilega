package account

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/database"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository interface {
	FindUser(ctx context.Context, id primitive.ObjectID) (*user.User, error)

	SaveCode(ctx context.Context, code *ActionCode) error
	LatestCode(ctx context.Context, userID primitive.ObjectID, now time.Time) (*ActionCode, error)
	CountCodesSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error)
	IncrementCodeAttempts(ctx context.Context, id primitive.ObjectID) error
	MarkCodeUsed(ctx context.Context, id primitive.ObjectID) error
	DeleteCodes(ctx context.Context, userID primitive.ObjectID) error

	// Transition atomically moves the account from one of `from` to a new state. It returns false
	// when the account was no longer in an allowed state (a concurrent change won).
	Transition(ctx context.Context, id primitive.ObjectID, from []string, set bson.M, unset []string, endSessions bool) (bool, error)
	SetJobsHidden(ctx context.Context, recruiterID primitive.ObjectID, hidden bool) error
	SaveFeedback(ctx context.Context, action, reason, feedback string, at time.Time) error

	DeletionChecks(ctx context.Context, userID primitive.ObjectID, now time.Time) (*deletionChecks, error)
	Export(ctx context.Context, userID primitive.ObjectID) (map[string]interface{}, error)

	DueDeletions(ctx context.Context, now time.Time, limit int64) ([]user.User, error)
	// EraseRelatedData removes or anonymises everything outside the user document (idempotent)
	EraseRelatedData(ctx context.Context, u *user.User, now time.Time) error
	// AnonymiseUser finalises deletion; it only applies while the account is still pending_deletion
	AnonymiseUser(ctx context.Context, id primitive.ObjectID, now time.Time) (bool, error)
	FilesByURL(ctx context.Context, urls []string) ([]fileRecord, error)
	DeleteFileRecords(ctx context.Context, ids []primitive.ObjectID) error
}

type fileRecord struct {
	ID   primitive.ObjectID `bson:"_id"`
	Path string             `bson:"path"`
	URL  string             `bson:"url"`
}

type mongoRepository struct {
	db    *mongo.Database
	users *mongo.Collection
	codes *mongo.Collection
}

func NewRepository(db *database.MongodbDB) Repository {
	codes := db.DB.Collection("account_action_codes")
	// Expired codes are removed by MongoDB itself
	_, _ = codes.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}},
	})
	users := db.DB.Collection("users")
	_, _ = users.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys: bson.D{{Key: "account_status", Value: 1}, {Key: "deletion_scheduled_for", Value: 1}},
	})
	return &mongoRepository{db: db.DB, users: users, codes: codes}
}

func (r *mongoRepository) FindUser(ctx context.Context, id primitive.ObjectID) (*user.User, error) {
	var u user.User
	err := r.users.FindOne(ctx, bson.M{"_id": id}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ─── Verification codes ─────────────────────────────────────────────────────────

func (r *mongoRepository) SaveCode(ctx context.Context, code *ActionCode) error {
	_, err := r.codes.InsertOne(ctx, code)
	return err
}

func (r *mongoRepository) LatestCode(ctx context.Context, userID primitive.ObjectID, now time.Time) (*ActionCode, error) {
	var c ActionCode
	err := r.codes.FindOne(ctx,
		bson.M{"user_id": userID, "used": false, "expires_at": bson.M{"$gt": now}},
		options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}}),
	).Decode(&c)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *mongoRepository) CountCodesSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error) {
	return r.codes.CountDocuments(ctx, bson.M{"user_id": userID, "created_at": bson.M{"$gte": since}})
}

func (r *mongoRepository) IncrementCodeAttempts(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.codes.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$inc": bson.M{"attempts": 1}})
	return err
}

func (r *mongoRepository) MarkCodeUsed(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.codes.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"used": true}})
	return err
}

func (r *mongoRepository) DeleteCodes(ctx context.Context, userID primitive.ObjectID) error {
	_, err := r.codes.DeleteMany(ctx, bson.M{"user_id": userID})
	return err
}

// ─── State transitions ──────────────────────────────────────────────────────────

// statusFilter matches the given account states; "active" also matches a missing/empty status
func statusFilter(states []string) bson.M {
	or := []bson.M{{"account_status": bson.M{"$in": states}}}
	for _, s := range states {
		if s == user.AccountActive {
			or = append(or, bson.M{"account_status": bson.M{"$exists": false}}, bson.M{"account_status": ""})
			break
		}
	}
	return bson.M{"$or": or}
}

func (r *mongoRepository) Transition(ctx context.Context, id primitive.ObjectID, from []string, set bson.M, unset []string, endSessions bool) (bool, error) {
	update := bson.M{}
	set["updated_at"] = time.Now()
	update["$set"] = set
	if len(unset) > 0 {
		u := bson.M{}
		for _, f := range unset {
			u[f] = ""
		}
		update["$unset"] = u
	}
	if endSessions {
		update["$inc"] = bson.M{"session_version": 1}
	}
	res, err := r.users.UpdateOne(ctx, bson.M{"$and": []bson.M{{"_id": id}, statusFilter(from)}}, update)
	if err != nil {
		return false, err
	}
	return res.MatchedCount == 1, nil
}

func (r *mongoRepository) SetJobsHidden(ctx context.Context, recruiterID primitive.ObjectID, hidden bool) error {
	var update bson.M
	if hidden {
		update = bson.M{"$set": bson.M{"hidden_by_account": true}}
	} else {
		update = bson.M{"$unset": bson.M{"hidden_by_account": ""}}
	}
	_, err := r.db.Collection("jobs").UpdateMany(ctx, bson.M{"recruiter_id": recruiterID}, update)
	return err
}

// SaveFeedback keeps the stated reason for leaving. It is stored without any user reference.
func (r *mongoRepository) SaveFeedback(ctx context.Context, action, reason, feedback string, at time.Time) error {
	if reason == "" && feedback == "" {
		return nil
	}
	_, err := r.db.Collection("account_exit_feedback").InsertOne(ctx, bson.M{
		"action": action, "reason": reason, "feedback": feedback, "created_at": at,
	})
	return err
}

// ─── Deletion checks ────────────────────────────────────────────────────────────

func (r *mongoRepository) DeletionChecks(ctx context.Context, userID primitive.ObjectID, now time.Time) (*deletionChecks, error) {
	checks := &deletionChecks{}

	var w walletState
	err := r.db.Collection("wallets").FindOne(ctx, bson.M{"user_id": userID}).Decode(&w)
	switch {
	case err == nil:
		checks.Wallet = &w
	case !errors.Is(err, mongo.ErrNoDocuments):
		return nil, err
	}

	// Money still moving to the user. Pending top-ups (abandoned checkouts) don't count, or a
	// closed payment window could block deletion forever.
	if checks.PendingTransactions, err = r.db.Collection("wallet_transactions").CountDocuments(ctx, bson.M{
		"user_id":  userID,
		"status":   "pending",
		"category": bson.M{"$in": []string{"withdrawal", "session_payout", "gig_payout", "refund"}},
	}); err != nil {
		return nil, err
	}
	if checks.OpenDisputes, err = r.db.Collection("wallet_disputes").CountDocuments(ctx,
		bson.M{"user_id": userID, "status": bson.M{"$in": []string{"pending", "under_review"}}}); err != nil {
		return nil, err
	}
	// Sessions as mentee or as the expert that are still to happen (or awaiting confirmation)
	if checks.UpcomingSessions, err = r.db.Collection("mentorship_bookings").CountDocuments(ctx, bson.M{
		"$or":          []bson.M{{"user_id": userID}, {"expert_id": userID}},
		"status":       bson.M{"$in": []string{"pending", "confirmed"}},
		"scheduled_at": bson.M{"$gte": now.Add(-2 * time.Hour)},
	}); err != nil {
		return nil, err
	}

	var sub struct {
		ExpiresAt time.Time `bson:"expires_at"`
	}
	err = r.db.Collection("expert_subscriptions").FindOne(ctx,
		bson.M{"user_id": userID, "status": "active", "expires_at": bson.M{"$gt": now}},
		options.FindOne().SetSort(bson.D{{Key: "expires_at", Value: -1}}),
	).Decode(&sub)
	switch {
	case err == nil:
		checks.SubscriptionEndsAt = &sub.ExpiresAt
	case !errors.Is(err, mongo.ErrNoDocuments):
		return nil, err
	}

	if checks.OpenJobs, err = r.db.Collection("jobs").CountDocuments(ctx, bson.M{
		"recruiter_id": userID,
		"status":       bson.M{"$nin": []string{"Closed", "closed"}},
	}); err != nil {
		return nil, err
	}
	return checks, nil
}

// ─── Data export ────────────────────────────────────────────────────────────────

func (r *mongoRepository) findAll(ctx context.Context, coll string, filter bson.M, projection bson.M) ([]bson.M, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(5000)
	if projection != nil {
		opts.SetProjection(projection)
	}
	cur, err := r.db.Collection(coll).Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	out := []bson.M{}
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *mongoRepository) Export(ctx context.Context, userID primitive.ObjectID) (map[string]interface{}, error) {
	var profile bson.M
	if err := r.users.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(bson.M{
		// Secrets and internal bookkeeping are never exported
		"password": 0, "session_version": 0, "profile_viewers": 0,
	})).Decode(&profile); err != nil {
		return nil, err
	}

	sections := []struct {
		key, coll  string
		filter     bson.M
		projection bson.M
	}{
		{"job_applications", "applications", bson.M{"candidate_id": userID}, nil},
		{"jobs_posted", "jobs", bson.M{"recruiter_id": userID}, nil},
		{"connections", "network_connections", bson.M{"$or": []bson.M{{"sender_id": userID}, {"receiver_id": userID}}}, nil},
		{"wallet", "wallets", bson.M{"user_id": userID}, nil},
		{"wallet_transactions", "wallet_transactions", bson.M{"user_id": userID}, nil},
		{"wallet_disputes", "wallet_disputes", bson.M{"user_id": userID}, nil},
		{"mentorship_bookings", "mentorship_bookings", bson.M{"$or": []bson.M{{"user_id": userID}, {"expert_id": userID}}}, nil},
		{"subscriptions", "expert_subscriptions", bson.M{"user_id": userID}, nil},
		{"notifications", "notifications", bson.M{"user_id": userID}, nil},
	}

	data := map[string]interface{}{
		"exported_at": time.Now().UTC(),
		"profile":     profile,
	}
	for _, s := range sections {
		docs, err := r.findAll(ctx, s.coll, s.filter, s.projection)
		if err != nil {
			return nil, err
		}
		data[s.key] = docs
	}
	return data, nil
}

// ─── Final deletion ─────────────────────────────────────────────────────────────

func (r *mongoRepository) DueDeletions(ctx context.Context, now time.Time, limit int64) ([]user.User, error) {
	cur, err := r.users.Find(ctx, bson.M{
		"account_status":         user.AccountPendingDeletion,
		"deletion_scheduled_for": bson.M{"$lte": now},
	}, options.Find().SetLimit(limit))
	if err != nil {
		return nil, err
	}
	var out []user.User
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *mongoRepository) EraseRelatedData(ctx context.Context, u *user.User, now time.Time) error {
	id := u.ID
	steps := []func() error{
		// Social graph and personal lists
		func() error {
			_, err := r.db.Collection("network_connections").DeleteMany(ctx, bson.M{"$or": []bson.M{{"sender_id": id}, {"receiver_id": id}}})
			return err
		},
		func() error {
			_, err := r.db.Collection("network_dismissed_suggestions").DeleteMany(ctx, bson.M{"$or": []bson.M{{"user_id": id}, {"dismissed_user_id": id}}})
			return err
		},
		func() error {
			_, err := r.db.Collection("user_blocks").DeleteMany(ctx, bson.M{"$or": []bson.M{{"user_id": id}, {"blocked_user_id": id}}})
			return err
		},
		func() error {
			_, err := r.db.Collection("notifications").DeleteMany(ctx, bson.M{"user_id": id})
			return err
		},
		// Applications stay for the employer's records, minus the candidate's documents
		func() error {
			_, err := r.db.Collection("applications").UpdateMany(ctx, bson.M{"candidate_id": id},
				bson.M{"$unset": bson.M{"resume_url": "", "cover_letter": ""}})
			return err
		},
		// Job posts close for good
		func() error {
			_, err := r.db.Collection("jobs").UpdateMany(ctx, bson.M{"recruiter_id": id},
				bson.M{"$set": bson.M{"status": "Closed", "hidden_by_account": true}})
			return err
		},
		// Expert offerings stop
		func() error {
			_, err := r.db.Collection("mentorships").UpdateMany(ctx, bson.M{"expert_id": id}, bson.M{"$set": bson.M{"status": "inactive"}})
			return err
		},
		func() error {
			_, err := r.db.Collection("expert_availability").DeleteMany(ctx, bson.M{"expert_id": id})
			return err
		},
		func() error {
			_, err := r.db.Collection("expert_subscriptions").UpdateMany(ctx, bson.M{"user_id": id, "status": "active"},
				bson.M{"$set": bson.M{"status": "cancelled", "updated_at": now}})
			return err
		},
		// Financial records are retained (accounting law) but detached from personal details
		func() error {
			_, err := r.db.Collection("wallets").UpdateMany(ctx, bson.M{"user_id": id}, bson.M{"$set": bson.M{"status": "closed", "updated_at": now}})
			return err
		},
		func() error {
			_, err := r.db.Collection("wallet_disputes").UpdateMany(ctx, bson.M{"user_id": id},
				bson.M{"$set": bson.M{"user_name": "Deleted user"}, "$unset": bson.M{"user_email": ""}})
			return err
		},
		// Sign-in codes tied to the old contact details
		func() error {
			or := []bson.M{}
			if u.Mobile != "" {
				or = append(or, bson.M{"mobile": u.Mobile})
			}
			if u.Email != "" {
				or = append(or, bson.M{"email": u.Email})
			}
			if len(or) == 0 {
				return nil
			}
			_, err := r.db.Collection("otps").DeleteMany(ctx, bson.M{"$or": or})
			return err
		},
		func() error { return r.DeleteCodes(ctx, id) },
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return err
		}
	}
	return nil
}

// erasedUserFields are removed from the user document on final deletion. Kept: _id, roles,
// created_at (so references in messages, applications and payments still resolve), the
// business-level company name/industry, and the lifecycle fields.
var erasedUserFields = []string{
	"mobile", "email", "password", "username", "first_name", "last_name", "additional_name", "pronouns",
	"headline", "about", "address", "profile_image", "cover_image", "gender", "date_of_birth",
	"marital_status", "education_level", "work_experience", "city", "state", "country",
	"job_categories", "experience_detail", "email_verified_at", "otp_verified_at",
	"education", "experience", "skills", "projects", "portfolio_url", "portfolio_label",
	"bookmarked_jobs", "open_to_work", "providing_services",
	"company_logo", "company_website", "gst", "company_documents",
	"expert_category", "expert_bio", "expert_pricing", "expert_documents",
	"last_login_lat", "last_login_lng", "profile_viewers",
	"deactivated_at", "deletion_requested_at",
}

func (r *mongoRepository) AnonymiseUser(ctx context.Context, id primitive.ObjectID, now time.Time) (bool, error) {
	unset := bson.M{}
	for _, f := range erasedUserFields {
		unset[f] = ""
	}
	res, err := r.users.UpdateOne(ctx,
		bson.M{"_id": id, "account_status": user.AccountPendingDeletion},
		bson.M{
			"$set": bson.M{
				"account_status":    user.AccountDeleted,
				"deleted_at":        now,
				"name":              "Deleted user",
				"is_registered":     false,
				"is_email_verified": false,
				"settings":          bson.M{"profile_visibility": "private", "search_engine_indexing": false},
				"updated_at":        now,
			},
			"$unset": unset,
			"$inc":   bson.M{"session_version": 1},
		})
	if err != nil {
		return false, err
	}
	return res.MatchedCount == 1, nil
}

func (r *mongoRepository) FilesByURL(ctx context.Context, urls []string) ([]fileRecord, error) {
	if len(urls) == 0 {
		return nil, nil
	}
	cur, err := r.db.Collection("files").Find(ctx, bson.M{"url": bson.M{"$in": urls}})
	if err != nil {
		return nil, err
	}
	var out []fileRecord
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *mongoRepository) DeleteFileRecords(ctx context.Context, ids []primitive.ObjectID) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.Collection("files").DeleteMany(ctx, bson.M{"_id": bson.M{"$in": ids}})
	return err
}
