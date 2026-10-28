package user

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"km-backend/internal/database"
)

type UserRepository interface {
	FindUserByMobile(ctx context.Context, mobile string) (*User, error)
	FindUserByEmail(ctx context.Context, email string) (*User, error)
	FindUserByEmailOrMobile(ctx context.Context, identifier string) (*User, error)
	CreateUser(ctx context.Context, user *User) (*User, error)
	UpdateUser(ctx context.Context, user *User) (*User, error)
	UpdatePassword(ctx context.Context, userID string, passwordHash string) error
	FindUserByID(ctx context.Context, id string) (*User, error)
	DeleteUser(ctx context.Context, id string) error

	SaveOTP(ctx context.Context, otp *OTP) error
	GetLatestOTP(ctx context.Context, mobile string) (*OTP, error)
	GetLatestEmailOTP(ctx context.Context, email string) (*OTP, error)
	MarkOTPUsed(ctx context.Context, id primitive.ObjectID) error
	IncrementOTPAttempts(ctx context.Context, id primitive.ObjectID) error
	CountMobileOTPsSince(ctx context.Context, mobile string, since time.Time) (int64, error)

	FindUsers(ctx context.Context, filter UserFilter) ([]*User, int64, error)
	ToggleBookmark(ctx context.Context, userID string, jobID string) ([]string, error)
	GetUserSettings(ctx context.Context, userID string) (*UserSettings, error)
	UpdateUserSettings(ctx context.Context, userID string, settings UserSettings) (*UserSettings, error)
	GetPlatformStats(ctx context.Context) (map[string]interface{}, error)
	GetLiveActivity(ctx context.Context) ([]map[string]interface{}, error)
	IncrementPostImpressions(ctx context.Context, authorCounts map[string]int) error
	FindUserByUsername(ctx context.Context, username string) (*User, error)
	BackfillUsernames(ctx context.Context) error
	HasActivePassOrSubscription(ctx context.Context, userID string) (bool, error)
	BumpSessionVersion(ctx context.Context, userID string) (int, error)
	HasRestrictedProfileAccess(ctx context.Context, ownerID, viewerID string, allowConnections bool) (bool, error)
	GetSessionState(ctx context.Context, userID string) (found bool, status string, version int, err error)

	ExportUsersCSV(ctx context.Context, role string) ([]byte, error)
	ExportJobsCSV(ctx context.Context, status string) ([]byte, error)
	ExportRevenueCSV(ctx context.Context, status string) ([]byte, error)

	GlobalSearch(ctx context.Context, query string) (*GlobalSearchResponse, error)
}

type UserRepositoryImpl struct {
	db       *database.MongodbDB
	userColl *mongo.Collection
	otpColl  *mongo.Collection
}

func NewUserRepository(db *database.MongodbDB) UserRepository {
	userColl := db.DB.Collection("users")
	// Ensure unique sparse index on username
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		opts := options.Index().SetUnique(true).SetSparse(true)
		_, _ = userColl.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys:    bson.M{"username": 1},
			Options: opts,
		})
	}()

	return &UserRepositoryImpl{
		db:       db,
		userColl: userColl,
		otpColl:  db.DB.Collection("otps"),
	}
}

func cleanMobile(mobile string) string {
	cleaned := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, mobile)
	if len(cleaned) == 12 && strings.HasPrefix(cleaned, "91") {
		cleaned = cleaned[2:]
	}
	if len(cleaned) == 11 && strings.HasPrefix(cleaned, "0") {
		cleaned = cleaned[1:]
	}
	return cleaned
}

func (r *UserRepositoryImpl) FindUserByMobile(ctx context.Context, mobile string) (*User, error) {
	cMobile := cleanMobile(mobile)
	var filter bson.M
	if cMobile != "" && cMobile != mobile {
		filter = bson.M{
			"$or": []bson.M{
				{"mobile": mobile},
				{"mobile": cMobile},
			},
		}
	} else {
		filter = bson.M{"mobile": mobile}
	}

	var user User
	err := r.userColl.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepositoryImpl) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	normEmail := strings.ToLower(strings.TrimSpace(email))
	if normEmail == "" {
		return nil, nil
	}
	var user User
	err := r.userColl.FindOne(ctx, bson.M{"email": normEmail}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepositoryImpl) FindUserByEmailOrMobile(ctx context.Context, identifier string) (*User, error) {
	trimmed := strings.TrimSpace(identifier)
	if trimmed == "" {
		return nil, nil
	}
	normEmail := strings.ToLower(trimmed)
	cMobile := cleanMobile(trimmed)

	conditions := []bson.M{
		{"email": normEmail},
		{"mobile": trimmed},
	}
	if cMobile != "" && cMobile != trimmed {
		conditions = append(conditions, bson.M{"mobile": cMobile})
	}

	filter := bson.M{"$or": conditions}
	var user User
	err := r.userColl.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepositoryImpl) FindUserByID(ctx context.Context, id string) (*User, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("empty user identifier")
	}

	var filter bson.M
	if oid, err := primitive.ObjectIDFromHex(id); err == nil {
		filter = bson.M{
			"$or": []bson.M{
				{"_id": oid},
				{"username": strings.ToLower(id)},
			},
		}
	} else {
		filter = bson.M{"username": strings.ToLower(id)}
	}

	var user User
	err := r.userColl.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepositoryImpl) CreateUser(ctx context.Context, user *User) (*User, error) {
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	if user.Settings.ProfileVisibility == "" {
		user.Settings = DefaultUserSettings()
	}
	res, err := r.userColl.InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}
	user.ID = res.InsertedID.(primitive.ObjectID)
	return user, nil
}

