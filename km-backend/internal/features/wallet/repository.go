package wallet

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type WalletRepository interface {
	GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error)
	SetWalletStatus(ctx context.Context, userID primitive.ObjectID, status string) (*Wallet, error)
	GetTransactionsByWalletID(ctx context.Context, walletID primitive.ObjectID, query TransactionQuery) ([]WalletTransaction, int64, error)
	GetTransactionByID(ctx context.Context, txID primitive.ObjectID) (*WalletTransaction, error)
	GetTransactionByReference(ctx context.Context, referenceID string) (*WalletTransaction, error)
	SetTransactionStatus(ctx context.Context, referenceID string, status TransactionStatus) error
	RecordAtomicTransaction(ctx context.Context, input RecordTransactionInput) (*WalletTransaction, *Wallet, error)
	GetUserContact(ctx context.Context, userID primitive.ObjectID) (string, string, error)
	FindUser(ctx context.Context, search string) (*UserContact, error)
	GetPayoutAccount(ctx context.Context, userID primitive.ObjectID) (*PayoutAccount, error)

	// Withdrawals
	CreateWithdrawal(ctx context.Context, withdrawal *Withdrawal) error
	GetWithdrawal(ctx context.Context, id primitive.ObjectID) (*Withdrawal, error)
	UpdateWithdrawal(ctx context.Context, id primitive.ObjectID, from []WithdrawalStatus, update WithdrawalUpdate) (bool, error)
	CountOpenWithdrawals(ctx context.Context, userID primitive.ObjectID) (int64, error)
	SumWithdrawalsSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error)
	ListWithdrawals(ctx context.Context, query WithdrawalQuery) ([]Withdrawal, int64, error)

	// Dispute operations (F73)
	CreateDispute(ctx context.Context, dispute *WalletDispute) (*WalletDispute, error)
	GetDisputeByID(ctx context.Context, id primitive.ObjectID) (*WalletDispute, error)
	GetDisputeByTransactionID(ctx context.Context, txID primitive.ObjectID) (*WalletDispute, error)
	GetDisputes(ctx context.Context, query DisputeQuery) ([]WalletDispute, int64, error)
	UpdateDispute(ctx context.Context, id primitive.ObjectID, from []DisputeStatus, update DisputeUpdate) (bool, error)

	FinanceOverview(ctx context.Context) (*FinanceOverview, error)
}

// WithdrawalUpdate is a withdrawal's move to its next status.
type WithdrawalUpdate struct {
	Status        WithdrawalStatus
	BankReference string
	FailureReason string
	HandledBy     string
	At            time.Time
}

// DisputeUpdate is a dispute's move to its next status.
type DisputeUpdate struct {
	Status      DisputeStatus
	AdminNotes  string
	RefundPaise int64
	RefundTxID  *primitive.ObjectID
	ResolvedBy  string
	ResolvedAt  *time.Time
}

type WalletRepositoryImpl struct {
	db                   *database.MongodbDB
	tx                   database.Transactor
	collection           *mongo.Collection
	txCollection         *mongo.Collection
	disputeCollection    *mongo.Collection
	withdrawalCollection *mongo.Collection
}

func NewWalletRepository(db *database.MongodbDB) WalletRepository {
	r := &WalletRepositoryImpl{
		db:                   db,
		tx:                   database.NewTransactor(db),
		collection:           db.DB.Collection("wallets"),
		txCollection:         db.DB.Collection("wallet_transactions"),
		disputeCollection:    db.DB.Collection("wallet_disputes"),
		withdrawalCollection: db.DB.Collection("wallet_withdrawals"),
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		database.SyncIndexes(ctx, r.collection, []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		})
		database.SyncIndexes(ctx, r.txCollection, []mongo.IndexModel{
			{Keys: bson.D{{Key: "wallet_id", Value: 1}, {Key: "created_at", Value: -1}}},
			{Keys: bson.D{{Key: "reference_id", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
		})
		database.SyncIndexes(ctx, r.disputeCollection, []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}},
			{Keys: bson.D{{Key: "transaction_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		})
		database.SyncIndexes(ctx, r.withdrawalCollection, []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}},
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: 1}}},
		})
	}()

	return r
}

