// Command copy_to_postgres copies the money and purchase collections from MongoDB into the
// Postgres "app" schema, keeping every id. MongoDB is only read, never changed.
//
// Everything is written in one transaction and checked inside it (row counts, ids, money totals,
// map points, slot times). Nothing is kept unless every check passes.
//
// Run from km-backend with MONGO_URI, DB_NAME and DATABASE_URI set:
//
//	go run ./cmd/copy_to_postgres               dry run: copy and check, then roll everything back
//	go run ./cmd/copy_to_postgres -apply        copy, check, and commit if every check passed
//	go run ./cmd/copy_to_postgres -apply -replace
//	                                            empty the 15 tables first. Only for the cut-over
//	                                            re-run while the old backend is stopped; never
//	                                            after the new backend has taken real payments.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var tables = []string{
	"wallets", "wallet_transactions", "wallet_withdrawals", "wallet_disputes", "payment_orders",
	"events", "event_participants", "event_tickets", "mentorships", "expert_availability",
	"mentorship_bookings", "expert_subscriptions", "instant_workers", "instant_passes", "instant_jobs",
}

// errRollback ends a dry run after its checks
var errRollback = errors.New("dry run: rolled back")

func main() {
	apply := flag.Bool("apply", false, "commit the copy (default: dry run)")
	replace := flag.Bool("replace", false, "with -apply: empty the target tables first (cut-over re-run only)")
	flag.Parse()
	if *replace && !*apply {
		log.Fatal("-replace only makes sense with -apply")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	mc, err := mongo.Connect(ctx, options.Client().ApplyURI(os.Getenv("MONGO_URI")).SetReadPreference(readpref.Primary()))
	if err != nil {
		log.Fatal("mongo: could not connect")
	}
	defer mc.Disconnect(context.Background())
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		log.Fatal("DB_NAME is not set")
	}
	src := mc.Database(dbName)

	dsn, err := database.PostgresDSN(os.Getenv("DATABASE_URI"))
	if err != nil {
		log.Fatal("DATABASE_URI is missing or invalid")
	}
	pg, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatal("postgres: could not connect")
	}

	data, err := readAll(ctx, src)
	if err != nil {
		log.Fatal(err)
	}

	var report *report
	err = pg.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := prepare(tx, *replace); err != nil {
			return err
		}
		if err := write(tx, data); err != nil {
			return err
		}
		// Deferred foreign keys are checked now, so a broken link fails here, not at commit
		if err := tx.Exec(`SET CONSTRAINTS ALL IMMEDIATE`).Error; err != nil {
			return fmt.Errorf("a row points at something that wasn't copied: %w", err)
		}
		if report, err = verify(tx, data); err != nil {
			return err
		}
		report.print()
		if !report.ok() {
			return errors.New("checks failed: nothing was kept")
		}
		if !*apply {
			return errRollback
		}
		return nil
	})
	switch {
	case errors.Is(err, errRollback):
		fmt.Println("\nDry run passed. Nothing was written. Run with -apply to keep it.")
	case err != nil:
		log.Fatalf("copy failed, nothing was kept: %v", err)
	default:
		fmt.Println("\nCopied and committed.")
	}
}

// ---------------------------------------------------------------------------------------------
// MongoDB shapes, as stored. Unknown fields stop the copy so nothing is silently left behind.
// ---------------------------------------------------------------------------------------------

type geo struct {
	Type        string    `bson:"type"`
	Coordinates []float64 `bson:"coordinates"`
}

func (g geo) valid() bool { return g.Type == "Point" && len(g.Coordinates) == 2 }

type mWallet struct {
	ID            primitive.ObjectID `bson:"_id"`
	UserID        primitive.ObjectID `bson:"user_id"`
	MainPaise     int64              `bson:"main_paise"`
	EarningsPaise int64              `bson:"earnings_paise"`
	LockedPaise   int64              `bson:"locked_paise"`
	BonusPaise    int64              `bson:"bonus_paise"`
	Currency      string             `bson:"currency"`
	Status        string             `bson:"status"`
	CreatedAt     time.Time          `bson:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at"`
	// Rupee balances from before the wallet rebuild; the paise fields are the real ones
	MainBalance     *float64 `bson:"main_balance"`
	EarningsBalance *float64 `bson:"earnings_balance"`
	LockedBalance   *float64 `bson:"locked_balance"`
	BonusBalance    *float64 `bson:"bonus_balance"`
}

type mTx struct {
	ID                primitive.ObjectID `bson:"_id"`
	WalletID          primitive.ObjectID `bson:"wallet_id"`
	UserID            primitive.ObjectID `bson:"user_id"`
	Type              string             `bson:"type"`
	TargetBalance     string             `bson:"target_balance"`
	Category          string             `bson:"category"`
	AmountPaise       int64              `bson:"amount_paise"`
	BalanceAfterPaise int64              `bson:"balance_after_paise"`
	Status            string             `bson:"status"`
	ReferenceID       string             `bson:"reference_id"`
	Description       string             `bson:"description"`
	Metadata          bson.M             `bson:"metadata"`
	CreatedAt         time.Time          `bson:"created_at"`
}

type mWithdrawal struct {
	ID            primitive.ObjectID `bson:"_id"`
	UserID        primitive.ObjectID `bson:"user_id"`
	AmountPaise   int64              `bson:"amount_paise"`
	Status        string             `bson:"status"`
	PayoutMethod  string             `bson:"payout_method"`
	AccountHolder string             `bson:"account_holder"`
	AccountLast4  string             `bson:"account_last4"`
	IFSC          string             `bson:"ifsc"`
	UPIID         string             `bson:"upi_id"`
	ReferenceID   string             `bson:"reference_id"`
	BankReference string             `bson:"bank_reference"`
	FailureReason string             `bson:"failure_reason"`
	HandledBy     string             `bson:"handled_by"`
	CreatedAt     time.Time          `bson:"created_at"`
	ProcessingAt  *time.Time         `bson:"processing_at"`
	PaidAt        *time.Time         `bson:"paid_at"`
	FailedAt      *time.Time         `bson:"failed_at"`
	UpdatedAt     time.Time          `bson:"updated_at"`
}