// sessionVersionFilter matches a stored session_version (a missing field counts as 0)
func sessionVersionFilter(version int) bson.M {
	if version == 0 {
		return bson.M{"$or": []bson.M{{"session_version": bson.M{"$exists": false}}, {"session_version": 0}}}
	}
	return bson.M{"session_version": version}
}

// ErrStaleUser is returned when the user changed account state (deactivated, deletion requested,
// signed out everywhere) after this copy was read. Replacing it would silently undo that change.
var ErrStaleUser = errors.New("your account changed in another session; please reload and try again")

func (r *UserRepositoryImpl) UpdateUser(ctx context.Context, user *User) (*User, error) {
	user.UpdatedAt = time.Now()
	// Full-document replace, but only while the session version is unchanged: every account
	// lifecycle transition bumps it, so a stale copy can never revert one
	filter := bson.M{"$and": []bson.M{{"_id": user.ID}, sessionVersionFilter(user.SessionVersion)}}
	res, err := r.userColl.ReplaceOne(ctx, filter, user)
	if err != nil {
		return nil, err
	}
	if res.MatchedCount == 0 {
		return nil, ErrStaleUser
	}
	return user, nil
}

func (r *UserRepositoryImpl) DeleteUser(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.userColl.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}

// HasRestrictedProfileAccess reports whether viewer may see owner's private or connections-only
// profile: a recruiter the owner applied to always may; connections may when allowConnections.
func (r *UserRepositoryImpl) HasRestrictedProfileAccess(ctx context.Context, ownerID, viewerID string, allowConnections bool) (bool, error) {
	owner, err := primitive.ObjectIDFromHex(ownerID)
	if err != nil {
		return false, nil
	}
	viewer, err := primitive.ObjectIDFromHex(viewerID)
	if err != nil {
		return false, nil
	}
	applied, err := r.db.DB.Collection("applications").CountDocuments(ctx,
		bson.M{"candidate_id": owner, "recruiter_id": viewer}, options.Count().SetLimit(1))
	if err != nil {
		return false, err
	}
	if applied > 0 {
		return true, nil
	}
	if !allowConnections {
		return false, nil
	}
	connected, err := r.db.DB.Collection("network_connections").CountDocuments(ctx, bson.M{
		"status": "accepted",
		"$or": []bson.M{
			{"sender_id": owner, "receiver_id": viewer},
			{"sender_id": viewer, "receiver_id": owner},
		},
	}, options.Count().SetLimit(1))
	if err != nil {
		return false, err
	}
	return connected > 0, nil
}

// BumpSessionVersion invalidates every login token issued so far and returns the new version
func (r *UserRepositoryImpl) BumpSessionVersion(ctx context.Context, userID string) (int, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return 0, err
	}
	var out struct {
		SessionVersion int `bson:"session_version"`
	}
	err = r.userColl.FindOneAndUpdate(ctx, bson.M{"_id": oid},
		bson.M{"$inc": bson.M{"session_version": 1}, "$set": bson.M{"updated_at": time.Now()}},
		options.FindOneAndUpdate().SetReturnDocument(options.After).SetProjection(bson.M{"session_version": 1}),
	).Decode(&out)
	if err != nil {
		return 0, err
	}
	return out.SessionVersion, nil
}

// GetSessionState returns just the fields the auth middleware checks on every request
func (r *UserRepositoryImpl) GetSessionState(ctx context.Context, userID string) (found bool, status string, version int, err error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return false, "", 0, nil
	}
	var out struct {
		AccountStatus  string `bson:"account_status"`
		SessionVersion int    `bson:"session_version"`
	}
	err = r.userColl.FindOne(ctx, bson.M{"_id": oid},
		options.FindOne().SetProjection(bson.M{"account_status": 1, "session_version": 1}),
	).Decode(&out)
	if err == mongo.ErrNoDocuments {
		return false, "", 0, nil
	}
	if err != nil {
		return false, "", 0, err
	}
	return true, out.AccountStatus, out.SessionVersion, nil
}

func (r *UserRepositoryImpl) UpdatePassword(ctx context.Context, userID string, passwordHash string) error {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}
	update := bson.M{
		"$set": bson.M{
			"password":   passwordHash,
			"updated_at": time.Now(),
		},
	}
	_, err = r.userColl.UpdateOne(ctx, bson.M{"_id": oid}, update)
	return err
}

