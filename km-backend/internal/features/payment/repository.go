package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// Repository stores payment orders. Every status change is conditional on the current status,
// which is what makes each order settle or refund only once.
type Repository interface {
	Insert(ctx context.Context, order *Order) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*Order, error)
	FindByRazorpayOrderID(ctx context.Context, razorpayOrderID string) (*Order, error)
	FindByRazorpayPaymentID(ctx context.Context, razorpayPaymentID string) (*Order, error)
	ClaimPaid(ctx context.Context, id primitive.ObjectID, paymentID string, now time.Time) (bool, error)
	MarkRefundDue(ctx context.Context, id primitive.ObjectID, from []Status, paymentID string, paise int64, reason string, now time.Time) (bool, error)
	MarkRefunded(ctx context.Context, id primitive.ObjectID, refundID string, now time.Time) (bool, error)
	ReopenRefund(ctx context.Context, id primitive.ObjectID, message string) error
	SetRefundError(ctx context.Context, id primitive.ObjectID, message string) error
	SetLastFailure(ctx context.Context, id primitive.ObjectID, message string) error
	ListCreatedBefore(ctx context.Context, before time.Time, limit int64) ([]Order, error)
	ListRefundDue(ctx context.Context, limit int64) ([]Order, error)
	MarkExpired(ctx context.Context, id primitive.ObjectID, now time.Time) error
	SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) (int64, error)
	ListPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) ([]Order, error)
	AdminList(ctx context.Context, query AdminOrderQuery) ([]Order, int64, error)
}

type pgRepository struct {
	db *gorm.DB
}

// NewRepository creates the payment order store (Postgres table payment_orders).
func NewRepository(pg *database.PostgresDB) Repository {
	return &pgRepository{db: pg.DB}
}

func (r *pgRepository) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.db) }