// GetOrCreateWallet retrieves a user's wallet, creating an empty one the first time
func (r *WalletRepositoryImpl) GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	if userID.IsZero() {
		return nil, errors.New("invalid user id")
	}

	now := time.Now()
	update := bson.M{
		"$setOnInsert": bson.M{
			"main_paise":     int64(0),
			"earnings_paise": int64(0),
			"locked_paise":   int64(0),
			"bonus_paise":    int64(0),
			"currency":       "INR",
			"status":         WalletActive,
			"created_at":     now,
			"updated_at":     now,
		},
	}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)

	var w Wallet
	err := r.collection.FindOneAndUpdate(ctx, bson.M{"user_id": userID}, update, opts).Decode(&w)
	if mongo.IsDuplicateKeyError(err) { // Two first-time requests at once; the other one won
		err = r.collection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&w)
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// SetWalletStatus puts a wallet on hold or takes it off hold
func (r *WalletRepositoryImpl) SetWalletStatus(ctx context.Context, userID primitive.ObjectID, status string) (*Wallet, error) {
	if _, err := r.GetOrCreateWallet(ctx, userID); err != nil {
		return nil, err
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var w Wallet
	err := r.collection.FindOneAndUpdate(ctx,
		bson.M{"user_id": userID, "status": bson.M{"$ne": WalletClosed}},
		bson.M{"$set": bson.M{"status": status, "updated_at": time.Now()}},
		opts,
	).Decode(&w)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrClosed
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
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

	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}, {Key: "_id", Value: -1}}).
		SetSkip(int64((page - 1) * limit)).
		SetLimit(int64(limit))

	cursor, err := r.txCollection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	transactions := []WalletTransaction{}
	if err := cursor.All(ctx, &transactions); err != nil {
		return nil, 0, err
	}
	return transactions, total, nil
}

func balanceField(target TargetBalance) (string, error) {
	switch target {
	case BalanceMain:
		return "main_paise", nil
	case BalanceEarnings:
		return "earnings_paise", nil
	case BalanceLocked:
		return "locked_paise", nil
	case BalanceBonus:
		return "bonus_paise", nil
	}
	return "", fmt.Errorf("unknown wallet balance %q", target)
}

func (w *Wallet) balance(target TargetBalance) int64 {
	switch target {
	case BalanceEarnings:
		return w.EarningsPaise
	case BalanceLocked:
		return w.LockedPaise
	case BalanceBonus:
		return w.BonusPaise
	}
	return w.MainPaise
}

