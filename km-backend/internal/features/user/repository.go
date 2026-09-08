package user

import (
	"context"
	"errors"
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
}

type UserRepositoryImpl struct {
	db       *database.MongodbDB
	userColl *mongo.Collection
	otpColl  *mongo.Collection
}

func NewUserRepository(db *database.MongodbDB) UserRepository {
	return &UserRepositoryImpl{
		db:       db,
		userColl: db.DB.Collection("users"),
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
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var user User
	err = r.userColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&user)
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