type orderRow struct {
	ID                string
	RazorpayOrderID   string
	RazorpayPaymentID *string
	UserID            string
	Purpose           string
	AmountPaise       int64
	Currency          string
	TargetID          *string
	Details           []byte
	Description       *string
	Status            string
	LastFailure       *string
	RefundPaise       int64
	RefundReason      *string
	RefundID          *string
	RefundError       *string
	PaidAt            *time.Time
	RefundedAt        *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

const orderColumns = `id, razorpay_order_id, razorpay_payment_id, user_id, purpose, amount_paise, currency, target_id,
	details, description, status, last_failure, refund_paise, refund_reason, refund_id, refund_error, paid_at, refunded_at,
	created_at, updated_at`

func str(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func null(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (o orderRow) toDomain() (Order, error) {
	out := Order{
		ID:                database.OID(o.ID),
		RazorpayOrderID:   o.RazorpayOrderID,
		RazorpayPaymentID: str(o.RazorpayPaymentID),
		UserID:            database.OID(o.UserID),
		Purpose:           Purpose(o.Purpose),
		AmountPaise:       o.AmountPaise,
		Currency:          strings.TrimSpace(o.Currency),
		TargetID:          str(o.TargetID),
		Description:       str(o.Description),
		Status:            Status(o.Status),
		LastFailure:       str(o.LastFailure),
		RefundPaise:       o.RefundPaise,
		RefundReason:      str(o.RefundReason),
		RefundID:          str(o.RefundID),
		RefundError:       str(o.RefundError),
		PaidAt:            o.PaidAt,
		RefundedAt:        o.RefundedAt,
		CreatedAt:         o.CreatedAt,
		UpdatedAt:         o.UpdatedAt,
	}
	if len(o.Details) > 0 {
		if err := json.Unmarshal(o.Details, &out.Details); err != nil {
			return out, fmt.Errorf("reading order details: %w", err)
		}
	}
	return out, nil
}

func toOrders(rows []orderRow) ([]Order, error) {
	out := make([]Order, 0, len(rows))
	for _, row := range rows {
		o, err := row.toDomain()
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, nil
}

func (r *pgRepository) Insert(ctx context.Context, order *Order) error {
	if order.ID.IsZero() {
		order.ID = primitive.NewObjectID()
	}
	var details []byte
	if len(order.Details) > 0 {
		var err error
		if details, err = json.Marshal(order.Details); err != nil {
			return err
		}
	}
	return r.conn(ctx).Exec(`INSERT INTO payment_orders
		(id, razorpay_order_id, user_id, purpose, amount_paise, currency, target_id, details, description, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		order.ID.Hex(), order.RazorpayOrderID, order.UserID.Hex(), string(order.Purpose), order.AmountPaise,
		order.Currency, null(order.TargetID), details, null(order.Description), string(order.Status),
		order.CreatedAt, order.UpdatedAt).Error
}

func (r *pgRepository) findOne(ctx context.Context, column, value string) (*Order, error) {
	var rows []orderRow
	if err := r.conn(ctx).Raw(`SELECT `+orderColumns+` FROM payment_orders WHERE `+column+` = ?`, value).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	o, err := rows[0].toDomain()
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *pgRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*Order, error) {
	return r.findOne(ctx, "id", id.Hex())
}

func (r *pgRepository) FindByRazorpayOrderID(ctx context.Context, razorpayOrderID string) (*Order, error) {
	return r.findOne(ctx, "razorpay_order_id", razorpayOrderID)
}

func (r *pgRepository) FindByRazorpayPaymentID(ctx context.Context, razorpayPaymentID string) (*Order, error) {
	return r.findOne(ctx, "razorpay_payment_id", razorpayPaymentID)
}

func statusList(list []Status) []string {
	out := make([]string, len(list))
	for i, s := range list {
		out[i] = string(s)
	}
	return out
}

// changed runs a conditional update and reports whether it applied.
func (r *pgRepository) changed(ctx context.Context, id primitive.ObjectID, from []Status, set map[string]interface{}) (bool, error) {
	res := r.conn(ctx).Table("payment_orders").Where("id = ? AND status IN ?", id.Hex(), statusList(from)).Updates(set)
	return res.RowsAffected == 1, res.Error
}

// ClaimPaid accepts an expired order too: a late payment is still money received.
func (r *pgRepository) ClaimPaid(ctx context.Context, id primitive.ObjectID, paymentID string, now time.Time) (bool, error) {
	return r.changed(ctx, id, []Status{StatusCreated, StatusExpired},
		map[string]interface{}{"status": string(StatusPaid), "razorpay_payment_id": paymentID, "paid_at": now})
}

func (r *pgRepository) MarkRefundDue(ctx context.Context, id primitive.ObjectID, from []Status, paymentID string, paise int64, reason string, now time.Time) (bool, error) {
	return r.changed(ctx, id, from, map[string]interface{}{
		"status": string(StatusRefundDue), "razorpay_payment_id": null(paymentID), "refund_paise": paise, "refund_reason": null(reason),
	})
}

func (r *pgRepository) MarkRefunded(ctx context.Context, id primitive.ObjectID, refundID string, now time.Time) (bool, error) {
	set := map[string]interface{}{"status": string(StatusRefunded), "refunded_at": now, "refund_error": nil}
	if refundID != "" {
		set["refund_id"] = refundID
	}
	return r.changed(ctx, id, []Status{StatusRefundDue}, set)
}

func (r *pgRepository) ReopenRefund(ctx context.Context, id primitive.ObjectID, message string) error {
	_, err := r.changed(ctx, id, []Status{StatusRefunded}, map[string]interface{}{
		"status": string(StatusRefundDue), "refund_error": null(message), "refund_id": nil, "refunded_at": nil,
	})
	return err
}

func (r *pgRepository) SetRefundError(ctx context.Context, id primitive.ObjectID, message string) error {
	return r.conn(ctx).Exec(`UPDATE payment_orders SET refund_error = ? WHERE id = ?`, null(message), id.Hex()).Error
}

func (r *pgRepository) SetLastFailure(ctx context.Context, id primitive.ObjectID, message string) error {
	return r.conn(ctx).Exec(`UPDATE payment_orders SET last_failure = ? WHERE id = ?`, null(message), id.Hex()).Error
}

func (r *pgRepository) list(ctx context.Context, query string, args ...interface{}) ([]Order, error) {
	var rows []orderRow
	if err := r.conn(ctx).Raw(`SELECT `+orderColumns+` FROM payment_orders `+query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return toOrders(rows)
}

func (r *pgRepository) ListCreatedBefore(ctx context.Context, before time.Time, limit int64) ([]Order, error) {
	return r.list(ctx, `WHERE status = 'created' AND created_at <= ? ORDER BY created_at LIMIT ?`, before, limit)
}

func (r *pgRepository) ListRefundDue(ctx context.Context, limit int64) ([]Order, error) {
	return r.list(ctx, `WHERE status = 'refund_due' ORDER BY updated_at LIMIT ?`, limit)
}

func (r *pgRepository) MarkExpired(ctx context.Context, id primitive.ObjectID, now time.Time) error {
	_, err := r.changed(ctx, id, []Status{StatusCreated}, map[string]interface{}{"status": string(StatusExpired)})
	return err
}

// SumPaidSince adds up what a user has successfully paid for a purpose since a moment in time.
func (r *pgRepository) SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) (int64, error) {
	var total int64
	err := r.conn(ctx).Raw(`SELECT COALESCE(sum(amount_paise), 0) FROM payment_orders
		WHERE user_id = ? AND purpose = ? AND status = 'paid' AND paid_at >= ?`,
		userID.Hex(), string(purpose), since).Scan(&total).Error
	return total, err
}

// ListPaidSince returns a user's paid (not refunded) orders for a purpose since a moment, newest first.
func (r *pgRepository) ListPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) ([]Order, error) {
	return r.list(ctx, `WHERE user_id = ? AND purpose = ? AND status = 'paid' AND paid_at >= ? ORDER BY paid_at DESC, id DESC`,
		userID.Hex(), string(purpose), since)
}

func (r *pgRepository) AdminList(ctx context.Context, query AdminOrderQuery) ([]Order, int64, error) {
	q := r.conn(ctx).Table("payment_orders")
	if query.Status != "" {
		q = q.Where("status = ?", string(query.Status))
	}
	if query.Purpose != "" {
		q = q.Where("purpose = ?", string(query.Purpose))
	}
	if query.Search != "" {
		prefix := database.EscapeLike(query.Search) + "%"
		q = q.Where("(razorpay_order_id LIKE ? OR razorpay_payment_id LIKE ?)", prefix, prefix)
	}
	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, limit := query.Page, query.Limit
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	var rows []orderRow
	if err := q.Select(orderColumns).Order("created_at DESC, id DESC").Limit(limit).Offset((page - 1) * limit).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	orders, err := toOrders(rows)
	return orders, total, err
}
