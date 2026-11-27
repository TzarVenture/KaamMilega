package referral

import (
	"context"
	"errors"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// ErrCodeTaken is returned by InsertCode when the code is already someone else's
var ErrCodeTaken = errors.New("referral code taken")

// Repository keeps codes, referrals, aggregators and group rewards in Postgres
type Repository interface {
	GetCode(ctx context.Context, userID string) (string, error)
	// InsertCode saves a new code; ErrCodeTaken when the code belongs to someone else. When the
	// user already has a code, theirs is kept and returned.
	InsertCode(ctx context.Context, userID, code string) (string, error)
	// FindCode returns the code's owner, or "" when there's none
	FindCode(ctx context.Context, code string) (string, error)

	GetByReferred(ctx context.Context, referredID string) (*Referral, error)
	Create(ctx context.Context, r *Referral) error
	// FirstPayment is the member's earliest real payment: its reference and time ("" when none)
	FirstPayment(ctx context.Context, userID string) (string, time.Time, error)
	// NewlyPaid finds pending referrals whose member has now paid, with that first payment
	NewlyPaid(ctx context.Context, limit int) ([]paidHit, error)
	MarkPaid(ctx context.Context, id, ref string, paidAt, releaseAt time.Time) error
	DueIDs(ctx context.Context, now time.Time, limit int) ([]string, error)
	// LockDue locks one referral that's still waiting and due (transaction only); nil when it
	// was already handled
	LockDue(ctx context.Context, id string, now time.Time) (*Referral, error)
	// NetSpentPaise is what the member has really paid for so far, minus what came back
	NetSpentPaise(ctx context.Context, userID string) (int64, error)
	Release(ctx context.Context, id, kind string, rewardPaise int64, now time.Time) error
	Cancel(ctx context.Context, id, reason string, now time.Time) error
	// CancelForUser cancels the unfinished referrals a member made or was invited by
	CancelForUser(ctx context.Context, userID, reason string, now time.Time) error

	ListByReferrer(ctx context.Context, userID string, limit int) ([]Referral, error)
	CountsByReferrer(ctx context.Context, userID string) (Counts, error)
	MemberRewardsPaise(ctx context.Context, userID string) (int64, error)
	ListReferrals(ctx context.Context, status string, page, limit int) ([]Referral, int64, error)

	GetAggregator(ctx context.Context, userID string) (*Aggregator, error)
	// LockAggregator locks the aggregator's row (transaction only); nil when there's none
	LockAggregator(ctx context.Context, userID string) (*Aggregator, error)
	SaveAggregator(ctx context.Context, userID string, active bool, note, by string, now time.Time) error
	ListAggregators(ctx context.Context) ([]Aggregator, error)
	// AggregatorsDue are active aggregators with at least `group` released referrals not yet in a group
	AggregatorsDue(ctx context.Context, group int) ([]string, error)
	UnbatchedCount(ctx context.Context, userID string) (int, error)
	NextBatchNo(ctx context.Context, userID string) (int, error)
	CreatePayout(ctx context.Context, p *Payout) error
	// AssignBatch puts the aggregator's n oldest ungrouped referrals into the payout
	AssignBatch(ctx context.Context, userID, payoutID string, n int) (int64, error)
	PayoutsByUser(ctx context.Context, userID string) ([]Payout, error)
	ListPayouts(ctx context.Context, owedOnly bool, page, limit int) ([]Payout, int64, error)
	LockPayout(ctx context.Context, id string) (*Payout, error)
	MarkCashPaid(ctx context.Context, id, by, note string, now time.Time) error
}

type repository struct{ pg *gorm.DB }

func NewRepository(pg *database.PostgresDB) Repository { return &repository{pg: pg.DB} }

func (r *repository) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

// What counts as a real payment: online payments for anything but a top-up, and money spent from
// the wallet's main balance on a purchase. Bonus credit isn't real money and doesn't count.
const purchaseCategories = `('pass_purchase', 'session_booking', 'event_ticket', 'recruiter_plan', 'recruiter_ad')`

const firstPaymentSQL = `
	SELECT ref, at FROM (
		SELECT 'order:' || id AS ref, paid_at AS at FROM payment_orders
		WHERE user_id = @uid AND purpose <> 'wallet_topup' AND paid_at IS NOT NULL
			AND status IN ('paid', 'refund_due', 'refunded')
		UNION ALL
		SELECT reference_id, created_at FROM wallet_transactions
		WHERE user_id = @uid AND type = 'debit' AND target_balance = 'main' AND status = 'completed'
			AND category IN ` + purchaseCategories + `
	) p ORDER BY at, ref LIMIT 1`

func (r *repository) GetCode(ctx context.Context, userID string) (string, error) {
	var codes []string
	err := r.conn(ctx).Raw(`SELECT code FROM referral_codes WHERE user_id = ?`, userID).Scan(&codes).Error
	if err != nil || len(codes) == 0 {
		return "", err
	}
	return codes[0], nil
}

func (r *repository) InsertCode(ctx context.Context, userID, code string) (string, error) {
	err := r.conn(ctx).Exec(`INSERT INTO referral_codes (user_id, code) VALUES (?, ?) ON CONFLICT (user_id) DO NOTHING`, userID, code).Error
	if err != nil {
		if database.PgErrCode(err) == "23505" {
			return "", ErrCodeTaken
		}
		return "", err
	}
	return r.GetCode(ctx, userID)
}

func (r *repository) FindCode(ctx context.Context, code string) (string, error) {
	var ids []string
	err := r.conn(ctx).Raw(`SELECT user_id FROM referral_codes WHERE code = ?`, code).Scan(&ids).Error
	if err != nil || len(ids) == 0 {
		return "", err
	}
	return ids[0], nil
}

// ---------------------------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------------------------

type referralRow struct {
	ID           string
	ReferrerID   string
	ReferredID   string
	Status       string
	FirstPayment *string
	PaidAt       *time.Time
	ReleaseAt    *time.Time
	ReleasedAt   *time.Time
	RewardKind   *string
	RewardPaise  int64
	PayoutID     *string
	CancelReason *string
	CreatedAt    time.Time
}

const referralColumns = `id, referrer_id, referred_id, status, first_payment, paid_at, release_at, released_at,
	reward_kind, reward_paise, payout_id, cancel_reason, created_at`

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (row referralRow) toReferral() Referral {
	return Referral{
		ID: row.ID, ReferrerID: row.ReferrerID, ReferredID: row.ReferredID, Status: row.Status,
		FirstPayment: deref(row.FirstPayment), PaidAt: row.PaidAt, ReleaseAt: row.ReleaseAt, ReleasedAt: row.ReleasedAt,
		RewardKind: deref(row.RewardKind), Reward: money.ToRupees(row.RewardPaise), PayoutID: deref(row.PayoutID),
		CancelReason: deref(row.CancelReason), CreatedAt: row.CreatedAt,
	}
}

func toReferrals(rows []referralRow) []Referral {
	out := make([]Referral, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toReferral())
	}
	return out
}

