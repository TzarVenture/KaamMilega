package account

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"km-backend/internal/database"
	"km-backend/internal/features/analytics"
	"km-backend/internal/features/story"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/gorm"
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
	// EndedSuspensions lists suspended accounts whose end date has passed
	EndedSuspensions(ctx context.Context, now time.Time, limit int64) ([]primitive.ObjectID, error)
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
	// The money and purchase tables (wallet, bookings) live in Postgres
	pg *gorm.DB
	tx *database.PgTransactor
}

func NewRepository(db *database.MongodbDB, pg *database.PostgresDB, tx *database.PgTransactor) Repository {
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
	return &mongoRepository{db: db.DB, users: users, codes: codes, pg: pg.DB, tx: tx}
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

	uid := userID.Hex()

	// One query, so every money fact comes from the same moment
	var row struct {
		HasWallet           bool
		MainPaise           int64
		EarningsPaise       int64
		LockedPaise         int64
		BonusPaise          int64
		PendingTransactions int64
		OpenDisputes        int64
		UpcomingSessions    int64
	}
	// Pending money still moving to the user counts; pending top-ups (abandoned checkouts) don't,
	// or a closed payment window could block deletion forever. Sessions count as mentee or as the
	// expert while they are still to happen (or awaiting confirmation).
	err := r.pg.WithContext(ctx).Raw(`SELECT
			w.id IS NOT NULL AS has_wallet,
			coalesce(w.main_paise, 0) AS main_paise, coalesce(w.earnings_paise, 0) AS earnings_paise,
			coalesce(w.locked_paise, 0) AS locked_paise, coalesce(w.bonus_paise, 0) AS bonus_paise,
			(SELECT count(*) FROM wallet_transactions WHERE user_id = @uid AND status = 'pending'
				AND category IN ('withdrawal', 'session_payout', 'gig_payout', 'refund')) AS pending_transactions,
			(SELECT count(*) FROM wallet_disputes WHERE user_id = @uid AND status IN ('pending', 'under_review')) AS open_disputes,
			(SELECT count(*) FROM mentorship_bookings WHERE (user_id = @uid OR expert_id = @uid)
				AND status IN ('pending', 'confirmed') AND scheduled_at >= @since) AS upcoming_sessions
		FROM (SELECT 1) one LEFT JOIN wallets w ON w.user_id = @uid`,
		sql.Named("uid", uid), sql.Named("since", now.Add(-2*time.Hour))).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.HasWallet {
		checks.Wallet = &walletState{MainPaise: row.MainPaise, EarningsPaise: row.EarningsPaise, LockedPaise: row.LockedPaise, BonusPaise: row.BonusPaise}
	}
	checks.PendingTransactions = row.PendingTransactions
	checks.OpenDisputes = row.OpenDisputes
	checks.UpcomingSessions = row.UpcomingSessions

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

	// Money records, from Postgres. Amounts are in paise, as stored.
	uid := userID.Hex()
	pgSections := []struct{ key, table, where string }{
		{"wallet", "wallets", "user_id = @uid"},
		{"wallet_transactions", "wallet_transactions", "user_id = @uid"},
		{"wallet_disputes", "wallet_disputes", "user_id = @uid"},
		{"mentorship_bookings", "mentorship_bookings", "user_id = @uid OR expert_id = @uid"},
	}
	for _, s := range pgSections {
		rows, err := r.pgRows(ctx, s.table, s.where, uid)
		if err != nil {
			return nil, err
		}
		data[s.key] = rows
	}
	return data, nil
}

// pgRows returns a user's rows of one table as JSON objects, newest first. table and where are
// fixed strings from this file, never user input; the user id is a bound parameter.
func (r *mongoRepository) pgRows(ctx context.Context, table, where, uid string) ([]map[string]interface{}, error) {
	var raw string
	err := r.pg.WithContext(ctx).Raw(`SELECT coalesce(json_agg(t), '[]')::text FROM (
			SELECT * FROM `+table+` WHERE `+where+` ORDER BY created_at DESC LIMIT 5000) t`,
		sql.Named("uid", uid)).Row().Scan(&raw)
	if err != nil {
		return nil, fmt.Errorf("exporting %s: %w", table, err)
	}
	out := []map[string]interface{}{}
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, fmt.Errorf("exporting %s: %w", table, err)
	}
	return out, nil
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

