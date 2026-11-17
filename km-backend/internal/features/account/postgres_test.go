package account

import (
	"context"
	"os"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These check the account features that read and write the Postgres money tables, on a
// throwaway schema (see pgtest).

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

// newPGRepo builds the repository. With a Mongo URI it uses a throwaway Mongo database (the
// deletion checks also count job posts there); without one, a client that never connects.
func newPGRepo(t *testing.T, needMongo bool) (*mongoRepository, *database.PostgresDB) {
	t.Helper()
	pg := pgtest.New(t)
	uri := os.Getenv("WALLET_TEST_MONGO_URI")
	if needMongo && uri == "" {
		t.Skip("WALLET_TEST_MONGO_URI not set")
	}
	if uri == "" || !needMongo {
		uri = "mongodb://127.0.0.1:1"
	}
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri).SetServerSelectionTimeout(2*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("km_account_pg_test")}
	if needMongo {
		t.Cleanup(func() {
			_ = mdb.DB.Drop(context.Background())
			_ = client.Disconnect(context.Background())
		})
	}
	return NewRepository(mdb, pg, database.NewPgTransactor(pg)).(*mongoRepository), pg
}

func run(t *testing.T, pg *database.PostgresDB, sql string, args ...interface{}) {
	t.Helper()
	if err := pg.DB.Exec(sql, args...).Error; err != nil {
		t.Fatal(err)
	}
}

func newHex() string { return primitive.NewObjectID().Hex() }

// seedMember gives a user a wallet, ledger rows, a dispute, bookings and a plan
func seedMember(t *testing.T, pg *database.PostgresDB, uid string, now time.Time) {
	t.Helper()
	wallet := newHex()
	run(t, pg, `INSERT INTO wallets (id, user_id, main_paise, earnings_paise, locked_paise, bonus_paise) VALUES (?, ?, 15000, 2500, 0, 100)`, wallet, uid)
	disputed := newHex()
	run(t, pg, `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, target_balance, category, amount_paise, balance_after_paise, status, reference_id) VALUES
		(?, ?, ?, 'debit', 'earnings', 'withdrawal', 1000, 2500, 'pending', ?),
		(?, ?, ?, 'credit', 'main', 'topup', 5000, 15000, 'pending', ?),
		(?, ?, ?, 'debit', 'main', 'pass_purchase', 9900, 15000, 'completed', ?)`,
		newHex(), wallet, uid, "w:"+newHex(),
		newHex(), wallet, uid, "t:"+newHex(), // abandoned top-up: doesn't count
		disputed, wallet, uid, "p:"+newHex())
	run(t, pg, `INSERT INTO wallet_disputes (id, user_id, user_name, user_email, transaction_id, reference_id, amount_paise, target_balance, category, reason, description)
		VALUES (?, ?, 'Asha Rao', 'asha@example.com', ?, 'ref', 9900, 'main', 'pass_purchase', 'technical_failure', 'did not work')`,
		newHex(), uid, disputed)

	mentorship := newHex()
	run(t, pg, `INSERT INTO mentorships (id, expert_id, title, duration) VALUES (?, ?, 'Mock interview', 30)`, mentorship, uid)
	run(t, pg, `INSERT INTO expert_availability (id, expert_id, day_of_week, start_time, end_time) VALUES (?, ?, 1, '10:00', '12:00')`, newHex(), uid)
	run(t, pg, `INSERT INTO mentorship_bookings (id, mentorship_id, expert_id, user_id, scheduled_at, status) VALUES
		(?, ?, ?, ?, ?, 'confirmed'), (?, ?, ?, ?, ?, 'confirmed'), (?, ?, ?, ?, ?, 'completed')`,
		newHex(), mentorship, uid, newHex(), now.Add(48*time.Hour), // as the expert, still to come
		newHex(), mentorship, uid, newHex(), now.Add(-5*time.Hour), // long past
		newHex(), mentorship, uid, newHex(), now.Add(72*time.Hour)) // already settled
	run(t, pg, `INSERT INTO expert_subscriptions (id, user_id, plan_type, amount_paise, payment_method, payment_status, status, starts_at, expires_at)
		VALUES (?, ?, 'monthly', 49900, 'wallet', 'paid', 'active', ?, ?)`, newHex(), uid, now.Add(-24*time.Hour), now.Add(29*24*time.Hour))
}

