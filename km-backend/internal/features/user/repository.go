package user

import (
	"context"
	"errors"
	"fmt"
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

	SaveOTP(ctx context.Context, otp *OTP) error
	GetLatestOTP(ctx context.Context, mobile string) (*OTP, error)
	GetLatestEmailOTP(ctx context.Context, email string) (*OTP, error)
	MarkOTPUsed(ctx context.Context, id primitive.ObjectID) error

	FindUsers(ctx context.Context, filter UserFilter) ([]*User, int64, error)
	ToggleBookmark(ctx context.Context, userID string, jobID string) ([]string, error)
	GetUserSettings(ctx context.Context, userID string) (*UserSettings, error)
	UpdateUserSettings(ctx context.Context, userID string, settings UserSettings) (*UserSettings, error)
	GetPlatformStats(ctx context.Context) (map[string]interface{}, error)
	GetLiveActivity(ctx context.Context) ([]map[string]interface{}, error)
	IncrementPostImpressions(ctx context.Context, authorCounts map[string]int) error
	FindUserByUsername(ctx context.Context, username string) (*User, error)
	BackfillUsernames(ctx context.Context) error
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

func (r *UserRepositoryImpl) UpdateUser(ctx context.Context, user *User) (*User, error) {
	user.UpdatedAt = time.Now()
	_, err := r.userColl.ReplaceOne(ctx, bson.M{"_id": user.ID}, user)
	if err != nil {
		return nil, err
	}
	return user, nil
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
		regex := bson.M{"$regex": filter.Search, "$options": "i"}
		andConditions = append(andConditions, bson.M{"$or": []bson.M{
			{"name": regex},
			{"email": regex},
			{"mobile": regex},
			{"company_name": regex},
		}})
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

	// Enforce profile visibility: exclude "private" profiles from candidate search results.
	// This ensures that users who set their profile to private are not discoverable
	// by recruiters or other users via the search/listing endpoints.
	if filter.Role == RoleUser || filter.Role == RoleExpert {
		andConditions = append(andConditions, bson.M{
			"$or": []bson.M{
				{"settings.profile_visibility": bson.M{"$exists": false}},
				{"settings.profile_visibility": ""},
				{"settings.profile_visibility": "public"},
				{"settings.profile_visibility": "connections"},
			},
		})
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
	}, nil
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

	// 3. Fetch real newly registered candidates
	userCursor, err := r.userColl.Find(ctx, bson.M{"roles": "user"}, options.Find().SetSort(bson.M{"created_at": -1}).SetLimit(6))
	if err == nil {
		var users []bson.M
		if err := userCursor.All(ctx, &users); err == nil {
			for _, item := range users {
				name := "Verified Candidate"
				if n, ok := item["name"].(string); ok && n != "" {
					name = strings.TrimSpace(strings.TrimSuffix(n, "."))
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