type mDispute struct {
	ID                  primitive.ObjectID  `bson:"_id"`
	UserID              primitive.ObjectID  `bson:"user_id"`
	UserName            string              `bson:"user_name"`
	UserEmail           string              `bson:"user_email"`
	TransactionID       primitive.ObjectID  `bson:"transaction_id"`
	ReferenceID         string              `bson:"reference_id"`
	AmountPaise         int64               `bson:"amount_paise"`
	RefundPaise         int64               `bson:"refund_paise"`
	TargetBalance       string              `bson:"target_balance"`
	Category            string              `bson:"category"`
	Reason              string              `bson:"reason"`
	Description         string              `bson:"description"`
	Status              string              `bson:"status"`
	AdminNotes          string              `bson:"admin_notes"`
	RefundTransactionID *primitive.ObjectID `bson:"refund_transaction_id"`
	ResolvedBy          string              `bson:"resolved_by"`
	ResolvedAt          *time.Time          `bson:"resolved_at"`
	CreatedAt           time.Time           `bson:"created_at"`
	UpdatedAt           time.Time           `bson:"updated_at"`
}

type mOrder struct {
	ID                primitive.ObjectID `bson:"_id"`
	RazorpayOrderID   string             `bson:"razorpay_order_id"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id"`
	UserID            primitive.ObjectID `bson:"user_id"`
	Purpose           string             `bson:"purpose"`
	AmountPaise       int64              `bson:"amount_paise"`
	Currency          string             `bson:"currency"`
	TargetID          string             `bson:"target_id"`
	Details           map[string]string  `bson:"details"`
	Description       string             `bson:"description"`
	Status            string             `bson:"status"`
	LastFailure       string             `bson:"last_failure"`
	RefundPaise       int64              `bson:"refund_paise"`
	RefundReason      string             `bson:"refund_reason"`
	RefundID          string             `bson:"refund_id"`
	RefundError       string             `bson:"refund_error"`
	PaidAt            *time.Time         `bson:"paid_at"`
	RefundedAt        *time.Time         `bson:"refunded_at"`
	CreatedAt         time.Time          `bson:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at"`
	backfilled        bool
}

type mEvent struct {
	ID             primitive.ObjectID   `bson:"_id"`
	Title          string               `bson:"title"`
	Organizer      string               `bson:"organizer"`
	OrganizerID    primitive.ObjectID   `bson:"organizer_id"`
	Description    string               `bson:"description"`
	Date           string               `bson:"date"`
	Time           string               `bson:"time"`
	Location       string               `bson:"location"`
	MeetingLink    string               `bson:"meeting_link"`
	ImageURL       string               `bson:"image_url"`
	Category       string               `bson:"category"`
	IsPaid         bool                 `bson:"is_paid"`
	Price          float64              `bson:"price"`
	Currency       string               `bson:"currency"`
	Capacity       int                  `bson:"capacity"`
	AvailableSeats int                  `bson:"available_seats"`
	Participants   []primitive.ObjectID `bson:"participants"`
	CreatedAt      time.Time            `bson:"created_at"`
	UpdatedAt      time.Time            `bson:"updated_at"`
}

type mTicket struct {
	ID                primitive.ObjectID `bson:"_id"`
	TicketNumber      string             `bson:"ticket_number"`
	EventID           primitive.ObjectID `bson:"event_id"`
	UserID            primitive.ObjectID `bson:"user_id"`
	AttendeeName      string             `bson:"attendee_name"`
	AttendeeEmail     string             `bson:"attendee_email"`
	AttendeePhone     string             `bson:"attendee_phone"`
	Amount            float64            `bson:"amount"`
	PaymentStatus     string             `bson:"payment_status"`
	PaymentMethod     string             `bson:"payment_method"`
	RazorpayOrderID   string             `bson:"razorpay_order_id"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id"`
	Status            string             `bson:"status"`
	QRCodeData        string             `bson:"qr_code_data"`
	EventTitle        string             `bson:"event_title"`
	EventDate         string             `bson:"event_date"`
	EventTime         string             `bson:"event_time"`
	EventLocation     string             `bson:"event_location"`
	ReminderSentAt    *time.Time         `bson:"reminder_sent_at"`
	CreatedAt         time.Time          `bson:"created_at"`
}

type mMentorship struct {
	ID          primitive.ObjectID `bson:"_id"`
	ExpertID    primitive.ObjectID `bson:"expert_id"`
	Title       string             `bson:"title"`
	Description string             `bson:"description"`
	Category    string             `bson:"category"`
	Duration    int                `bson:"duration"`
	Price       float64            `bson:"price"`
	Rating      float64            `bson:"rating"`
	Reviews     int                `bson:"reviews"`
	Status      string             `bson:"status"`
	CreatedAt   time.Time          `bson:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at"`
}

type mAvailability struct {
	ID        primitive.ObjectID `bson:"_id"`
	ExpertID  primitive.ObjectID `bson:"expert_id"`
	DayOfWeek int                `bson:"day_of_week"`
	StartTime string             `bson:"start_time"`
	EndTime   string             `bson:"end_time"`
	IsActive  bool               `bson:"is_active"`
}

type mBooking struct {
	ID                primitive.ObjectID `bson:"_id"`
	MentorshipID      primitive.ObjectID `bson:"mentorship_id"`
	ExpertID          primitive.ObjectID `bson:"expert_id"`
	UserID            primitive.ObjectID `bson:"user_id"`
	ScheduledAt       time.Time          `bson:"scheduled_at"`
	Status            string             `bson:"status"`
	Amount            float64            `bson:"amount"`
	PaymentStatus     string             `bson:"payment_status"`
	PaymentMethod     string             `bson:"payment_method"`
	RazorpayOrderID   string             `bson:"razorpay_order_id"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id"`
	ReleaseAfter      *time.Time         `bson:"release_after"`
	ReportReason      string             `bson:"report_reason"`
	ReportedAt        *time.Time         `bson:"reported_at"`
	ResolutionNote    string             `bson:"resolution_note"`
	MeetingLink       string             `bson:"meeting_link"`
	Notes             string             `bson:"notes"`
	Rating            float64            `bson:"rating"`
	Review            string             `bson:"review"`
	ReminderSentAt    *time.Time         `bson:"reminder_sent_at"`
	CreatedAt         time.Time          `bson:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at"`
}