// RecordAtomicTransaction changes one balance and writes its ledger row together. Repeating a
// reference returns the original row and leaves the balance alone. Called inside a transaction
// it joins it, so a feature's own writes commit or roll back with the money.
func (r *WalletRepositoryImpl) RecordAtomicTransaction(ctx context.Context, input RecordTransactionInput) (*WalletTransaction, *Wallet, error) {
	if input.UserID.IsZero() {
		return nil, nil, errors.New("invalid user id")
	}
	paise := input.Paise()
	if paise <= 0 {
		return nil, nil, errors.New("amount must be greater than zero")
	}
	if input.ReferenceID == "" {
		return nil, nil, errors.New("a transaction reference is required")
	}
	if input.Type != TypeCredit && input.Type != TypeDebit {
		return nil, nil, fmt.Errorf("unknown transaction type %q", input.Type)
	}
	field, err := balanceField(input.TargetBalance)
	if err != nil {
		return nil, nil, err
	}

	var entry *WalletTransaction
	var updated *Wallet
	err = r.tx.Run(ctx, func(ctx context.Context) error {
		existing, err := r.GetTransactionByReference(ctx, input.ReferenceID)
		if err != nil {
			return err
		}
		if existing != nil {
			if existing.UserID != input.UserID || existing.AmountPaise != paise || existing.Type != input.Type || existing.TargetBalance != input.TargetBalance {
				return ErrReferenceConflict
			}
			w, err := r.GetOrCreateWallet(ctx, input.UserID)
			if err != nil {
				return err
			}
			entry, updated = existing, w
			return nil
		}

		wallet, err := r.GetOrCreateWallet(ctx, input.UserID)
		if err != nil {
			return err
		}
		if err := checkWalletCanPost(wallet.Status, input); err != nil {
			return err
		}

		now := time.Now()
		delta := paise
		filter := bson.M{"_id": wallet.ID}
		if input.Type == TypeDebit {
			delta = -paise
			filter[field] = bson.M{"$gte": paise} // Never below zero
		}

		var w Wallet
		err = r.collection.FindOneAndUpdate(ctx, filter,
			bson.M{"$inc": bson.M{field: delta}, "$set": bson.M{"updated_at": now}},
			options.FindOneAndUpdate().SetReturnDocument(options.After),
		).Decode(&w)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrInsufficient
		}
		if err != nil {
			return err
		}

		status := input.Status
		if status == "" {
			status = StatusCompleted
		}
		row := &WalletTransaction{
			ID:                primitive.NewObjectID(),
			WalletID:          w.ID,
			UserID:            input.UserID,
			Type:              input.Type,
			TargetBalance:     input.TargetBalance,
			Category:          input.Category,
			AmountPaise:       paise,
			BalanceAfterPaise: w.balance(input.TargetBalance),
			Status:            status,
			ReferenceID:       input.ReferenceID,
			Description:       input.Description,
			Metadata:          input.Metadata,
			CreatedAt:         now,
		}
		if _, err := r.txCollection.InsertOne(ctx, row); err != nil {
			return err
		}
		entry, updated = row, &w
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return entry, updated, nil
}

// checkWalletCanPost enforces wallet status. A held wallet can still receive money and settle
// escrow; it just can't spend or withdraw.
func checkWalletCanPost(status string, input RecordTransactionInput) error {
	switch status {
	case WalletClosed:
		return ErrClosed
	case WalletFrozen, WalletSuspended:
		if input.Type == TypeDebit && input.TargetBalance != BalanceLocked {
			return ErrFrozen
		}
	}
	return nil
}

// GetUserContact retrieves the registered email and display name for a given user ID
func (r *WalletRepositoryImpl) GetUserContact(ctx context.Context, userID primitive.ObjectID) (string, string, error) {
	var u userDoc
	err := r.db.DB.Collection("users").FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	if err != nil {
		return "", "", err
	}
	name := u.displayName()
	if name == "" {
		name = "Valued Expert"
	}
	return u.Email, name, nil
}

type userDoc struct {
	ID        primitive.ObjectID `bson:"_id"`
	Email     string             `bson:"email"`
	Mobile    string             `bson:"mobile"`
	Name      string             `bson:"name"`
	FirstName string             `bson:"first_name"`
	LastName  string             `bson:"last_name"`
}

func (u userDoc) displayName() string {
	name := strings.TrimSpace(u.Name)
	if name == "" {
		name = strings.TrimSpace(u.FirstName + " " + u.LastName)
	}
	return name
}

// FindUser looks a user up by id, exact email or mobile number
func (r *WalletRepositoryImpl) FindUser(ctx context.Context, search string) (*UserContact, error) {
	search = strings.TrimSpace(search)
	filter := bson.M{"$or": []bson.M{
		{"email": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(search) + "$", Options: "i"}},
		{"mobile": search},
	}}
	if id, err := primitive.ObjectIDFromHex(search); err == nil {
		filter = bson.M{"_id": id}
	}

	var u userDoc
	err := r.db.DB.Collection("users").FindOne(ctx, filter).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &UserContact{ID: u.ID, Name: u.displayName(), Email: u.Email, Mobile: u.Mobile}, nil
}

