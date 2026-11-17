package user

import (
	"context"
	"encoding/csv"
	"os"
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These check the user features that read Postgres (passes, wallet, events) on a throwaway
// schema (see pgtest). MongoDB is a client that never connects: the parts read here don't use it.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

func newPGUserRepo(t *testing.T) (*UserRepositoryImpl, *database.PostgresDB) {
	t.Helper()
	pg := pgtest.New(t)
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}
	return NewUserRepository(mdb, pg).(*UserRepositoryImpl), pg
}

func pgExec(t *testing.T, pg *database.PostgresDB, sql string, args ...interface{}) {
	t.Helper()
	if err := pg.DB.Exec(sql, args...).Error; err != nil {
		t.Fatal(err)
	}
}

func oidHex() string { return primitive.NewObjectID().Hex() }

func TestPGHasActivePass(t *testing.T) {
	r, pg := newPGUserRepo(t)
	now := time.Now()
	current, expired, refunded, usedUp := oidHex(), oidHex(), oidHex(), oidHex()
	pgExec(t, pg, `INSERT INTO instant_passes (id, user_id, has_active_pass, quota_total, quota_remaining, price_paise, activated_at, expires_at) VALUES
		(?, ?, true, 10, 5, 9900, @a, @e), (?, ?, true, 10, 5, 9900, @a, @past),
		(?, ?, false, 10, 0, 9900, @a, @e), (?, ?, true, 10, 0, 9900, @a, @e)`,
		oidHex(), current, oidHex(), expired, oidHex(), refunded, oidHex(), usedUp,
		map[string]interface{}{"a": now.Add(-48 * time.Hour), "e": now.Add(24 * time.Hour), "past": now.Add(-time.Hour)})

	for uid, want := range map[string]bool{current: true, expired: false, refunded: false, usedUp: true, oidHex(): false} {
		got, err := r.HasActivePass(context.Background(), uid)
		if err != nil || got != want {
			t.Fatalf("HasActivePass(%s) = %v, %v; want %v", uid, got, err, want)
		}
	}
	if _, err := r.HasActivePass(context.Background(), "not-an-id"); err == nil {
		t.Fatal("a malformed id should be an error")
	}
}

func seedLedger(t *testing.T, pg *database.PostgresDB) string {
	t.Helper()
	uid, wallet := oidHex(), oidHex()
	pgExec(t, pg, `INSERT INTO wallets (id, user_id, main_paise) VALUES (?, ?, 10050)`, wallet, uid)
	pgExec(t, pg, `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, target_balance, category, amount_paise, balance_after_paise, status, reference_id, description, created_at) VALUES
		(?, ?, ?, 'credit', 'main', 'topup', 19950, 19950, 'completed', 'r1', 'Top-up, via UPI', ?),
		(?, ?, ?, 'debit', 'main', 'pass_purchase', 9900, 10050, 'completed', 'r2', 'InstantPass', ?),
		(?, ?, ?, 'credit', 'main', 'topup', 5000, 10050, 'pending', 'r3', 'Abandoned', ?)`,
		oidHex(), wallet, uid, time.Now().Add(-3*time.Hour),
		oidHex(), wallet, uid, time.Now().Add(-2*time.Hour),
		oidHex(), wallet, uid, time.Now().Add(-time.Hour))
	return uid
}

func TestPGPlatformStatsCountsPostgres(t *testing.T) {
	r, pg := newPGUserRepo(t)
	seedLedger(t, pg)
	stats, err := r.GetPlatformStats(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	// Completed entries only: 199.50 + 99.00
	if stats["revenue"] != 298.5 || stats["disputes"] != int64(0) || stats["active_gigs"] != int64(0) {
		t.Fatalf("stats = %v", stats)
	}
}

func TestPGRevenueCSV(t *testing.T) {
	r, pg := newPGUserRepo(t)
	uid := seedLedger(t, pg)

	read := func(status string) [][]string {
		t.Helper()
		out, err := r.ExportRevenueCSV(context.Background(), status)
		if err != nil {
			t.Fatal(err)
		}
		rows, err := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(out), "\xEF\xBB\xBF"))).ReadAll()
		if err != nil {
			t.Fatal(err)
		}
		return rows
	}
	all := read("all")
	if len(all) != 4 || all[0][0] != "Transaction ID" {
		t.Fatalf("rows = %v", all)
	}
	// Newest first, exact rupees
	if all[1][9] != "r3" || all[3][9] != "r1" || all[3][6] != "199.50" || all[3][7] != "199.50" || all[2][6] != "99.00" || all[3][2] != uid {
		t.Fatalf("rows = %v", all)
	}
	if all[3][10] != "Top-up, via UPI" {
		t.Fatalf("description = %q", all[3][10])
	}
	if done := read("completed"); len(done) != 3 {
		t.Fatalf("completed rows = %d, want 2 + header", len(done))
	}
}

func TestPGGlobalSearchFindsLiveEventsOnly(t *testing.T) {
	r, pg := newPGUserRepo(t)
	live, gone := oidHex(), oidHex()
	pgExec(t, pg, `INSERT INTO events (id, title, organizer, location, category) VALUES
		(?, 'Pune Tech Fair', 'KM', 'Pune', NULL), (?, 'Pune Old Fair', 'KM', 'Pune', 'Career'),
		(?, '100% Hiring Day', 'KM', 'Mumbai', 'Career')`, live, gone, oidHex())
	pgExec(t, pg, `UPDATE events SET deleted_at = now() WHERE id = ?`, gone)

	res, err := r.GlobalSearch(context.Background(), "pune")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Events) != 1 || res.Events[0].ID != live || res.Events[0].Badge != "Event" {
		t.Fatalf("events = %+v", res.Events)
	}
	// % is matched literally, not as a wildcard
	res, _ = r.GlobalSearch(context.Background(), "0%")
	if len(res.Events) != 1 || res.Events[0].Title != "100% Hiring Day" {
		t.Fatalf("events = %+v", res.Events)
	}
	res, _ = r.GlobalSearch(context.Background(), "%")
	if len(res.Events) != 1 {
		t.Fatalf("a bare %% should only match titles containing it, got %+v", res.Events)
	}
}