type mSubscription struct {
	ID                primitive.ObjectID `bson:"_id"`
	UserID            primitive.ObjectID `bson:"user_id"`
	PlanType          string             `bson:"plan_type"`
	Amount            float64            `bson:"amount"`
	PaymentMethod     string             `bson:"payment_method"`
	PaymentStatus     string             `bson:"payment_status"`
	Status            string             `bson:"status"`
	RazorpayOrderID   string             `bson:"razorpay_order_id"`
	RazorpayPaymentID string             `bson:"razorpay_payment_id"`
	StartsAt          time.Time          `bson:"starts_at"`
	ExpiresAt         time.Time          `bson:"expires_at"`
	CreatedAt         time.Time          `bson:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at"`
}

type mWorker struct {
	ID             primitive.ObjectID `bson:"_id"`
	UserID         primitive.ObjectID `bson:"user_id"`
	Name           string             `bson:"name"`
	Avatar         string             `bson:"avatar"`
	Mobile         string             `bson:"mobile"`
	ActiveSkill    string             `bson:"active_skill"`
	HourlyRate     float64            `bson:"hourly_rate"`
	Rating         float64            `bson:"rating"`
	TotalGigs      int                `bson:"total_gigs"`
	Location       geo                `bson:"location"`
	IsFreeNow      bool               `bson:"is_free_now"`
	LastPingAt     time.Time          `bson:"last_ping_at"`
	QuotaRemaining int                `bson:"quota_remaining"`
	PassExpiresAt  time.Time          `bson:"pass_expires_at"`
	UpdatedAt      time.Time          `bson:"updated_at"`
}

type mPass struct {
	ID                   primitive.ObjectID `bson:"_id"`
	UserID               primitive.ObjectID `bson:"user_id"`
	HasActivePass        bool               `bson:"has_active_pass"`
	Channel              string             `bson:"channel"`
	EndedReason          string             `bson:"ended_reason"`
	QuotaTotal           int                `bson:"quota_total"`
	QuotaRemaining       int                `bson:"quota_remaining"`
	PriceINR             float64            `bson:"price_inr"`
	RazorpayOrderID      string             `bson:"razorpay_order_id"`
	RazorpayPaymentID    string             `bson:"razorpay_payment_id"`
	ExpiryReminderSentAt *time.Time         `bson:"expiry_reminder_sent_at"`
	ActivatedAt          time.Time          `bson:"activated_at"`
	ExpiresAt            time.Time          `bson:"expires_at"`
	CreatedAt            time.Time          `bson:"created_at"`
	UpdatedAt            time.Time          `bson:"updated_at"`
}

type mJob struct {
	ID              primitive.ObjectID  `bson:"_id"`
	RecruiterID     primitive.ObjectID  `bson:"recruiter_id"`
	RecruiterName   string              `bson:"recruiter_name"`
	RecruiterMobile string              `bson:"recruiter_mobile"`
	CompanyName     string              `bson:"company_name"`
	Skill           string              `bson:"skill"`
	Location        geo                 `bson:"location"`
	Address         string              `bson:"address"`
	PayRate         float64             `bson:"pay_rate"`
	RateType        string              `bson:"rate_type"`
	DurationHours   int                 `bson:"duration_hours"`
	RequiredWorkers int                 `bson:"required_workers"`
	Notes           string              `bson:"notes"`
	Status          string              `bson:"status"`
	CandidateID     *primitive.ObjectID `bson:"candidate_id"`
	CandidateName   string              `bson:"candidate_name"`
	CandidateMobile string              `bson:"candidate_mobile"`
	MatchedAt       *time.Time          `bson:"matched_at"`
	CompletedAt     *time.Time          `bson:"completed_at"`
	ClosedAt        *time.Time          `bson:"closed_at"`
	CancelledAt     *time.Time          `bson:"cancelled_at"`
	ExpiresAt       time.Time           `bson:"expires_at"`
	CreatedAt       time.Time           `bson:"created_at"`
	UpdatedAt       time.Time           `bson:"updated_at"`
}

// Fields that are deliberately not copied
var ignored = map[string]string{
	"seed":             "test-data tag; the ids are saved in the backup folder",
	"distance_meters":  "computed per search, never stored",
	"mentorship_title": "read from the mentorship",
	"mentee_name":      "read from the user",
	"mentee_email":     "read from the user",
	"expert_name":      "read from the user",
	"expert_headline":  "read from the user",
	"expert_image":     "read from the user",
}

type source struct {
	wallets       []mWallet
	txs           []mTx
	withdrawals   []mWithdrawal
	disputes      []mDispute
	orders        []mOrder
	events        []mEvent
	tickets       []mTicket
	mentorships   []mMentorship
	availability  []mAvailability
	bookings      []mBooking
	subscriptions []mSubscription
	workers       []mWorker
	passes        []mPass
	jobs          []mJob
	warnings      []string
}

// load reads a whole collection in id order. A field the shape doesn't know stops the copy.
func load[T any](ctx context.Context, db *mongo.Database, coll string, out *[]T) error {
	var zero T
	known := bsonFields(zero)
	cur, err := db.Collection(coll).Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return fmt.Errorf("reading %s: %w", coll, err)
	}
	defer cur.Close(ctx)
	unknown := map[string]bool{}
	for cur.Next(ctx) {
		elems, err := cur.Current.Elements()
		if err != nil {
			return fmt.Errorf("reading %s: %w", coll, err)
		}
		for _, e := range elems {
			if !known[e.Key()] && ignored[e.Key()] == "" {
				unknown[e.Key()] = true
			}
		}
		var v T
		if err := cur.Decode(&v); err != nil {
			return fmt.Errorf("reading %s %v: %w", coll, cur.Current.Lookup("_id"), err)
		}
		*out = append(*out, v)
	}
	if err := cur.Err(); err != nil {
		return fmt.Errorf("reading %s: %w", coll, err)
	}
	if len(unknown) > 0 {
		names := make([]string, 0, len(unknown))
		for k := range unknown {
			names = append(names, k)
		}
		sort.Strings(names)
		return fmt.Errorf("%s has fields this copy doesn't know: %s", coll, strings.Join(names, ", "))
	}
	return nil
}

