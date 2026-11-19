package event

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/gorm"
)

var (
	// ErrAlreadyRegistered is a second registration for the same event
	ErrAlreadyRegistered = apperr.New("EVENT_ALREADY_REGISTERED", "you are already registered for this event")
	// ErrSeatsAboveCapacity is an admin edit that would leave more free seats than the event has
	ErrSeatsAboveCapacity = apperr.New("EVENT_SEATS_INVALID", "available seats can't be more than the capacity")
)

// EventRepositoryImpl keeps events and tickets in Postgres. Attendee profiles are read from the
// MongoDB users collection.
type EventRepositoryImpl struct {
	pg    *gorm.DB
	users *mongo.Collection
}

func NewEventRepository(pg *database.PostgresDB, db *database.MongodbDB) EventRepository {
	return &EventRepositoryImpl{pg: pg.DB, users: db.DB.Collection("users")}
}

func (r *EventRepositoryImpl) conn(ctx context.Context) *gorm.DB { return database.Conn(ctx, r.pg) }

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

type eventRow struct {
	ID             string
	Title          string
	Organizer      string
	OrganizerID    *string
	Description    string
	Date           string
	Time           string
	Location       string
	MeetingLink    *string
	ImageURL       *string
	Category       *string
	IsPaid         bool
	PricePaise     int64
	Currency       string
	Capacity       int
	AvailableSeats int
	Participants   string // JSON array of user ids, oldest registration first
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// eventSelect reads an event with its participant list
const eventSelect = `SELECT e.id, e.title, e.organizer, e.organizer_id, e.description, e.date, e.time, e.location,
	e.meeting_link, e.image_url, e.category, e.is_paid, e.price_paise, e.currency, e.capacity, e.available_seats,
	COALESCE((SELECT json_agg(p.user_id ORDER BY p.created_at, p.user_id) FROM event_participants p WHERE p.event_id = e.id), '[]')::text AS participants,
	e.created_at, e.updated_at
	FROM events e`

func (e eventRow) toDomain() (Event, error) {
	out := Event{
		ID:             database.OID(e.ID),
		Title:          e.Title,
		Organizer:      e.Organizer,
		Description:    e.Description,
		Date:           e.Date,
		Time:           e.Time,
		Location:       e.Location,
		MeetingLink:    deref(e.MeetingLink),
		ImageURL:       deref(e.ImageURL),
		Category:       deref(e.Category),
		IsPaid:         e.IsPaid,
		Price:          money.ToRupees(e.PricePaise),
		Currency:       strings.TrimSpace(e.Currency),
		Capacity:       e.Capacity,
		AvailableSeats: e.AvailableSeats,
		Participants:   []primitive.ObjectID{},
		CreatedAt:      e.CreatedAt,
		UpdatedAt:      e.UpdatedAt,
	}
	if e.OrganizerID != nil {
		out.OrganizerID = database.OID(*e.OrganizerID)
	}
	var ids []string
	if err := json.Unmarshal([]byte(e.Participants), &ids); err != nil {
		return out, fmt.Errorf("reading participants: %w", err)
	}
	for _, id := range ids {
		out.Participants = append(out.Participants, database.OID(id))
	}
	return out, nil
}

func toEvents(rows []eventRow) ([]Event, error) {
	out := make([]Event, 0, len(rows))
	for _, row := range rows {
		ev, err := row.toDomain()
		if err != nil {
			return nil, err
		}
		out = append(out, ev)
	}
	return out, nil
}

type ticketRow struct {
	ID                string
	TicketNumber      string
	EventID           string
	UserID            string
	AttendeeName      string
	AttendeeEmail     string
	AttendeePhone     *string
	AmountPaise       int64
	PaymentStatus     string
	PaymentMethod     string
	RazorpayOrderID   *string
	RazorpayPaymentID *string
	Status            string
	QRCodeData        string `gorm:"column:qr_code_data"`
	EventTitle        *string
	EventDate         *string
	EventTime         *string
	EventLocation     *string
	CreatedAt         time.Time
}

const ticketColumns = `id, ticket_number, event_id, user_id, attendee_name, attendee_email, attendee_phone, amount_paise,
	payment_status, payment_method, razorpay_order_id, razorpay_payment_id, status, qr_code_data, event_title, event_date,
	event_time, event_location, created_at`

func (t ticketRow) toDomain() EventTicket {
	return EventTicket{
		ID:                database.OID(t.ID),
		TicketNumber:      t.TicketNumber,
		EventID:           database.OID(t.EventID),
		UserID:            database.OID(t.UserID),
		AttendeeName:      t.AttendeeName,
		AttendeeEmail:     t.AttendeeEmail,
		AttendeePhone:     deref(t.AttendeePhone),
		Amount:            money.ToRupees(t.AmountPaise),
		PaymentStatus:     t.PaymentStatus,
		PaymentMethod:     t.PaymentMethod,
		RazorpayOrderID:   deref(t.RazorpayOrderID),
		RazorpayPaymentID: deref(t.RazorpayPaymentID),
		Status:            t.Status,
		QRCodeData:        t.QRCodeData,
		EventTitle:        deref(t.EventTitle),
		EventDate:         deref(t.EventDate),
		EventTime:         deref(t.EventTime),
		EventLocation:     deref(t.EventLocation),
		CreatedAt:         t.CreatedAt,
	}
}

func toTickets(rows []ticketRow) []EventTicket {
	out := make([]EventTicket, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toDomain())
	}
	return out
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
// Events
// ---------------------------------------------------------------------------------------------

func (r *EventRepositoryImpl) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	if e.ID.IsZero() {
		e.ID = primitive.NewObjectID()
	}
	if e.Capacity > 0 && e.AvailableSeats == 0 {
		e.AvailableSeats = e.Capacity
	}
	if e.Currency == "" {
		e.Currency = "INR"
	}
	if e.Participants == nil {
		e.Participants = []primitive.ObjectID{}
	}
	var organizer *string
	if !e.OrganizerID.IsZero() {
		hex := e.OrganizerID.Hex()
		organizer = &hex
	}
	now := time.Now()
	e.CreatedAt, e.UpdatedAt = now, now
	err := r.conn(ctx).Exec(`INSERT INTO events
		(id, title, organizer, organizer_id, description, date, time, location, meeting_link, image_url, category,
		 is_paid, price_paise, currency, capacity, available_seats, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID.Hex(), e.Title, e.Organizer, organizer, e.Description, e.Date, e.Time, e.Location,
		nullable(e.MeetingLink), nullable(e.ImageURL), nullable(e.Category), e.IsPaid, money.ToPaise(e.Price),
		e.Currency, e.Capacity, e.AvailableSeats, now, now).Error
	if database.PgErrCode(err) == database.PgCheckViolation {
		return nil, ErrSeatsAboveCapacity
	}
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *EventRepositoryImpl) GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error) {
	where := []string{"e.deleted_at IS NULL"}
	args := []interface{}{}
	if filter.Search != "" {
		where = append(where, "(e.title ILIKE ? OR e.organizer ILIKE ? OR e.category ILIKE ?)")
		p := database.LikeContains(filter.Search)
		args = append(args, p, p, p)
	}
	if filter.Location != "" {
		where = append(where, "e.location ILIKE ?")
		args = append(args, database.LikeContains(filter.Location))
	}
	if filter.IsPaid != nil {
		where = append(where, "e.is_paid = ?")
		args = append(args, *filter.IsPaid)
	}
	cond := " WHERE " + strings.Join(where, " AND ")

	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM events e`+cond, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	// Dates are stored as entered, so "Upcoming" sorts them as text, as before
	order := ` ORDER BY e.created_at DESC, e.id DESC`
	if filter.Sort == "Upcoming" {
		order = ` ORDER BY e.date COLLATE "C", e.id`
	}
	page := ""
	if filter.Limit > 0 {
		offset := 0
		if filter.Page > 1 {
			offset = (filter.Page - 1) * filter.Limit
		}
		page = fmt.Sprintf(" LIMIT %d OFFSET %d", filter.Limit, offset)
	}

	var rows []eventRow
	if err := r.conn(ctx).Raw(eventSelect+cond+order+page, args...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	events, err := toEvents(rows)
	return events, total, err
}

// GetEventByID returns a live (not deleted) event, or an error when there is none
func (r *EventRepositoryImpl) GetEventByID(ctx context.Context, id primitive.ObjectID) (*Event, error) {
	var rows []eventRow
	if err := r.conn(ctx).Raw(eventSelect+` WHERE e.id = ? AND e.deleted_at IS NULL`, id.Hex()).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrEventNotFound
	}
	ev, err := rows[0].toDomain()
	if err != nil {
		return nil, err
	}
	return &ev, nil
}

// RegisterUser adds the user to the event's participants. Registering twice is a no-op here; the
// ticket's unique rule is what rejects a second registration.
func (r *EventRepositoryImpl) RegisterUser(ctx context.Context, eventID, userID primitive.ObjectID) error {
	return r.conn(ctx).Exec(`INSERT INTO event_participants (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
		eventID.Hex(), userID.Hex()).Error
}

// DecrementAvailableSeats claims one seat. The update is atomic, so two buyers can't both take
// the last one.
func (r *EventRepositoryImpl) DecrementAvailableSeats(ctx context.Context, eventID primitive.ObjectID) error {
	res := r.conn(ctx).Exec(`UPDATE events SET available_seats = available_seats - 1
		WHERE id = ? AND deleted_at IS NULL AND capacity > 0 AND available_seats > 0`, eventID.Hex())
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrEventSoldOut
	}
	return nil
}

// ---------------------------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------------------------

// CreateTicket saves a ticket. One confirmed ticket per person per event is a database rule.
func (r *EventRepositoryImpl) CreateTicket(ctx context.Context, t *EventTicket) (*EventTicket, error) {
	if t.ID.IsZero() {
		t.ID = primitive.NewObjectID()
	}
	t.CreatedAt = time.Now()
	err := r.conn(ctx).Exec(`INSERT INTO event_tickets
		(id, ticket_number, event_id, user_id, attendee_name, attendee_email, attendee_phone, amount_paise, payment_status,
		 payment_method, razorpay_order_id, razorpay_payment_id, status, qr_code_data, event_title, event_date, event_time,
		 event_location, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID.Hex(), t.TicketNumber, t.EventID.Hex(), t.UserID.Hex(), t.AttendeeName, t.AttendeeEmail,
		nullable(t.AttendeePhone), money.ToPaise(t.Amount), t.PaymentStatus, t.PaymentMethod, nullable(t.RazorpayOrderID),
		nullable(t.RazorpayPaymentID), t.Status, t.QRCodeData, nullable(t.EventTitle), nullable(t.EventDate),
		nullable(t.EventTime), nullable(t.EventLocation), t.CreatedAt, t.CreatedAt).Error
	if database.PgConstraint(err) == "event_tickets_one_confirmed_idx" {
		return nil, ErrEventTicketTaken
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *EventRepositoryImpl) tickets(ctx context.Context, where string, args ...interface{}) ([]EventTicket, error) {
	var rows []ticketRow
	if err := r.conn(ctx).Raw(`SELECT `+ticketColumns+` FROM event_tickets WHERE `+where, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return toTickets(rows), nil
}

func (r *EventRepositoryImpl) GetTicketByID(ctx context.Context, id primitive.ObjectID) (*EventTicket, error) {
	list, err := r.tickets(ctx, `id = ?`, id.Hex())
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, ErrTicketNotFound
	}
	return &list[0], nil
}

func (r *EventRepositoryImpl) GetTicketByEventAndUser(ctx context.Context, eventID, userID primitive.ObjectID) (*EventTicket, error) {
	list, err := r.tickets(ctx, `event_id = ? AND user_id = ? AND status = 'confirmed'`, eventID.Hex(), userID.Hex())
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *EventRepositoryImpl) GetTicketsByUser(ctx context.Context, userID primitive.ObjectID) ([]EventTicket, error) {
	return r.tickets(ctx, `user_id = ? AND status = 'confirmed' ORDER BY created_at DESC, id DESC`, userID.Hex())
}

func (r *EventRepositoryImpl) GetTicketsByEvent(ctx context.Context, eventID primitive.ObjectID) ([]EventTicket, error) {
	return r.tickets(ctx, `event_id = ? AND status = 'confirmed' ORDER BY created_at DESC, id DESC`, eventID.Hex())
}

// RevokeTicket cancels a refunded ticket, removes the attendee and returns their seat
func (r *EventRepositoryImpl) RevokeTicket(ctx context.Context, eventID, userID primitive.ObjectID, razorpayOrderID string) error {
	db := r.conn(ctx)
	res := db.Exec(`UPDATE event_tickets SET status = 'cancelled', payment_status = 'refunded'
		WHERE razorpay_order_id = ? AND status = 'confirmed'`, razorpayOrderID)
	if res.Error != nil || res.RowsAffected == 0 {
		return res.Error
	}
	if err := db.Exec(`DELETE FROM event_participants WHERE event_id = ? AND user_id = ?`, eventID.Hex(), userID.Hex()).Error; err != nil {
		return err
	}
	return db.Exec(`UPDATE events SET available_seats = available_seats + 1
		WHERE id = ? AND capacity > 0 AND available_seats < capacity`, eventID.Hex()).Error
}

// ---------------------------------------------------------------------------------------------
// Attendees
// ---------------------------------------------------------------------------------------------

// GetEventAttendees fetches attendee profiles for all confirmed participants of an event (F64)
func (r *EventRepositoryImpl) GetEventAttendees(ctx context.Context, eventID primitive.ObjectID) ([]EventAttendeeItem, error) {
	event, err := r.GetEventByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if len(event.Participants) == 0 {
		return []EventAttendeeItem{}, nil
	}

	cursor, err := r.users.Find(ctx, bson.M{
		"_id": bson.M{"$in": event.Participants},
	}, options.Find().SetProjection(bson.M{
		"_id":           1,
		"name":          1,
		"first_name":    1,
		"last_name":     1,
		"headline":      1,
		"profile_image": 1,
		"city":          1,
		"roles":         1,
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	type rawUser struct {
		ID           primitive.ObjectID `bson:"_id"`
		Name         string             `bson:"name"`
		FirstName    string             `bson:"first_name"`
		LastName     string             `bson:"last_name"`
		Headline     string             `bson:"headline"`
		ProfileImage string             `bson:"profile_image"`
		City         string             `bson:"city"`
		Roles        []string           `bson:"roles"`
	}

	var users []rawUser
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}
	userMap := make(map[primitive.ObjectID]rawUser, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}

	tickets, err := r.GetTicketsByEvent(ctx, eventID)
	if err != nil {
		return nil, err
	}
	ticketMap := make(map[primitive.ObjectID]EventTicket, len(tickets))
	for _, t := range tickets {
		ticketMap[t.UserID] = t
	}

	attendees := make([]EventAttendeeItem, 0, len(event.Participants))
	for _, uid := range event.Participants {
		u, found := userMap[uid]
		name := u.Name
		if name == "" && found {
			if u.FirstName != "" || u.LastName != "" {
				name = fmt.Sprintf("%s %s", u.FirstName, u.LastName)
			}
		}

		ticket, hasTicket := ticketMap[uid]
		if name == "" && hasTicket && ticket.AttendeeName != "" {
			name = ticket.AttendeeName
		}
		if name == "" {
			name = "Participant"
		}

		headline := u.Headline
		if headline == "" {
			headline = "KaamMilega Member"
		}

		role := "user"
		if len(u.Roles) > 0 {
			role = u.Roles[0]
		}

		paymentType := "free"
		var ticketNum string
		joinedAt := event.CreatedAt
		if hasTicket {
			paymentType = ticket.PaymentStatus
			ticketNum = ticket.TicketNumber
			joinedAt = ticket.CreatedAt
		}

		attendees = append(attendees, EventAttendeeItem{
			ID:           uid.Hex(),
			Name:         name,
			Headline:     headline,
			ProfileImage: u.ProfileImage,
			City:         u.City,
			Role:         role,
			TicketNumber: ticketNum,
			PaymentType:  paymentType,
			JoinedAt:     joinedAt,
		})
	}
	return attendees, nil
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

type ticketStats struct {
	EventID       string
	Sold          int
	RevenuePaise  int64
	Free          int
	Paid          int
	Wallet        int
	Razorpay      int
}

// statsFor adds up the confirmed tickets of each event in one query
func (r *EventRepositoryImpl) statsFor(ctx context.Context, eventIDs []string) (map[string]ticketStats, error) {
	out := make(map[string]ticketStats, len(eventIDs))
	if len(eventIDs) == 0 {
		return out, nil
	}
	var rows []ticketStats
	err := r.conn(ctx).Raw(`SELECT event_id,
			count(*) AS sold,
			COALESCE(sum(amount_paise), 0) AS revenue_paise,
			count(*) FILTER (WHERE payment_status = 'free' OR amount_paise = 0) AS free,
			count(*) FILTER (WHERE NOT (payment_status = 'free' OR amount_paise = 0)) AS paid,
			count(*) FILTER (WHERE payment_method = 'wallet') AS wallet,
			count(*) FILTER (WHERE payment_method = 'razorpay') AS razorpay
		FROM event_tickets WHERE status = 'confirmed' AND event_id IN ? GROUP BY event_id`, eventIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.EventID] = row
	}
	return out, nil
}

// AdminGetAllEvents lists all events with calculated participants, ticket sales, and revenue
func (r *EventRepositoryImpl) AdminGetAllEvents(ctx context.Context, search string, page, limit int) ([]AdminEventItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	cond := ` WHERE e.deleted_at IS NULL`
	args := []interface{}{}
	if search != "" {
		cond += ` AND (e.title ILIKE ? OR e.organizer ILIKE ? OR e.category ILIKE ? OR e.location ILIKE ?)`
		p := database.LikeContains(search)
		args = append(args, p, p, p, p)
	}

	var total int64
	if err := r.conn(ctx).Raw(`SELECT count(*) FROM events e`+cond, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []eventRow
	query := eventSelect + cond + fmt.Sprintf(` ORDER BY e.created_at DESC, e.id DESC LIMIT %d OFFSET %d`, limit, (page-1)*limit)
	if err := r.conn(ctx).Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	events, err := toEvents(rows)
	if err != nil {
		return nil, 0, err
	}

	ids := make([]string, len(events))
	for i, ev := range events {
		ids[i] = ev.ID.Hex()
	}
	stats, err := r.statsFor(ctx, ids)
	if err != nil {
		return nil, 0, err
	}

	items := make([]AdminEventItem, 0, len(events))
	for _, ev := range events {
		s := stats[ev.ID.Hex()]
		items = append(items, AdminEventItem{
			Event:             ev,
			TotalParticipants: len(ev.Participants),
			TotalTicketsSold:  s.Sold,
			TotalRevenue:      money.ToRupees(s.RevenuePaise),
			FreeRegistrations: s.Free,
			PaidRegistrations: s.Paid,
			WalletBookings:    s.Wallet,
			RazorpayBookings:  s.Razorpay,
		})
	}
	return items, total, nil
}

// AdminGetEventDetail provides deep inspection into an event including all tickets, payments and attendees
func (r *EventRepositoryImpl) AdminGetEventDetail(ctx context.Context, eventID primitive.ObjectID) (*AdminEventDetailResponse, error) {
	ev, err := r.GetEventByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	tickets, err := r.GetTicketsByEvent(ctx, eventID)
	if err != nil {
		return nil, err
	}
	attendees, err := r.GetEventAttendees(ctx, eventID)
	if err != nil {
		return nil, err
	}

	var revenuePaise int64
	var freeCount, paidCount int
	for _, t := range tickets {
		revenuePaise += money.ToPaise(t.Amount)
		if t.PaymentStatus == "free" || t.Amount == 0 {
			freeCount++
		} else {
			paidCount++
		}
	}

	return &AdminEventDetailResponse{
		Event:             *ev,
		TotalParticipants: len(ev.Participants),
		TotalTicketsSold:  len(tickets),
		TotalRevenue:      money.ToRupees(revenuePaise),
		FreeRegistrations: freeCount,
		PaidRegistrations: paidCount,
		Tickets:           tickets,
		Attendees:         attendees,
	}, nil
}

// AdminUpdateEvent allows updating any detail of an event
func (r *EventRepositoryImpl) AdminUpdateEvent(ctx context.Context, eventID primitive.ObjectID, req AdminUpdateEventRequest) (*Event, error) {
	set := map[string]interface{}{}
	if req.Title != "" {
		set["title"] = req.Title
	}
	if req.Organizer != "" {
		set["organizer"] = req.Organizer
	}
	if req.Description != "" {
		set["description"] = req.Description
	}
	if req.Date != "" {
		set["date"] = req.Date
	}
	if req.Time != "" {
		set["time"] = req.Time
	}
	if req.Location != "" {
		set["location"] = req.Location
	}
	if req.MeetingLink != nil {
		set["meeting_link"] = nullable(*req.MeetingLink)
	}
	if req.ImageURL != "" {
		set["image_url"] = req.ImageURL
	}
	if req.Category != "" {
		set["category"] = req.Category
	}
	if req.IsPaid != nil {
		set["is_paid"] = *req.IsPaid
	}
	if req.Price >= 0 {
		set["price_paise"] = money.ToPaise(req.Price)
	}
	if req.Capacity >= 0 {
		set["capacity"] = req.Capacity
	}
	if req.AvailableSeats != nil {
		set["available_seats"] = *req.AvailableSeats
	}

	if len(set) > 0 {
		res := r.conn(ctx).Table("events").Where("id = ? AND deleted_at IS NULL", eventID.Hex()).Updates(set)
		if database.PgErrCode(res.Error) == database.PgCheckViolation {
			return nil, ErrSeatsAboveCapacity
		}
		if res.Error != nil {
			return nil, res.Error
		}
		if res.RowsAffected == 0 {
			return nil, ErrEventNotFound
		}
	}
	return r.GetEventByID(ctx, eventID)
}

// SettleTicketDispute runs before a wallet ticket is refunded because its event was deleted. It
// returns what an approved dispute on the ticket already paid back, so the refund pays only the
// rest, and closes a dispute that is still open, which the refund settles. Call inside a
// transaction.
func (r *EventRepositoryImpl) SettleTicketDispute(ctx context.Context, ticketID primitive.ObjectID) (int64, error) {
	db := r.conn(ctx)
	ref := "ticket:" + ticketID.Hex() + ":pay"
	if err := db.Exec(`UPDATE wallet_disputes SET status = 'rejected', resolved_by = 'system', resolved_at = now(),
			admin_notes = 'Closed: the event was cancelled and the ticket refunded'
		WHERE reference_id = ? AND status IN ('pending', 'under_review')`, ref).Error; err != nil {
		return 0, err
	}
	var refunded int64
	err := db.Raw(`SELECT coalesce(sum(refund_paise), 0) FROM wallet_disputes WHERE reference_id = ? AND status = 'approved'`,
		ref).Scan(&refunded).Error
	return refunded, err
}

// KeepTicketPaid undoes the "refunded" mark on a cancelled ticket whose refund couldn't be paid
// (the owner's wallet is closed), so the record doesn't claim money went back
func (r *EventRepositoryImpl) KeepTicketPaid(ctx context.Context, ticketID primitive.ObjectID) error {
	return r.conn(ctx).Exec(`UPDATE event_tickets SET payment_status = 'paid' WHERE id = ? AND payment_status = 'refunded'`,
		ticketID.Hex()).Error
}

// AdminDeleteEvent hides an event and cancels its tickets, in one transaction, and returns the
// tickets it cancelled. Paid tickets are marked refunded; the caller posts the refunds in the
// same transaction. The rows stay because tickets are payment records.
func (r *EventRepositoryImpl) AdminDeleteEvent(ctx context.Context, eventID primitive.ObjectID) ([]EventTicket, error) {
	var cancelled []EventTicket
	err := r.conn(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Exec(`UPDATE events SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL`, eventID.Hex())
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrEventNotFound
		}
		var rows []ticketRow
		if err := tx.Raw(`UPDATE event_tickets SET status = 'cancelled',
				payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
			WHERE event_id = ? AND status = 'confirmed' RETURNING `+ticketColumns, eventID.Hex()).Scan(&rows).Error; err != nil {
			return err
		}
		cancelled = toTickets(rows)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return cancelled, nil
}
