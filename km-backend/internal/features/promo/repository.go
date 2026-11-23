package promo

import (
	"context"
	"errors"
	"strings"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// Repository keeps coupons and their uses in Postgres
type Repository interface {
	ListCoupons(ctx context.Context) ([]CouponStats, error)
	GetCoupon(ctx context.Context, id string) (*Coupon, error)
	GetCouponByCode(ctx context.Context, code string) (*Coupon, error)
	// LockCouponByCode reads a coupon and locks it until the transaction ends, so its limits
	// are checked one purchase at a time
	LockCouponByCode(ctx context.Context, code string) (*Coupon, error)
	CreateCoupon(ctx context.Context, c *Coupon) error
	UpdateCoupon(ctx context.Context, c *Coupon) error

	// CountLive counts uses that hold a place: redeemed, or reserved and not yet expired.
	// userID "" counts everyone's. Holds by exceptHoldsBy are left out.
	CountLive(ctx context.Context, couponID, userID, exceptHoldsBy string, now time.Time) (int, error)
	// ReleaseHolds gives up a customer's unpaid holds on a coupon
	ReleaseHolds(ctx context.Context, couponID, userID string) error
	CreateRedemption(ctx context.Context, r *Redemption) error
	GetRedemption(ctx context.Context, id string) (*Redemption, error)
	GetRedemptionByPurchase(ctx context.Context, purchaseRef string) (*Redemption, error)
	AttachOrder(ctx context.Context, id, razorpayOrderID string) error
	// SetStatus moves a use from one of the given statuses; it reports whether it moved
	SetStatus(ctx context.Context, id string, from []string, to string, purchaseRef string, cashbackPaise int64, at time.Time) (bool, error)
	ListRedemptions(ctx context.Context, couponID string, page, limit int) ([]Redemption, int64, error)
}

type repository struct{ pg *gorm.DB }

func NewRepository(pg *database.PostgresDB) Repository { return &repository{pg: pg.DB} }

func (r *repository) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func rupees(p *int64) *float64 {
	if p == nil {
		return nil
	}
	v := money.ToRupees(*p)
	return &v
}

// pgTextArray writes a list of known words as a Postgres array literal. Only validated
// purposes reach it, so no quoting is needed.
func pgTextArray(items []string) string { return "{" + strings.Join(items, ",") + "}" }

func isUniqueViolation(err error) bool { return database.PgErrCode(err) == database.PgUniqueViolation }

// ---------------------------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------------------------

type couponRow struct {
	ID              string
	Code            string
	Description     string
	Kind            string
	ValueType       string
	AmountPaise     *int64
	Percent         *int
	MaxBenefitPaise *int64
	MinOrderPaise   int64
	AppliesTo       string // joined with commas by the query
	StartsAt        *time.Time
	EndsAt          *time.Time
	TotalLimit      *int
	PerUserLimit    *int
	IsActive        bool
	CreatedBy       string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

const couponColumns = `c.id, c.code, c.description, c.kind, c.value_type, c.amount_paise, c.percent, c.max_benefit_paise,
	c.min_order_paise, array_to_string(c.applies_to, ',') AS applies_to, c.starts_at, c.ends_at, c.total_limit,
	c.per_user_limit, c.is_active, c.created_by, c.created_at, c.updated_at`

func (c couponRow) toDomain() Coupon {
	var applies []string
	if c.AppliesTo != "" {
		applies = strings.Split(c.AppliesTo, ",")
	}
	return Coupon{
		ID: c.ID, Code: c.Code, Description: c.Description, Kind: c.Kind, ValueType: c.ValueType,
		Amount: rupees(c.AmountPaise), AmountPaise: c.AmountPaise, Percent: c.Percent,
		MaxBenefit: rupees(c.MaxBenefitPaise), MaxBenefitPaise: c.MaxBenefitPaise,
		MinOrder: money.ToRupees(c.MinOrderPaise), MinOrderPaise: c.MinOrderPaise,
		AppliesTo: applies, StartsAt: c.StartsAt, EndsAt: c.EndsAt,
		TotalLimit: c.TotalLimit, PerUserLimit: c.PerUserLimit, IsActive: c.IsActive,
		CreatedBy: c.CreatedBy, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
	}
}

type couponStatsRow struct {
	// A named, exported field: GORM skips an unexported embedded struct and would leave the coupon blank
	Row           couponRow `gorm:"embedded"`
	Used          int
	Held          int
	DiscountPaise int64
	CashbackPaise int64
}

func (r *repository) ListCoupons(ctx context.Context) ([]CouponStats, error) {
	var rows []couponStatsRow
	err := r.conn(ctx).Raw(`SELECT ` + couponColumns + `,
			count(u.id) FILTER (WHERE u.status = 'redeemed') AS used,
			count(u.id) FILTER (WHERE u.status = 'reserved' AND u.reserved_until > now()) AS held,
			coalesce(sum(u.discount_paise) FILTER (WHERE u.status = 'redeemed'), 0) AS discount_paise,
			coalesce(sum(u.cashback_paise) FILTER (WHERE u.status = 'redeemed'), 0) AS cashback_paise
		FROM coupons c LEFT JOIN coupon_redemptions u ON u.coupon_id = c.id
		GROUP BY c.id
		ORDER BY c.is_active DESC, c.created_at DESC, c.id`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]CouponStats, 0, len(rows))
	for _, row := range rows {
		out = append(out, CouponStats{
			Coupon: row.Row.toDomain(), Used: row.Used, Held: row.Held,
			Discounted: money.ToRupees(row.DiscountPaise), CashbackGiven: money.ToRupees(row.CashbackPaise),
		})
	}
	return out, nil
}

func (r *repository) oneCoupon(ctx context.Context, where string, arg interface{}, lock bool) (*Coupon, error) {
	sql := `SELECT ` + couponColumns + ` FROM coupons c WHERE ` + where
	if lock {
		sql += ` FOR UPDATE`
	}
	var rows []couponRow
	if err := r.conn(ctx).Raw(sql, arg).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	c := rows[0].toDomain()
	return &c, nil
}

func (r *repository) GetCoupon(ctx context.Context, id string) (*Coupon, error) {
	return r.oneCoupon(ctx, `c.id = ?`, id, false)
}

func (r *repository) GetCouponByCode(ctx context.Context, code string) (*Coupon, error) {
	return r.oneCoupon(ctx, `c.code = ?`, code, false)
}

func (r *repository) LockCouponByCode(ctx context.Context, code string) (*Coupon, error) {
	return r.oneCoupon(ctx, `c.code = ?`, code, true)
}

func (r *repository) CreateCoupon(ctx context.Context, c *Coupon) error {
	c.ID = primitive.NewObjectID().Hex()
	var rows []couponRow
	err := r.conn(ctx).Raw(`INSERT INTO coupons AS c (id, code, description, kind, value_type, amount_paise, percent,
			max_benefit_paise, min_order_paise, applies_to, starts_at, ends_at, total_limit, per_user_limit, is_active, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::text[], ?, ?, ?, ?, ?, ?)
		RETURNING `+couponColumns,
		c.ID, c.Code, c.Description, c.Kind, c.ValueType, c.AmountPaise, c.Percent, c.MaxBenefitPaise, c.MinOrderPaise,
		pgTextArray(c.AppliesTo), c.StartsAt, c.EndsAt, c.TotalLimit, c.PerUserLimit, c.IsActive, c.CreatedBy).Scan(&rows).Error
	if isUniqueViolation(err) {
		return ErrCodeTaken
	}
	if err != nil {
		return err
	}
	*c = rows[0].toDomain()
	return nil
}

func (r *repository) UpdateCoupon(ctx context.Context, c *Coupon) error {
	var rows []couponRow
	err := r.conn(ctx).Raw(`UPDATE coupons AS c SET description = ?, kind = ?, value_type = ?, amount_paise = ?, percent = ?,
			max_benefit_paise = ?, min_order_paise = ?, applies_to = ?::text[], starts_at = ?, ends_at = ?, total_limit = ?,
			per_user_limit = ?, is_active = ?
		WHERE c.id = ? RETURNING `+couponColumns,
		c.Description, c.Kind, c.ValueType, c.AmountPaise, c.Percent, c.MaxBenefitPaise, c.MinOrderPaise,
		pgTextArray(c.AppliesTo), c.StartsAt, c.EndsAt, c.TotalLimit, c.PerUserLimit, c.IsActive, c.ID).Scan(&rows).Error
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return ErrNotFound
	}
	*c = rows[0].toDomain()
	return nil
}