func readAll(ctx context.Context, db *mongo.Database) (*source, error) {
	s := &source{}
	steps := []error{
		load(ctx, db, "wallets", &s.wallets),
		load(ctx, db, "wallet_transactions", &s.txs),
		load(ctx, db, "wallet_withdrawals", &s.withdrawals),
		load(ctx, db, "wallet_disputes", &s.disputes),
		load(ctx, db, "payment_orders", &s.orders),
		load(ctx, db, "events", &s.events),
		load(ctx, db, "event_tickets", &s.tickets),
		load(ctx, db, "mentorships", &s.mentorships),
		load(ctx, db, "expert_availability", &s.availability),
		load(ctx, db, "mentorship_bookings", &s.bookings),
		load(ctx, db, "expert_subscriptions", &s.subscriptions),
		load(ctx, db, "instant_workers", &s.workers),
		load(ctx, db, "instant_passes", &s.passes),
		load(ctx, db, "instant_jobs", &s.jobs),
	}
	if err := errors.Join(steps...); err != nil {
		return nil, err
	}
	if n, err := db.Collection("bookings").CountDocuments(ctx, bson.M{}); err == nil && n > 0 {
		s.warnings = append(s.warnings, fmt.Sprintf("old 'bookings' collection has %d documents; it is not used by the app and is not copied", n))
	}
	s.checkLegacyBalances()
	s.backfillOrders()
	return s, nil
}

func (s *source) checkLegacyBalances() {
	for _, w := range s.wallets {
		pairs := []struct {
			name   string
			paise  int64
			rupees *float64
		}{{"main", w.MainPaise, w.MainBalance}, {"earnings", w.EarningsPaise, w.EarningsBalance},
			{"locked", w.LockedPaise, w.LockedBalance}, {"bonus", w.BonusPaise, w.BonusBalance}}
		for _, p := range pairs {
			if p.rupees != nil && money.ToPaise(*p.rupees) != p.paise {
				s.warnings = append(s.warnings, fmt.Sprintf("wallet %s: old %s balance %.2f disagrees with %d paise (paise kept)",
					w.ID.Hex(), p.name, *p.rupees, p.paise))
			}
		}
	}
}