func (r *UserRepositoryImpl) SaveOTP(ctx context.Context, otp *OTP) error {
	otp.CreatedAt = time.Now()
	otp.ExpiresAt = time.Now().Add(5 * time.Minute) // 5 min expiry
	otp.Used = false
	_, err := r.otpColl.InsertOne(ctx, otp)
	return err
}

func (r *UserRepositoryImpl) GetLatestOTP(ctx context.Context, mobile string) (*OTP, error) {
	filter := bson.M{
		"mobile":     mobile,
		"used":       false,
		"expires_at": bson.M{"$gt": time.Now()},
	}
	opts := options.FindOne().SetSort(bson.M{"created_at": -1})

	var otp OTP
	err := r.otpColl.FindOne(ctx, filter, opts).Decode(&otp)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &otp, nil
}

func (r *UserRepositoryImpl) MarkOTPUsed(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.otpColl.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"used": true}})
	return err
}

func (r *UserRepositoryImpl) IncrementOTPAttempts(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.otpColl.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$inc": bson.M{"attempts": 1}})
	return err
}

func (r *UserRepositoryImpl) CountMobileOTPsSince(ctx context.Context, mobile string, since time.Time) (int64, error) {
	return r.otpColl.CountDocuments(ctx, bson.M{
		"mobile":     mobile,
		"created_at": bson.M{"$gte": since},
	})
}

func (r *UserRepositoryImpl) GetLatestEmailOTP(ctx context.Context, email string) (*OTP, error) {
	filter := bson.M{
		"email":      email,
		"used":       false,
		"expires_at": bson.M{"$gt": time.Now()},
	}
	opts := options.FindOne().SetSort(bson.M{"created_at": -1})

	var otp OTP
	err := r.otpColl.FindOne(ctx, filter, opts).Decode(&otp)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &otp, nil
}

func (r *UserRepositoryImpl) FindUsers(ctx context.Context, filter UserFilter) ([]*User, int64, error) {
	bsonFilter := bson.M{}
	andConditions := []bson.M{}

	if filter.Role != "" {
		andConditions = append(andConditions, bson.M{"roles": filter.Role})
	}

	if filter.Search != "" {
		// Escape the query so user input is matched literally, not as a regular expression
		regex := bson.M{"$regex": regexp.QuoteMeta(filter.Search), "$options": "i"}
		searchFields := []bson.M{
			{"name": regex},
			{"headline": regex},
			{"company_name": regex},
		}
		// Looking people up by phone number or email is an admin-only capability
		if filter.AdminView {
			searchFields = append(searchFields, bson.M{"email": regex}, bson.M{"mobile": regex})
		}
		andConditions = append(andConditions, bson.M{"$or": searchFields})
	}

	if filter.CompanyName != "" {
		andConditions = append(andConditions, bson.M{"company_name": bson.M{"$regex": filter.CompanyName, "$options": "i"}})
	}

	if filter.VerificationStatus != "" {
		andConditions = append(andConditions, bson.M{"verification_status": filter.VerificationStatus})
	}

	if filter.ExpertApprovalStatus != "" {
		andConditions = append(andConditions, bson.M{"expert_approval_status": filter.ExpertApprovalStatus})
	}

	if !filter.AdminView {
		// Private profiles are never discoverable through search or listings. Connections-only
		// profiles stay findable (so people can connect) but their details are gated on view.
		andConditions = append(andConditions, bson.M{"settings.profile_visibility": bson.M{"$ne": "private"}})
		// Deactivated, pending-deletion and deleted accounts disappear everywhere
		andConditions = append(andConditions, bson.M{"account_status": bson.M{"$nin": InactiveAccountStatuses}})
	}

	if len(andConditions) > 0 {
		bsonFilter["$and"] = andConditions
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1})

	total, err := r.userColl.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	if filter.Limit > 0 {
		opts.SetLimit(int64(filter.Limit))
		if filter.Page > 1 {
			opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
		}
	}

	cursor, err := r.userColl.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var users []*User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *UserRepositoryImpl) ToggleBookmark(ctx context.Context, userID string, jobID string) ([]string, error) {
	objID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user ID")
	}

	user, err := r.FindUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	isBookmarked := false
	for _, id := range user.BookmarkedJobs {
		if id == jobID {
			isBookmarked = true
			break
		}
	}

	var update bson.M
	if isBookmarked {
		update = bson.M{"$pull": bson.M{"bookmarked_jobs": jobID}}
	} else {
		update = bson.M{"$addToSet": bson.M{"bookmarked_jobs": jobID}}
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updatedUser User
	err = r.userColl.FindOneAndUpdate(ctx, bson.M{"_id": objID}, update, opts).Decode(&updatedUser)
	if err != nil {
		return nil, err
	}

	return updatedUser.BookmarkedJobs, nil
}