// ---------------------------------------------------------------------------------------------
// Uses
// ---------------------------------------------------------------------------------------------

type redemptionRow struct {
	ID              string
	CouponID        string
	Code            string
	UserID          string
	Purpose         string
	Channel         string
	Status          string
	ListPaise       int64
	DiscountPaise   int64
	CashbackPaise   int64
	RazorpayOrderID *string
	PurchaseRef     *string
	ReservedUntil   *time.Time
	RedeemedAt      *time.Time
	ReversedAt      *time.Time
	CreatedAt       time.Time
}

const redemptionColumns = `u.id, u.coupon_id, c.code, u.user_id, u.purpose, u.channel, u.status, u.list_paise,
	u.discount_paise, u.cashback_paise, u.razorpay_order_id, u.purchase_ref, u.reserved_until, u.redeemed_at,
	u.reversed_at, u.created_at`

func (u redemptionRow) toDomain() Redemption {
	return Redemption{
		ID: u.ID, CouponID: u.CouponID, Code: u.Code, UserID: u.UserID, Purpose: u.Purpose, Channel: u.Channel,
		Status:    u.Status,
		ListPrice: money.ToRupees(u.ListPaise), ListPaise: u.ListPaise,
		Discount: money.ToRupees(u.DiscountPaise), DiscountPaise: u.DiscountPaise,
		Cashback: money.ToRupees(u.CashbackPaise), CashbackPaise: u.CashbackPaise,
		RazorpayOrderID: deref(u.RazorpayOrderID), PurchaseRef: deref(u.PurchaseRef),
		ReservedUntil: u.ReservedUntil, RedeemedAt: u.RedeemedAt, ReversedAt: u.ReversedAt, CreatedAt: u.CreatedAt,
	}
}