// GetPayoutAccount reads the payout details from a user's Expert KYC. It reads the users
// collection directly because the user feature can't be imported from here.
func (r *WalletRepositoryImpl) GetPayoutAccount(ctx context.Context, userID primitive.ObjectID) (*PayoutAccount, error) {
	var u struct {
		Status string `bson:"expert_approval_status"`
		KYC    *struct {
			PayoutMethod  string `bson:"payout_method"`
			AccountHolder string `bson:"account_holder"`
			AccountNumber string `bson:"account_number"`
			AccountLast4  string `bson:"account_last4"`
			IFSC          string `bson:"ifsc"`
			UPIID         string `bson:"upi_id"`
		} `bson:"expert_kyc"`
	}
	err := r.db.DB.Collection("users").FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return &PayoutAccount{}, nil
	}
	if err != nil {
		return nil, err
	}
	if u.KYC == nil {
		return &PayoutAccount{}, nil
	}
	return &PayoutAccount{
		Approved:      u.Status == "approved",
		Method:        u.KYC.PayoutMethod,
		AccountHolder: u.KYC.AccountHolder,
		AccountNumber: u.KYC.AccountNumber,
		AccountLast4:  u.KYC.AccountLast4,
		IFSC:          u.KYC.IFSC,
		UPIID:         u.KYC.UPIID,
	}, nil
}

// GetTransactionByID fetches a single wallet transaction by its ID
func (r *WalletRepositoryImpl) GetTransactionByID(ctx context.Context, txID primitive.ObjectID) (*WalletTransaction, error) {
	var tx WalletTransaction
	err := r.txCollection.FindOne(ctx, bson.M{"_id": txID}).Decode(&tx)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &tx, nil
}

