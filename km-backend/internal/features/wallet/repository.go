package wallet

import (
	"context"
	"errors"
	"strings"
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
	CreateTransaction(ctx context.Context, tx *WalletTransaction) error
	GetTransactionsByWalletID(ctx context.Context, walletID primitive.ObjectID, query TransactionQuery) ([]WalletTransaction, int64, error)
	RecordAtomicTransaction(ctx context.Context, input RecordTransactionInput) (*WalletTransaction, *Wallet, error)
	GetUserContact(ctx context.Context, userID primitive.ObjectID) (string, string, error)
}

type WalletRepositoryImpl struct {
	db           *database.MongodbDB
	collection   *mongo.Collection
	txCollection *mongo.Collection
}

func NewWalletRepository(db *database.MongodbDB) WalletRepository {
	txColl := db.DB.Collection("wallet_transactions")

	// Ensure indexes for wallet transactions in background
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// Compound index: wallet_id + created_at desc
		_, _ = txColl.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys: bson.D{
				{Key: "wallet_id", Value: 1},
				{Key: "created_at", Value: -1},
			},
			Options: options.Index().SetName("idx_wallet_transactions_wallet_date"),
		})

		// Unique sparse index on reference_id (for payment idempotency)
		sparse := true
		unique := true
		_, _ = txColl.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys: bson.D{{Key: "reference_id", Value: 1}},
			Options: &options.IndexOptions{
				Name:   &[]string{"idx_wallet_transactions_ref_id"}[0],
				Unique: &unique,
				Sparse: &sparse,
			},
		})
	}()

	return &WalletRepositoryImpl{
		db:           db,
		collection:   db.DB.Collection("wallets"),
		txCollection: txColl,
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

// CreateTransaction inserts a new immutable transaction ledger document
func (r *WalletRepositoryImpl) CreateTransaction(ctx context.Context, tx *WalletTransaction) error {
	if tx == nil {
		return errors.New("cannot create nil transaction")
	}
	if tx.CreatedAt.IsZero() {
		tx.CreatedAt = time.Now()
	}
	if tx.Status == "" {
		tx.Status = StatusCompleted
	}

	result, err := r.txCollection.InsertOne(ctx, tx)
	if err != nil {
		return err
	}
	if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
		tx.ID = oid
	}
	return nil
}

// GetTransactionsByWalletID retrieves paginated transactions for a wallet matching optional filters
func (r *WalletRepositoryImpl) GetTransactionsByWalletID(ctx context.Context, walletID primitive.ObjectID, query TransactionQuery) ([]WalletTransaction, int64, error) {
	if walletID.IsZero() {
		return nil, 0, errors.New("invalid wallet id")
	}

	filter := bson.M{"wallet_id": walletID}
	if query.Type != "" {
		filter["type"] = query.Type
	}
	if query.Category != "" {
		filter["category"] = query.Category
	}
	if query.TargetBalance != "" {
		filter["target_balance"] = query.TargetBalance
	}

	total, err := r.txCollection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	limit := query.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}
	skip := int64((page - 1) * limit)

	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cursor, err := r.txCollection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var transactions []WalletTransaction
	if err := cursor.All(ctx, &transactions); err != nil {
		return nil, 0, err
	}

	return transactions, total, nil
}

// RecordAtomicTransaction safely updates the target balance bucket and logs the transaction atomically
func (r *WalletRepositoryImpl) RecordAtomicTransaction(ctx context.Context, input RecordTransactionInput) (*WalletTransaction, *Wallet, error) {
	if input.UserID.IsZero() {
		return nil, nil, errors.New("invalid user id")
	}
	if input.Amount <= 0 {
		return nil, nil, errors.New("amount must be greater than zero")
	}

	targetField := "main_balance"
	switch input.TargetBalance {
	case BalanceEarnings:
		targetField = "earnings_balance"
	case BalanceLocked:
		targetField = "locked_balance"
	case BalanceBonus:
		targetField = "bonus_balance"
	default:
		input.TargetBalance = BalanceMain
		targetField = "main_balance"
	}

	// Ensure wallet exists
	wallet, err := r.GetOrCreateWallet(ctx, input.UserID)
	if err != nil {
		return nil, nil, err
	}

	delta := input.Amount
	filter := bson.M{"_id": wallet.ID}

	if input.Type == TypeDebit {
		delta = -input.Amount
		// Concurrency protection: only debit if target balance is >= amount
		filter[targetField] = bson.M{"$gte": input.Amount}
	} else {
		input.Type = TypeCredit
	}

	update := bson.M{
		"$inc": bson.M{targetField: delta},
		"$set": bson.M{"updated_at": time.Now()},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updatedWallet Wallet
	err = r.collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updatedWallet)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil, errors.New("insufficient balance for transaction")
		}
		return nil, nil, err
	}

	// Determine the new balance of the affected bucket
	var balanceAfter float64
	switch input.TargetBalance {
	case BalanceEarnings:
		balanceAfter = updatedWallet.EarningsBalance
	case BalanceLocked:
		balanceAfter = updatedWallet.LockedBalance
	case BalanceBonus:
		balanceAfter = updatedWallet.BonusBalance
	default:
		balanceAfter = updatedWallet.MainBalance
	}

	tx := &WalletTransaction{
		WalletID:      updatedWallet.ID,
		UserID:        input.UserID,
		Type:          input.Type,
		TargetBalance: input.TargetBalance,
		Category:      input.Category,
		Amount:        input.Amount,
		BalanceAfter:  balanceAfter,
		Status:        StatusCompleted,
		ReferenceID:   input.ReferenceID,
		Description:   input.Description,
		Metadata:      input.Metadata,
		CreatedAt:     time.Now(),
	}

	if err := r.CreateTransaction(ctx, tx); err != nil {
		return nil, &updatedWallet, err
	}

	return tx, &updatedWallet, nil
}

// GetUserContact retrieves the registered email and display name for a given user ID
func (r *WalletRepositoryImpl) GetUserContact(ctx context.Context, userID primitive.ObjectID) (string, string, error) {
	var u struct {
		Email     string `bson:"email"`
		Name      string `bson:"name"`
		FirstName string `bson:"first_name"`
		LastName  string `bson:"last_name"`
	}
	err := r.db.DB.Collection("users").FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	if err != nil {
		return "", "", err
	}
	fullName := strings.TrimSpace(u.Name)
	if fullName == "" {
		fullName = strings.TrimSpace(u.FirstName + " " + u.LastName)
	}
	if fullName == "" {
		fullName = "Valued Expert"
	}
	return u.Email, fullName, nil
}