func (r *UserRepositoryImpl) GetUserSettings(ctx context.Context, userID string) (*UserSettings, error) {
	user, err := r.FindUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}
	if user.Settings.ProfileVisibility == "" {
		defaults := DefaultUserSettings()
		return &defaults, nil
	}
	return &user.Settings, nil
}

func (r *UserRepositoryImpl) UpdateUserSettings(ctx context.Context, userID string, settings UserSettings) (*UserSettings, error) {
	objID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user ID")
	}

	update := bson.M{
		"$set": bson.M{
			"settings":   settings,
			"updated_at": time.Now(),
		},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updatedUser User
	err = r.userColl.FindOneAndUpdate(ctx, bson.M{"_id": objID}, update, opts).Decode(&updatedUser)
	if err != nil {
		return nil, err
	}

	return &updatedUser.Settings, nil
}

func (r *UserRepositoryImpl) GetPlatformStats(ctx context.Context) (map[string]interface{}, error) {
	totalUsers, _ := r.userColl.CountDocuments(ctx, bson.M{})
	jobseekers, _ := r.userColl.CountDocuments(ctx, bson.M{"roles": "user"})
	recruiters, _ := r.userColl.CountDocuments(ctx, bson.M{"roles": "recruiter"})
	experts, _ := r.userColl.CountDocuments(ctx, bson.M{"roles": "expert"})
	cities, _ := r.db.DB.Collection("cities").CountDocuments(ctx, bson.M{})
	skills, _ := r.db.DB.Collection("skills").CountDocuments(ctx, bson.M{})
	jobs, _ := r.db.DB.Collection("jobs").CountDocuments(ctx, bson.M{})
	applications, _ := r.db.DB.Collection("applications").CountDocuments(ctx, bson.M{})
	interviews, _ := r.db.DB.Collection("interviews").CountDocuments(ctx, bson.M{})
	activeGigs, _ := r.db.DB.Collection("instant_jobs").CountDocuments(ctx, bson.M{})
	disputes, _ := r.db.DB.Collection("wallet_disputes").CountDocuments(ctx, bson.M{})

	// Aggregate total revenue from completed wallet transactions
	var totalRevenue float64 = 0
	pipeline := []bson.M{
		{"$match": bson.M{"status": bson.M{"$in": []string{"completed", "success"}}}},
		{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$amount"}}},
	}
	cursor, err := r.db.DB.Collection("wallet_transactions").Aggregate(ctx, pipeline)
	if err == nil {
		var results []bson.M
		if err := cursor.All(ctx, &results); err == nil && len(results) > 0 {
			if t, ok := results[0]["total"].(float64); ok {
				totalRevenue = t
			} else if t, ok := results[0]["total"].(int32); ok {
				totalRevenue = float64(t)
			} else if t, ok := results[0]["total"].(int64); ok {
				totalRevenue = float64(t)
			}
		}
	}

	return map[string]interface{}{
		"total_users":  totalUsers,
		"jobseekers":   jobseekers,
		"recruiters":   recruiters,
		"experts":      experts,
		"cities":       cities,
		"skills":       skills,
		"jobs":         jobs,
		"applications": applications,
		"interviews":   interviews,
		"active_gigs":  activeGigs,
		"disputes":     disputes,
		"revenue":      totalRevenue,
	}, nil
}

// publicDisplayName shortens "Rahul Kumar Sharma" to "Rahul S." for public listings
func publicDisplayName(full string) string {
	parts := strings.Fields(strings.TrimSuffix(strings.TrimSpace(full), "."))
	if len(parts) == 0 {
		return ""
	}
	if len(parts) == 1 {
		return parts[0]
	}
	last := []rune(parts[len(parts)-1])
	return parts[0] + " " + strings.ToUpper(string(last[0])) + "."
}

func (r *UserRepositoryImpl) GetLiveActivity(ctx context.Context) ([]map[string]interface{}, error) {
	var activities []map[string]interface{}

	// 1. Fetch real interviews
	intCursor, err := r.db.DB.Collection("interviews").Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"created_at": -1}).SetLimit(5))
	if err == nil {
		var interviews []bson.M
		if err := intCursor.All(ctx, &interviews); err == nil {
			for _, item := range interviews {
				loc := "Online Video"
				if l, ok := item["location"].(string); ok && l != "" && !strings.Contains(l, "ret") {
					loc = l
				}
				activities = append(activities, map[string]interface{}{
					"id":          item["_id"],
					"type":        "interview",
					"place":       loc,
					"tag":         "Interview Fixed",
					"title":       "Direct HR Interview Scheduled",
					"description": "Verified candidate interview confirmed (" + loc + ") with zero brokerage.",
					"badge":       "Live Milestone",
					"time":        "Recently Scheduled",
				})
			}
		}
	}

	// 2. Fetch real applications
	appCursor, err := r.db.DB.Collection("applications").Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"created_at": -1}).SetLimit(5))
	if err == nil {
		var applications []bson.M
		if err := appCursor.All(ctx, &applications); err == nil {
			for _, item := range applications {
				activities = append(activities, map[string]interface{}{
					"id":          item["_id"],
					"type":        "application",
					"tag":         "Direct Application",
					"title":       "New Candidate Applied",
					"description": "Direct application submitted for employer review with contact privileges.",
					"badge":       "Application Placed",
					"time":        "Verified Application",
				})
			}
		}
	}

	// 3. Fetch real newly registered candidates (public endpoint: first name + last initial only)
	userCursor, err := r.userColl.Find(ctx, bson.M{"roles": "user", "is_registered": true, "name": bson.M{"$ne": ""}}, options.Find().SetSort(bson.M{"created_at": -1}).SetLimit(6))
	if err == nil {
		var users []bson.M
		if err := userCursor.All(ctx, &users); err == nil {
			for _, item := range users {
				name := "A new member"
				if n, ok := item["name"].(string); ok && strings.TrimSpace(n) != "" {
					name = publicDisplayName(n)
				}
				city := "India"
				if c, ok := item["city"].(string); ok && c != "" {
					city = c
				}
				trade := "General Trade"
				if cats, ok := item["job_categories"].(primitive.A); ok && len(cats) > 0 {
					if t, ok := cats[0].(string); ok && t != "" {
						trade = t
					}
				}
				activities = append(activities, map[string]interface{}{
					"id":          item["_id"],
					"type":        "member",
					"person":      name,
					"place":       city,
					"trade":       trade,
					"tag":         "Talent Network",
					"title":       name + " joined from " + city,
					"description": "Verified profile active in " + trade + " with zero-brokerage contact.",
					"badge":       "New Candidate",
					"time":        city,
				})
			}
		}
	}

	return activities, nil
}

