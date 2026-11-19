package mentorship

import (
	"context"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

type MentorshipRepository interface {
	CreateMentorship(ctx context.Context, mentorship *Mentorship) (*Mentorship, error)
	GetMentorshipByID(ctx context.Context, id string) (*Mentorship, error)
	ListMentorships(ctx context.Context, category string) ([]Mentorship, error)
	GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error)
	UpdateMentorship(ctx context.Context, id string, mentorship *Mentorship) (*Mentorship, error)
	DeleteMentorship(ctx context.Context, id string) error

	CreateBooking(ctx context.Context, booking *Booking) (*Booking, error)
	GetBookingByID(ctx context.Context, id string) (*Booking, error)
	ListBookingsByUser(ctx context.Context, userID string) ([]Booking, error)
	ListBookingsByExpert(ctx context.Context, expertID string) ([]Booking, error)
	UpdateBookingStatus(ctx context.Context, id string, status string) error
	TransitionBooking(ctx context.Context, id string, from []string, t BookingTransition) (bool, error)
	ListBookingsDueRelease(ctx context.Context, now time.Time, limit int64) ([]Booking, error)
	ListReportedBookings(ctx context.Context) ([]Booking, error)
	UpdateBookingPayment(ctx context.Context, id string, paymentStatus string, paymentMethod string, rzpPaymentID string, status string) error
	UpdateMeetingLink(ctx context.Context, id string, meetingLink string) error
	UpdateBookingReview(ctx context.Context, id string, rating float64, review string) error
	GetReviewsByMentorshipID(ctx context.Context, mentorshipID string) ([]Booking, error)
	GetReviewsByExpertID(ctx context.Context, expertID string) ([]Booking, error)
	UpdateMentorshipRatingStats(ctx context.Context, mentorshipID string, rating float64, reviewsCount int) error

	UpdateAvailability(ctx context.Context, expertID string, availabilities []Availability) error
	GetAvailabilityByExpert(ctx context.Context, expertID string) ([]Availability, error)
}

// ErrAvailabilityInvalid is a time slot Postgres can't store (bad format or ending before it starts)
var ErrAvailabilityInvalid = apperr.New("AVAILABILITY_INVALID", "each time slot needs a start and end time (HH:MM) on the same day, ending after it starts")


// MentorshipRepositoryImpl keeps mentorships, bookings and availability in Postgres.
type MentorshipRepositoryImpl struct {
	pg *gorm.DB
}

func NewMentorshipRepository(pg *database.PostgresDB) MentorshipRepository {
	return &MentorshipRepositoryImpl{pg: pg.DB}
}

func (r *MentorshipRepositoryImpl) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

// hexID checks an id from the caller before it reaches SQL (the column only accepts real ids)
func hexID(id string) (string, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return "", err
	}
	return oid.Hex(), nil
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

// ---------------------------------------------------------------------------------------------
// Mentorships
// ---------------------------------------------------------------------------------------------

