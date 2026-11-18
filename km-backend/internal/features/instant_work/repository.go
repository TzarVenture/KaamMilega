package instant_work

import (
	"context"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// workerStaleAfter is how long a worker stays on the radar without a location ping
const workerStaleAfter = 5 * time.Minute

// Statuses in which a job still needs its worker
var candidateActiveStatuses = []JobStatus{JobStatusAccepted, JobStatusInProgress, JobStatusCompleted}

// Statuses in which a hirer's job is still open
var recruiterActiveStatuses = []JobStatus{JobStatusDispatching, JobStatusAccepted, JobStatusInProgress, JobStatusCompleted}

type InstantWorkRepository interface {
	EnsureIndexes(ctx context.Context) error

	// Workers
	SetWorkerAvailability(ctx context.Context, worker *InstantWorker, updateLocation bool) (*InstantWorker, error)
	GetWorkerByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantWorker, error)
	UpdateWorkerPing(ctx context.Context, userID primitive.ObjectID, location GeoJSONPoint) error
	SetWorkerFreeNow(ctx context.Context, userID primitive.ObjectID, free bool) error
	IncrementWorkerGigs(ctx context.Context, userID primitive.ObjectID) error
	FindNearbyWorkers(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, limit int) ([]NearbyCandidateResult, error)

	// Passes
	CreatePass(ctx context.Context, pass *InstantPass) error
	GetActivePassByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error)
	GetPassByID(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error)
	GetPassByOrderID(ctx context.Context, orderID string) (*InstantPass, error)
	RetireFinishedPasses(ctx context.Context, userID primitive.ObjectID) error
	RefundUnusedPass(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error)
	UseCredit(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error)
	SyncWorkerPass(ctx context.Context, userID primitive.ObjectID, quota int, expiresAt time.Time) error

	// Jobs
	CreateJob(ctx context.Context, job *InstantJob) error
	GetJobByID(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error)
	FindNearbyJobsForWorker(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, excludeRecruiter primitive.ObjectID) ([]InstantJob, error)
	GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error)
	GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error)
	ExpireStaleJobs(ctx context.Context, recruiterID primitive.ObjectID) error
	ClaimJobAtomic(ctx context.Context, jobID primitive.ObjectID, candidateID primitive.ObjectID, candidateName string, candidateMobile string) (*InstantJob, error)
	CompleteJob(ctx context.Context, jobID, candidateID primitive.ObjectID) (*InstantJob, error)
	CloseJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error)
	CancelJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error)
}

// InstantWorkRepositoryImpl keeps workers, passes and gigs in Postgres. Locations are PostGIS
// geography points, so distances are real metres on the earth's surface.
type InstantWorkRepositoryImpl struct {
	pg *gorm.DB
}

func NewInstantWorkRepository(pg *database.PostgresDB) InstantWorkRepository {
	return &InstantWorkRepositoryImpl{pg: pg.DB}
}

func (r *InstantWorkRepositoryImpl) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

// EnsureIndexes is a no-op: the indexes (including the one-current-pass rule and the location
// indexes) are created by the migrations.
func (r *InstantWorkRepositoryImpl) EnsureIndexes(ctx context.Context) error { return nil }

// point is the SQL for a geography point from longitude and latitude placeholders
const point = `ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography`

func geoPoint(lng, lat float64) GeoJSONPoint {
	return GeoJSONPoint{Type: "Point", Coordinates: []float64{lng, lat}}
}

