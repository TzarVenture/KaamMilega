package chat

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

// The chat unlock reads InstantPasses from Postgres (throwaway schema, see pgtest)

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

func TestPGActivePassUnlocksChatEvenWithNoCreditsLeft(t *testing.T) {
	pg := pgtest.New(t)
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	r := NewRepository(&database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}, pg)

	now := time.Now()
	withCredits, usedUp, expired := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	if err := pg.DB.Exec(`INSERT INTO instant_passes (id, user_id, quota_total, quota_remaining, price_paise, activated_at, expires_at) VALUES
		(?, ?, 10, 7, 9900, @a, @e), (?, ?, 10, 0, 9900, @a, @e), (?, ?, 10, 7, 9900, @a, @past)`,
		primitive.NewObjectID().Hex(), withCredits.Hex(), primitive.NewObjectID().Hex(), usedUp.Hex(), primitive.NewObjectID().Hex(), expired.Hex(),
		map[string]interface{}{"a": now.Add(-48 * time.Hour), "e": now.Add(24 * time.Hour), "past": now.Add(-time.Hour)}).Error; err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		user    primitive.ObjectID
		active  bool
		credits int
	}{{withCredits, true, 7}, {usedUp, true, 0}, {expired, false, 0}, {primitive.NewObjectID(), false, 0}}
	for _, c := range cases {
		active, credits, err := r.ActivePass(context.Background(), c.user)
		if err != nil || active != c.active || credits != c.credits {
			t.Fatalf("ActivePass = %v, %d, %v; want %v, %d", active, credits, err, c.active, c.credits)
		}
	}
}

func TestPGMarkPassBenefitUsedStampsOnlyTheCurrentPass(t *testing.T) {
	pg := pgtest.New(t)
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	r := NewRepository(&database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}, pg)

	now := time.Now()
	holder := primitive.NewObjectID()
	current, old := primitive.NewObjectID().Hex(), primitive.NewObjectID().Hex()
	// Only one pass per user can be current, so the old one has already been closed
	if err := pg.DB.Exec(`INSERT INTO instant_passes (id, user_id, has_active_pass, quota_total, quota_remaining, price_paise, activated_at, expires_at) VALUES
		(?, ?, true, 10, 10, 9900, @a, @e), (?, ?, false, 10, 10, 9900, @a, @past)`,
		current, holder.Hex(), old, holder.Hex(),
		map[string]interface{}{"a": now.Add(-time.Hour), "e": now.Add(24 * time.Hour), "past": now.Add(-time.Minute)}).Error; err != nil {
		t.Fatal(err)
	}

	stampOf := func(id string) *time.Time {
		var at *time.Time
		if err := pg.DB.Raw(`SELECT benefit_used_at FROM instant_passes WHERE id = ?`, id).Row().Scan(&at); err != nil {
			t.Fatal(err)
		}
		return at
	}
	if err := r.MarkPassBenefitUsed(context.Background(), holder); err != nil {
		t.Fatal(err)
	}
	first := stampOf(current)
	if first == nil || stampOf(old) != nil {
		t.Fatalf("current pass stamped = %v, expired pass stamped = %v; want only the current one", first, stampOf(old))
	}
	// A second chat keeps the first time
	if err := r.MarkPassBenefitUsed(context.Background(), holder); err != nil {
		t.Fatal(err)
	}
	if again := stampOf(current); again == nil || !again.Equal(*first) {
		t.Fatalf("stamp moved from %v to %v", first, again)
	}
}