func (r *UserRepositoryImpl) IncrementPostImpressions(ctx context.Context, authorCounts map[string]int) error {
	if len(authorCounts) == 0 {
		return nil
	}

	var writes []mongo.WriteModel
	for idStr, count := range authorCounts {
		if count <= 0 {
			continue
		}
		oid, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			continue
		}
		model := mongo.NewUpdateOneModel().
			SetFilter(bson.M{"_id": oid}).
			SetUpdate(bson.M{
				"$inc": bson.M{"post_impressions": count},
			})
		writes = append(writes, model)
	}

	if len(writes) == 0 {
		return nil
	}

	_, err := r.userColl.BulkWrite(ctx, writes)
	return err
}

func (r *UserRepositoryImpl) FindUserByUsername(ctx context.Context, username string) (*User, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	if username == "" {
		return nil, errors.New("empty username")
	}

	var user User
	err := r.userColl.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepositoryImpl) BackfillUsernames(ctx context.Context) error {
	cursor, err := r.userColl.Find(ctx, bson.M{
		"$or": []bson.M{
			{"username": bson.M{"$exists": false}},
			{"username": ""},
			{"username": nil},
		},
	})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	var users []*User
	if err := cursor.All(ctx, &users); err != nil {
		return err
	}

	if len(users) == 0 {
		return nil
	}

	var writes []mongo.WriteModel
	for _, u := range users {
		if u.Username != "" {
			continue
		}
		slug := GenerateDefaultUsername(u.Name, u.ID.Hex())
		model := mongo.NewUpdateOneModel().
			SetFilter(bson.M{"_id": u.ID}).
			SetUpdate(bson.M{"$set": bson.M{"username": slug}})
		writes = append(writes, model)
	}

	if len(writes) > 0 {
		_, err = r.userColl.BulkWrite(ctx, writes)
		return err
	}
	return nil
}

func GenerateDefaultUsername(name, idHex string) string {
	cleaned := strings.ToLower(strings.TrimSpace(name))
	var sb strings.Builder
	lastDash := false
	for _, r := range cleaned {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
			lastDash = false
		} else if !lastDash && sb.Len() > 0 {
			sb.WriteRune('-')
			lastDash = true
		}
	}
	base := strings.Trim(sb.String(), "-")
	if base == "" {
		base = "user"
	}

	suffix := ""
	if len(idHex) >= 4 {
		suffix = idHex[len(idHex)-4:]
	} else {
		suffix = "km"
	}

	return fmt.Sprintf("%s-%s", base, suffix)
}

// HasActivePassOrSubscription checks if the user has an active ₹99 InstantPass or active Pro Expert Subscription
func (r *UserRepositoryImpl) HasActivePassOrSubscription(ctx context.Context, userID string) (bool, error) {
	objID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return false, err
	}
	now := time.Now()

	// 1. Check instant_passes
	passCount, err := r.db.DB.Collection("instant_passes").CountDocuments(ctx, bson.M{
		"user_id":         objID,
		"has_active_pass": true,
		"expires_at":      bson.M{"$gte": now},
	})
	if err != nil {
		return false, err
	}
	if passCount > 0 {
		return true, nil
	}

	// 2. Check expert_subscriptions
	subCount, err := r.db.DB.Collection("expert_subscriptions").CountDocuments(ctx, bson.M{
		"user_id":    objID,
		"status":     "active",
		"expires_at": bson.M{"$gte": now},
	})
	if err != nil {
		return false, err
	}

	return subCount > 0, nil
}

