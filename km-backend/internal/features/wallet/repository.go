package wallet

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type WalletRepository interface {
	GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error)
	GetWalletByUserID(ctx context.Context, userID primitive.ObjectID) (*Wallet, error)
	UpdateBalances(ctx context.Context, userID primitive.ObjectID, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*Wallet, error)
}

type WalletRepositoryImpl struct {
	db         *database.MongodbDB
	collection *mongo.Collection
}

func NewWalletRepository(db *database.MongodbDB) WalletRepository {
	return &WalletRepositoryImpl{
		db:         db,
		collection: db.DB.Collection("wallets"),
	}
}

// GetOrCreateWallet retrieves an existing wallet or initializes a new one atomically
func (r *WalletRepositoryImpl) GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	if userID.IsZero() {
		return nil, errors.New("invalid user id")
	}

	filter := bson.M{"user_id": userID}
	now := time.Now()

	update := bson.M{
		"$setOnInsert": bson.M{
			"user_id":          userID,
			"main_balance":     0.0,
			"earnings_balance": 0.0,
			"locked_balance":   0.0,
			"bonus_balance":    0.0,
			"currency":         "INR",
			"status":           "active",
			"created_at":       now,
		},
		"$set": bson.M{
			"updated_at": now,
		},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var w Wallet
	err := r.collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&w)
	if err != nil {
		return nil, err
	}

	return &w, nil
}

// GetWalletByUserID retrieves the wallet document for a user
func (r *WalletRepositoryImpl) GetWalletByUserID(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	if userID.IsZero() {
		return nil, errors.New("invalid user id")
	}

	var w Wallet
	err := r.collection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&w)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return r.GetOrCreateWallet(ctx, userID)
		}
		return nil, err
	}

	return &w, nil
}

// UpdateBalances performs an atomic increment/decrement on the user balance buckets
func (r *WalletRepositoryImpl) UpdateBalances(ctx context.Context, userID primitive.ObjectID, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*Wallet, error) {
	if userID.IsZero() {
		return nil, errors.New("invalid user id")
	}

	incDoc := bson.M{}
	if mainDelta != 0 {
		incDoc["main_balance"] = mainDelta
	}
	if earningsDelta != 0 {
		incDoc["earnings_balance"] = earningsDelta
	}
	if lockedDelta != 0 {
		incDoc["locked_balance"] = lockedDelta
	}
	if bonusDelta != 0 {
		incDoc["bonus_balance"] = bonusDelta
	}

	if len(incDoc) == 0 {
		return r.GetWalletByUserID(ctx, userID)
	}

	filter := bson.M{"user_id": userID}
	update := bson.M{
		"$inc": incDoc,
		"$set": bson.M{"updated_at": time.Now()},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var updated Wallet
	err := r.collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updated)
	if err != nil {
		return nil, err
	}

	return &updated, nil
}
