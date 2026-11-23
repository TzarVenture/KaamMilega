package recruiterplan

import (
	"context"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// Repository keeps plans, bought plans and usage in Postgres
type Repository interface {
	ListPlans(ctx context.Context, activeOnly bool) ([]Plan, error)
	GetPlan(ctx context.Context, id string) (*Plan, error)
	CreatePlan(ctx context.Context, p *Plan) error
	UpdatePlan(ctx context.Context, p *Plan) error

	// LockUser serialises plan purchases and usage checks for one recruiter (transaction only)
	LockUser(ctx context.Context, userID string) error
	// OpenSubscriptions are the recruiter's active plans that haven't ended, earliest first
	OpenSubscriptions(ctx context.Context, userID string, now time.Time) ([]Subscription, error)
	CreateSubscription(ctx context.Context, s *Subscription) error
	GetSubscriptionByOrder(ctx context.Context, razorpayOrderID string) (*Subscription, error)
	MarkRefunded(ctx context.Context, id string) error
	ListSubscriptions(ctx context.Context, page, limit int) ([]Subscription, int64, error)

	CountUsage(ctx context.Context, userID, period, kind string) (int, error)
	HasUsage(ctx context.Context, userID, period, kind, refID string) (bool, error)
	// AddUsage records one use and returns its id, or "" when that ref was already counted
	AddUsage(ctx context.Context, userID, period, subscriptionID, kind, refID string) (string, error)
	DeleteUsage(ctx context.Context, id string) error
	CountSubscriptionUsage(ctx context.Context, subscriptionID string) (int, error)
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

// ---------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------

type planRow struct {
	ID              string
	Name            string
	Description     string
	PricePaise      int64
	PeriodDays      int
	JobPosts        *int
	NewChats        *int
	ResumeDownloads *int
	AiJobWriter     bool
	SortOrder       int
	IsActive        bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

const planColumns = `id, name, description, price_paise, period_days, job_posts, new_chats, resume_downloads,
	ai_job_writer, sort_order, is_active, created_at, updated_at`

func (p planRow) toDomain() Plan {
	return Plan{
		ID: p.ID, Name: p.Name, Description: p.Description,
		Price: money.ToRupees(p.PricePaise), PricePaise: p.PricePaise, PeriodDays: p.PeriodDays,
		Limits:      Limits{JobPosts: p.JobPosts, NewChats: p.NewChats, ResumeDownloads: p.ResumeDownloads},
		AIJobWriter: p.AiJobWriter, SortOrder: p.SortOrder, IsActive: p.IsActive,
		CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

func (r *repository) ListPlans(ctx context.Context, activeOnly bool) ([]Plan, error) {
	sql := `SELECT ` + planColumns + ` FROM recruiter_plans`
	if activeOnly {
		sql += ` WHERE is_active`
	}
	sql += ` ORDER BY is_active DESC, sort_order, price_paise, id`
	var rows []planRow
	if err := r.conn(ctx).Raw(sql).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Plan, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, nil
}

func (r *repository) GetPlan(ctx context.Context, id string) (*Plan, error) {
	var rows []planRow
	if err := r.conn(ctx).Raw(`SELECT `+planColumns+` FROM recruiter_plans WHERE id = ?`, id).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	p := rows[0].toDomain()
	return &p, nil
}

func (r *repository) CreatePlan(ctx context.Context, p *Plan) error {
	p.ID = primitive.NewObjectID().Hex()
	now := time.Now()
	p.CreatedAt, p.UpdatedAt = now, now
	return r.conn(ctx).Exec(`INSERT INTO recruiter_plans (`+planColumns+`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Description, p.PricePaise, p.PeriodDays, p.JobPosts, p.NewChats, p.ResumeDownloads,
		p.AIJobWriter, p.SortOrder, p.IsActive, now, now).Error
}

func (r *repository) UpdatePlan(ctx context.Context, p *Plan) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_plans SET name = ?, description = ?, price_paise = ?, period_days = ?,
		job_posts = ?, new_chats = ?, resume_downloads = ?, ai_job_writer = ?, sort_order = ?, is_active = ?
		WHERE id = ?`,
		p.Name, p.Description, p.PricePaise, p.PeriodDays, p.JobPosts, p.NewChats, p.ResumeDownloads,
		p.AIJobWriter, p.SortOrder, p.IsActive, p.ID)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrPlanNotFound
	}
	return nil
}

// ---------------------------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------------------------

func (r *repository) LockUser(ctx context.Context, userID string) error {
	return r.conn(ctx).Exec(`SELECT pg_advisory_xact_lock(hashtext(?))`, "recruiter_plan:"+userID).Error
}

type subRow struct {
	ID                string
	UserID            string
	PlanID            string
	PlanName          string
	PricePaise        int64
	JobPosts          *int
	NewChats          *int
	ResumeDownloads   *int
	AiJobWriter       bool
	Channel           string
	Status            string
	RazorpayOrderID   *string
	RazorpayPaymentID *string
	StartsAt          time.Time
	ExpiresAt         time.Time
	CreatedAt         time.Time
}

const subColumns = `id, user_id, plan_id, plan_name, price_paise, job_posts, new_chats, resume_downloads, ai_job_writer,
	channel, status, razorpay_order_id, razorpay_payment_id, starts_at, expires_at, created_at`

func (s subRow) toDomain() Subscription {
	return Subscription{
		ID: s.ID, UserID: s.UserID, PlanID: s.PlanID, PlanName: s.PlanName,
		Price: money.ToRupees(s.PricePaise), PricePaise: s.PricePaise,
		Limits:      Limits{JobPosts: s.JobPosts, NewChats: s.NewChats, ResumeDownloads: s.ResumeDownloads},
		AIJobWriter: s.AiJobWriter, Channel: s.Channel, Status: s.Status,
		RazorpayOrderID: deref(s.RazorpayOrderID), RazorpayPaymentID: deref(s.RazorpayPaymentID),
		StartsAt: s.StartsAt, ExpiresAt: s.ExpiresAt, CreatedAt: s.CreatedAt,
	}
}

func (r *repository) subQuery(ctx context.Context, sql string, args ...interface{}) ([]Subscription, error) {
	var rows []subRow
	if err := r.conn(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Subscription, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, nil
}

func (r *repository) OpenSubscriptions(ctx context.Context, userID string, now time.Time) ([]Subscription, error) {
	return r.subQuery(ctx, `SELECT `+subColumns+` FROM recruiter_subscriptions
		WHERE user_id = ? AND status = 'active' AND expires_at > ? ORDER BY starts_at, id`, userID, now)
}

func (r *repository) CreateSubscription(ctx context.Context, s *Subscription) error {
	s.ID = primitive.NewObjectID().Hex()
	s.CreatedAt = time.Now()
	return r.conn(ctx).Exec(`INSERT INTO recruiter_subscriptions (`+subColumns+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.UserID, s.PlanID, s.PlanName, s.PricePaise, s.JobPosts, s.NewChats, s.ResumeDownloads, s.AIJobWriter,
		s.Channel, s.Status, nullable(s.RazorpayOrderID), nullable(s.RazorpayPaymentID), s.StartsAt, s.ExpiresAt, s.CreatedAt).Error
}

func (r *repository) GetSubscriptionByOrder(ctx context.Context, razorpayOrderID string) (*Subscription, error) {
	subs, err := r.subQuery(ctx, `SELECT `+subColumns+` FROM recruiter_subscriptions WHERE razorpay_order_id = ?`, razorpayOrderID)
	if err != nil || len(subs) == 0 {
		return nil, err
	}
	return &subs[0], nil
}

func (r *repository) MarkRefunded(ctx context.Context, id string) error {
	return r.conn(ctx).Exec(`UPDATE recruiter_subscriptions SET status = 'refunded' WHERE id = ? AND status = 'active'`, id).Error
}

func (r *repository) ListSubscriptions(ctx context.Context, page, limit int) ([]Subscription, int64, error) {
	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM recruiter_subscriptions`).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	subs, err := r.subQuery(ctx, `SELECT `+subColumns+` FROM recruiter_subscriptions ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
		limit, (page-1)*limit)
	return subs, total, err
}

// ---------------------------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------------------------

func (r *repository) CountUsage(ctx context.Context, userID, period, kind string) (int, error) {
	var n int
	err := r.conn(ctx).Raw(`SELECT count(*) FROM recruiter_usage WHERE user_id = ? AND period = ? AND kind = ?`,
		userID, period, kind).Scan(&n).Error
	return n, err
}

func (r *repository) HasUsage(ctx context.Context, userID, period, kind, refID string) (bool, error) {
	var n int
	err := r.conn(ctx).Raw(`SELECT count(*) FROM recruiter_usage WHERE user_id = ? AND period = ? AND kind = ? AND ref_id = ?`,
		userID, period, kind, refID).Scan(&n).Error
	return n > 0, err
}

func (r *repository) AddUsage(ctx context.Context, userID, period, subscriptionID, kind, refID string) (string, error) {
	id := primitive.NewObjectID().Hex()
	res := r.conn(ctx).Exec(`INSERT INTO recruiter_usage (id, user_id, period, subscription_id, kind, ref_id)
		VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, period, kind, ref_id) DO NOTHING`,
		id, userID, period, nullable(subscriptionID), kind, refID)
	if res.Error != nil {
		return "", res.Error
	}
	if res.RowsAffected == 0 {
		return "", nil
	}
	return id, nil
}

func (r *repository) DeleteUsage(ctx context.Context, id string) error {
	return r.conn(ctx).Exec(`DELETE FROM recruiter_usage WHERE id = ?`, id).Error
}

func (r *repository) CountSubscriptionUsage(ctx context.Context, subscriptionID string) (int, error) {
	var n int
	err := r.conn(ctx).Raw(`SELECT count(*) FROM recruiter_usage WHERE subscription_id = ?`, subscriptionID).Scan(&n).Error
	return n, err
}