func (r *UserRepositoryImpl) ExportUsersCSV(ctx context.Context, role string) ([]byte, error) {
	filter := bson.M{}
	if role != "" && role != "all" {
		filter["roles"] = role
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.userColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var users []*User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF") // UTF-8 BOM for Excel compatibility
	writer := csv.NewWriter(&buf)

	headers := []string{
		"User ID",
		"Full Name",
		"Mobile",
		"Email",
		"Roles",
		"Headline / Trade",
		"City",
		"Verification Status",
		"Total Bookmarked Jobs",
		"Registered Date",
		"Last Active",
	}
	if err := writer.Write(headers); err != nil {
		return nil, err
	}

	for _, u := range users {
		name := u.Name
		if name == "" {
			name = strings.TrimSpace(u.FirstName + " " + u.LastName)
		}
		rolesStr := strings.Join(u.Roles, ", ")
		regDate := ""
		if !u.CreatedAt.IsZero() {
			regDate = u.CreatedAt.Format("2006-01-02 15:04:05")
		}
		lastActive := ""
		if !u.LastActiveAt.IsZero() {
			lastActive = u.LastActiveAt.Format("2006-01-02 15:04:05")
		}

		row := []string{
			u.ID.Hex(),
			name,
			u.Mobile,
			u.Email,
			rolesStr,
			u.Headline,
			u.City,
			u.VerificationStatus,
			strconv.Itoa(len(u.BookmarkedJobs)),
			regDate,
			lastActive,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (r *UserRepositoryImpl) ExportJobsCSV(ctx context.Context, status string) ([]byte, error) {
	filter := bson.M{}
	if status != "" && status != "all" {
		filter["status"] = status
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.db.DB.Collection("jobs").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var jobs []bson.M
	if err := cursor.All(ctx, &jobs); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	writer := csv.NewWriter(&buf)

	headers := []string{
		"Job ID",
		"Job Title",
		"Company",
		"City",
		"Job Type",
		"Status",
		"Salary Min (₹)",
		"Salary Max (₹)",
		"Education",
		"Min Experience (Yrs)",
		"Max Experience (Yrs)",
		"Applications Received",
		"Posted Date",
	}
	if err := writer.Write(headers); err != nil {
		return nil, err
	}

	for _, j := range jobs {
		idStr := ""
		if oid, ok := j["_id"].(primitive.ObjectID); ok {
			idStr = oid.Hex()
		}

		title, _ := j["title"].(string)
		company, _ := j["company"].(string)
		city, _ := j["city_name"].(string)
		jobType, _ := j["job_type"].(string)
		statusVal, _ := j["status"].(string)
		education, _ := j["education"].(string)

		salMin := 0
		if sm, ok := j["salary_min"].(int32); ok {
			salMin = int(sm)
		} else if sm, ok := j["salary_min"].(int64); ok {
			salMin = int(sm)
		} else if sm, ok := j["salary_min"].(float64); ok {
			salMin = int(sm)
		}

		salMax := 0
		if sm, ok := j["salary_max"].(int32); ok {
			salMax = int(sm)
		} else if sm, ok := j["salary_max"].(int64); ok {
			salMax = int(sm)
		} else if sm, ok := j["salary_max"].(float64); ok {
			salMax = int(sm)
		}

		expMin := 0
		if em, ok := j["experience_min"].(int32); ok {
			expMin = int(em)
		} else if em, ok := j["experience_min"].(int64); ok {
			expMin = int(em)
		}

		expMax := 0
		if em, ok := j["experience_max"].(int32); ok {
			expMax = int(em)
		} else if em, ok := j["experience_max"].(int64); ok {
			expMax = int(em)
		}

		var appCount int64 = 0
		if oid, ok := j["_id"].(primitive.ObjectID); ok {
			appCount, _ = r.db.DB.Collection("applications").CountDocuments(ctx, bson.M{"job_id": oid})
			if appCount == 0 {
				appCount, _ = r.db.DB.Collection("applications").CountDocuments(ctx, bson.M{"job_id": oid.Hex()})
			}
		}

		createdStr := ""
		if t, ok := j["created_at"].(primitive.DateTime); ok {
			createdStr = t.Time().Format("2006-01-02 15:04:05")
		} else if t, ok := j["created_at"].(time.Time); ok {
			createdStr = t.Format("2006-01-02 15:04:05")
		}

		row := []string{
			idStr,
			title,
			company,
			city,
			jobType,
			statusVal,
			strconv.Itoa(salMin),
			strconv.Itoa(salMax),
			education,
			strconv.Itoa(expMin),
			strconv.Itoa(expMax),
			strconv.FormatInt(appCount, 10),
			createdStr,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (r *UserRepositoryImpl) ExportRevenueCSV(ctx context.Context, status string) ([]byte, error) {
	filter := bson.M{}
	if status != "" && status != "all" {
		filter["status"] = status
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.db.DB.Collection("wallet_transactions").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var txs []bson.M
	if err := cursor.All(ctx, &txs); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	writer := csv.NewWriter(&buf)

	headers := []string{
		"Transaction ID",
		"Wallet ID",
		"User ID",
		"Type",
		"Target Balance",
		"Category",
		"Amount (₹)",
		"Balance After (₹)",
		"Status",
		"Reference ID",
		"Description",
		"Date & Time",
	}
	if err := writer.Write(headers); err != nil {
		return nil, err
	}

	for _, tx := range txs {
		idStr := ""
		if oid, ok := tx["_id"].(primitive.ObjectID); ok {
			idStr = oid.Hex()
		}

		walletID := ""
		if wid, ok := tx["wallet_id"].(primitive.ObjectID); ok {
			walletID = wid.Hex()
		}

		userID := ""
		if uid, ok := tx["user_id"].(primitive.ObjectID); ok {
			userID = uid.Hex()
		}

		txType, _ := tx["type"].(string)
		targetBal, _ := tx["target_balance"].(string)
		category, _ := tx["category"].(string)
		statusVal, _ := tx["status"].(string)
		refID, _ := tx["reference_id"].(string)
		desc, _ := tx["description"].(string)

		amount := 0.0
		if a, ok := tx["amount"].(float64); ok {
			amount = a
		} else if a, ok := tx["amount"].(int32); ok {
			amount = float64(a)
		} else if a, ok := tx["amount"].(int64); ok {
			amount = float64(a)
		}

		balAfter := 0.0
		if ba, ok := tx["balance_after"].(float64); ok {
			balAfter = ba
		} else if ba, ok := tx["balance_after"].(int32); ok {
			balAfter = float64(ba)
		} else if ba, ok := tx["balance_after"].(int64); ok {
			balAfter = float64(ba)
		}

		createdStr := ""
		if t, ok := tx["created_at"].(primitive.DateTime); ok {
			createdStr = t.Time().Format("2006-01-02 15:04:05")
		} else if t, ok := tx["created_at"].(time.Time); ok {
			createdStr = t.Format("2006-01-02 15:04:05")
		}

		row := []string{
			idStr,
			walletID,
			userID,
			txType,
			targetBal,
			category,
			fmt.Sprintf("%.2f", amount),
			fmt.Sprintf("%.2f", balAfter),
			statusVal,
			refID,
			desc,
			createdStr,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (r *UserRepositoryImpl) GlobalSearch(ctx context.Context, q string) (*GlobalSearchResponse, error) {
	q = strings.TrimSpace(q)
	res := &GlobalSearchResponse{
		Query:     q,
		Total:     0,
		Users:     []GlobalSearchResultItem{},
		Companies: []GlobalSearchResultItem{},
		Jobs:      []GlobalSearchResultItem{},
		Events:    []GlobalSearchResultItem{},
	}

	if q == "" {
		return res, nil
	}

	regexPattern := primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"}

	// 1. Search Users (limit 5)
	userFilter := bson.M{
		"$or": []bson.M{
			{"name": regexPattern},
			{"first_name": regexPattern},
			{"last_name": regexPattern},
			{"email": regexPattern},
			{"mobile": regexPattern},
			{"headline": regexPattern},
		},
	}
	userOpts := options.Find().SetLimit(5).SetProjection(bson.M{
		"_id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "mobile": 1, "roles": 1, "headline": 1, "profile_image": 1,
	})
	if userCursor, err := r.userColl.Find(ctx, userFilter, userOpts); err == nil {
		var rawUsers []bson.M
		if err := userCursor.All(ctx, &rawUsers); err == nil {
			for _, u := range rawUsers {
				idStr := ""
				if id, ok := u["_id"].(primitive.ObjectID); ok {
					idStr = id.Hex()
				}
				name, _ := u["name"].(string)
				if name == "" {
					fn, _ := u["first_name"].(string)
					ln, _ := u["last_name"].(string)
					name = strings.TrimSpace(fn + " " + ln)
				}
				if name == "" {
					name = "Platform User"
				}

				subtitle, _ := u["headline"].(string)
				if subtitle == "" {
					if em, ok := u["email"].(string); ok && em != "" {
						subtitle = em
					} else if mob, ok := u["mobile"].(string); ok && mob != "" {
						subtitle = mob
					}
				}

				badge := "Candidate"
				if roles, ok := u["roles"].(primitive.A); ok {
					for _, rItem := range roles {
						if rs, ok := rItem.(string); ok {
							if rs == "admin" {
								badge = "Admin"
								break
							} else if rs == "recruiter" {
								badge = "Recruiter"
							} else if rs == "expert" && badge != "Recruiter" {
								badge = "Expert"
							}
						}
					}
				}

				avatar, _ := u["profile_image"].(string)
				res.Users = append(res.Users, GlobalSearchResultItem{
					ID:       idStr,
					Type:     "user",
					Title:    name,
					Subtitle: subtitle,
					Badge:    badge,
					Avatar:   avatar,
					URL:      fmt.Sprintf("/admin/users?search=%s", url.QueryEscape(name)),
				})
			}
		}
	}

	// 2. Search Companies (limit 5)
	compFilter := bson.M{
		"$or": []bson.M{
			{"name": regexPattern},
			{"email": regexPattern},
			{"industry": regexPattern},
			{"website": regexPattern},
		},
	}
	compOpts := options.Find().SetLimit(5).SetProjection(bson.M{
		"_id": 1, "name": 1, "logo": 1, "industry": 1, "website": 1, "status": 1,
	})
	if compCursor, err := r.db.DB.Collection("companies").Find(ctx, compFilter, compOpts); err == nil {
		var rawComps []bson.M
		if err := compCursor.All(ctx, &rawComps); err == nil {
			for _, c := range rawComps {
				idStr := ""
				if id, ok := c["_id"].(primitive.ObjectID); ok {
					idStr = id.Hex()
				}
				cname, _ := c["name"].(string)
				if cname == "" {
					cname = "Company"
				}
				industry, _ := c["industry"].(string)
				if industry == "" {
					industry, _ = c["website"].(string)
				}
				logo, _ := c["logo"].(string)
				status, _ := c["status"].(string)
				if status == "" {
					status = "Verified"
				}
				res.Companies = append(res.Companies, GlobalSearchResultItem{
					ID:       idStr,
					Type:     "company",
					Title:    cname,
					Subtitle: industry,
					Badge:    strings.Title(status),
					Avatar:   logo,
					URL:      fmt.Sprintf("/admin/companies?search=%s", url.QueryEscape(cname)),
				})
			}
		}
	}

	// 3. Search Jobs (limit 5)
	jobFilter := bson.M{
		"$or": []bson.M{
			{"title": regexPattern},
			{"company": regexPattern},
			{"city_name": regexPattern},
			{"location": regexPattern},
			{"job_type": regexPattern},
		},
	}
	jobOpts := options.Find().SetLimit(5).SetProjection(bson.M{
		"_id": 1, "title": 1, "company": 1, "city_name": 1, "location": 1, "job_type": 1, "status": 1,
	})
	if jobCursor, err := r.db.DB.Collection("jobs").Find(ctx, jobFilter, jobOpts); err == nil {
		var rawJobs []bson.M
		if err := jobCursor.All(ctx, &rawJobs); err == nil {
			for _, j := range rawJobs {
				idStr := ""
				if id, ok := j["_id"].(primitive.ObjectID); ok {
					idStr = id.Hex()
				}
				title, _ := j["title"].(string)
				if title == "" {
					title = "Untitled Job"
				}
				company, _ := j["company"].(string)
				loc, _ := j["city_name"].(string)
				if loc == "" {
					loc, _ = j["location"].(string)
				}
				sub := company
				if loc != "" {
					if sub != "" {
						sub += " • " + loc
					} else {
						sub = loc
					}
				}
				status, _ := j["status"].(string)
				if status == "" {
					status = "Active"
				}
				res.Jobs = append(res.Jobs, GlobalSearchResultItem{
					ID:       idStr,
					Type:     "job",
					Title:    title,
					Subtitle: sub,
					Badge:    strings.Title(status),
					URL:      fmt.Sprintf("/admin/jobs?search=%s", url.QueryEscape(title)),
				})
			}
		}
	}

	// 4. Search Events (limit 3)
	eventFilter := bson.M{
		"$or": []bson.M{
			{"title": regexPattern},
			{"organizer": regexPattern},
			{"location": regexPattern},
			{"category": regexPattern},
		},
	}
	eventOpts := options.Find().SetLimit(3).SetProjection(bson.M{
		"_id": 1, "title": 1, "organizer": 1, "location": 1, "category": 1,
	})
	if eventCursor, err := r.db.DB.Collection("events").Find(ctx, eventFilter, eventOpts); err == nil {
		var rawEvents []bson.M
		if err := eventCursor.All(ctx, &rawEvents); err == nil {
			for _, e := range rawEvents {
				idStr := ""
				if id, ok := e["_id"].(primitive.ObjectID); ok {
					idStr = id.Hex()
				}
				title, _ := e["title"].(string)
				organizer, _ := e["organizer"].(string)
				category, _ := e["category"].(string)
				if category == "" {
					category = "Event"
				}
				res.Events = append(res.Events, GlobalSearchResultItem{
					ID:       idStr,
					Type:     "event",
					Title:    title,
					Subtitle: organizer,
					Badge:    category,
					URL:      fmt.Sprintf("/admin/events?search=%s", url.QueryEscape(title)),
				})
			}
		}
	}

	res.Total = len(res.Users) + len(res.Companies) + len(res.Jobs) + len(res.Events)
	return res, nil
}