func (r *repository) one(ctx context.Context, sql string, args ...interface{}) (*Referral, error) {
	var rows []referralRow
	if err := r.conn(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	ref := rows[0].toReferral()
	return &ref, nil
}

func (r *repository) GetByReferred(ctx context.Context, referredID string) (*Referral, error) {
	return r.one(ctx, `SELECT `+referralColumns+` FROM referrals WHERE referred_id = ?`, referredID)
}

func (r *repository) Create(ctx context.Context, ref *Referral) error {
	return r.conn(ctx).Exec(`INSERT INTO referrals (id, referrer_id, referred_id, status, created_at, updated_at)
		VALUES (?, ?, ?, 'pending', ?, ?)`, ref.ID, ref.ReferrerID, ref.ReferredID, ref.CreatedAt, ref.CreatedAt).Error
}

func (r *repository) FirstPayment(ctx context.Context, userID string) (string, time.Time, error) {
	var rows []struct {
		Ref string
		At  time.Time
	}
	if err := r.conn(ctx).Raw(firstPaymentSQL, map[string]interface{}{"uid": userID}).Scan(&rows).Error; err != nil {
		return "", time.Time{}, err
	}
	if len(rows) == 0 {
		return "", time.Time{}, nil
	}
	return rows[0].Ref, rows[0].At, nil
}

type paidHit struct {
	ID  string
	Ref string
	At  time.Time
}

func (r *repository) NewlyPaid(ctx context.Context, limit int) ([]paidHit, error) {
	var rows []paidHit
	err := r.conn(ctx).Raw(`
		SELECT r.id, f.ref, f.at FROM referrals r
		CROSS JOIN LATERAL (
			SELECT ref, at FROM (
				SELECT 'order:' || o.id AS ref, o.paid_at AS at FROM payment_orders o
				WHERE o.user_id = r.referred_id AND o.purpose <> 'wallet_topup' AND o.paid_at IS NOT NULL
					AND o.status IN ('paid', 'refund_due', 'refunded')
				UNION ALL
				SELECT t.reference_id, t.created_at FROM wallet_transactions t
				WHERE t.user_id = r.referred_id AND t.type = 'debit' AND t.target_balance = 'main'
					AND t.status = 'completed' AND t.category IN `+purchaseCategories+`
			) p ORDER BY at, ref LIMIT 1
		) f
		WHERE r.status = 'pending'
		ORDER BY r.created_at LIMIT ?`, limit).Scan(&rows).Error
	return rows, err
}

func (r *repository) MarkPaid(ctx context.Context, id, ref string, paidAt, releaseAt time.Time) error {
	return r.conn(ctx).Exec(`UPDATE referrals SET status = 'paid', first_payment = ?, paid_at = ?, release_at = ?,
		updated_at = now() WHERE id = ? AND status = 'pending'`, ref, paidAt, releaseAt, id).Error
}

func (r *repository) DueIDs(ctx context.Context, now time.Time, limit int) ([]string, error) {
	var ids []string
	err := r.conn(ctx).Raw(`SELECT id FROM referrals WHERE status = 'paid' AND release_at <= ? ORDER BY release_at LIMIT ?`,
		now, limit).Scan(&ids).Error
	return ids, err
}

func (r *repository) LockDue(ctx context.Context, id string, now time.Time) (*Referral, error) {
	return r.one(ctx, `SELECT `+referralColumns+` FROM referrals WHERE id = ? AND status = 'paid' AND release_at <= ? FOR UPDATE`, id, now)
}

func (r *repository) NetSpentPaise(ctx context.Context, userID string) (int64, error) {
	var net []int64
	// Online orders count what was kept after any refund (a partial refund leaves the rest). Refunds
	// to the wallet count against it, except a top-up refund's own money coming back
	// (that was never a purchase). jsonb_exists is the ? operator, which the driver would read as
	// a placeholder.
	err := r.conn(ctx).Raw(`SELECT
		COALESCE((SELECT SUM(amount_paise - refund_paise) FROM payment_orders
			WHERE user_id = @uid AND purpose <> 'wallet_topup' AND status IN ('paid', 'refund_due', 'refunded')), 0)
		+ COALESCE((SELECT SUM(amount_paise) FROM wallet_transactions
			WHERE user_id = @uid AND type = 'debit' AND target_balance = 'main' AND status = 'completed'
				AND category IN `+purchaseCategories+`), 0)
		- COALESCE((SELECT SUM(amount_paise) FROM wallet_transactions
			WHERE user_id = @uid AND type = 'credit' AND target_balance = 'main' AND status = 'completed'
				AND category = 'refund' AND NOT COALESCE(jsonb_exists(metadata, 'topup_refund_id'), false)), 0)`,
		map[string]interface{}{"uid": userID}).Scan(&net).Error
	if err != nil || len(net) == 0 {
		return 0, err
	}
	return net[0], nil
}

func (r *repository) Release(ctx context.Context, id, kind string, rewardPaise int64, now time.Time) error {
	return r.conn(ctx).Exec(`UPDATE referrals SET status = 'released', released_at = ?, reward_kind = ?, reward_paise = ?,
		updated_at = now() WHERE id = ? AND status = 'paid'`, now, kind, rewardPaise, id).Error
}

func (r *repository) Cancel(ctx context.Context, id, reason string, now time.Time) error {
	return r.conn(ctx).Exec(`UPDATE referrals SET status = 'cancelled', cancel_reason = ?, updated_at = ?
		WHERE id = ? AND status IN ('pending', 'paid')`, reason, now, id).Error
}

func (r *repository) CancelForUser(ctx context.Context, userID, reason string, now time.Time) error {
	return r.conn(ctx).Exec(`UPDATE referrals SET status = 'cancelled', cancel_reason = ?, updated_at = ?
		WHERE (referrer_id = ? OR referred_id = ?) AND status IN ('pending', 'paid')`, reason, now, userID, userID).Error
}

func (r *repository) ListByReferrer(ctx context.Context, userID string, limit int) ([]Referral, error) {
	var rows []referralRow
	err := r.conn(ctx).Raw(`SELECT `+referralColumns+` FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC LIMIT ?`,
		userID, limit).Scan(&rows).Error
	return toReferrals(rows), err
}

func (r *repository) CountsByReferrer(ctx context.Context, userID string) (Counts, error) {
	var rows []struct {
		Status string
		N      int
	}
	var c Counts
	err := r.conn(ctx).Raw(`SELECT status, count(*) AS n FROM referrals WHERE referrer_id = ? GROUP BY status`, userID).Scan(&rows).Error
	for _, row := range rows {
		switch row.Status {
		case StatusPending:
			c.Joined = row.N
		case StatusPaid:
			c.Waiting = row.N
		case StatusReleased:
			c.Released = row.N
		case StatusCancelled:
			c.Cancelled = row.N
		}
	}
	return c, err
}

func (r *repository) MemberRewardsPaise(ctx context.Context, userID string) (int64, error) {
	var sum []int64
	err := r.conn(ctx).Raw(`SELECT COALESCE(SUM(reward_paise), 0) FROM referrals WHERE referrer_id = ? AND status = 'released'`, userID).Scan(&sum).Error
	if err != nil || len(sum) == 0 {
		return 0, err
	}
	return sum[0], nil
}

func (r *repository) ListReferrals(ctx context.Context, status string, page, limit int) ([]Referral, int64, error) {
	where, args := "", []interface{}{}
	if status != "" {
		where, args = " WHERE status = ?", append(args, status)
	}
	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM referrals`+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []referralRow
	err := r.conn(ctx).Raw(`SELECT `+referralColumns+` FROM referrals`+where+` ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		append(args, limit, (page-1)*limit)...).Scan(&rows).Error
	return toReferrals(rows), total, err
}

