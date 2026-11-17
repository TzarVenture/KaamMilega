package subscription

import (
	"context"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

type SubscriptionRepository interface {
	CreateSubscription(ctx context.Context, sub *ExpertSubscription) (*ExpertSubscription, error)
	GetActiveSubscription(ctx context.Context, userID string) (*ExpertSubscription, error)
	GetSubscriptionByID(ctx context.Context, id string) (*ExpertSubscription, error)
	GetByRazorpayOrderID(ctx context.Context, orderID string) (*ExpertSubscription, error)
	UpdateSubscriptionStatus(ctx context.Context, id string, status string) error
	// LockUser makes purchases for one user run one at a time until the transaction ends
	LockUser(ctx context.Context, userID primitive.ObjectID) error
}

// SubscriptionRepositoryImpl keeps expert plans in Postgres.
type SubscriptionRepositoryImpl struct {
	pg *gorm.DB
}

func NewSubscriptionRepository(pg *database.PostgresDB) SubscriptionRepository {
	return &SubscriptionRepositoryImpl{pg: pg.DB}
}

func (r *SubscriptionRepositoryImpl) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

type subscriptionRow struct {
	ID                string
	UserID            string
	PlanType          string
	AmountPaise       int64
	PaymentMethod     string
	PaymentStatus     string
	Status            string
	RazorpayOrderID   *string
	RazorpayPaymentID *string
	StartsAt          time.Time
	ExpiresAt         time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

const subscriptionSelect = `SELECT id, user_id, plan_type, amount_paise, payment_method, payment_status, status,
	razorpay_order_id, razorpay_payment_id, starts_at, expires_at, created_at, updated_at FROM expert_subscriptions`

func (s subscriptionRow) toDomain() *ExpertSubscription {
	return &ExpertSubscription{
		ID:                database.OID(s.ID),
		UserID:            database.OID(s.UserID),
		PlanType:          s.PlanType,
		Amount:            money.ToRupees(s.AmountPaise),
		PaymentMethod:     s.PaymentMethod,
		PaymentStatus:     s.PaymentStatus,
		Status:            s.Status,
		RazorpayOrderID:   deref(s.RazorpayOrderID),
		RazorpayPaymentID: deref(s.RazorpayPaymentID),
		StartsAt:          s.StartsAt,
		ExpiresAt:         s.ExpiresAt,
		CreatedAt:         s.CreatedAt,
		UpdatedAt:         s.UpdatedAt,
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func hexID(id string) (string, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return "", err
	}
	return oid.Hex(), nil
}

func (r *SubscriptionRepositoryImpl) one(ctx context.Context, where string, args ...interface{}) (*ExpertSubscription, error) {
	var rows []subscriptionRow
	if err := r.conn(ctx).Raw(subscriptionSelect+` WHERE `+where, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0].toDomain(), nil
}

func (r *SubscriptionRepositoryImpl) CreateSubscription(ctx context.Context, sub *ExpertSubscription) (*ExpertSubscription, error) {
	if sub.ID.IsZero() {
		sub.ID = primitive.NewObjectID()
	}
	now := time.Now()
	sub.CreatedAt, sub.UpdatedAt = now, now
	err := r.conn(ctx).Exec(`INSERT INTO expert_subscriptions
		(id, user_id, plan_type, amount_paise, payment_method, payment_status, status, razorpay_order_id,
		 razorpay_payment_id, starts_at, expires_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sub.ID.Hex(), sub.UserID.Hex(), sub.PlanType, money.ToPaise(sub.Amount), sub.PaymentMethod, sub.PaymentStatus,
		sub.Status, nullable(sub.RazorpayOrderID), nullable(sub.RazorpayPaymentID), sub.StartsAt, sub.ExpiresAt, now, now).Error
	if err != nil {
		return nil, err
	}
	return sub, nil
}

// GetActiveSubscription returns the active plan that runs latest (a renewal queued after the
// current one counts), or nil
func (r *SubscriptionRepositoryImpl) GetActiveSubscription(ctx context.Context, userID string) (*ExpertSubscription, error) {
	hex, err := hexID(userID)
	if err != nil {
		return nil, err
	}
	return r.one(ctx, `user_id = ? AND status = ? AND expires_at > now() ORDER BY expires_at DESC, id DESC LIMIT 1`, hex, StatusActive)
}

func (r *SubscriptionRepositoryImpl) GetSubscriptionByID(ctx context.Context, id string) (*ExpertSubscription, error) {
	hex, err := hexID(id)
	if err != nil {
		return nil, err
	}
	return r.one(ctx, `id = ?`, hex)
}

func (r *SubscriptionRepositoryImpl) UpdateSubscriptionStatus(ctx context.Context, id string, status string) error {
	hex, err := hexID(id)
	if err != nil {
		return err
	}
	return r.conn(ctx).Exec(`UPDATE expert_subscriptions SET status = ? WHERE id = ?`, status, hex).Error
}

// GetByRazorpayOrderID finds the subscription an online payment bought, or nil
func (r *SubscriptionRepositoryImpl) GetByRazorpayOrderID(ctx context.Context, orderID string) (*ExpertSubscription, error) {
	return r.one(ctx, `razorpay_order_id = ?`, orderID)
}

// LockUser takes a transaction-scoped lock on the user, so two purchases at the same moment run
// one after the other and the second sees the first. Outside a transaction it does nothing useful,
// so it refuses.
func (r *SubscriptionRepositoryImpl) LockUser(ctx context.Context, userID primitive.ObjectID) error {
	if !database.InPgTx(ctx) {
		return errNoTransaction
	}
	return r.conn(ctx).Exec(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, "subscription:"+userID.Hex()).Error
}
