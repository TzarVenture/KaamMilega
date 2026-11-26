package adsales

import (
	"context"
	"encoding/json"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// Repository keeps ad packages and recruiter ads in Postgres
type Repository interface {
	ListPackages(ctx context.Context, activeOnly bool) ([]Package, error)
	GetPackage(ctx context.Context, id string) (*Package, error)
	CreatePackage(ctx context.Context, p *Package) error
	UpdatePackage(ctx context.Context, p *Package) error

	CreateAd(ctx context.Context, a *Ad) error
	// GetAd reads an ad; lock takes a row lock (transaction only)
	GetAd(ctx context.Context, id string, lock bool) (*Ad, error)
	ListUserAds(ctx context.Context, userID string) ([]Ad, error)
	ListAds(ctx context.Context, q AdminQuery) ([]Ad, int64, error)
	// UpdateUnpaid changes an ad that isn't paid for: its package and content
	UpdateUnpaid(ctx context.Context, a *Ad) error
	// UpdateContent changes the content of a paid ad that's still waiting for review
	UpdateContent(ctx context.Context, id string, c Content) error
	DeleteUnpaid(ctx context.Context, id string) (bool, error)
	// MarkPaid moves an unpaid ad to pending with what was paid. False when it wasn't unpaid.
	MarkPaid(ctx context.Context, a *Ad) (bool, error)
	Approve(ctx context.Context, id, campaignID, adminID string, starts, ends time.Time) error
	Reject(ctx context.Context, id, adminID, reason string, refundedPaise int64) error
	MarkRefunded(ctx context.Context, id string) error
	SetRevision(ctx context.Context, id string, c *Content) error
	// ApplyRevision makes the waiting change the ad's content
	ApplyRevision(ctx context.Context, id string, c Content) error
	RejectRevision(ctx context.Context, id, note string) error
}

type repository struct{ pg *gorm.DB }

func NewRepository(pg *database.PostgresDB) Repository { return &repository{pg: pg.DB} }

func (r *repository) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

// jsonList passes a list to Postgres as JSON, turned into text[] by the query
func jsonList(list []string) string {
	if list == nil {
		list = []string{}
	}
	b, _ := json.Marshal(list)
	return string(b)
}

const toArray = `ARRAY(SELECT jsonb_array_elements_text(?::jsonb))`

func fromJSONList(raw string) []string {
	out := []string{}
	_ = json.Unmarshal([]byte(raw), &out)
	return out
}

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
// Packages
// ---------------------------------------------------------------------------------------------

type packageRow struct {
	ID          string
	Name        string
	Description string
	Days        int
	PricePaise  int64
	Placements  string
	SortOrder   int
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

const packageColumns = `id, name, description, days, price_paise, array_to_json(placements)::text AS placements,
	sort_order, is_active, created_at, updated_at`

func (p packageRow) toDomain() Package {
	return Package{
		ID: p.ID, Name: p.Name, Description: p.Description, Days: p.Days,
		Price: money.ToRupees(p.PricePaise), PricePaise: p.PricePaise, Placements: fromJSONList(p.Placements),
		SortOrder: p.SortOrder, IsActive: p.IsActive, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

func (r *repository) packages(ctx context.Context, sql string, args ...interface{}) ([]Package, error) {
	var rows []packageRow
	if err := r.conn(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Package, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, nil
}

func (r *repository) ListPackages(ctx context.Context, activeOnly bool) ([]Package, error) {
	sql := `SELECT ` + packageColumns + ` FROM ad_packages`
	if activeOnly {
		sql += ` WHERE is_active`
	}
	return r.packages(ctx, sql+` ORDER BY is_active DESC, sort_order, price_paise, id`)
}

func (r *repository) GetPackage(ctx context.Context, id string) (*Package, error) {
	list, err := r.packages(ctx, `SELECT `+packageColumns+` FROM ad_packages WHERE id = ?`, id)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *repository) CreatePackage(ctx context.Context, p *Package) error {
	p.ID = primitive.NewObjectID().Hex()
	list, err := r.packages(ctx, `INSERT INTO ad_packages (id, name, description, days, price_paise, placements, sort_order, is_active)
		VALUES (?, ?, ?, ?, ?, `+toArray+`, ?, ?) RETURNING `+packageColumns,
		p.ID, p.Name, p.Description, p.Days, p.PricePaise, jsonList(p.Placements), p.SortOrder, p.IsActive)
	if err != nil {
		return err
	}
	*p = list[0]
	return nil
}

func (r *repository) UpdatePackage(ctx context.Context, p *Package) error {
	list, err := r.packages(ctx, `UPDATE ad_packages SET name = ?, description = ?, days = ?, price_paise = ?,
		placements = `+toArray+`, sort_order = ?, is_active = ? WHERE id = ? RETURNING `+packageColumns,
		p.Name, p.Description, p.Days, p.PricePaise, jsonList(p.Placements), p.SortOrder, p.IsActive, p.ID)
	if err != nil {
		return err
	}
	if len(list) == 0 {
		return ErrPackageNotFound
	}
	*p = list[0]
	return nil
}

// ---------------------------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------------------------

type adRow struct {
	ID              string
	UserID          string
	PackageID       string
	PackageName     string
	Days            int
	Placements      string
	Advertiser      string
	Headline        string
	Body            string
	CtaLabel        string
	ImageURL        string `gorm:"column:image_url"`
	LinkURL         string `gorm:"column:link_url"`
	Cities          string
	Audiences       string
	Status          string
	Channel         *string
	PricePaise      int64
	PaidBonusPaise  int64
	PaidMainPaise   int64
	PaidOnlinePaise int64
	RazorpayOrderID *string
	RefundedPaise   int64
	CampaignID      *string
	StartsAt        *time.Time
	EndsAt          *time.Time
	Revision        *string
	RevisionAt      *time.Time
	RevisionNote    *string
	RejectReason    *string
	HandledBy       *string
	PaidAt          *time.Time
	DecidedAt       *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

const adColumns = `id, user_id, package_id, package_name, days, array_to_json(placements)::text AS placements,
	advertiser, headline, body, cta_label, image_url, link_url,
	array_to_json(cities)::text AS cities, array_to_json(audiences)::text AS audiences,
	status, channel, price_paise, paid_bonus_paise, paid_main_paise, paid_online_paise, razorpay_order_id,
	refunded_paise, campaign_id, starts_at, ends_at, revision::text AS revision, revision_at, revision_note,
	reject_reason, handled_by, paid_at, decided_at, created_at, updated_at`

func (a adRow) toDomain() Ad {
	ad := Ad{
		ID: a.ID, UserID: a.UserID, PackageID: a.PackageID, PackageName: a.PackageName, Days: a.Days,
		Placements: fromJSONList(a.Placements),
		Content: Content{
			Advertiser: a.Advertiser, Headline: a.Headline, Body: a.Body, CTALabel: a.CtaLabel,
			ImageURL: a.ImageURL, LinkURL: a.LinkURL,
			Cities: fromJSONList(a.Cities), Audiences: fromJSONList(a.Audiences),
		},
		Status: a.Status, Channel: deref(a.Channel),
		Price: money.ToRupees(a.PricePaise), PricePaise: a.PricePaise,
		PaidBonusPaise: a.PaidBonusPaise, PaidMainPaise: a.PaidMainPaise, PaidOnlinePaise: a.PaidOnlinePaise,
		RazorpayOrderID: deref(a.RazorpayOrderID),
		Refunded:        money.ToRupees(a.RefundedPaise), RefundedPaise: a.RefundedPaise,
		CampaignID: deref(a.CampaignID), StartsAt: a.StartsAt, EndsAt: a.EndsAt,
		RevisionAt: a.RevisionAt, RevisionNote: deref(a.RevisionNote),
		RejectReason: deref(a.RejectReason), HandledBy: deref(a.HandledBy),
		PaidAt: a.PaidAt, DecidedAt: a.DecidedAt, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt,
	}
	if a.Revision != nil {
		var c Content
		if json.Unmarshal([]byte(*a.Revision), &c) == nil {
			ad.Revision = &c
		}
	}
	return ad
}

func (r *repository) ads(ctx context.Context, sql string, args ...interface{}) ([]Ad, error) {
	var rows []adRow
	if err := r.conn(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Ad, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, nil
}

func (r *repository) CreateAd(ctx context.Context, a *Ad) error {
	a.ID = primitive.NewObjectID().Hex()
	list, err := r.ads(ctx, `INSERT INTO recruiter_ads (id, user_id, package_id, package_name, days, placements,
			advertiser, headline, body, cta_label, image_url, link_url, cities, audiences, status)
		VALUES (?, ?, ?, ?, ?, `+toArray+`, ?, ?, ?, ?, ?, ?, `+toArray+`, `+toArray+`, 'unpaid')
		RETURNING `+adColumns,
		a.ID, a.UserID, a.PackageID, a.PackageName, a.Days, jsonList(a.Placements),
		a.Advertiser, a.Headline, a.Body, a.CTALabel, a.ImageURL, a.LinkURL, jsonList(a.Cities), jsonList(a.Audiences))
	if err != nil {
		return err
	}
	*a = list[0]
	return nil
}

func (r *repository) GetAd(ctx context.Context, id string, lock bool) (*Ad, error) {
	sql := `SELECT ` + adColumns + ` FROM recruiter_ads WHERE id = ?`
	if lock {
		sql += ` FOR UPDATE`
	}
	list, err := r.ads(ctx, sql, id)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *repository) ListUserAds(ctx context.Context, userID string) ([]Ad, error) {
	return r.ads(ctx, `SELECT `+adColumns+` FROM recruiter_ads WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 200`, userID)
}

func (r *repository) ListAds(ctx context.Context, q AdminQuery) ([]Ad, int64, error) {
	where := `status <> 'unpaid'`
	order := `created_at DESC, id DESC`
	args := []interface{}{}
	switch q.Status {
	case "review":
		// New ads and changes to running ads, oldest first. A change left on an ad that ended no
		// longer matters.
		where = `(status = 'pending' OR (revision IS NOT NULL AND ends_at > now()))`
		order = `COALESCE(revision_at, paid_at, created_at), id`
	case "running":
		where = `status = 'approved' AND ends_at > now()`
	case "ended":
		where = `status = 'approved' AND ends_at <= now()`
	case StatusRejected, StatusRefunded:
		where = `status = ?`
		args = append(args, q.Status)
	}
	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM recruiter_ads WHERE `+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	args = append(args, q.Limit, (q.Page-1)*q.Limit)
	list, err := r.ads(ctx, `SELECT `+adColumns+` FROM recruiter_ads WHERE `+where+` ORDER BY `+order+` LIMIT ? OFFSET ?`, args...)
	return list, total, err
}

func (r *repository) UpdateUnpaid(ctx context.Context, a *Ad) error {
	list, err := r.ads(ctx, `UPDATE recruiter_ads SET package_id = ?, package_name = ?, days = ?, placements = `+toArray+`,
			advertiser = ?, headline = ?, body = ?, cta_label = ?, image_url = ?, link_url = ?,
			cities = `+toArray+`, audiences = `+toArray+`
		WHERE id = ? AND status = 'unpaid' RETURNING `+adColumns,
		a.PackageID, a.PackageName, a.Days, jsonList(a.Placements),
		a.Advertiser, a.Headline, a.Body, a.CTALabel, a.ImageURL, a.LinkURL, jsonList(a.Cities), jsonList(a.Audiences), a.ID)
	if err != nil {
		return err
	}
	if len(list) == 0 {
		return ErrNotUnpaid
	}
	*a = list[0]
	return nil
}

func (r *repository) UpdateContent(ctx context.Context, id string, c Content) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET advertiser = ?, headline = ?, body = ?, cta_label = ?, image_url = ?,
			link_url = ?, cities = `+toArray+`, audiences = `+toArray+`
		WHERE id = ? AND status = 'pending'`,
		c.Advertiser, c.Headline, c.Body, c.CTALabel, c.ImageURL, c.LinkURL, jsonList(c.Cities), jsonList(c.Audiences), id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrCantEdit
	}
	return nil
}

func (r *repository) DeleteUnpaid(ctx context.Context, id string) (bool, error) {
	res := r.conn(ctx).Exec(`DELETE FROM recruiter_ads WHERE id = ? AND status = 'unpaid'`, id)
	return res.RowsAffected > 0, res.Error
}

func (r *repository) MarkPaid(ctx context.Context, a *Ad) (bool, error) {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET status = 'pending', channel = ?, package_id = ?, package_name = ?,
			days = ?, placements = `+toArray+`, price_paise = ?, paid_bonus_paise = ?, paid_main_paise = ?,
			paid_online_paise = ?, razorpay_order_id = ?, paid_at = now()
		WHERE id = ? AND status = 'unpaid'`,
		a.Channel, a.PackageID, a.PackageName, a.Days, jsonList(a.Placements), a.PricePaise,
		a.PaidBonusPaise, a.PaidMainPaise, a.PaidOnlinePaise, nullable(a.RazorpayOrderID), a.ID)
	return res.RowsAffected > 0, res.Error
}

func (r *repository) Approve(ctx context.Context, id, campaignID, adminID string, starts, ends time.Time) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET status = 'approved', campaign_id = ?, starts_at = ?, ends_at = ?,
			handled_by = ?, decided_at = now() WHERE id = ? AND status = 'pending'`,
		campaignID, starts, ends, adminID, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrState
	}
	return nil
}

func (r *repository) Reject(ctx context.Context, id, adminID, reason string, refundedPaise int64) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET status = 'rejected', reject_reason = ?, refunded_paise = ?,
			handled_by = ?, decided_at = now() WHERE id = ? AND status = 'pending'`,
		reason, refundedPaise, adminID, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrState
	}
	return nil
}

func (r *repository) MarkRefunded(ctx context.Context, id string) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET status = 'refunded', revision = NULL, revision_at = NULL,
			refunded_paise = price_paise, decided_at = COALESCE(decided_at, now())
		WHERE id = ? AND status IN ('pending', 'approved')`, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrAlreadyRefund
	}
	return nil
}

func (r *repository) SetRevision(ctx context.Context, id string, c *Content) error {
	b, err := json.Marshal(c)
	if err != nil {
		return err
	}
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET revision = ?::jsonb, revision_at = now(), revision_note = NULL
		WHERE id = ? AND status = 'approved'`, string(b), id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrCantEdit
	}
	return nil
}

func (r *repository) ApplyRevision(ctx context.Context, id string, c Content) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET advertiser = ?, headline = ?, body = ?, cta_label = ?, image_url = ?,
			link_url = ?, revision = NULL, revision_at = NULL, revision_note = NULL
		WHERE id = ? AND status = 'approved' AND revision IS NOT NULL`,
		c.Advertiser, c.Headline, c.Body, c.CTALabel, c.ImageURL, c.LinkURL, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNoRevision
	}
	return nil
}

func (r *repository) RejectRevision(ctx context.Context, id, note string) error {
	res := r.conn(ctx).Exec(`UPDATE recruiter_ads SET revision = NULL, revision_at = NULL, revision_note = ?
		WHERE id = ? AND status = 'approved' AND revision IS NOT NULL`, note, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNoRevision
	}
	return nil
}