func TestPGDeletionChecksReadTheMoneyTables(t *testing.T) {
	r, pg := newPGRepo(t, true)
	now := time.Now()
	uid := primitive.NewObjectID()
	seedMember(t, pg, uid.Hex(), now)

	c, err := r.DeletionChecks(context.Background(), uid, now)
	if err != nil {
		t.Fatal(err)
	}
	if c.Wallet == nil || c.Wallet.MainPaise != 15000 || c.Wallet.EarningsPaise != 2500 || c.Wallet.BonusPaise != 100 {
		t.Fatalf("wallet = %+v", c.Wallet)
	}
	if c.PendingTransactions != 1 || c.OpenDisputes != 1 || c.UpcomingSessions != 1 {
		t.Fatalf("pending = %d, disputes = %d, sessions = %d", c.PendingTransactions, c.OpenDisputes, c.UpcomingSessions)
	}
	if c.SubscriptionEndsAt == nil || c.SubscriptionEndsAt.Sub(now.Add(29*24*time.Hour)).Abs() > time.Second {
		t.Fatalf("subscription ends %v", c.SubscriptionEndsAt)
	}

	// Someone with no money records has nothing blocking
	empty, err := r.DeletionChecks(context.Background(), primitive.NewObjectID(), now)
	if err != nil {
		t.Fatal(err)
	}
	if empty.Wallet != nil || empty.PendingTransactions != 0 || empty.OpenDisputes != 0 || empty.UpcomingSessions != 0 || empty.SubscriptionEndsAt != nil {
		t.Fatalf("empty = %+v", empty)
	}
}

func TestPGErasureWindsDownAndKeepsMoneyRecords(t *testing.T) {
	r, pg := newPGRepo(t, false)
	uid := newHex()
	other := newHex()
	seedMember(t, pg, uid, time.Now())
	seedMember(t, pg, other, time.Now())

	for i := 0; i < 2; i++ { // safe to run again
		if err := r.erasePurchaseData(context.Background(), uid); err != nil {
			t.Fatal(err)
		}
	}

	var got struct {
		Mentorship   string
		Availability int64
		Plan         string
		Wallet       string
		DisputeName  string
		DisputeEmail string
		Ledger       int64
	}
	if err := pg.DB.Raw(`SELECT
			(SELECT status FROM mentorships WHERE expert_id = @u) AS mentorship,
			(SELECT count(*) FROM expert_availability WHERE expert_id = @u) AS availability,
			(SELECT status FROM expert_subscriptions WHERE user_id = @u) AS plan,
			(SELECT status FROM wallets WHERE user_id = @u) AS wallet,
			(SELECT user_name FROM wallet_disputes WHERE user_id = @u) AS dispute_name,
			(SELECT user_email FROM wallet_disputes WHERE user_id = @u) AS dispute_email,
			(SELECT count(*) FROM wallet_transactions WHERE user_id = @u) AS ledger`,
		map[string]interface{}{"u": uid}).Scan(&got).Error; err != nil {
		t.Fatal(err)
	}
	want := struct {
		Mentorship   string
		Availability int64
		Plan         string
		Wallet       string
		DisputeName  string
		DisputeEmail string
		Ledger       int64
	}{"inactive", 0, "cancelled", "closed", "Deleted user", "", 3}
	if got != want {
		t.Fatalf("after erasure got %+v, want %+v", got, want)
	}

	// Nobody else is touched
	var untouched int64
	pg.DB.Raw(`SELECT count(*) FROM wallets WHERE user_id = ? AND status = 'active'`, other).Scan(&untouched)
	if untouched != 1 {
		t.Fatal("another member's wallet was closed")
	}
}

func TestPGExportListsTheMembersMoneyRows(t *testing.T) {
	r, pg := newPGRepo(t, false)
	uid := newHex()
	seedMember(t, pg, uid, time.Now())
	seedMember(t, pg, newHex(), time.Now())

	txs, err := r.pgRows(context.Background(), "wallet_transactions", "user_id = @uid", uid)
	if err != nil {
		t.Fatal(err)
	}
	if len(txs) != 3 {
		t.Fatalf("%d transactions exported, want 3", len(txs))
	}
	for _, tx := range txs {
		if tx["user_id"] != uid || tx["amount_paise"] == nil {
			t.Fatalf("row = %v", tx)
		}
	}
	bookings, err := r.pgRows(context.Background(), "mentorship_bookings", "user_id = @uid OR expert_id = @uid", uid)
	if err != nil || len(bookings) != 3 {
		t.Fatalf("bookings = %d, err = %v", len(bookings), err)
	}
	none, err := r.pgRows(context.Background(), "wallets", "user_id = @uid", newHex())
	if err != nil || none == nil || len(none) != 0 {
		t.Fatalf("no wallet should export as an empty list, got %v (%v)", none, err)
	}
}