// ---------------------------------------------------------------------------------------------
// Aggregators and group rewards
// ---------------------------------------------------------------------------------------------

type aggregatorRow struct {
	UserID     string
	Active     bool
	Note       string
	ApprovedBy string
	ApprovedAt time.Time
}

func (row aggregatorRow) toAggregator() *Aggregator {
	return &Aggregator{UserID: row.UserID, Active: row.Active, Note: row.Note, ApprovedBy: row.ApprovedBy, ApprovedAt: row.ApprovedAt}
}

func (r *repository) aggregator(ctx context.Context, sql string, userID string) (*Aggregator, error) {
	var rows []aggregatorRow
	if err := r.conn(ctx).Raw(sql, userID).Scan(&rows).Error; err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0].toAggregator(), nil
}

func (r *repository) GetAggregator(ctx context.Context, userID string) (*Aggregator, error) {
	return r.aggregator(ctx, `SELECT user_id, active, note, approved_by, approved_at FROM referral_aggregators WHERE user_id = ?`, userID)
}

func (r *repository) LockAggregator(ctx context.Context, userID string) (*Aggregator, error) {
	return r.aggregator(ctx, `SELECT user_id, active, note, approved_by, approved_at FROM referral_aggregators WHERE user_id = ? FOR UPDATE`, userID)
}