func pointArgs(p GeoJSONPoint) (float64, float64) {
	if len(p.Coordinates) < 2 {
		return 0, 0
	}
	return p.Coordinates[0], p.Coordinates[1]
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

func timeOrZero(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}

func nullTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func statusList(list []JobStatus) []string {
	out := make([]string, len(list))
	for i, s := range list {
		out[i] = string(s)
	}
	return out
}

// ---------------------------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------------------------

type workerRow struct {
	ID              string
	UserID          string
	Name            string
	Avatar          string
	Mobile          string
	ActiveSkill     string
	HourlyRatePaise int64
	Rating          float64
	TotalGigs       int
	Lng             *float64
	Lat             *float64
	IsFreeNow       bool
	LastPingAt      *time.Time
	QuotaRemaining  int
	PassExpiresAt   *time.Time
	UpdatedAt       time.Time
	DistanceMeters  float64
}

const workerColumns = `id, user_id, name, avatar, mobile, active_skill, hourly_rate_paise, rating::float8 AS rating, total_gigs,
	ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat, is_free_now, last_ping_at, quota_remaining,
	pass_expires_at, updated_at`

func (w workerRow) location() GeoJSONPoint {
	if w.Lng == nil || w.Lat == nil {
		return GeoJSONPoint{}
	}
	return geoPoint(*w.Lng, *w.Lat)
}

func (w workerRow) toDomain() *InstantWorker {
	return &InstantWorker{
		ID:             database.OID(w.ID),
		UserID:         database.OID(w.UserID),
		Name:           w.Name,
		Avatar:         w.Avatar,
		Mobile:         w.Mobile,
		ActiveSkill:    w.ActiveSkill,
		HourlyRate:     money.ToRupees(w.HourlyRatePaise),
		Rating:         w.Rating,
		TotalGigs:      w.TotalGigs,
		Location:       w.location(),
		IsFreeNow:      w.IsFreeNow,
		LastPingAt:     timeOrZero(w.LastPingAt),
		QuotaRemaining: w.QuotaRemaining,
		PassExpiresAt:  timeOrZero(w.PassExpiresAt),
		UpdatedAt:      w.UpdatedAt,
	}
}

// SetWorkerAvailability saves the worker's Free Now state, skill and rate. A new worker starts
// with no rating and no gigs. The location is only changed when updateLocation is set.
func (r *InstantWorkRepositoryImpl) SetWorkerAvailability(ctx context.Context, w *InstantWorker, updateLocation bool) (*InstantWorker, error) {
	lng, lat := pointArgs(w.Location)
	var rows []workerRow
	err := r.conn(ctx).Raw(`INSERT INTO instant_workers AS iw
			(id, user_id, name, avatar, mobile, active_skill, hourly_rate_paise, location, last_ping_at, is_free_now,
			 quota_remaining, pass_expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?,
			CASE WHEN ? THEN `+point+` END,
			CASE WHEN ? THEN now() END,
			?, ?, ?)
		ON CONFLICT (user_id) DO UPDATE SET
			name = EXCLUDED.name, avatar = EXCLUDED.avatar, mobile = EXCLUDED.mobile,
			is_free_now = EXCLUDED.is_free_now, quota_remaining = EXCLUDED.quota_remaining,
			pass_expires_at = EXCLUDED.pass_expires_at,
			active_skill = CASE WHEN ? <> '' THEN EXCLUDED.active_skill ELSE iw.active_skill END,
			hourly_rate_paise = CASE WHEN ? <> '' THEN EXCLUDED.hourly_rate_paise ELSE iw.hourly_rate_paise END,
			location = CASE WHEN ? THEN EXCLUDED.location ELSE iw.location END,
			last_ping_at = CASE WHEN ? THEN EXCLUDED.last_ping_at ELSE iw.last_ping_at END
		RETURNING `+workerColumns,
		primitive.NewObjectID().Hex(), w.UserID.Hex(), w.Name, w.Avatar, w.Mobile, w.ActiveSkill, money.ToPaise(w.HourlyRate),
		updateLocation, lng, lat,
		updateLocation,
		w.IsFreeNow, w.QuotaRemaining, nullTime(w.PassExpiresAt),
		w.ActiveSkill, w.ActiveSkill, updateLocation, updateLocation).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows[0].toDomain(), nil
}

func (r *InstantWorkRepositoryImpl) GetWorkerByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantWorker, error) {
	var rows []workerRow
	if err := r.conn(ctx).Raw(`SELECT `+workerColumns+` FROM instant_workers WHERE user_id = ?`, userID.Hex()).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0].toDomain(), nil
}

func (r *InstantWorkRepositoryImpl) UpdateWorkerPing(ctx context.Context, userID primitive.ObjectID, location GeoJSONPoint) error {
	lng, lat := pointArgs(location)
	return r.conn(ctx).Exec(`UPDATE instant_workers SET location = `+point+`, last_ping_at = now() WHERE user_id = ?`,
		lng, lat, userID.Hex()).Error
}

func (r *InstantWorkRepositoryImpl) SetWorkerFreeNow(ctx context.Context, userID primitive.ObjectID, free bool) error {
	return r.conn(ctx).Exec(`UPDATE instant_workers SET is_free_now = ? WHERE user_id = ?`, free, userID.Hex()).Error
}

