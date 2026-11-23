package wallet

import (
	"context"
	"encoding/json"
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
	"gorm.io/gorm"
)

type WalletRepository interface {
	GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error)
	// LockWallet reads the wallet and locks it until the transaction ends
	LockWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error)
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

// WalletRepositoryImpl keeps money in Postgres. Users (names, emails, KYC) stay in MongoDB and
// are only read from here.
type WalletRepositoryImpl struct {
	pg    *gorm.DB
	tx    *database.PgTransactor
	users *mongo.Collection
}

func NewWalletRepository(pg *database.PostgresDB, tx *database.PgTransactor, db *database.MongodbDB) WalletRepository {
	return &WalletRepositoryImpl{pg: pg.DB, tx: tx, users: db.DB.Collection("users")}
}

func (r *WalletRepositoryImpl) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

// ---------------------------------------------------------------------------------------------
// Row types: how each table is stored. Domain structs stay free of database details.
// ---------------------------------------------------------------------------------------------

type walletRow struct {
	ID            string
	UserID        string
	MainPaise     int64
	EarningsPaise int64
	LockedPaise   int64
	BonusPaise    int64
	Currency      string
	Status        string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (w walletRow) toDomain() *Wallet {
	return &Wallet{
		ID:            database.OID(w.ID),
		UserID:        database.OID(w.UserID),
		MainPaise:     w.MainPaise,
		EarningsPaise: w.EarningsPaise,
		LockedPaise:   w.LockedPaise,
		BonusPaise:    w.BonusPaise,
		Currency:      strings.TrimSpace(w.Currency),
		Status:        w.Status,
		CreatedAt:     w.CreatedAt,
		UpdatedAt:     w.UpdatedAt,
	}
}

type txRow struct {
	ID                string
	WalletID          string
	UserID            string
	Type              string
	TargetBalance     string
	Category          string
	AmountPaise       int64
	BalanceAfterPaise int64
	Status            string
	ReferenceID       string
	Description       string
	Metadata          []byte
	CreatedAt         time.Time
}

func (t txRow) toDomain() (*WalletTransaction, error) {
	out := &WalletTransaction{
		ID:                database.OID(t.ID),
		WalletID:          database.OID(t.WalletID),
		UserID:            database.OID(t.UserID),
		Type:              TransactionType(t.Type),
		TargetBalance:     TargetBalance(t.TargetBalance),
		Category:          TransactionCategory(t.Category),
		AmountPaise:       t.AmountPaise,
		BalanceAfterPaise: t.BalanceAfterPaise,
		Status:            TransactionStatus(t.Status),
		ReferenceID:       t.ReferenceID,
		Description:       t.Description,
		CreatedAt:         t.CreatedAt,
	}
	if len(t.Metadata) > 0 {
		if err := json.Unmarshal(t.Metadata, &out.Metadata); err != nil {
			return nil, fmt.Errorf("reading ledger metadata: %w", err)
		}
	}
	return out, nil
}

func txRowsToDomain(rows []txRow) ([]WalletTransaction, error) {
	out := make([]WalletTransaction, 0, len(rows))
	for _, row := range rows {
		t, err := row.toDomain()
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, nil
}

type withdrawalRow struct {
	ID            string
	UserID        string
	AmountPaise   int64
	Status        string
	PayoutMethod  string
	AccountHolder string
	AccountLast4  *string
	IFSC          *string
	UPIID         *string `gorm:"column:upi_id"`
	ReferenceID   string
	BankReference *string
	FailureReason *string
	HandledBy     *string
	CreatedAt     time.Time
	ProcessingAt  *time.Time
	PaidAt        *time.Time
	FailedAt      *time.Time
	UpdatedAt     time.Time
}

func (w withdrawalRow) toDomain() Withdrawal {
	return Withdrawal{
		ID:            database.OID(w.ID),
		UserID:        database.OID(w.UserID),
		AmountPaise:   w.AmountPaise,
		Amount:        money.ToRupees(w.AmountPaise),
		Status:        WithdrawalStatus(w.Status),
		PayoutMethod:  w.PayoutMethod,
		AccountHolder: w.AccountHolder,
		AccountLast4:  deref(w.AccountLast4),
		IFSC:          deref(w.IFSC),
		UPIID:         deref(w.UPIID),
		ReferenceID:   w.ReferenceID,
		BankReference: deref(w.BankReference),
		FailureReason: deref(w.FailureReason),
		HandledBy:     deref(w.HandledBy),
		CreatedAt:     w.CreatedAt,
		ProcessingAt:  w.ProcessingAt,
		PaidAt:        w.PaidAt,
		FailedAt:      w.FailedAt,
		UpdatedAt:     w.UpdatedAt,
	}
}

type disputeRow struct {
	ID                  string
	UserID              string
	UserName            string
	UserEmail           string
	TransactionID       string
	ReferenceID         string
	AmountPaise         int64
	RefundPaise         int64
	TargetBalance       string
	Category            string
	Reason              string
	Description         string
	Status              string
	AdminNotes          *string
	RefundTransactionID *string
	ResolvedBy          *string
	ResolvedAt          *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func (d disputeRow) toDomain() WalletDispute {
	out := WalletDispute{
		ID:            database.OID(d.ID),
		UserID:        database.OID(d.UserID),
		UserName:      d.UserName,
		UserEmail:     d.UserEmail,
		TransactionID: database.OID(d.TransactionID),
		ReferenceID:   d.ReferenceID,
		AmountPaise:   d.AmountPaise,
		Amount:        money.ToRupees(d.AmountPaise),
		RefundPaise:   d.RefundPaise,
		RefundAmount:  money.ToRupees(d.RefundPaise),
		TargetBalance: TargetBalance(d.TargetBalance),
		Category:      TransactionCategory(d.Category),
		Reason:        DisputeReason(d.Reason),
		Description:   d.Description,
		Status:        DisputeStatus(d.Status),
		AdminNotes:    deref(d.AdminNotes),
		ResolvedBy:    deref(d.ResolvedBy),
		ResolvedAt:    d.ResolvedAt,
		CreatedAt:     d.CreatedAt,
		UpdatedAt:     d.UpdatedAt,
	}
	if d.RefundTransactionID != nil {
		id := database.OID(*d.RefundTransactionID)
		out.RefundTransactionID = &id
	}
	return out
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// nullable stores "" as NULL
func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func pageOffset(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return limit, (page - 1) * limit
}

// ---------------------------------------------------------------------------------------------
// Wallets and the ledger
// ---------------------------------------------------------------------------------------------

const walletColumns = `id, user_id, main_paise, earnings_paise, locked_paise, bonus_paise, currency, status, created_at, updated_at`

// GetOrCreateWallet retrieves a user's wallet, creating an empty one the first time
func (r *WalletRepositoryImpl) GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	return r.getOrCreate(ctx, userID, false)
}

func (r *WalletRepositoryImpl) LockWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	return r.getOrCreate(ctx, userID, true)
}

// getOrCreate optionally locks the row (FOR UPDATE) so balance changes on one wallet run one at a time.
func (r *WalletRepositoryImpl) getOrCreate(ctx context.Context, userID primitive.ObjectID, lock bool) (*Wallet, error) {
	if userID.IsZero() {
		return nil, errors.New("invalid user id")
	}
	db := r.conn(ctx)
	// Two first-time requests at once: one inserts, the other does nothing and reads it
	if err := db.Exec(`INSERT INTO wallets (id, user_id) VALUES (?, ?) ON CONFLICT (user_id) DO NOTHING`,
		primitive.NewObjectID().Hex(), userID.Hex()).Error; err != nil {
		return nil, err
	}
	q := `SELECT ` + walletColumns + ` FROM wallets WHERE user_id = ?`
	if lock {
		q += ` FOR UPDATE`
	}
	var row walletRow
	if err := db.Raw(q, userID.Hex()).Scan(&row).Error; err != nil {
		return nil, err
	}
	if row.ID == "" {
		return nil, ErrWalletNotFound
	}
	return row.toDomain(), nil
}

// SetWalletStatus puts a wallet on hold or takes it off hold
func (r *WalletRepositoryImpl) SetWalletStatus(ctx context.Context, userID primitive.ObjectID, status string) (*Wallet, error) {
	if _, err := r.GetOrCreateWallet(ctx, userID); err != nil {
		return nil, err
	}
	var rows []walletRow
	err := r.conn(ctx).Raw(`UPDATE wallets SET status = ? WHERE user_id = ? AND status <> 'closed' RETURNING `+walletColumns,
		status, userID.Hex()).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrClosed
	}
	return rows[0].toDomain(), nil
}

const txColumns = `id, wallet_id, user_id, type, target_balance, category, amount_paise, balance_after_paise, status, reference_id, description, metadata, created_at`

// GetTransactionsByWalletID retrieves paginated transactions for a wallet matching optional filters
func (r *WalletRepositoryImpl) GetTransactionsByWalletID(ctx context.Context, walletID primitive.ObjectID, query TransactionQuery) ([]WalletTransaction, int64, error) {
	if walletID.IsZero() {
		return nil, 0, errors.New("invalid wallet id")
	}
	q := r.conn(ctx).Table("wallet_transactions").Where("wallet_id = ?", walletID.Hex())
	if query.Type != "" {
		q = q.Where("type = ?", string(query.Type))
	}
	if query.Category != "" {
		q = q.Where("category = ?", string(query.Category))
	}
	if query.TargetBalance != "" {
		q = q.Where("target_balance = ?", string(query.TargetBalance))
	}

	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	limit, offset := pageOffset(query.Page, query.Limit)
	var rows []txRow
	if err := q.Select(txColumns).Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	list, err := txRowsToDomain(rows)
	return list, total, err
}

func balanceColumn(target TargetBalance) (string, error) {
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
//
// The wallet row is locked first, so postings to one wallet run one after another: the
// "already posted?" check and the balance change can't interleave with another request.
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
	column, err := balanceColumn(input.TargetBalance)
	if err != nil {
		return nil, nil, err
	}
	var metadata []byte
	if len(input.Metadata) > 0 {
		if metadata, err = json.Marshal(input.Metadata); err != nil {
			return nil, nil, fmt.Errorf("saving ledger metadata: %w", err)
		}
	}

	var entry *WalletTransaction
	var updated *Wallet
	err = r.tx.Run(ctx, func(ctx context.Context) error {
		wallet, err := r.getOrCreate(ctx, input.UserID, true)
		if err != nil {
			return err
		}

		existing, err := r.GetTransactionByReference(ctx, input.ReferenceID)
		if err != nil {
			return err
		}
		if existing != nil {
			if existing.UserID != input.UserID || existing.AmountPaise != paise || existing.Type != input.Type || existing.TargetBalance != input.TargetBalance {
				return ErrReferenceConflict
			}
			entry, updated = existing, wallet
			return nil
		}

		if err := checkWalletCanPost(wallet.Status, input); err != nil {
			return err
		}

		delta := paise
		if input.Type == TypeDebit {
			if wallet.balance(input.TargetBalance) < paise {
				return ErrInsufficient // Never below zero (the table's CHECK is the last line of defence)
			}
			delta = -paise
		}

		db := r.conn(ctx)
		var rows []walletRow
		if err := db.Raw(`UPDATE wallets SET `+column+` = `+column+` + ? WHERE id = ? RETURNING `+walletColumns,
			delta, wallet.ID.Hex()).Scan(&rows).Error; err != nil {
			return err
		}
		if len(rows) != 1 {
			return ErrWalletNotFound
		}
		w := rows[0].toDomain()

		status := input.Status
		if status == "" {
			status = StatusCompleted
		}
		row := txRow{
			ID:                primitive.NewObjectID().Hex(),
			WalletID:          w.ID.Hex(),
			UserID:            input.UserID.Hex(),
			Type:              string(input.Type),
			TargetBalance:     string(input.TargetBalance),
			Category:          string(input.Category),
			AmountPaise:       paise,
			BalanceAfterPaise: w.balance(input.TargetBalance),
			Status:            string(status),
			ReferenceID:       input.ReferenceID,
			Description:       input.Description,
			Metadata:          metadata,
		}
		var inserted []txRow
		err = db.Raw(`INSERT INTO wallet_transactions
			(id, wallet_id, user_id, type, target_balance, category, amount_paise, balance_after_paise, status, reference_id, description, metadata)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING `+txColumns,
			row.ID, row.WalletID, row.UserID, row.Type, row.TargetBalance, row.Category, row.AmountPaise,
			row.BalanceAfterPaise, row.Status, row.ReferenceID, row.Description, row.Metadata).Scan(&inserted).Error
		if database.PgErrCode(err) == database.PgUniqueViolation {
			return ErrReferenceConflict // Same reference already used on another wallet
		}
		if err != nil {
			return err
		}
		if entry, err = inserted[0].toDomain(); err != nil {
			return err
		}
		updated = w
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

func (r *WalletRepositoryImpl) oneTx(ctx context.Context, where string, arg interface{}) (*WalletTransaction, error) {
	var rows []txRow
	if err := r.conn(ctx).Raw(`SELECT `+txColumns+` FROM wallet_transactions WHERE `+where+` = ?`, arg).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0].toDomain()
}

// GetTransactionByID fetches a single wallet transaction by its ID
func (r *WalletRepositoryImpl) GetTransactionByID(ctx context.Context, txID primitive.ObjectID) (*WalletTransaction, error) {
	return r.oneTx(ctx, "id", txID.Hex())
}

// GetTransactionByReference fetches the ledger row for a reference, or nil
func (r *WalletRepositoryImpl) GetTransactionByReference(ctx context.Context, referenceID string) (*WalletTransaction, error) {
	return r.oneTx(ctx, "reference_id", referenceID)
}

// SetTransactionStatus records how a pending ledger row ended. The amount never changes.
func (r *WalletRepositoryImpl) SetTransactionStatus(ctx context.Context, referenceID string, status TransactionStatus) error {
	return r.conn(ctx).Exec(`UPDATE wallet_transactions SET status = ? WHERE reference_id = ?`, string(status), referenceID).Error
}

// ---------------------------------------------------------------------------------------------
// Users (MongoDB, read only)
// ---------------------------------------------------------------------------------------------

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

// GetUserContact retrieves the registered email and display name for a given user ID
func (r *WalletRepositoryImpl) GetUserContact(ctx context.Context, userID primitive.ObjectID) (string, string, error) {
	var u userDoc
	if err := r.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err != nil {
		return "", "", err
	}
	name := u.displayName()
	if name == "" {
		name = "Valued Expert"
	}
	return u.Email, name, nil
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
	err := r.users.FindOne(ctx, filter).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &UserContact{ID: u.ID, Name: u.displayName(), Email: u.Email, Mobile: u.Mobile}, nil
}

// GetPayoutAccount reads the payout details from a user's Expert KYC.
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
	err := r.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
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

// ---------------------------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------------------------

const withdrawalColumns = `id, user_id, amount_paise, status, payout_method, account_holder, account_last4, ifsc, upi_id,
	reference_id, bank_reference, failure_reason, handled_by, created_at, processing_at, paid_at, failed_at, updated_at`

// CreateWithdrawal saves a new payout request. The database allows one open request per user.
func (r *WalletRepositoryImpl) CreateWithdrawal(ctx context.Context, w *Withdrawal) error {
	err := r.conn(ctx).Exec(`INSERT INTO wallet_withdrawals
		(id, user_id, wallet_id, amount_paise, status, payout_method, account_holder, account_last4, ifsc, upi_id, reference_id, created_at, updated_at)
		SELECT ?, ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM wallets WHERE user_id = ?`,
		w.ID.Hex(), w.UserID.Hex(), w.AmountPaise, string(w.Status), w.PayoutMethod, w.AccountHolder,
		nullable(w.AccountLast4), nullable(w.IFSC), nullable(w.UPIID), w.ReferenceID, w.CreatedAt, w.UpdatedAt,
		w.UserID.Hex()).Error
	if database.PgConstraint(err) == "wallet_withdrawals_one_open_idx" {
		return ErrWithdrawalOpen
	}
	return err
}

// GetWithdrawal fetches a payout request, or nil
func (r *WalletRepositoryImpl) GetWithdrawal(ctx context.Context, id primitive.ObjectID) (*Withdrawal, error) {
	var rows []withdrawalRow
	if err := r.conn(ctx).Raw(`SELECT `+withdrawalColumns+` FROM wallet_withdrawals WHERE id = ?`, id.Hex()).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	w := rows[0].toDomain()
	return &w, nil
}

func withdrawalStatuses(list []WithdrawalStatus) []string {
	out := make([]string, len(list))
	for i, s := range list {
		out[i] = string(s)
	}
	return out
}

// UpdateWithdrawal moves a withdrawal on, only if it's still in one of the expected states
func (r *WalletRepositoryImpl) UpdateWithdrawal(ctx context.Context, id primitive.ObjectID, from []WithdrawalStatus, update WithdrawalUpdate) (bool, error) {
	set := map[string]interface{}{"status": string(update.Status), "handled_by": nullable(update.HandledBy)}
	switch update.Status {
	case WithdrawalProcessing:
		set["processing_at"] = update.At
	case WithdrawalPaid:
		set["paid_at"] = update.At
		set["bank_reference"] = nullable(update.BankReference)
	case WithdrawalFailed:
		set["failed_at"] = update.At
		set["failure_reason"] = nullable(update.FailureReason)
	}
	res := r.conn(ctx).Table("wallet_withdrawals").
		Where("id = ? AND status IN ?", id.Hex(), withdrawalStatuses(from)).
		Updates(set)
	return res.RowsAffected == 1, res.Error
}

// CountOpenWithdrawals counts a user's withdrawals that haven't finished
func (r *WalletRepositoryImpl) CountOpenWithdrawals(ctx context.Context, userID primitive.ObjectID) (int64, error) {
	var n int64
	err := r.conn(ctx).Raw(`SELECT count(*) FROM wallet_withdrawals WHERE user_id = ? AND status IN ('requested', 'processing')`,
		userID.Hex()).Scan(&n).Error
	return n, err
}

// SumWithdrawalsSince adds up a user's withdrawals since a moment, leaving out failed ones
func (r *WalletRepositoryImpl) SumWithdrawalsSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error) {
	var total int64
	err := r.conn(ctx).Raw(`SELECT COALESCE(sum(amount_paise), 0) FROM wallet_withdrawals
		WHERE user_id = ? AND status <> 'failed' AND created_at >= ?`, userID.Hex(), since).Scan(&total).Error
	return total, err
}

// ListWithdrawals returns withdrawals, newest first
func (r *WalletRepositoryImpl) ListWithdrawals(ctx context.Context, query WithdrawalQuery) ([]Withdrawal, int64, error) {
	q := r.conn(ctx).Table("wallet_withdrawals")
	if query.Status != "" {
		q = q.Where("status = ?", string(query.Status))
	}
	if query.UserID != nil {
		q = q.Where("user_id = ?", query.UserID.Hex())
	}
	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	limit, offset := pageOffset(query.Page, query.Limit)
	var rows []withdrawalRow
	if err := q.Select(withdrawalColumns).Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	list := make([]Withdrawal, 0, len(rows))
	for _, row := range rows {
		list = append(list, row.toDomain())
	}
	return list, total, nil
}

// ---------------------------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------------------------

const disputeColumns = `id, user_id, user_name, user_email, transaction_id, reference_id, amount_paise, refund_paise,
	target_balance, category, reason, description, status, admin_notes, refund_transaction_id, resolved_by, resolved_at, created_at, updated_at`

// CreateDispute saves a new dispute. The database allows one per ledger row.
func (r *WalletRepositoryImpl) CreateDispute(ctx context.Context, dispute *WalletDispute) (*WalletDispute, error) {
	if dispute.ID.IsZero() {
		dispute.ID = primitive.NewObjectID()
	}
	var rows []disputeRow
	err := r.conn(ctx).Raw(`INSERT INTO wallet_disputes
		(id, user_id, user_name, user_email, transaction_id, reference_id, amount_paise, target_balance, category, reason, description, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING `+disputeColumns,
		dispute.ID.Hex(), dispute.UserID.Hex(), dispute.UserName, dispute.UserEmail, dispute.TransactionID.Hex(),
		dispute.ReferenceID, dispute.AmountPaise, string(dispute.TargetBalance), string(dispute.Category),
		string(dispute.Reason), dispute.Description, string(dispute.Status)).Scan(&rows).Error
	if database.PgErrCode(err) == database.PgUniqueViolation {
		return nil, ErrDisputeExists
	}
	if err != nil {
		return nil, err
	}
	out := rows[0].toDomain()
	return &out, nil
}

func (r *WalletRepositoryImpl) oneDispute(ctx context.Context, column, value string) (*WalletDispute, error) {
	var rows []disputeRow
	if err := r.conn(ctx).Raw(`SELECT `+disputeColumns+` FROM wallet_disputes WHERE `+column+` = ?`, value).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	out := rows[0].toDomain()
	return &out, nil
}

// GetDisputeByID retrieves a dispute by its primary key, or nil
func (r *WalletRepositoryImpl) GetDisputeByID(ctx context.Context, id primitive.ObjectID) (*WalletDispute, error) {
	return r.oneDispute(ctx, "id", id.Hex())
}

// GetDisputeByTransactionID checks if a dispute already exists for a transaction
func (r *WalletRepositoryImpl) GetDisputeByTransactionID(ctx context.Context, txID primitive.ObjectID) (*WalletDispute, error) {
	return r.oneDispute(ctx, "transaction_id", txID.Hex())
}

// GetDisputes returns paginated disputes filtered by status or user
func (r *WalletRepositoryImpl) GetDisputes(ctx context.Context, query DisputeQuery) ([]WalletDispute, int64, error) {
	q := r.conn(ctx).Table("wallet_disputes")
	if query.Status != "" {
		q = q.Where("status = ?", string(query.Status))
	}
	if query.UserID != "" {
		if uid, err := primitive.ObjectIDFromHex(query.UserID); err == nil {
			q = q.Where("user_id = ?", uid.Hex())
		}
	}
	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	limit, offset := pageOffset(query.Page, query.Limit)
	var rows []disputeRow
	if err := q.Select(disputeColumns).Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	list := make([]WalletDispute, 0, len(rows))
	for _, row := range rows {
		list = append(list, row.toDomain())
	}
	return list, total, nil
}

// UpdateDispute moves a dispute on, only if it's still in one of the expected states
func (r *WalletRepositoryImpl) UpdateDispute(ctx context.Context, id primitive.ObjectID, from []DisputeStatus, update DisputeUpdate) (bool, error) {
	set := map[string]interface{}{"status": string(update.Status)}
	if update.AdminNotes != "" {
		set["admin_notes"] = update.AdminNotes
	}
	if update.RefundPaise > 0 {
		set["refund_paise"] = update.RefundPaise
	}
	if update.RefundTxID != nil {
		set["refund_transaction_id"] = update.RefundTxID.Hex()
	}
	if update.ResolvedBy != "" {
		set["resolved_by"] = update.ResolvedBy
	}
	if update.ResolvedAt != nil {
		set["resolved_at"] = *update.ResolvedAt
	}
	statuses := make([]string, len(from))
	for i, s := range from {
		statuses[i] = string(s)
	}
	res := r.conn(ctx).Table("wallet_disputes").Where("id = ? AND status IN ?", id.Hex(), statuses).Updates(set)
	return res.RowsAffected == 1, res.Error
}

// ---------------------------------------------------------------------------------------------
// Admin overview
// ---------------------------------------------------------------------------------------------

const maxMismatchesShown = 50

// FinanceOverview adds up every balance and checks each one against its ledger. Every ledger row
// moved a balance, whatever its status, so all rows count.
func (r *WalletRepositoryImpl) FinanceOverview(ctx context.Context) (*FinanceOverview, error) {
	db := r.conn(ctx)

	var totals struct {
		Wallets  int64
		Main     int64
		Earnings int64
		Locked   int64
		Bonus    int64
	}
	if err := db.Raw(`SELECT count(*) AS wallets,
			COALESCE(sum(main_paise), 0) AS main, COALESCE(sum(earnings_paise), 0) AS earnings,
			COALESCE(sum(locked_paise), 0) AS locked, COALESCE(sum(bonus_paise), 0) AS bonus
		FROM wallets`).Scan(&totals).Error; err != nil {
		return nil, err
	}

	// Each (wallet, balance) whose stored value differs from what its ledger adds up to
	var mismatches []struct {
		UserID   string
		Balance  string
		Stored   int64
		Computed int64
	}
	if err := db.Raw(`
		WITH ledger AS (
			SELECT wallet_id, target_balance,
				sum(CASE WHEN type = 'credit' THEN amount_paise ELSE -amount_paise END) AS net
			FROM wallet_transactions GROUP BY wallet_id, target_balance
		), stored AS (
			SELECT w.id, w.user_id, b.balance, b.amount
			FROM wallets w
			CROSS JOIN LATERAL (VALUES ('main', w.main_paise), ('earnings', w.earnings_paise),
				('locked', w.locked_paise), ('bonus', w.bonus_paise)) AS b(balance, amount)
		)
		SELECT s.user_id, s.balance, s.amount AS stored, COALESCE(l.net, 0) AS computed
		FROM stored s
		LEFT JOIN ledger l ON l.wallet_id = s.id AND l.target_balance = s.balance
		WHERE s.amount <> COALESCE(l.net, 0)
		ORDER BY s.user_id, s.balance`).Scan(&mismatches).Error; err != nil {
		return nil, err
	}

	overview := &FinanceOverview{
		Wallets:         totals.Wallets,
		MainBalance:     money.ToRupees(totals.Main),
		EarningsBalance: money.ToRupees(totals.Earnings),
		LockedBalance:   money.ToRupees(totals.Locked),
		BonusBalance:    money.ToRupees(totals.Bonus),
		Mismatches:      []BalanceMismatch{},
		MismatchesTotal: len(mismatches),
	}
	for i, m := range mismatches {
		if i == maxMismatchesShown {
			break
		}
		overview.Mismatches = append(overview.Mismatches, BalanceMismatch{
			UserID:   m.UserID,
			Balance:  TargetBalance(m.Balance),
			Stored:   money.ToRupees(m.Stored),
			Computed: money.ToRupees(m.Computed),
		})
	}

	var open struct {
		Count int64
		Total int64
	}
	if err := db.Raw(`SELECT count(*) AS count, COALESCE(sum(amount_paise), 0) AS total
		FROM wallet_withdrawals WHERE status IN ('requested', 'processing')`).Scan(&open).Error; err != nil {
		return nil, err
	}
	overview.OpenWithdrawals = open.Count
	overview.OpenWithdrawalSum = money.ToRupees(open.Total)

	if err := db.Raw(`SELECT count(*) FROM wallet_disputes WHERE status IN ('pending', 'under_review')`).
		Scan(&overview.OpenDisputes).Error; err != nil {
		return nil, err
	}
	return overview, nil
}