func (r *repository) SaveAggregator(ctx context.Context, userID string, active bool, note, by string, now time.Time) error {
	// Approving again records who approved it this time; removing keeps the original approval
	return r.conn(ctx).Exec(`INSERT INTO referral_aggregators (user_id, active, note, approved_by, approved_at, updated_at)
		VALUES (@uid, @active, @note, @by, @now, @now)
		ON CONFLICT (user_id) DO UPDATE SET active = @active, note = @note, updated_at = @now,
			approved_by = CASE WHEN @active THEN @by ELSE referral_aggregators.approved_by END,
			approved_at = CASE WHEN @active AND NOT referral_aggregators.active THEN @now ELSE referral_aggregators.approved_at END`,
		map[string]interface{}{"uid": userID, "active": active, "note": note, "by": by, "now": now}).Error
}

func (r *repository) ListAggregators(ctx context.Context) ([]Aggregator, error) {
	// Fields listed out: GORM does not fill an embedded unexported struct
	var rows []struct {
		UserID      string
		Active      bool
		Note        string
		ApprovedBy  string
		ApprovedAt  time.Time
		Released    int
		Waiting     int
		CreditPaise int64
		CashOwed    int64
	}
	err := r.conn(ctx).Raw(`SELECT a.user_id, a.active, a.note, a.approved_by, a.approved_at,
			(SELECT count(*) FROM referrals x WHERE x.referrer_id = a.user_id AND x.status = 'released') AS released,
			(SELECT count(*) FROM referrals x WHERE x.referrer_id = a.user_id AND x.status = 'paid') AS waiting,
			(SELECT COALESCE(SUM(credit_paise), 0) FROM referral_payouts p WHERE p.user_id = a.user_id) AS credit_paise,
			(SELECT COALESCE(SUM(cash_paise), 0) FROM referral_payouts p WHERE p.user_id = a.user_id AND p.cash_paid_at IS NULL) AS cash_owed
		FROM referral_aggregators a ORDER BY a.active DESC, a.approved_at DESC`).Scan(&rows).Error
	out := make([]Aggregator, 0, len(rows))
	for _, row := range rows {
		a := aggregatorRow{UserID: row.UserID, Active: row.Active, Note: row.Note, ApprovedBy: row.ApprovedBy, ApprovedAt: row.ApprovedAt}.toAggregator()
		a.Released, a.Waiting = row.Released, row.Waiting
		a.CreditEarned, a.CashOwed = money.ToRupees(row.CreditPaise), money.ToRupees(row.CashOwed)
		out = append(out, *a)
	}
	return out, err
}

