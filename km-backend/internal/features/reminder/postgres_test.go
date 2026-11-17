package reminder

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/notification"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These run the booking, ticket and pass reminders on a throwaway Postgres schema (see pgtest).
// Interview reminders read MongoDB and are not covered here.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type sentNote struct {
	to    primitive.ObjectID
	title string
	msg   string
}

type fakeNotify struct {
	notification.NotificationService
	mu   sync.Mutex
	sent []sentNote
}

func (f *fakeNotify) CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentNote{to: req.UserID, title: req.Title, msg: req.Message})
	return &notification.Notification{}, nil
}

func (f *fakeNotify) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.sent)
}

func newPGService(t *testing.T) (*Service, *database.PostgresDB, *fakeNotify) {
	t.Helper()
	pg := pgtest.New(t)
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}
	notify := &fakeNotify{}
	return NewService(mdb, pg, notify), pg, notify
}

func exec(t *testing.T, pg *database.PostgresDB, sql string, args ...interface{}) {
	t.Helper()
	if err := pg.DB.Exec(sql, args...).Error; err != nil {
		t.Fatal(err)
	}
}

func hex() string { return primitive.NewObjectID().Hex() }

func TestPGSessionReminderGoesOutOnceToBothSides(t *testing.T) {
	s, pg, notify := newPGService(t)
	now := time.Now()
	expert, mentee := hex(), hex()
	mentorship := hex()
	exec(t, pg, `INSERT INTO mentorships (id, expert_id, title, duration) VALUES (?, ?, 'Resume review', 30)`, mentorship, expert)
	exec(t, pg, `INSERT INTO mentorship_bookings (id, mentorship_id, expert_id, user_id, scheduled_at, status) VALUES
		(?, ?, ?, ?, ?, 'confirmed'), (?, ?, ?, ?, ?, 'pending'), (?, ?, ?, ?, ?, 'confirmed')`,
		hex(), mentorship, expert, mentee, now.Add(30*time.Minute),
		hex(), mentorship, expert, mentee, now.Add(40*time.Minute), // not confirmed yet
		hex(), mentorship, expert, mentee, now.Add(5*time.Hour)) // too far off

	for run := 1; run <= 2; run++ {
		n, err := s.sessions(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if want := map[int]int{1: 1, 2: 0}[run]; n != want {
			t.Fatalf("run %d sent %d session reminders, want %d", run, n, want)
		}
	}
	if notify.count() != 2 {
		t.Fatalf("%d notifications, want one each for mentee and expert", notify.count())
	}
	if notify.sent[0].msg[:len("Your session “Resume review”")] != "Your session “Resume review”" {
		t.Fatalf("message = %q", notify.sent[0].msg)
	}
}

func TestPGEventReminderUsesTheEventsCurrentTime(t *testing.T) {
	s, pg, notify := newPGService(t)
	start := time.Now().Add(3 * time.Hour).In(ist)
	date, clock := start.Format("2006-01-02"), start.Format("15:04")

	live, gone := hex(), hex()
	exec(t, pg, `INSERT INTO events (id, title, date, time, location) VALUES (?, 'Career fair', ?, ?, 'Pune'), (?, 'Old meetup', ?, ?, '')`,
		live, date, clock, gone, date, clock)
	exec(t, pg, `UPDATE events SET deleted_at = now() WHERE id = ?`, gone)
	buyer := hex()
	// The copy on the ticket still has the old date: the event was moved after it was bought
	exec(t, pg, `INSERT INTO event_tickets (id, ticket_number, event_id, user_id, payment_status, payment_method, event_date, event_time) VALUES
		(?, 'T-1', ?, ?, 'free', 'free', '2020-01-01', '10:00'),
		(?, 'T-2', ?, ?, 'free', 'free', NULL, NULL)`,
		hex(), live, buyer, hex(), gone, buyer)

	for run := 1; run <= 2; run++ {
		n, err := s.events(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if want := map[int]int{1: 1, 2: 0}[run]; n != want {
			t.Fatalf("run %d sent %d event reminders, want %d", run, n, want)
		}
	}
	if notify.count() != 1 || notify.sent[0].to.Hex() != buyer {
		t.Fatalf("sent = %+v", notify.sent)
	}
}

func TestPGPassExpiryReminderOnceAndOnlyWhenClose(t *testing.T) {
	s, pg, notify := newPGService(t)
	now := time.Now()
	soon, later := hex(), hex()
	exec(t, pg, `INSERT INTO instant_passes (id, user_id, quota_total, quota_remaining, price_paise, activated_at, expires_at) VALUES
		(?, ?, 10, 4, 9900, ?, ?), (?, ?, 10, 10, 9900, ?, ?)`,
		hex(), soon, now.Add(-24*time.Hour), now.Add(48*time.Hour),
		hex(), later, now.Add(-24*time.Hour), now.Add(10*24*time.Hour))

	for run := 1; run <= 2; run++ {
		n, err := s.expiringPasses(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if want := map[int]int{1: 1, 2: 0}[run]; n != want {
			t.Fatalf("run %d sent %d pass reminders, want %d", run, n, want)
		}
	}
	if notify.count() != 1 || notify.sent[0].to.Hex() != soon {
		t.Fatalf("sent = %+v", notify.sent)
	}
}

func TestPGOverlappingRunsSendEachReminderOnce(t *testing.T) {
	s, pg, notify := newPGService(t)
	now := time.Now()
	for i := 0; i < 5; i++ {
		exec(t, pg, `INSERT INTO instant_passes (id, user_id, quota_total, quota_remaining, price_paise, activated_at, expires_at)
			VALUES (?, ?, 10, 10, 9900, ?, ?)`, hex(), hex(), now.Add(-time.Hour), now.Add(24*time.Hour))
	}
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, _ = s.expiringPasses(context.Background()) }()
	}
	wg.Wait()
	if notify.count() != 5 {
		t.Fatalf("%d reminders for 5 passes", notify.count())
	}
}