type mentorshipRow struct {
	ID          string
	ExpertID    string
	Title       string
	Description string
	Category    string
	Duration    int
	PricePaise  int64
	Rating      float64
	Reviews     int
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

const mentorshipSelect = `SELECT id, expert_id, title, description, category, duration, price_paise, rating::float8 AS rating,
	reviews, status, created_at, updated_at FROM mentorships`

func (m mentorshipRow) toDomain() Mentorship {
	return Mentorship{
		ID:          database.OID(m.ID),
		ExpertID:    database.OID(m.ExpertID),
		Title:       m.Title,
		Description: m.Description,
		Category:    m.Category,
		Duration:    m.Duration,
		Price:       money.ToRupees(m.PricePaise),
		Rating:      m.Rating,
		Reviews:     m.Reviews,
		Status:      m.Status,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

func (r *MentorshipRepositoryImpl) mentorships(ctx context.Context, where string, args ...interface{}) ([]Mentorship, error) {
	var rows []mentorshipRow
	if err := r.conn(ctx).Raw(mentorshipSelect+` WHERE deleted_at IS NULL AND `+where, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Mentorship, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, nil
}

func (r *MentorshipRepositoryImpl) CreateMentorship(ctx context.Context, m *Mentorship) (*Mentorship, error) {
	if m.ID.IsZero() {
		m.ID = primitive.NewObjectID()
	}
	if m.Status == "" {
		m.Status = "active"
	}
	now := time.Now()
	m.CreatedAt, m.UpdatedAt = now, now
	err := r.conn(ctx).Exec(`INSERT INTO mentorships
		(id, expert_id, title, description, category, duration, price_paise, rating, reviews, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID.Hex(), m.ExpertID.Hex(), m.Title, m.Description, m.Category, m.Duration, money.ToPaise(m.Price),
		m.Rating, m.Reviews, m.Status, now, now).Error
	if err != nil {
		return nil, err
	}
	return m, nil
}

// GetMentorshipByID returns a live mentorship, or nil
func (r *MentorshipRepositoryImpl) GetMentorshipByID(ctx context.Context, id string) (*Mentorship, error) {
	hex, err := hexID(id)
	if err != nil {
		return nil, err
	}
	list, err := r.mentorships(ctx, `id = ?`, hex)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *MentorshipRepositoryImpl) ListMentorships(ctx context.Context, category string) ([]Mentorship, error) {
	if category != "" {
		return r.mentorships(ctx, `status = 'active' AND category = ? ORDER BY created_at DESC, id DESC`, category)
	}
	return r.mentorships(ctx, `status = 'active' ORDER BY created_at DESC, id DESC`)
}

func (r *MentorshipRepositoryImpl) GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error) {
	hex, err := hexID(expertID)
	if err != nil {
		return nil, err
	}
	return r.mentorships(ctx, `expert_id = ? ORDER BY created_at DESC, id DESC`, hex)
}

// UpdateMentorship saves the fields an expert can edit. The owner, rating and dates are not
// changed here.
func (r *MentorshipRepositoryImpl) UpdateMentorship(ctx context.Context, id string, m *Mentorship) (*Mentorship, error) {
	hex, err := hexID(id)
	if err != nil {
		return nil, err
	}
	status := m.Status
	if status == "" {
		status = "active"
	}
	res := r.conn(ctx).Exec(`UPDATE mentorships SET title = ?, description = ?, category = ?, duration = ?, price_paise = ?, status = ?
		WHERE id = ? AND deleted_at IS NULL`,
		m.Title, m.Description, m.Category, m.Duration, money.ToPaise(m.Price), status, hex)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrMentorshipGone
	}
	m.UpdatedAt = time.Now()
	return m, nil
}

// DeleteMentorship hides a mentorship. The row stays because bookings point at it.
func (r *MentorshipRepositoryImpl) DeleteMentorship(ctx context.Context, id string) error {
	hex, err := hexID(id)
	if err != nil {
		return err
	}
	return r.conn(ctx).Exec(`UPDATE mentorships SET deleted_at = now(), status = 'inactive' WHERE id = ? AND deleted_at IS NULL`, hex).Error
}

func (r *MentorshipRepositoryImpl) UpdateMentorshipRatingStats(ctx context.Context, mentorshipID string, rating float64, reviewsCount int) error {
	hex, err := hexID(mentorshipID)
	if err != nil {
		return err
	}
	return r.conn(ctx).Exec(`UPDATE mentorships SET rating = ?, reviews = ? WHERE id = ?`, rating, reviewsCount, hex).Error
}

// ---------------------------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------------------------

type bookingRow struct {
	ID                string
	MentorshipID      string
	ExpertID          string
	UserID            string
	ScheduledAt       time.Time
	Status            string
	AmountPaise       int64
	PaymentStatus     string
	PaymentMethod     *string
	RazorpayOrderID   *string
	RazorpayPaymentID *string
	ReleaseAfter      *time.Time
	ReportReason      *string
	ReportedAt        *time.Time
	ResolutionNote    *string
	MeetingLink       *string
	Notes             *string
	Rating            *float64
	Review            *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

const bookingSelect = `SELECT id, mentorship_id, expert_id, user_id, scheduled_at, status, amount_paise, payment_status,
	payment_method, razorpay_order_id, razorpay_payment_id, release_after, report_reason, reported_at, resolution_note,
	meeting_link, notes, rating::float8 AS rating, review, created_at, updated_at FROM mentorship_bookings`

func (b bookingRow) toDomain() Booking {
	out := Booking{
		ID:                database.OID(b.ID),
		MentorshipID:      database.OID(b.MentorshipID),
		ExpertID:          database.OID(b.ExpertID),
		UserID:            database.OID(b.UserID),
		ScheduledAt:       b.ScheduledAt,
		Status:            b.Status,
		Amount:            money.ToRupees(b.AmountPaise),
		PaymentStatus:     b.PaymentStatus,
		PaymentMethod:     deref(b.PaymentMethod),
		RazorpayOrderID:   deref(b.RazorpayOrderID),
		RazorpayPaymentID: deref(b.RazorpayPaymentID),
		ReleaseAfter:      b.ReleaseAfter,
		ReportReason:      deref(b.ReportReason),
		ReportedAt:        b.ReportedAt,
		ResolutionNote:    deref(b.ResolutionNote),
		MeetingLink:       deref(b.MeetingLink),
		Notes:             deref(b.Notes),
		Review:            deref(b.Review),
		CreatedAt:         b.CreatedAt,
		UpdatedAt:         b.UpdatedAt,
	}
	if b.Rating != nil {
		out.Rating = *b.Rating
	}
	return out
}

func (r *MentorshipRepositoryImpl) bookings(ctx context.Context, where string, args ...interface{}) ([]Booking, error) {
	var rows []bookingRow
	if err := r.conn(ctx).Raw(bookingSelect+` WHERE `+where, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Booking, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out, nil
}

func (r *MentorshipRepositoryImpl) CreateBooking(ctx context.Context, b *Booking) (*Booking, error) {
	if b.ID.IsZero() {
		b.ID = primitive.NewObjectID()
	}
	if b.PaymentStatus == "" {
		b.PaymentStatus = "pending"
	}
	now := time.Now()
	b.CreatedAt, b.UpdatedAt = now, now
	err := r.conn(ctx).Exec(`INSERT INTO mentorship_bookings
		(id, mentorship_id, expert_id, user_id, scheduled_at, status, amount_paise, payment_status, payment_method,
		 razorpay_order_id, razorpay_payment_id, release_after, meeting_link, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		b.ID.Hex(), b.MentorshipID.Hex(), b.ExpertID.Hex(), b.UserID.Hex(), b.ScheduledAt, b.Status,
		money.ToPaise(b.Amount), b.PaymentStatus, nullable(b.PaymentMethod), nullable(b.RazorpayOrderID),
		nullable(b.RazorpayPaymentID), b.ReleaseAfter, nullable(b.MeetingLink), nullable(b.Notes), now, now).Error
	if err != nil {
		return nil, err
	}
	// Booking an expert counts as using the ₹99 pass, so it can't be refunded any more (client answer Q5).
	// Same transaction as the booking, so a failed booking leaves the pass refundable.
	if err := r.conn(ctx).Exec(`UPDATE instant_passes SET benefit_used_at = now()
		WHERE user_id = ? AND has_active_pass AND expires_at > now() AND benefit_used_at IS NULL`, b.UserID.Hex()).Error; err != nil {
		return nil, err
	}
	return b, nil
}

func (r *MentorshipRepositoryImpl) GetBookingByID(ctx context.Context, id string) (*Booking, error) {
	hex, err := hexID(id)
	if err != nil {
		return nil, err
	}
	list, err := r.bookings(ctx, `id = ?`, hex)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, ErrBookingNotFound
	}
	return &list[0], nil
}

func (r *MentorshipRepositoryImpl) ListBookingsByUser(ctx context.Context, userID string) ([]Booking, error) {
	hex, err := hexID(userID)
	if err != nil {
		return nil, err
	}
	return r.bookings(ctx, `user_id = ? ORDER BY scheduled_at DESC, id DESC`, hex)
}

func (r *MentorshipRepositoryImpl) ListBookingsByExpert(ctx context.Context, expertID string) ([]Booking, error) {
	hex, err := hexID(expertID)
	if err != nil {
		return nil, err
	}
	return r.bookings(ctx, `expert_id = ? ORDER BY scheduled_at DESC, id DESC`, hex)
}

func (r *MentorshipRepositoryImpl) updateBooking(ctx context.Context, id string, set map[string]interface{}) error {
	hex, err := hexID(id)
	if err != nil {
		return err
	}
	return r.conn(ctx).Table("mentorship_bookings").Where("id = ?", hex).Updates(set).Error
}

func (r *MentorshipRepositoryImpl) UpdateBookingStatus(ctx context.Context, id string, status string) error {
	return r.updateBooking(ctx, id, map[string]interface{}{"status": status})
}

func (r *MentorshipRepositoryImpl) UpdateBookingPayment(ctx context.Context, id string, paymentStatus string, paymentMethod string, rzpPaymentID string, status string) error {
	set := map[string]interface{}{"payment_status": paymentStatus}
	if paymentMethod != "" {
		set["payment_method"] = paymentMethod
	}
	if rzpPaymentID != "" {
		set["razorpay_payment_id"] = rzpPaymentID
	}
	if status != "" {
		set["status"] = status
	}
	return r.updateBooking(ctx, id, set)
}

func (r *MentorshipRepositoryImpl) UpdateMeetingLink(ctx context.Context, id string, meetingLink string) error {
	return r.updateBooking(ctx, id, map[string]interface{}{"meeting_link": nullable(meetingLink)})
}

func (r *MentorshipRepositoryImpl) UpdateBookingReview(ctx context.Context, id string, rating float64, review string) error {
	return r.updateBooking(ctx, id, map[string]interface{}{"rating": rating, "review": nullable(review)})
}

func (r *MentorshipRepositoryImpl) GetReviewsByMentorshipID(ctx context.Context, mentorshipID string) ([]Booking, error) {
	hex, err := hexID(mentorshipID)
	if err != nil {
		return nil, err
	}
	return r.bookings(ctx, `mentorship_id = ? AND rating > 0 ORDER BY updated_at DESC, created_at DESC`, hex)
}

func (r *MentorshipRepositoryImpl) GetReviewsByExpertID(ctx context.Context, expertID string) ([]Booking, error) {
	hex, err := hexID(expertID)
	if err != nil {
		return nil, err
	}
	return r.bookings(ctx, `expert_id = ? AND rating > 0 ORDER BY updated_at DESC, created_at DESC`, hex)
}

// BookingTransition is a booking's move to its next status.
type BookingTransition struct {
	Status         string
	PaymentStatus  string
	ReleaseAfter   *time.Time
	ReportReason   string
	ResolutionNote string
}

// TransitionBooking moves a booking on, only if it's still in one of the expected states. That
// condition is what stops a session being paid out or refunded twice.
func (r *MentorshipRepositoryImpl) TransitionBooking(ctx context.Context, id string, from []string, t BookingTransition) (bool, error) {
	hex, err := hexID(id)
	if err != nil {
		return false, err
	}
	set := map[string]interface{}{"status": t.Status}
	if t.PaymentStatus != "" {
		set["payment_status"] = t.PaymentStatus
	}
	if t.ReleaseAfter != nil {
		set["release_after"] = *t.ReleaseAfter
	}
	if t.ReportReason != "" {
		set["report_reason"] = t.ReportReason
		set["reported_at"] = time.Now()
	}
	if t.ResolutionNote != "" {
		set["resolution_note"] = t.ResolutionNote
	}
	res := r.conn(ctx).Table("mentorship_bookings").Where("id = ? AND status IN ?", hex, from).Updates(set)
	return res.RowsAffected == 1, res.Error
}

// ListBookingsDueRelease finds sessions whose 24 hour wait for the mentee has run out
func (r *MentorshipRepositoryImpl) ListBookingsDueRelease(ctx context.Context, now time.Time, limit int64) ([]Booking, error) {
	return r.bookings(ctx, `status = ? AND release_after <= ? ORDER BY release_after LIMIT ?`, BookingAwaitingConfirmation, now, limit)
}

// ListReportedBookings returns sessions waiting for an admin decision, oldest first
func (r *MentorshipRepositoryImpl) ListReportedBookings(ctx context.Context) ([]Booking, error) {
	return r.bookings(ctx, `status = ? ORDER BY reported_at, id LIMIT 200`, BookingReported)
}

// ---------------------------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------------------------

// UpdateAvailability replaces an expert's weekly slots in one transaction
func (r *MentorshipRepositoryImpl) UpdateAvailability(ctx context.Context, expertID string, availabilities []Availability) error {
	hex, err := hexID(expertID)
	if err != nil {
		return err
	}
	err = r.conn(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`DELETE FROM expert_availability WHERE expert_id = ?`, hex).Error; err != nil {
			return err
		}
		for _, a := range availabilities {
			if err := tx.Exec(`INSERT INTO expert_availability (id, expert_id, day_of_week, start_time, end_time, is_active)
				VALUES (?, ?, ?, ?, ?, ?)`, primitive.NewObjectID().Hex(), hex, a.DayOfWeek, a.StartTime, a.EndTime, a.IsActive).Error; err != nil {
				return err
			}
		}
		return nil
	})
	// 22007/22008: not a valid time; 23514: a CHECK (day 0-6, end after start)
	switch database.PgErrCode(err) {
	case "22007", "22008", database.PgCheckViolation:
		return ErrAvailabilityInvalid
	}
	return err
}

func (r *MentorshipRepositoryImpl) GetAvailabilityByExpert(ctx context.Context, expertID string) ([]Availability, error) {
	hex, err := hexID(expertID)
	if err != nil {
		return nil, err
	}
	var rows []struct {
		ID        string
		ExpertID  string
		DayOfWeek int
		StartTime string
		EndTime   string
		IsActive  bool
	}
	if err := r.conn(ctx).Raw(`SELECT id, expert_id, day_of_week, to_char(start_time, 'HH24:MI') AS start_time,
		to_char(end_time, 'HH24:MI') AS end_time, is_active
		FROM expert_availability WHERE expert_id = ? ORDER BY day_of_week, start_time`, hex).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Availability, 0, len(rows))
	for _, row := range rows {
		out = append(out, Availability{
			ID:        database.OID(row.ID),
			ExpertID:  database.OID(row.ExpertID),
			DayOfWeek: row.DayOfWeek,
			StartTime: row.StartTime,
			EndTime:   row.EndTime,
			IsActive:  row.IsActive,
		})
	}
	return out, nil
}