// backfillOrders adds a payment record for a card purchase made before payment records were
// kept, so the purchase can point at its payment like every other one does
func (s *source) backfillOrders() {
	have := map[string]bool{}
	for _, o := range s.orders {
		have[o.RazorpayOrderID] = true
	}
	add := func(orderID, paymentID string, user primitive.ObjectID, purpose, target string, paise int64, refunded bool, at, updated time.Time, what string) {
		if orderID == "" || have[orderID] {
			return
		}
		have[orderID] = true
		o := mOrder{
			ID: primitive.NewObjectID(), RazorpayOrderID: orderID, RazorpayPaymentID: paymentID, UserID: user,
			Purpose: purpose, AmountPaise: paise, Currency: "INR", TargetID: target, Status: "paid",
			Description: "Backfilled during the Postgres move: " + what + " bought before payment records were kept",
			PaidAt:      &at, CreatedAt: at, UpdatedAt: updated, backfilled: true,
		}
		if refunded {
			o.Status, o.RefundPaise, o.RefundedAt = "refunded", paise, &updated
		}
		s.orders = append(s.orders, o)
		s.warnings = append(s.warnings, fmt.Sprintf("backfilled payment record for %s (%s, %s)", what, orderID, money.INR(paise)))
	}
	for _, x := range s.subscriptions {
		add(x.RazorpayOrderID, x.RazorpayPaymentID, x.UserID, "subscription", x.PlanType, money.ToPaise(x.Amount),
			x.PaymentStatus == "refunded", x.CreatedAt, x.UpdatedAt, "subscription "+x.ID.Hex())
	}
	for _, x := range s.passes {
		add(x.RazorpayOrderID, x.RazorpayPaymentID, x.UserID, "instant_pass", "", money.ToPaise(x.PriceINR),
			x.EndedReason == "refunded", x.CreatedAt, x.UpdatedAt, "InstantPass "+x.ID.Hex())
	}
	for _, x := range s.tickets {
		add(x.RazorpayOrderID, x.RazorpayPaymentID, x.UserID, "event_ticket", x.EventID.Hex(), money.ToPaise(x.Amount),
			x.PaymentStatus == "refunded", x.CreatedAt, x.CreatedAt, "ticket "+x.ID.Hex())
	}
	for _, x := range s.bookings {
		add(x.RazorpayOrderID, x.RazorpayPaymentID, x.UserID, "mentorship_booking", x.ID.Hex(), money.ToPaise(x.Amount),
			x.PaymentStatus == "refunded", x.CreatedAt, x.UpdatedAt, "session booking "+x.ID.Hex())
	}
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

func prepare(tx *gorm.DB, replace bool) error {
	if replace {
		if err := tx.Exec(`TRUNCATE ` + strings.Join(tables, ", ")).Error; err != nil {
			return fmt.Errorf("emptying the tables: %w", err)
		}
		return nil
	}
	for _, t := range tables {
		var n int64
		if err := tx.Raw(`SELECT count(*) FROM ` + t).Scan(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			return fmt.Errorf("%s already has %d rows; this copy only fills empty tables (see -replace)", t, n)
		}
	}
	return nil
}

func str(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func oid(id primitive.ObjectID) *string {
	if id.IsZero() {
		return nil
	}
	h := id.Hex()
	return &h
}

func oidp(id *primitive.ObjectID) *string {
	if id == nil {
		return nil
	}
	return oid(*id)
}

func tm(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func jsonOf(v interface{}) (*string, error) {
	if v == nil {
		return nil, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if string(b) == "null" {
		return nil, nil
	}
	s := string(b)
	return &s, nil
}

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func write(tx *gorm.DB, s *source) error {
	exec := func(what string, sql string, args ...interface{}) error {
		if err := tx.Exec(sql, args...).Error; err != nil {
			return fmt.Errorf("%s: %w", what, err)
		}
		return nil
	}

	for _, w := range s.wallets {
		if err := exec("wallet "+w.ID.Hex(), `INSERT INTO wallets (id, user_id, main_paise, earnings_paise, locked_paise, bonus_paise,
				currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			w.ID.Hex(), w.UserID.Hex(), w.MainPaise, w.EarningsPaise, w.LockedPaise, w.BonusPaise,
			orDefault(w.Currency, "INR"), orDefault(w.Status, "active"), w.CreatedAt, w.UpdatedAt); err != nil {
			return err
		}
	}
	for _, o := range s.orders {
		details, err := jsonOf(o.Details)
		if err != nil {
			return err
		}
		if len(o.Details) == 0 {
			details = nil
		}
		if err := exec("payment order "+o.RazorpayOrderID, `INSERT INTO payment_orders (id, razorpay_order_id, razorpay_payment_id, user_id,
				purpose, amount_paise, currency, target_id, details, description, status, last_failure, refund_paise, refund_reason,
				refund_id, refund_error, paid_at, refunded_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			o.ID.Hex(), o.RazorpayOrderID, str(o.RazorpayPaymentID), o.UserID.Hex(), o.Purpose, o.AmountPaise,
			orDefault(o.Currency, "INR"), str(o.TargetID), details, str(o.Description), o.Status, str(o.LastFailure),
			o.RefundPaise, str(o.RefundReason), str(o.RefundID), str(o.RefundError), o.PaidAt, o.RefundedAt,
			o.CreatedAt, o.UpdatedAt); err != nil {
			return err
		}
	}
	for _, t := range s.txs {
		meta, err := jsonOf(t.Metadata)
		if err != nil {
			return err
		}
		if err := exec("wallet transaction "+t.ID.Hex(), `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, target_balance,
				category, amount_paise, balance_after_paise, status, reference_id, description, metadata, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
			t.ID.Hex(), t.WalletID.Hex(), t.UserID.Hex(), t.Type, t.TargetBalance, t.Category, t.AmountPaise,
			t.BalanceAfterPaise, orDefault(t.Status, "completed"), t.ReferenceID, t.Description, meta, t.CreatedAt); err != nil {
			return err
		}
	}
	for _, w := range s.withdrawals {
		if err := exec("withdrawal "+w.ID.Hex(), `INSERT INTO wallet_withdrawals (id, user_id, wallet_id, amount_paise, status, payout_method,
				account_holder, account_last4, ifsc, upi_id, reference_id, bank_reference, failure_reason, handled_by, created_at,
				processing_at, paid_at, failed_at, updated_at)
				VALUES (?, ?, (SELECT id FROM wallets WHERE user_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			w.ID.Hex(), w.UserID.Hex(), w.UserID.Hex(), w.AmountPaise, w.Status, w.PayoutMethod, w.AccountHolder,
			str(w.AccountLast4), str(w.IFSC), str(w.UPIID), w.ReferenceID, str(w.BankReference), str(w.FailureReason),
			str(w.HandledBy), w.CreatedAt, w.ProcessingAt, w.PaidAt, w.FailedAt, w.UpdatedAt); err != nil {
			return err
		}
	}
	for _, d := range s.disputes {
		if err := exec("dispute "+d.ID.Hex(), `INSERT INTO wallet_disputes (id, user_id, user_name, user_email, transaction_id, reference_id,
				amount_paise, refund_paise, target_balance, category, reason, description, status, admin_notes,
				refund_transaction_id, resolved_by, resolved_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			d.ID.Hex(), d.UserID.Hex(), d.UserName, d.UserEmail, d.TransactionID.Hex(), d.ReferenceID, d.AmountPaise,
			d.RefundPaise, d.TargetBalance, d.Category, d.Reason, d.Description, d.Status, str(d.AdminNotes),
			oidp(d.RefundTransactionID), str(d.ResolvedBy), d.ResolvedAt, d.CreatedAt, d.UpdatedAt); err != nil {
			return err
		}
	}
	for _, e := range s.events {
		if err := exec("event "+e.ID.Hex(), `INSERT INTO events (id, title, organizer, organizer_id, description, date, time, location,
				meeting_link, image_url, category, is_paid, price_paise, currency, capacity, available_seats, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			e.ID.Hex(), e.Title, e.Organizer, oid(e.OrganizerID), e.Description, e.Date, e.Time, e.Location,
			str(e.MeetingLink), str(e.ImageURL), str(e.Category), e.IsPaid, money.ToPaise(e.Price), orDefault(e.Currency, "INR"),
			e.Capacity, e.AvailableSeats, e.CreatedAt, orTime(e.UpdatedAt, e.CreatedAt)); err != nil {
			return err
		}
		for _, p := range uniqueIDs(e.Participants) {
			if err := exec("participant of event "+e.ID.Hex(), `INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)`,
				e.ID.Hex(), p.Hex()); err != nil {
				return err
			}
		}
	}
	for _, t := range s.tickets {
		if err := exec("ticket "+t.ID.Hex(), `INSERT INTO event_tickets (id, ticket_number, event_id, user_id, attendee_name, attendee_email,
				attendee_phone, amount_paise, payment_status, payment_method, razorpay_order_id, razorpay_payment_id, status, qr_code_data,
				event_title, event_date, event_time, event_location, reminder_sent_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			t.ID.Hex(), t.TicketNumber, t.EventID.Hex(), t.UserID.Hex(), t.AttendeeName, t.AttendeeEmail, str(t.AttendeePhone),
			money.ToPaise(t.Amount), t.PaymentStatus, t.PaymentMethod, str(t.RazorpayOrderID), str(t.RazorpayPaymentID),
			orDefault(t.Status, "confirmed"), t.QRCodeData, str(t.EventTitle), str(t.EventDate), str(t.EventTime),
			str(t.EventLocation), t.ReminderSentAt, t.CreatedAt, t.CreatedAt); err != nil {
			return err
		}
	}
	for _, m := range s.mentorships {
		if err := exec("mentorship "+m.ID.Hex(), `INSERT INTO mentorships (id, expert_id, title, description, category, duration, price_paise,
				rating, reviews, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			m.ID.Hex(), m.ExpertID.Hex(), m.Title, m.Description, m.Category, m.Duration, money.ToPaise(m.Price),
			m.Rating, m.Reviews, orDefault(m.Status, "active"), m.CreatedAt, orTime(m.UpdatedAt, m.CreatedAt)); err != nil {
			return err
		}
	}
	for _, a := range s.availability {
		if err := exec("availability "+a.ID.Hex(), `INSERT INTO expert_availability (id, expert_id, day_of_week, start_time, end_time, is_active)
				VALUES (?, ?, ?, ?::time, ?::time, ?)`,
			a.ID.Hex(), a.ExpertID.Hex(), a.DayOfWeek, a.StartTime, a.EndTime, a.IsActive); err != nil {
			return err
		}
	}
	for _, b := range s.bookings {
		var rating *float64
		if b.Rating > 0 {
			rating = &b.Rating
		}
		if err := exec("booking "+b.ID.Hex(), `INSERT INTO mentorship_bookings (id, mentorship_id, expert_id, user_id, scheduled_at, status,
				amount_paise, payment_status, payment_method, razorpay_order_id, razorpay_payment_id, release_after, report_reason,
				reported_at, resolution_note, meeting_link, notes, rating, review, reminder_sent_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			b.ID.Hex(), b.MentorshipID.Hex(), b.ExpertID.Hex(), b.UserID.Hex(), b.ScheduledAt, b.Status, money.ToPaise(b.Amount),
			orDefault(b.PaymentStatus, "pending"), str(b.PaymentMethod), str(b.RazorpayOrderID), str(b.RazorpayPaymentID),
			b.ReleaseAfter, str(b.ReportReason), b.ReportedAt, str(b.ResolutionNote), str(b.MeetingLink), str(b.Notes),
			rating, str(b.Review), b.ReminderSentAt, b.CreatedAt, b.UpdatedAt); err != nil {
			return err
		}
	}
	for _, x := range s.subscriptions {
		if err := exec("subscription "+x.ID.Hex(), `INSERT INTO expert_subscriptions (id, user_id, plan_type, amount_paise, payment_method,
				payment_status, status, razorpay_order_id, razorpay_payment_id, starts_at, expires_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			x.ID.Hex(), x.UserID.Hex(), x.PlanType, money.ToPaise(x.Amount), x.PaymentMethod, x.PaymentStatus,
			orDefault(x.Status, "active"), str(x.RazorpayOrderID), str(x.RazorpayPaymentID), x.StartsAt, x.ExpiresAt,
			x.CreatedAt, x.UpdatedAt); err != nil {
			return err
		}
	}
	for _, w := range s.workers {
		var lng, lat *float64
		if w.Location.valid() {
			lng, lat = &w.Location.Coordinates[0], &w.Location.Coordinates[1]
		}
		if err := exec("instant worker "+w.ID.Hex(), `INSERT INTO instant_workers (id, user_id, name, avatar, mobile, active_skill,
				hourly_rate_paise, rating, total_gigs, location, is_free_now, last_ping_at, quota_remaining, pass_expires_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
					CASE WHEN ?::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(?::float8, ?::float8), 4326)::geography END,
					?, ?, ?, ?, ?)`,
			w.ID.Hex(), w.UserID.Hex(), w.Name, w.Avatar, w.Mobile, w.ActiveSkill, money.ToPaise(w.HourlyRate), w.Rating,
			w.TotalGigs, lng, lng, lat, w.IsFreeNow, tm(w.LastPingAt), w.QuotaRemaining, tm(w.PassExpiresAt), w.UpdatedAt); err != nil {
			return err
		}
	}
	for _, p := range s.passes {
		if err := exec("InstantPass "+p.ID.Hex(), `INSERT INTO instant_passes (id, user_id, has_active_pass, channel, ended_reason, quota_total,
				quota_remaining, price_paise, razorpay_order_id, razorpay_payment_id, expiry_reminder_sent_at, activated_at, expires_at,
				created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			p.ID.Hex(), p.UserID.Hex(), p.HasActivePass, str(p.Channel), str(p.EndedReason), p.QuotaTotal, p.QuotaRemaining,
			money.ToPaise(p.PriceINR), str(p.RazorpayOrderID), str(p.RazorpayPaymentID), p.ExpiryReminderSentAt, p.ActivatedAt,
			p.ExpiresAt, p.CreatedAt, p.UpdatedAt); err != nil {
			return err
		}
	}
	for _, j := range s.jobs {
		if !j.Location.valid() {
			return fmt.Errorf("instant job %s has no map location", j.ID.Hex())
		}
		if err := exec("instant job "+j.ID.Hex(), `INSERT INTO instant_jobs (id, recruiter_id, recruiter_name, recruiter_mobile, company_name,
				skill, location, address, pay_rate_paise, rate_type, duration_hours, required_workers, notes, status, candidate_id,
				candidate_name, candidate_mobile, matched_at, completed_at, closed_at, cancelled_at, expires_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			j.ID.Hex(), j.RecruiterID.Hex(), j.RecruiterName, str(j.RecruiterMobile), j.CompanyName, j.Skill,
			j.Location.Coordinates[0], j.Location.Coordinates[1], j.Address, money.ToPaise(j.PayRate), j.RateType,
			j.DurationHours, j.RequiredWorkers, j.Notes, j.Status, oidp(j.CandidateID), str(j.CandidateName),
			str(j.CandidateMobile), j.MatchedAt, j.CompletedAt, j.ClosedAt, j.CancelledAt, j.ExpiresAt, j.CreatedAt, j.UpdatedAt); err != nil {
			return err
		}
	}
	return nil
}

func orTime(t, def time.Time) time.Time {
	if t.IsZero() {
		return def
	}
	return t
}

func uniqueIDs(ids []primitive.ObjectID) []primitive.ObjectID {
	seen := map[primitive.ObjectID]bool{}
	out := []primitive.ObjectID{}
	for _, id := range ids {
		if !id.IsZero() && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// ---------------------------------------------------------------------------------------------
// Checks, run inside the transaction
// ---------------------------------------------------------------------------------------------

type check struct {
	name     string
	expected string
	got      string
}

type report struct {
	checks   []check
	warnings []string
}

func (r *report) add(name string, expected, got interface{}) {
	r.checks = append(r.checks, check{name, fmt.Sprint(expected), fmt.Sprint(got)})
}

func (r *report) ok() bool {
	for _, c := range r.checks {
		if c.expected != c.got {
			return false
		}
	}
	return true
}

func (r *report) print() {
	fmt.Printf("%-44s %-20s %-20s %s\n", "CHECK", "MONGODB", "POSTGRES", "")
	for _, c := range r.checks {
		mark := "ok"
		if c.expected != c.got {
			mark = "MISMATCH"
		}
		fmt.Printf("%-44s %-20s %-20s %s\n", c.name, short(c.expected), short(c.got), mark)
	}
	if len(r.warnings) > 0 {
		fmt.Println("\nNotes:")
		for _, w := range r.warnings {
			fmt.Println(" - " + w)
		}
	}
}

func short(s string) string {
	if len(s) > 20 {
		return s[:8] + "…" + s[len(s)-8:]
	}
	return s
}

// idDigest is an order-independent fingerprint of a set of ids: count:first:last of the sorted list
func idDigest(ids []string) string {
	sort.Strings(ids)
	if len(ids) == 0 {
		return "0"
	}
	return fmt.Sprintf("%d:%s:%s", len(ids), ids[0], ids[len(ids)-1])
}

func verify(tx *gorm.DB, s *source) (*report, error) {
	r := &report{warnings: s.warnings}
	var err error
	q := func(sql string, dest interface{}) {
		if err == nil {
			err = tx.Raw(sql).Scan(dest).Error
		}
	}
	idsOf := func(table string) []string {
		var ids []string
		q(`SELECT id FROM `+table, &ids)
		return ids
	}
	sum := func(sql string) int64 {
		var n int64
		q(sql, &n)
		return n
	}
	hexes := func(n int, at func(int) primitive.ObjectID) []string {
		out := make([]string, n)
		for i := 0; i < n; i++ {
			out[i] = at(i).Hex()
		}
		return out
	}
	// Every id, compared as full sorted lists
	idCheck := func(table string, want []string) {
		got := idsOf(table)
		sort.Strings(want)
		sort.Strings(got)
		r.add(table+" ids", idDigest(want), idDigest(got))
		if strings.Join(want, ",") != strings.Join(got, ",") {
			r.add(table+" id lists identical", true, false)
		}
	}

	idCheck("wallets", hexes(len(s.wallets), func(i int) primitive.ObjectID { return s.wallets[i].ID }))
	idCheck("wallet_transactions", hexes(len(s.txs), func(i int) primitive.ObjectID { return s.txs[i].ID }))
	idCheck("wallet_withdrawals", hexes(len(s.withdrawals), func(i int) primitive.ObjectID { return s.withdrawals[i].ID }))
	idCheck("wallet_disputes", hexes(len(s.disputes), func(i int) primitive.ObjectID { return s.disputes[i].ID }))
	idCheck("payment_orders", hexes(len(s.orders), func(i int) primitive.ObjectID { return s.orders[i].ID }))
	idCheck("events", hexes(len(s.events), func(i int) primitive.ObjectID { return s.events[i].ID }))
	idCheck("event_tickets", hexes(len(s.tickets), func(i int) primitive.ObjectID { return s.tickets[i].ID }))
	idCheck("mentorships", hexes(len(s.mentorships), func(i int) primitive.ObjectID { return s.mentorships[i].ID }))
	idCheck("expert_availability", hexes(len(s.availability), func(i int) primitive.ObjectID { return s.availability[i].ID }))
	idCheck("mentorship_bookings", hexes(len(s.bookings), func(i int) primitive.ObjectID { return s.bookings[i].ID }))
	idCheck("expert_subscriptions", hexes(len(s.subscriptions), func(i int) primitive.ObjectID { return s.subscriptions[i].ID }))
	idCheck("instant_workers", hexes(len(s.workers), func(i int) primitive.ObjectID { return s.workers[i].ID }))
	idCheck("instant_passes", hexes(len(s.passes), func(i int) primitive.ObjectID { return s.passes[i].ID }))
	idCheck("instant_jobs", hexes(len(s.jobs), func(i int) primitive.ObjectID { return s.jobs[i].ID }))

	participants := 0
	for _, e := range s.events {
		participants += len(uniqueIDs(e.Participants))
	}
	r.add("event_participants rows", participants, sum(`SELECT count(*) FROM event_participants`))

	// Money, to the paisa
	var w [4]int64
	var txSum, ordSum, refundSum, tkSum, bkSum, subSum, passSum, mentSum, evSum, hrSum, paySum, wdSum, dpSum int64
	for _, x := range s.wallets {
		w[0] += x.MainPaise
		w[1] += x.EarningsPaise
		w[2] += x.LockedPaise
		w[3] += x.BonusPaise
	}
	for _, x := range s.txs {
		txSum += x.AmountPaise
	}
	for _, x := range s.orders {
		ordSum += x.AmountPaise
		refundSum += x.RefundPaise
	}
	for _, x := range s.tickets {
		tkSum += money.ToPaise(x.Amount)
	}
	for _, x := range s.bookings {
		bkSum += money.ToPaise(x.Amount)
	}
	for _, x := range s.subscriptions {
		subSum += money.ToPaise(x.Amount)
	}
	for _, x := range s.passes {
		passSum += money.ToPaise(x.PriceINR)
	}
	for _, x := range s.mentorships {
		mentSum += money.ToPaise(x.Price)
	}
	for _, x := range s.events {
		evSum += money.ToPaise(x.Price)
	}
	for _, x := range s.workers {
		hrSum += money.ToPaise(x.HourlyRate)
	}
	for _, x := range s.jobs {
		paySum += money.ToPaise(x.PayRate)
	}
	for _, x := range s.withdrawals {
		wdSum += x.AmountPaise
	}
	for _, x := range s.disputes {
		dpSum += x.AmountPaise
	}
	r.add("wallets main paise", w[0], sum(`SELECT coalesce(sum(main_paise),0) FROM wallets`))
	r.add("wallets earnings paise", w[1], sum(`SELECT coalesce(sum(earnings_paise),0) FROM wallets`))
	r.add("wallets locked paise", w[2], sum(`SELECT coalesce(sum(locked_paise),0) FROM wallets`))
	r.add("wallets bonus paise", w[3], sum(`SELECT coalesce(sum(bonus_paise),0) FROM wallets`))
	r.add("wallet_transactions paise", txSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM wallet_transactions`))
	r.add("wallet_withdrawals paise", wdSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM wallet_withdrawals`))
	r.add("wallet_disputes paise", dpSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM wallet_disputes`))
	r.add("payment_orders paise", ordSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM payment_orders`))
	r.add("payment_orders refunded paise", refundSum, sum(`SELECT coalesce(sum(refund_paise),0) FROM payment_orders`))
	r.add("event_tickets paise", tkSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM event_tickets`))
	r.add("mentorship_bookings paise", bkSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM mentorship_bookings`))
	r.add("expert_subscriptions paise", subSum, sum(`SELECT coalesce(sum(amount_paise),0) FROM expert_subscriptions`))
	r.add("instant_passes paise", passSum, sum(`SELECT coalesce(sum(price_paise),0) FROM instant_passes`))
	r.add("mentorships price paise", mentSum, sum(`SELECT coalesce(sum(price_paise),0) FROM mentorships`))
	r.add("events price paise", evSum, sum(`SELECT coalesce(sum(price_paise),0) FROM events`))
	r.add("instant_workers hourly paise", hrSum, sum(`SELECT coalesce(sum(hourly_rate_paise),0) FROM instant_workers`))
	r.add("instant_jobs pay paise", paySum, sum(`SELECT coalesce(sum(pay_rate_paise),0) FROM instant_jobs`))

	// Map points: every worker and job back where it was
	type point struct {
		ID  string
		Lng *float64
		Lat *float64
	}
	var pts []point
	q(`SELECT id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat FROM instant_workers
		UNION ALL SELECT id, ST_X(location::geometry), ST_Y(location::geometry) FROM instant_jobs`, &pts)
	want := map[string]geo{}
	for _, x := range s.workers {
		want[x.ID.Hex()] = x.Location
	}
	for _, x := range s.jobs {
		want[x.ID.Hex()] = x.Location
	}
	moved := 0
	for _, p := range pts {
		g := want[p.ID]
		switch {
		case !g.valid() && p.Lng == nil:
		case g.valid() && p.Lng != nil && math.Abs(*p.Lng-g.Coordinates[0]) < 1e-9 && math.Abs(*p.Lat-g.Coordinates[1]) < 1e-9:
		default:
			moved++
		}
	}
	r.add("map points not where they were", 0, moved)

	// Slot times, as the app reads them
	var slots []struct {
		ID    string
		Start string
		End   string
	}
	q(`SELECT id, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end" FROM expert_availability`, &slots)
	byID := map[string]mAvailability{}
	for _, a := range s.availability {
		byID[a.ID.Hex()] = a
	}
	off := 0
	for _, sl := range slots {
		a := byID[sl.ID]
		if normClock(a.StartTime) != sl.Start || normClock(a.EndTime) != sl.End {
			off++
		}
	}
	r.add("availability slots with changed times", 0, off)

	// The ledger should add up to each balance. A difference already existed in MongoDB, so it is
	// reported, not treated as a copy failure.
	var mismatches []struct {
		UserID   string
		Balance  string
		Stored   int64
		Computed int64
	}
	q(`WITH ledger AS (
			SELECT wallet_id, target_balance, sum(CASE WHEN type = 'credit' THEN amount_paise ELSE -amount_paise END) AS net
			FROM wallet_transactions GROUP BY wallet_id, target_balance
		), stored AS (
			SELECT w.id, w.user_id, b.balance, b.amount FROM wallets w
			CROSS JOIN LATERAL (VALUES ('main', w.main_paise), ('earnings', w.earnings_paise),
				('locked', w.locked_paise), ('bonus', w.bonus_paise)) AS b(balance, amount)
		)
		SELECT s.user_id, s.balance, s.amount AS stored, coalesce(l.net, 0) AS computed
		FROM stored s LEFT JOIN ledger l ON l.wallet_id = s.id AND l.target_balance = s.balance
		WHERE s.amount <> coalesce(l.net, 0) ORDER BY 1, 2`, &mismatches)
	for _, m := range mismatches {
		r.warnings = append(r.warnings, fmt.Sprintf("wallet of user %s: %s balance is %s but its ledger adds up to %s (same in MongoDB)",
			m.UserID, m.Balance, money.INR(m.Stored), money.INR(m.Computed)))
	}
	return r, err
}

// normClock writes "9:00" or "09:00" as "09:00"
func normClock(s string) string {
	t, err := time.Parse("15:04", strings.TrimSpace(s))
	if err != nil {
		return s
	}
	return t.Format("15:04")
}

// bsonFields lists the bson names of a struct's fields
func bsonFields(v interface{}) map[string]bool {
	out := map[string]bool{}
	raw, err := bson.Marshal(v)
	if err != nil {
		return out
	}
	elems, _ := bson.Raw(raw).Elements()
	for _, e := range elems {
		out[e.Key()] = true
	}
	return out
}