func (r *repository) CountLive(ctx context.Context, couponID, userID, exceptHoldsBy string, now time.Time) (int, error) {
	sql := `SELECT count(*) FROM coupon_redemptions
		WHERE coupon_id = ? AND (status = 'redeemed' OR (status = 'reserved' AND reserved_until > ? AND user_id::text <> ?))`
	args := []interface{}{couponID, now, exceptHoldsBy}
	if userID != "" {
		sql += ` AND user_id = ?`
		args = append(args, userID)
	}
	var n int
	err := r.conn(ctx).Raw(sql, args...).Scan(&n).Error
	return n, err
}

func (r *repository) ReleaseHolds(ctx context.Context, couponID, userID string) error {
	return r.conn(ctx).Exec(`UPDATE coupon_redemptions SET status = 'released'
		WHERE coupon_id = ? AND user_id = ? AND status = 'reserved'`, couponID, userID).Error
}

func (r *repository) CreateRedemption(ctx context.Context, u *Redemption) error {
	u.ID = primitive.NewObjectID().Hex()
	return r.conn(ctx).Exec(`INSERT INTO coupon_redemptions
			(id, coupon_id, user_id, purpose, channel, status, list_paise, discount_paise, cashback_paise,
			 razorpay_order_id, purchase_ref, reserved_until, redeemed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.CouponID, u.UserID, u.Purpose, u.Channel, u.Status, u.ListPaise, u.DiscountPaise, u.CashbackPaise,
		nullable(u.RazorpayOrderID), nullable(u.PurchaseRef), u.ReservedUntil, u.RedeemedAt).Error
}

func (r *repository) oneRedemption(ctx context.Context, where string, arg interface{}) (*Redemption, error) {
	var rows []redemptionRow
	if err := r.conn(ctx).Raw(`SELECT `+redemptionColumns+` FROM coupon_redemptions u JOIN coupons c ON c.id = u.coupon_id
		WHERE `+where, arg).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	u := rows[0].toDomain()
	return &u, nil
}

func (r *repository) GetRedemption(ctx context.Context, id string) (*Redemption, error) {
	return r.oneRedemption(ctx, `u.id = ?`, id)
}

func (r *repository) GetRedemptionByPurchase(ctx context.Context, purchaseRef string) (*Redemption, error) {
	return r.oneRedemption(ctx, `u.purchase_ref = ?`, purchaseRef)
}

func (r *repository) AttachOrder(ctx context.Context, id, razorpayOrderID string) error {
	res := r.conn(ctx).Exec(`UPDATE coupon_redemptions SET razorpay_order_id = ? WHERE id = ? AND razorpay_order_id IS NULL`,
		razorpayOrderID, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return errors.New("coupon hold not found")
	}
	return nil
}

func (r *repository) SetStatus(ctx context.Context, id string, from []string, to string, purchaseRef string, cashbackPaise int64, at time.Time) (bool, error) {
	set := `status = ?`
	args := []interface{}{to}
	switch to {
	case StatusRedeemed:
		set += `, purchase_ref = ?, cashback_paise = ?, redeemed_at = ?`
		args = append(args, purchaseRef, cashbackPaise, at)
	case StatusReversed:
		set += `, reversed_at = ?`
		args = append(args, at)
	}
	args = append(args, id, from)
	res := r.conn(ctx).Exec(`UPDATE coupon_redemptions SET `+set+` WHERE id = ? AND status IN ?`, args...)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

func (r *repository) ListRedemptions(ctx context.Context, couponID string, page, limit int) ([]Redemption, int64, error) {
	where, args := `TRUE`, []interface{}{}
	if couponID != "" {
		where, args = `u.coupon_id = ?`, append(args, couponID)
	}
	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM coupon_redemptions u WHERE `+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []redemptionRow
	err := r.conn(ctx).Raw(`SELECT `+redemptionColumns+` FROM coupon_redemptions u JOIN coupons c ON c.id = u.coupon_id
		WHERE `+where+` ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
		append(args, limit, (page-1)*limit)...).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	out := make([]Redemption, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, total, nil
}