func (r *repository) AggregatorsDue(ctx context.Context, group int) ([]string, error) {
	var ids []string
	err := r.conn(ctx).Raw(`SELECT x.referrer_id FROM referrals x
		JOIN referral_aggregators a ON a.user_id = x.referrer_id AND a.active
		WHERE x.reward_kind = 'aggregator' AND x.payout_id IS NULL
		GROUP BY x.referrer_id HAVING count(*) >= ?`, group).Scan(&ids).Error
	return ids, err
}

func (r *repository) UnbatchedCount(ctx context.Context, userID string) (int, error) {
	var n []int
	err := r.conn(ctx).Raw(`SELECT count(*) FROM referrals WHERE referrer_id = ? AND reward_kind = 'aggregator' AND payout_id IS NULL`, userID).Scan(&n).Error
	if err != nil || len(n) == 0 {
		return 0, err
	}
	return n[0], nil
}

func (r *repository) NextBatchNo(ctx context.Context, userID string) (int, error) {
	var n []int
	err := r.conn(ctx).Raw(`SELECT COALESCE(MAX(batch_no), 0) + 1 FROM referral_payouts WHERE user_id = ?`, userID).Scan(&n).Error
	if err != nil || len(n) == 0 {
		return 1, err
	}
	return n[0], nil
}