func (r *mongoRepository) EndedSuspensions(ctx context.Context, now time.Time, limit int64) ([]primitive.ObjectID, error) {
	cur, err := r.users.Find(ctx, bson.M{
		"account_status":  user.AccountSuspended,
		"suspended_until": bson.M{"$lte": now},
	}, options.Find().SetLimit(limit).SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return nil, err
	}
	var rows []struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	return ids, nil
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
		// Feed: their posts with everything on them, and their comments and reactions elsewhere
		func() error { return r.eraseFeedData(ctx, id) },
		// Stories: theirs are taken down now and handed to the story sweeper, which deletes them
		// with their photos and videos from storage within minutes. Then their views and
		// reports, given and received.
		func() error {
			_, err := r.db.Collection(story.StoriesCollection).UpdateMany(ctx, bson.M{"owner_id": id},
				bson.M{"$set": bson.M{"status": story.StatusRemoved, "purge_at": now}})
			return err
		},
		func() error {
			views := r.db.Collection(story.ViewsCollection)
			// Their views of others' stories come off those stories' counts first
			seen, err := views.Distinct(ctx, "story_id", bson.M{"viewer_id": id, "owner_id": bson.M{"$ne": id}})
			if err != nil {
				return err
			}
			if len(seen) > 0 {
				if _, err := views.DeleteMany(ctx, bson.M{"viewer_id": id, "story_id": bson.M{"$in": seen}}); err != nil {
					return err
				}
				if _, err := r.db.Collection(story.StoriesCollection).UpdateMany(ctx,
					bson.M{"_id": bson.M{"$in": seen}, "views": bson.M{"$gt": 0}}, bson.M{"$inc": bson.M{"views": -1}}); err != nil {
					return err
				}
			}
			_, err = views.DeleteMany(ctx, bson.M{"$or": []bson.M{{"owner_id": id}, {"viewer_id": id}}})
			return err
		},
		func() error {
			_, err := r.db.Collection(story.SharesCollection).DeleteMany(ctx, bson.M{"owner_id": id})
			return err
		},
		func() error {
			_, err := r.db.Collection(story.ReportsCollection).DeleteMany(ctx, bson.M{"$or": []bson.M{{"owner_id": id}, {"reporter_id": id}}})
			return err
		},
		// Analytics: their own numbers, and their visits and searches that named other people.
		// Impressions they made on others' posts stay, so those posts' counts don't drop.
		func() error {
			_, err := r.db.Collection(analytics.ProfileViewsCollection).DeleteMany(ctx, bson.M{"$or": []bson.M{{"profile_id": id}, {"viewer_id": id}}})
			return err
		},
		func() error {
			_, err := r.db.Collection(analytics.SearchAppearancesCollection).DeleteMany(ctx, bson.M{"$or": []bson.M{{"user_id": id}, {"searcher_id": id}}})
			return err
		},
		func() error {
			_, err := r.db.Collection(analytics.PostImpressionsCollection).DeleteMany(ctx, bson.M{"$or": []bson.M{{"author_id": id}, {"viewer_id": id}}})
			return err
		},
		// Browser and phone push registrations
		func() error {
			_, err := r.db.Collection("push_tokens").DeleteMany(ctx, bson.M{"user_id": id})
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
		// Expert offerings stop, plans end, and money records are kept (accounting law) but
		// detached from personal details. All in Postgres, as one transaction.
		func() error { return r.erasePurchaseData(ctx, id.Hex()) },
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

// erasePurchaseData winds down a deleted member's Postgres records. It is safe to run again.
// updated_at is set by the tables' triggers.
func (r *mongoRepository) erasePurchaseData(ctx context.Context, uid string) error {
	return r.tx.Run(ctx, func(ctx context.Context) error {
		db := database.Conn(ctx, r.pg)
		steps := []struct{ sql string }{
			{`UPDATE mentorships SET status = 'inactive' WHERE expert_id = @uid AND status <> 'inactive'`},
			{`DELETE FROM expert_availability WHERE expert_id = @uid`},
			{`UPDATE wallets SET status = 'closed' WHERE user_id = @uid AND status <> 'closed'`},
			{`UPDATE wallet_disputes SET user_name = 'Deleted user', user_email = ''
				WHERE user_id = @uid AND (user_name <> 'Deleted user' OR user_email <> '')`},
		}
		for _, s := range steps {
			if err := db.Exec(s.sql, sql.Named("uid", uid)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// eraseFeedData removes a member's feed activity. Counts on other members' posts are lowered
// by what is removed, so they stay right.
func (r *mongoRepository) eraseFeedData(ctx context.Context, id primitive.ObjectID) error {
	posts := r.db.Collection("feed_posts")

	cur, err := posts.Find(ctx, bson.M{"author_id": id}, options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return err
	}
	var own []struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	if err := cur.All(ctx, &own); err != nil {
		return err
	}
	if len(own) > 0 {
		ids := make([]primitive.ObjectID, len(own))
		for i, p := range own {
			ids[i] = p.ID
		}
		for _, name := range []string{"feed_comments", "feed_reactions", "feed_saves", "feed_reports"} {
			if _, err := r.db.Collection(name).DeleteMany(ctx, bson.M{"post_id": bson.M{"$in": ids}}); err != nil {
				return err
			}
		}
		// The photos' storage objects are not removed here (see deleteUploadedFiles)
		if _, err := posts.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": ids}}); err != nil {
			return err
		}
	}

	// Their comments on other posts
	type tally struct {
		Post  primitive.ObjectID `bson:"_id"`
		Count int                `bson:"n"`
	}
	cc, err := r.db.Collection("feed_comments").Aggregate(ctx, []bson.M{
		{"$match": bson.M{"author_id": id}},
		{"$group": bson.M{"_id": "$post_id", "n": bson.M{"$sum": 1}}},
	})
	if err != nil {
		return err
	}
	var comments []tally
	if err := cc.All(ctx, &comments); err != nil {
		return err
	}
	for _, t := range comments {
		if _, err := posts.UpdateOne(ctx, bson.M{"_id": t.Post}, bson.M{"$inc": bson.M{"comments_count": -t.Count}}); err != nil {
			return err
		}
	}
	if _, err := r.db.Collection("feed_comments").DeleteMany(ctx, bson.M{"author_id": id}); err != nil {
		return err
	}

	// Their reactions (one per post)
	rc, err := r.db.Collection("feed_reactions").Find(ctx, bson.M{"user_id": id})
	if err != nil {
		return err
	}
	var reactions []struct {
		PostID primitive.ObjectID `bson:"post_id"`
		Type   string             `bson:"type"`
	}
	if err := rc.All(ctx, &reactions); err != nil {
		return err
	}
	for _, x := range reactions {
		if _, err := posts.UpdateOne(ctx, bson.M{"_id": x.PostID}, bson.M{"$inc": bson.M{
			"reactions_total": -1, "reaction_counts." + x.Type: -1,
		}}); err != nil {
			return err
		}
	}
	for _, name := range []string{"feed_reactions", "feed_saves"} {
		if _, err := r.db.Collection(name).DeleteMany(ctx, bson.M{"user_id": id}); err != nil {
			return err
		}
	}
	_, err = r.db.Collection("feed_reports").DeleteMany(ctx, bson.M{"reporter_id": id})
	return err
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
	"company_logo", "company_website", "company_cover", "company_about", "company_city", "company_size",
	"gst", "company_documents",
	"expert_category", "expert_bio", "expert_pricing", "expert_documents",
	"last_login_lat", "last_login_lng",
	// Counters from before analytics moved to its own collections
	"profile_viewers", "profile_views", "post_impressions", "search_appearances",
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