// GetTransactionByReference fetches the ledger row for a reference, or nil
func (r *WalletRepositoryImpl) GetTransactionByReference(ctx context.Context, referenceID string) (*WalletTransaction, error) {
	var tx WalletTransaction
	err := r.txCollection.FindOne(ctx, bson.M{"reference_id": referenceID}).Decode(&tx)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

// SetTransactionStatus records how a pending ledger row ended. The amount never changes.
func (r *WalletRepositoryImpl) SetTransactionStatus(ctx context.Context, referenceID string, status TransactionStatus) error {
	_, err := r.txCollection.UpdateOne(ctx, bson.M{"reference_id": referenceID}, bson.M{"$set": bson.M{"status": status}})
	return err
}

// CreateWithdrawal saves a new payout request
func (r *WalletRepositoryImpl) CreateWithdrawal(ctx context.Context, withdrawal *Withdrawal) error {
	_, err := r.withdrawalCollection.InsertOne(ctx, withdrawal)
	return err
}

// GetWithdrawal fetches a payout request, or nil
func (r *WalletRepositoryImpl) GetWithdrawal(ctx context.Context, id primitive.ObjectID) (*Withdrawal, error) {
	var w Withdrawal
	err := r.withdrawalCollection.FindOne(ctx, bson.M{"_id": id}).Decode(&w)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w.Amount = money.ToRupees(w.AmountPaise)
	return &w, nil
}

// UpdateWithdrawal moves a withdrawal on, only if it's still in one of the expected states
func (r *WalletRepositoryImpl) UpdateWithdrawal(ctx context.Context, id primitive.ObjectID, from []WithdrawalStatus, update WithdrawalUpdate) (bool, error) {
	set := bson.M{"status": update.Status, "updated_at": update.At, "handled_by": update.HandledBy}
	switch update.Status {
	case WithdrawalProcessing:
		set["processing_at"] = update.At
	case WithdrawalPaid:
		set["paid_at"] = update.At
		set["bank_reference"] = update.BankReference
	case WithdrawalFailed:
		set["failed_at"] = update.At
		set["failure_reason"] = update.FailureReason
	}
	res, err := r.withdrawalCollection.UpdateOne(ctx, bson.M{"_id": id, "status": bson.M{"$in": from}}, bson.M{"$set": set})
	if err != nil {
		return false, err
	}
	return res.ModifiedCount == 1, nil
}

// CountOpenWithdrawals counts a user's withdrawals that haven't finished
func (r *WalletRepositoryImpl) CountOpenWithdrawals(ctx context.Context, userID primitive.ObjectID) (int64, error) {
	return r.withdrawalCollection.CountDocuments(ctx, bson.M{
		"user_id": userID,
		"status":  bson.M{"$in": []WithdrawalStatus{WithdrawalRequested, WithdrawalProcessing}},
	})
}

// SumWithdrawalsSince adds up a user's withdrawals since a moment, leaving out failed ones
func (r *WalletRepositoryImpl) SumWithdrawalsSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error) {
	cursor, err := r.withdrawalCollection.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"user_id": userID, "status": bson.M{"$ne": WithdrawalFailed}, "created_at": bson.M{"$gte": since}}}},
		{{Key: "$group", Value: bson.M{"_id": nil, "total": bson.M{"$sum": "$amount_paise"}}}},
	})
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Total int64 `bson:"total"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Total, nil
}

// ListWithdrawals returns withdrawals, newest first
func (r *WalletRepositoryImpl) ListWithdrawals(ctx context.Context, query WithdrawalQuery) ([]Withdrawal, int64, error) {
	filter := bson.M{}
	if query.Status != "" {
		filter["status"] = query.Status
	}
	if query.UserID != nil {
		filter["user_id"] = *query.UserID
	}
	total, err := r.withdrawalCollection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	cursor, err := r.withdrawalCollection.Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((query.Page-1)*query.Limit)).
		SetLimit(int64(query.Limit)))
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	list := []Withdrawal{}
	if err := cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	for i := range list {
		list[i].Amount = money.ToRupees(list[i].AmountPaise)
	}
	return list, total, nil
}

func hydrateDispute(d *WalletDispute) {
	d.Amount = money.ToRupees(d.AmountPaise)
	d.RefundAmount = money.ToRupees(d.RefundPaise)
}

// CreateDispute saves a new dispute record into MongoDB
func (r *WalletRepositoryImpl) CreateDispute(ctx context.Context, dispute *WalletDispute) (*WalletDispute, error) {
	if dispute.ID.IsZero() {
		dispute.ID = primitive.NewObjectID()
	}
	dispute.CreatedAt = time.Now()
	dispute.UpdatedAt = dispute.CreatedAt

	if _, err := r.disputeCollection.InsertOne(ctx, dispute); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, ErrDisputeExists
		}
		return nil, err
	}
	hydrateDispute(dispute)
	return dispute, nil
}

// GetDisputeByID retrieves a dispute by its primary key, or nil
func (r *WalletRepositoryImpl) GetDisputeByID(ctx context.Context, id primitive.ObjectID) (*WalletDispute, error) {
	var dispute WalletDispute
	err := r.disputeCollection.FindOne(ctx, bson.M{"_id": id}).Decode(&dispute)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	hydrateDispute(&dispute)
	return &dispute, nil
}

// GetDisputeByTransactionID checks if a dispute already exists for a transaction
func (r *WalletRepositoryImpl) GetDisputeByTransactionID(ctx context.Context, txID primitive.ObjectID) (*WalletDispute, error) {
	var dispute WalletDispute
	err := r.disputeCollection.FindOne(ctx, bson.M{"transaction_id": txID}).Decode(&dispute)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	hydrateDispute(&dispute)
	return &dispute, nil
}

// GetDisputes returns paginated disputes filtered by status or user
func (r *WalletRepositoryImpl) GetDisputes(ctx context.Context, query DisputeQuery) ([]WalletDispute, int64, error) {
	filter := bson.M{}
	if query.Status != "" {
		filter["status"] = query.Status
	}
	if query.UserID != "" {
		if uid, err := primitive.ObjectIDFromHex(query.UserID); err == nil {
			filter["user_id"] = uid
		}
	}

	total, err := r.disputeCollection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	findOpts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((query.Page - 1) * query.Limit)).
		SetLimit(int64(query.Limit))

	cursor, err := r.disputeCollection.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	disputes := []WalletDispute{}
	if err := cursor.All(ctx, &disputes); err != nil {
		return nil, 0, err
	}
	for i := range disputes {
		hydrateDispute(&disputes[i])
	}
	return disputes, total, nil
}

// UpdateDispute moves a dispute on, only if it's still in one of the expected states
func (r *WalletRepositoryImpl) UpdateDispute(ctx context.Context, id primitive.ObjectID, from []DisputeStatus, update DisputeUpdate) (bool, error) {
	set := bson.M{"status": update.Status, "updated_at": time.Now()}
	if update.AdminNotes != "" {
		set["admin_notes"] = update.AdminNotes
	}
	if update.RefundPaise > 0 {
		set["refund_paise"] = update.RefundPaise
	}
	if update.RefundTxID != nil {
		set["refund_transaction_id"] = *update.RefundTxID
	}
	if update.ResolvedBy != "" {
		set["resolved_by"] = update.ResolvedBy
	}
	if update.ResolvedAt != nil {
		set["resolved_at"] = *update.ResolvedAt
	}
	res, err := r.disputeCollection.UpdateOne(ctx, bson.M{"_id": id, "status": bson.M{"$in": from}}, bson.M{"$set": set})
	if err != nil {
		return false, err
	}
	return res.MatchedCount == 1, nil
}

const maxMismatchesShown = 50

// FinanceOverview adds up every balance and checks each one against its ledger. Every ledger row
// moved a balance, whatever its status, so all rows count.
func (r *WalletRepositoryImpl) FinanceOverview(ctx context.Context) (*FinanceOverview, error) {
	cursor, err := r.collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	var wallets []Wallet
	if err := cursor.All(ctx, &wallets); err != nil {
		return nil, err
	}

	ledger, err := r.txCollection.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id": bson.M{"wallet": "$wallet_id", "balance": "$target_balance"},
			"net": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$eq": bson.A{"$type", TypeCredit}},
				"$amount_paise",
				bson.M{"$multiply": bson.A{"$amount_paise", -1}},
			}}},
		}}},
	})
	if err != nil {
		return nil, err
	}
	var rows []struct {
		ID struct {
			Wallet  primitive.ObjectID `bson:"wallet"`
			Balance TargetBalance      `bson:"balance"`
		} `bson:"_id"`
		Net int64 `bson:"net"`
	}
	if err := ledger.All(ctx, &rows); err != nil {
		return nil, err
	}
	computed := make(map[string]int64, len(rows))
	for _, row := range rows {
		computed[row.ID.Wallet.Hex()+string(row.ID.Balance)] = row.Net
	}

	var main, earnings, locked, bonus int64
	overview := &FinanceOverview{Wallets: int64(len(wallets)), Mismatches: []BalanceMismatch{}}
	for i := range wallets {
		w := &wallets[i]
		main += w.MainPaise
		earnings += w.EarningsPaise
		locked += w.LockedPaise
		bonus += w.BonusPaise
		for _, target := range []TargetBalance{BalanceMain, BalanceEarnings, BalanceLocked, BalanceBonus} {
			stored, net := w.balance(target), computed[w.ID.Hex()+string(target)]
			if stored == net {
				continue
			}
			overview.MismatchesTotal++
			if len(overview.Mismatches) < maxMismatchesShown {
				overview.Mismatches = append(overview.Mismatches, BalanceMismatch{
					UserID:   w.UserID.Hex(),
					Balance:  target,
					Stored:   money.ToRupees(stored),
					Computed: money.ToRupees(net),
				})
			}
		}
	}
	overview.MainBalance = money.ToRupees(main)
	overview.EarningsBalance = money.ToRupees(earnings)
	overview.LockedBalance = money.ToRupees(locked)
	overview.BonusBalance = money.ToRupees(bonus)

	open := []WithdrawalStatus{WithdrawalRequested, WithdrawalProcessing}
	if overview.OpenWithdrawals, err = r.withdrawalCollection.CountDocuments(ctx, bson.M{"status": bson.M{"$in": open}}); err != nil {
		return nil, err
	}
	openCursor, err := r.withdrawalCollection.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"status": bson.M{"$in": open}}}},
		{{Key: "$group", Value: bson.M{"_id": nil, "total": bson.M{"$sum": "$amount_paise"}}}},
	})
	if err != nil {
		return nil, err
	}
	var openRows []struct {
		Total int64 `bson:"total"`
	}
	if err := openCursor.All(ctx, &openRows); err != nil {
		return nil, err
	}
	if len(openRows) > 0 {
		overview.OpenWithdrawalSum = money.ToRupees(openRows[0].Total)
	}
	if overview.OpenDisputes, err = r.disputeCollection.CountDocuments(ctx, bson.M{"status": bson.M{"$in": []DisputeStatus{DisputeStatusPending, DisputeStatusUnderReview}}}); err != nil {
		return nil, err
	}
	return overview, nil
}