func (r *repository) CreatePayout(ctx context.Context, p *Payout) error {
	return r.conn(ctx).Exec(`INSERT INTO referral_payouts (id, user_id, batch_no, referrals, credit_paise, cash_paise, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`, p.ID, p.UserID, p.BatchNo, p.Referrals, money.ToPaise(p.Credit), money.ToPaise(p.Cash), p.CreatedAt).Error
}

func (r *repository) AssignBatch(ctx context.Context, userID, payoutID string, n int) (int64, error) {
	res := r.conn(ctx).Exec(`UPDATE referrals SET payout_id = ?, updated_at = now() WHERE id IN (
		SELECT id FROM referrals WHERE referrer_id = ? AND reward_kind = 'aggregator' AND payout_id IS NULL
		ORDER BY released_at, id LIMIT ?)`, payoutID, userID, n)
	return res.RowsAffected, res.Error
}

type payoutRow struct {
	ID          string
	UserID      string
	BatchNo     int
	Referrals   int
	CreditPaise int64
	CashPaise   int64
	CashPaidAt  *time.Time
	CashPaidBy  *string
	CashNote    string
	CreatedAt   time.Time
}

const payoutColumns = `id, user_id, batch_no, referrals, credit_paise, cash_paise, cash_paid_at, cash_paid_by, cash_note, created_at`

func toPayouts(rows []payoutRow) []Payout {
	out := make([]Payout, 0, len(rows))
	for _, row := range rows {
		out = append(out, Payout{ID: row.ID, UserID: row.UserID, BatchNo: row.BatchNo, Referrals: row.Referrals,
			Credit: money.ToRupees(row.CreditPaise), Cash: money.ToRupees(row.CashPaise), CashPaidAt: row.CashPaidAt,
			CashPaidBy: deref(row.CashPaidBy), CashNote: row.CashNote, CreatedAt: row.CreatedAt})
	}
	return out
}

func (r *repository) PayoutsByUser(ctx context.Context, userID string) ([]Payout, error) {
	var rows []payoutRow
	err := r.conn(ctx).Raw(`SELECT `+payoutColumns+` FROM referral_payouts WHERE user_id = ? ORDER BY batch_no`, userID).Scan(&rows).Error
	return toPayouts(rows), err
}

func (r *repository) ListPayouts(ctx context.Context, owedOnly bool, page, limit int) ([]Payout, int64, error) {
	where := ""
	if owedOnly {
		where = " WHERE cash_paid_at IS NULL AND cash_paise > 0"
	}
	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM referral_payouts` + where).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []payoutRow
	err := r.conn(ctx).Raw(`SELECT `+payoutColumns+` FROM referral_payouts`+where+` ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, (page-1)*limit).Scan(&rows).Error
	return toPayouts(rows), total, err
}

func (r *repository) LockPayout(ctx context.Context, id string) (*Payout, error) {
	var rows []payoutRow
	if err := r.conn(ctx).Raw(`SELECT `+payoutColumns+` FROM referral_payouts WHERE id = ? FOR UPDATE`, id).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &toPayouts(rows)[0], nil
}

func (r *repository) MarkCashPaid(ctx context.Context, id, by, note string, now time.Time) error {
	return r.conn(ctx).Exec(`UPDATE referral_payouts SET cash_paid_at = ?, cash_paid_by = ?, cash_note = ? WHERE id = ? AND cash_paid_at IS NULL`,
		now, by, note, id).Error
}

// newID is a fresh id for a row
func newID() string { return primitive.NewObjectID().Hex() }