func (r *InstantWorkRepositoryImpl) IncrementWorkerGigs(ctx context.Context, userID primitive.ObjectID) error {
	// Upsert: a worker can take a gig from the feed without ever going Free Now
	return r.conn(ctx).Exec(`INSERT INTO instant_workers (id, user_id, total_gigs) VALUES (?, ?, 1)
		ON CONFLICT (user_id) DO UPDATE SET total_gigs = instant_workers.total_gigs + 1`,
		primitive.NewObjectID().Hex(), userID.Hex()).Error
}

// FindNearbyWorkers lists free workers with credits and a valid pass who pinged recently,
// best rated first, then nearest
func (r *InstantWorkRepositoryImpl) FindNearbyWorkers(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, limit int) ([]NearbyCandidateResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 25
	}
	q := `SELECT ` + workerColumns + `, ST_Distance(location, ` + point + `) AS distance_meters
		FROM instant_workers
		WHERE is_free_now AND quota_remaining > 0 AND pass_expires_at > now() AND last_ping_at >= ?
		  AND location IS NOT NULL AND ST_DWithin(location, ` + point + `, ?)`
	args := []interface{}{lng, lat, time.Now().Add(-workerStaleAfter), lng, lat, radiusMeters}
	if skill != "" && skill != "all" {
		q += ` AND lower(active_skill) = lower(?)`
		args = append(args, skill)
	}
	q += ` ORDER BY rating DESC, distance_meters, id LIMIT ?`
	args = append(args, limit)

	var rows []workerRow
	if err := r.conn(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]NearbyCandidateResult, 0, len(rows))
	for _, w := range rows {
		out = append(out, NearbyCandidateResult{
			ID:             database.OID(w.ID),
			UserID:         database.OID(w.UserID),
			Name:           w.Name,
			Avatar:         w.Avatar,
			ActiveSkill:    w.ActiveSkill,
			HourlyRate:     money.ToRupees(w.HourlyRatePaise),
			Rating:         w.Rating,
			TotalGigs:      w.TotalGigs,
			Location:       w.location(),
			DistanceMeters: w.DistanceMeters,
			DistanceKm:     w.DistanceMeters / 1000.0,
		})
	}
	return out, nil
}

// SyncWorkerPass copies the pass credits and expiry onto the worker's radar record
func (r *InstantWorkRepositoryImpl) SyncWorkerPass(ctx context.Context, userID primitive.ObjectID, quota int, expiresAt time.Time) error {
	return r.conn(ctx).Exec(`UPDATE instant_workers SET quota_remaining = ?, pass_expires_at = ? WHERE user_id = ?`,
		quota, nullTime(expiresAt), userID.Hex()).Error
}

// ---------------------------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------------------------

type passRow struct {
	ID                string
	UserID            string
	HasActivePass     bool
	Channel           *string
	EndedReason       *string
	QuotaTotal        int
	QuotaRemaining    int
	PricePaise        int64
	RazorpayOrderID   *string
	RazorpayPaymentID *string
	ActivatedAt       time.Time
	ExpiresAt         time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

const passColumns = `id, user_id, has_active_pass, channel, ended_reason, quota_total, quota_remaining, price_paise,
	razorpay_order_id, razorpay_payment_id, activated_at, expires_at, created_at, updated_at`

func (p passRow) toDomain() *InstantPass {
	return &InstantPass{
		ID:                database.OID(p.ID),
		UserID:            database.OID(p.UserID),
		HasActivePass:     p.HasActivePass,
		Channel:           deref(p.Channel),
		EndedReason:       deref(p.EndedReason),
		QuotaTotal:        p.QuotaTotal,
		QuotaRemaining:    p.QuotaRemaining,
		PriceINR:          money.ToRupees(p.PricePaise),
		RazorpayOrderID:   deref(p.RazorpayOrderID),
		RazorpayPaymentID: deref(p.RazorpayPaymentID),
		ActivatedAt:       p.ActivatedAt,
		ExpiresAt:         p.ExpiresAt,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
	}
}

func (r *InstantWorkRepositoryImpl) passQuery(ctx context.Context, sql string, args ...interface{}) (*InstantPass, error) {
	var rows []passRow
	if err := r.conn(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0].toDomain(), nil
}

// CreatePass inserts a new current pass. ErrPassAlreadyActive means the user already has one.
func (r *InstantWorkRepositoryImpl) CreatePass(ctx context.Context, pass *InstantPass) error {
	if pass.ID.IsZero() {
		pass.ID = primitive.NewObjectID()
	}
	now := time.Now()
	pass.CreatedAt, pass.UpdatedAt = now, now
	err := r.conn(ctx).Exec(`INSERT INTO instant_passes
		(id, user_id, has_active_pass, channel, ended_reason, quota_total, quota_remaining, price_paise, razorpay_order_id,
		 razorpay_payment_id, activated_at, expires_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		pass.ID.Hex(), pass.UserID.Hex(), pass.HasActivePass, nullable(pass.Channel), nullable(pass.EndedReason),
		pass.QuotaTotal, pass.QuotaRemaining, money.ToPaise(pass.PriceINR), nullable(pass.RazorpayOrderID),
		nullable(pass.RazorpayPaymentID), pass.ActivatedAt, pass.ExpiresAt, now, now).Error
	if database.PgConstraint(err) == "instant_passes_one_current_idx" {
		return ErrPassAlreadyActive
	}
	return err
}

// GetActivePassByUserID returns the user's current pass if it hasn't expired, even with no credits left
func (r *InstantWorkRepositoryImpl) GetActivePassByUserID(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error) {
	return r.passQuery(ctx, `SELECT `+passColumns+` FROM instant_passes WHERE user_id = ? AND has_active_pass AND expires_at > now()`, userID.Hex())
}

func (r *InstantWorkRepositoryImpl) GetPassByID(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error) {
	return r.passQuery(ctx, `SELECT `+passColumns+` FROM instant_passes WHERE id = ?`, passID.Hex())
}

func (r *InstantWorkRepositoryImpl) GetPassByOrderID(ctx context.Context, orderID string) (*InstantPass, error) {
	return r.passQuery(ctx, `SELECT `+passColumns+` FROM instant_passes WHERE razorpay_order_id = ?`, orderID)
}

// RetireFinishedPasses ends the user's current pass if it has expired or has no credits left,
// so a new one can replace it
func (r *InstantWorkRepositoryImpl) RetireFinishedPasses(ctx context.Context, userID primitive.ObjectID) error {
	return r.conn(ctx).Exec(`UPDATE instant_passes SET has_active_pass = false, ended_reason = 'replaced'
		WHERE user_id = ? AND has_active_pass AND (expires_at <= now() OR quota_remaining <= 0)`, userID.Hex()).Error
}

// RefundUnusedPass ends a current pass that has all its credits. ErrPassUsed if any were spent.
func (r *InstantWorkRepositoryImpl) RefundUnusedPass(ctx context.Context, passID primitive.ObjectID) (*InstantPass, error) {
	pass, err := r.passQuery(ctx, `UPDATE instant_passes SET has_active_pass = false, ended_reason = 'refunded', quota_remaining = 0
		WHERE id = ? AND has_active_pass AND quota_remaining = quota_total RETURNING `+passColumns, passID.Hex())
	if err != nil {
		return nil, err
	}
	if pass == nil {
		return nil, ErrPassUsed
	}
	return pass, nil
}

// UseCredit takes one credit from the current, unexpired pass. ErrPassQuotaExhausted if there's none.
// Run it in the same transaction as the claim, so a failed claim gives the credit back. The row
// lock it takes also makes a worker's claims run one at a time.
func (r *InstantWorkRepositoryImpl) UseCredit(ctx context.Context, userID primitive.ObjectID) (*InstantPass, error) {
	pass, err := r.passQuery(ctx, `UPDATE instant_passes SET quota_remaining = quota_remaining - 1
		WHERE user_id = ? AND has_active_pass AND quota_remaining > 0 AND expires_at > now() RETURNING `+passColumns, userID.Hex())
	if err != nil {
		return nil, err
	}
	if pass == nil {
		return nil, ErrPassQuotaExhausted
	}
	return pass, nil
}

// ---------------------------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------------------------

type jobRow struct {
	ID              string
	RecruiterID     string
	RecruiterName   string
	RecruiterMobile *string
	CompanyName     string
	Skill           string
	Lng             float64
	Lat             float64
	Address         string
	PayRatePaise    int64
	RateType        string
	DurationHours   int
	RequiredWorkers int
	Notes           string
	Status          string
	CandidateID     *string
	CandidateName   *string
	CandidateMobile *string
	MatchedAt       *time.Time
	CompletedAt     *time.Time
	ClosedAt        *time.Time
	CancelledAt     *time.Time
	ExpiresAt       time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DistanceMeters  float64
}

const jobColumns = `id, recruiter_id, recruiter_name, recruiter_mobile, company_name, skill,
	ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat, address, pay_rate_paise, rate_type, duration_hours,
	required_workers, notes, status, candidate_id, candidate_name, candidate_mobile, matched_at, completed_at, closed_at,
	cancelled_at, expires_at, created_at, updated_at`

func (j jobRow) toDomain() *InstantJob {
	out := &InstantJob{
		ID:              database.OID(j.ID),
		RecruiterID:     database.OID(j.RecruiterID),
		RecruiterName:   j.RecruiterName,
		RecruiterMobile: deref(j.RecruiterMobile),
		CompanyName:     j.CompanyName,
		Skill:           j.Skill,
		Location:        geoPoint(j.Lng, j.Lat),
		Address:         j.Address,
		PayRate:         money.ToRupees(j.PayRatePaise),
		RateType:        j.RateType,
		DurationHours:   j.DurationHours,
		RequiredWorkers: j.RequiredWorkers,
		Notes:           j.Notes,
		Status:          JobStatus(j.Status),
		CandidateName:   deref(j.CandidateName),
		CandidateMobile: deref(j.CandidateMobile),
		MatchedAt:       j.MatchedAt,
		CompletedAt:     j.CompletedAt,
		ClosedAt:        j.ClosedAt,
		CancelledAt:     j.CancelledAt,
		ExpiresAt:       j.ExpiresAt,
		DistanceMeters:  j.DistanceMeters,
		CreatedAt:       j.CreatedAt,
		UpdatedAt:       j.UpdatedAt,
	}
	if j.CandidateID != nil {
		id := database.OID(*j.CandidateID)
		out.CandidateID = &id
	}
	return out
}

func (r *InstantWorkRepositoryImpl) jobQuery(ctx context.Context, sql string, args ...interface{}) (*InstantJob, error) {
	var rows []jobRow
	if err := r.conn(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0].toDomain(), nil
}

func (r *InstantWorkRepositoryImpl) CreateJob(ctx context.Context, job *InstantJob) error {
	if job.ID.IsZero() {
		job.ID = primitive.NewObjectID()
	}
	now := time.Now()
	job.CreatedAt, job.UpdatedAt = now, now
	lng, lat := pointArgs(job.Location)
	var candidate *string
	if job.CandidateID != nil {
		hex := job.CandidateID.Hex()
		candidate = &hex
	}
	return r.conn(ctx).Exec(`INSERT INTO instant_jobs
		(id, recruiter_id, recruiter_name, recruiter_mobile, company_name, skill, location, address, pay_rate_paise, rate_type,
		 duration_hours, required_workers, notes, status, candidate_id, candidate_name, candidate_mobile, expires_at,
		 created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, `+point+`, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		job.ID.Hex(), job.RecruiterID.Hex(), job.RecruiterName, nullable(job.RecruiterMobile), job.CompanyName, job.Skill,
		lng, lat, job.Address, money.ToPaise(job.PayRate), job.RateType, job.DurationHours, job.RequiredWorkers, job.Notes,
		string(job.Status), candidate, nullable(job.CandidateName), nullable(job.CandidateMobile), job.ExpiresAt, now, now).Error
}

func (r *InstantWorkRepositoryImpl) GetJobByID(ctx context.Context, jobID primitive.ObjectID) (*InstantJob, error) {
	return r.jobQuery(ctx, `SELECT `+jobColumns+` FROM instant_jobs WHERE id = ?`, jobID.Hex())
}

// FindNearbyJobsForWorker lists open jobs near the worker, newest first, leaving out the worker's own
func (r *InstantWorkRepositoryImpl) FindNearbyJobsForWorker(ctx context.Context, lng, lat float64, radiusMeters float64, skill string, excludeRecruiter primitive.ObjectID) ([]InstantJob, error) {
	q := `SELECT ` + jobColumns + `, ST_Distance(location, ` + point + `) AS distance_meters
		FROM instant_jobs
		WHERE status = ? AND expires_at > now() AND recruiter_id <> ? AND ST_DWithin(location, ` + point + `, ?)`
	args := []interface{}{lng, lat, string(JobStatusDispatching), excludeRecruiter.Hex(), lng, lat, radiusMeters}
	if skill != "" && skill != "all" {
		q += ` AND lower(skill) = lower(?)`
		args = append(args, skill)
	}
	q += ` ORDER BY created_at DESC, id DESC LIMIT 20`

	var rows []jobRow
	if err := r.conn(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	jobs := make([]InstantJob, 0, len(rows))
	for _, row := range rows {
		j := row.toDomain()
		j.RecruiterMobile = "" // The hirer's number is only shared once a worker has accepted
		j.DistanceKm = j.DistanceMeters / 1000.0
		jobs = append(jobs, *j)
	}
	return jobs, nil
}

func (r *InstantWorkRepositoryImpl) GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error) {
	return r.jobQuery(ctx, `SELECT `+jobColumns+` FROM instant_jobs WHERE candidate_id = ? AND status IN ?
		ORDER BY created_at DESC, id DESC LIMIT 1`, candidateID.Hex(), statusList(candidateActiveStatuses))
}

func (r *InstantWorkRepositoryImpl) GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error) {
	return r.jobQuery(ctx, `SELECT `+jobColumns+` FROM instant_jobs WHERE recruiter_id = ? AND status IN ?
		ORDER BY created_at DESC, id DESC LIMIT 1`, recruiterID.Hex(), statusList(recruiterActiveStatuses))
}

// ExpireStaleJobs marks the hirer's jobs that nobody accepted in time as expired
func (r *InstantWorkRepositoryImpl) ExpireStaleJobs(ctx context.Context, recruiterID primitive.ObjectID) error {
	return r.conn(ctx).Exec(`UPDATE instant_jobs SET status = ? WHERE recruiter_id = ? AND status = ? AND expires_at <= now()`,
		string(JobStatusExpired), recruiterID.Hex(), string(JobStatusDispatching)).Error
}

// moveJob applies a status change guarded by its WHERE clause, returning notMatched when the job
// isn't in that state. The single UPDATE is atomic, so only one of two racing moves wins.
func (r *InstantWorkRepositoryImpl) moveJob(ctx context.Context, set, where string, notMatched error, args ...interface{}) (*InstantJob, error) {
	job, err := r.jobQuery(ctx, `UPDATE instant_jobs SET `+set+` WHERE `+where+` RETURNING `+jobColumns, args...)
	if err != nil {
		return nil, err
	}
	if job == nil {
		return nil, notMatched
	}
	return job, nil
}

// ClaimJobAtomic gives an open job to the worker. Only one claim can win.
func (r *InstantWorkRepositoryImpl) ClaimJobAtomic(ctx context.Context, jobID primitive.ObjectID, candidateID primitive.ObjectID, candidateName string, candidateMobile string) (*InstantJob, error) {
	return r.moveJob(ctx,
		`status = ?, candidate_id = ?, candidate_name = ?, candidate_mobile = ?, matched_at = now()`,
		`id = ? AND status = ? AND expires_at > now() AND recruiter_id <> ?`,
		ErrGigUnavailable,
		string(JobStatusAccepted), candidateID.Hex(), nullable(candidateName), nullable(candidateMobile),
		jobID.Hex(), string(JobStatusDispatching), candidateID.Hex())
}

// CompleteJob is the worker marking their accepted job as done
func (r *InstantWorkRepositoryImpl) CompleteJob(ctx context.Context, jobID, candidateID primitive.ObjectID) (*InstantJob, error) {
	return r.moveJob(ctx, `status = ?, completed_at = now()`, `id = ? AND candidate_id = ? AND status IN ?`, ErrJobWrongState,
		string(JobStatusCompleted), jobID.Hex(), candidateID.Hex(), statusList([]JobStatus{JobStatusAccepted, JobStatusInProgress}))
}

// CloseJob is the hirer approving a completed job
func (r *InstantWorkRepositoryImpl) CloseJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error) {
	return r.moveJob(ctx, `status = ?, closed_at = now()`, `id = ? AND recruiter_id = ? AND status = ?`, ErrJobNotCompleted,
		string(JobStatusClosed), jobID.Hex(), recruiterID.Hex(), string(JobStatusCompleted))
}

// CancelJob is the hirer withdrawing a job before any worker accepts it
func (r *InstantWorkRepositoryImpl) CancelJob(ctx context.Context, jobID, recruiterID primitive.ObjectID) (*InstantJob, error) {
	return r.moveJob(ctx, `status = ?, cancelled_at = now()`, `id = ? AND recruiter_id = ? AND status = ?`, ErrJobWrongState,
		string(JobStatusCancelled), jobID.Hex(), recruiterID.Hex(), string(JobStatusDispatching))
}
