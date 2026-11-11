package instant_work

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run the pass and gig rules against real MongoDB transactions and indexes. They
// only run when WALLET_TEST_MONGO_URI is set, and use a throwaway database.
const testDatabase = "km_instant_test"

type stubUsers struct{ user.UserRepository }

func (stubUsers) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	return &user.User{Name: "Ramesh Kumar", Mobile: "9000000000"}, nil
}

type env struct {
	ctx      context.Context
	db       *database.MongodbDB
	repo     InstantWorkRepository
	svc      *InstantWorkServiceImpl
	wallet   wallet.WalletService
	walletDB wallet.WalletRepository
}

func setup(t *testing.T) *env {
	t.Helper()
	uri := os.Getenv("WALLET_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("WALLET_TEST_MONGO_URI not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	db := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database(testDatabase)}
	t.Cleanup(func() {
		_ = db.DB.Drop(context.Background())
		_ = client.Disconnect(context.Background())
	})
	_ = db.DB.Drop(ctx)
	for _, name := range []string{"instant_workers", "instant_passes", "instant_jobs", "wallets", "wallet_transactions", "wallet_disputes"} {
		if err := db.DB.CreateCollection(ctx, name); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.DB.Collection("wallets").Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "user_id", Value: 1}}, Options: options.Index().SetUnique(true)}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.DB.Collection("wallet_transactions").Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "reference_id", Value: 1}}, Options: options.Index().SetUnique(true)}); err != nil {
		t.Fatal(err)
	}

	tx := database.NewTransactor(db)
	repo := NewInstantWorkRepository(db)
	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
	fake := paymenttest.New()
	walletRepo := wallet.NewWalletRepository(db)
	walletSvc := wallet.NewWalletService(walletRepo, &config.Config{}, nil, nil, fake, tx)
	svc := NewInstantWorkService(repo, stubUsers{}, walletSvc, &config.Config{}, nil, fake, tx).(*InstantWorkServiceImpl)
	time.Sleep(500 * time.Millisecond) // let background index setup finish
	return &env{ctx: ctx, db: db, repo: repo, svc: svc, wallet: walletSvc, walletDB: walletRepo}
}

func (e *env) fund(t *testing.T, userID primitive.ObjectID, rupees float64) {
	t.Helper()
	_, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: userID, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceMain, Category: wallet.CategoryTopup,
		Amount: rupees, ReferenceID: "fund:" + primitive.NewObjectID().Hex(), Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func (e *env) passWithCredits(t *testing.T, userID primitive.ObjectID, credits int) *InstantPass {
	t.Helper()
	e.fund(t, userID, 99)
	pass, _, err := e.svc.PurchasePassWithWallet(e.ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if credits != passQuota {
		if _, err := e.db.DB.Collection("instant_passes").UpdateByID(e.ctx, pass.ID, bson.M{"$set": bson.M{"quota_remaining": credits}}); err != nil {
			t.Fatal(err)
		}
	}
	return pass
}

func (e *env) openJob(t *testing.T) *InstantJob {
	t.Helper()
	job, err := e.svc.CreateSpotJob(e.ctx, primitive.NewObjectID(), CreateInstantJobRequest{
		Skill: "plumber", Lat: 19.07, Lng: 72.87, Address: "Andheri East", PayRate: 500, RateType: "flat",
	})
	if err != nil {
		t.Fatal(err)
	}
	return job
}

func (e *env) credits(t *testing.T, userID primitive.ObjectID) int {
	t.Helper()
	pass, err := e.repo.GetActivePassByUserID(e.ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if pass == nil {
		return -1
	}
	return pass.QuotaRemaining
}

// claimAll claims each job at the same moment and returns how many claims won
func (e *env) claimAll(worker primitive.ObjectID, jobs ...*InstantJob) (int, []error) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	won := 0
	var errs []error
	for _, j := range jobs {
		wg.Add(1)
		go func(id primitive.ObjectID) {
			defer wg.Done()
			_, err := e.svc.ClaimSpotGig(e.ctx, worker, id)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				won++
			} else {
				errs = append(errs, err)
			}
		}(j.ID)
	}
	wg.Wait()
	return won, errs
}

func TestOneCreditCannotWinTwoGigs(t *testing.T) {
	e := setup(t)
	worker := primitive.NewObjectID()
	e.passWithCredits(t, worker, 1)

	won, errs := e.claimAll(worker, e.openJob(t), e.openJob(t))
	if won != 1 {
		t.Fatalf("won %d gigs with one credit, errors %v", won, errs)
	}
	if c := e.credits(t, worker); c != 0 {
		t.Fatalf("credits left %d, want 0", c)
	}
}

func TestWorkerHoldsOneGigAtATime(t *testing.T) {
	e := setup(t)
	worker := primitive.NewObjectID()
	e.passWithCredits(t, worker, passQuota)

	won, errs := e.claimAll(worker, e.openJob(t), e.openJob(t), e.openJob(t))
	if won != 1 {
		t.Fatalf("won %d gigs at once, errors %v", won, errs)
	}
	if c := e.credits(t, worker); c != passQuota-1 {
		t.Fatalf("credits left %d, want %d", c, passQuota-1)
	}
}

func TestFailedClaimKeepsCredit(t *testing.T) {
	e := setup(t)
	worker, rival := primitive.NewObjectID(), primitive.NewObjectID()
	e.passWithCredits(t, worker, 3)
	e.passWithCredits(t, rival, 3)
	job := e.openJob(t)

	if _, err := e.svc.ClaimSpotGig(e.ctx, rival, job.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.ClaimSpotGig(e.ctx, worker, job.ID); !errors.Is(err, ErrGigUnavailable) {
		t.Fatalf("claiming a taken gig: %v", err)
	}
	if c := e.credits(t, worker); c != 3 {
		t.Fatalf("failed claim spent a credit: %d left", c)
	}
}

func TestOnlyOnePassAtOnce(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.fund(t, buyer, 500)

	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, _, _ = e.svc.PurchasePassWithWallet(e.ctx, buyer) }()
	}
	wg.Wait()

	n, _ := e.db.DB.Collection("instant_passes").CountDocuments(e.ctx, bson.M{"user_id": buyer})
	if n != 1 {
		t.Fatalf("%d passes created, want 1", n)
	}
	summary, err := e.wallet.GetWalletSummary(e.ctx, buyer.Hex())
	if err != nil {
		t.Fatal(err)
	}
	if summary.MainBalance != 401 {
		t.Fatalf("balance %.2f, want 401 (charged once)", summary.MainBalance)
	}
}

func TestUsedUpPassStillUnlocksAndCanBeReplaced(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	old := e.passWithCredits(t, buyer, 0)

	if c := e.credits(t, buyer); c != 0 {
		t.Fatalf("a used-up pass should still be current until it expires, got credits %d", c)
	}
	if _, err := e.svc.ToggleAvailability(e.ctx, buyer, ToggleAvailabilityRequest{IsFreeNow: true, Skill: "plumber", Lat: 19.07, Lng: 72.87}); !errors.Is(err, ErrPassQuotaExhausted) {
		t.Fatalf("going free with no credits: %v", err)
	}

	e.fund(t, buyer, 99)
	fresh, _, err := e.svc.PurchasePassWithWallet(e.ctx, buyer)
	if err != nil {
		t.Fatalf("buying again after credits ran out: %v", err)
	}
	if c := e.credits(t, buyer); c != passQuota {
		t.Fatalf("new pass credits %d", c)
	}
	retired, _ := e.repo.GetPassByID(e.ctx, old.ID)
	if retired.HasActivePass || retired.EndedReason != "replaced" || fresh.ID == old.ID {
		t.Fatalf("old pass not replaced: %+v", retired)
	}

	// With credits left, another purchase is refused
	e.fund(t, buyer, 99)
	if _, _, err := e.svc.PurchasePassWithWallet(e.ctx, buyer); !errors.Is(err, ErrPassAlreadyActive) {
		t.Fatalf("second purchase with credits left: %v", err)
	}
}

func TestDisputeRefundTakesBackUnusedPassOnly(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.passWithCredits(t, buyer, passQuota)

	purchase := func() string {
		list, err := e.wallet.GetTransactions(e.ctx, buyer.Hex(), wallet.TransactionQuery{Category: wallet.CategoryPassPurchase})
		if err != nil || len(list.Transactions) == 0 {
			t.Fatalf("pass purchase not in ledger: %v", err)
		}
		return list.Transactions[0].ID
	}
	dispute, err := e.wallet.CreateDispute(e.ctx, buyer.Hex(), wallet.CreateDisputeRequest{
		TransactionID: purchase(), Reason: wallet.DisputeReasonTechnicalFailure, Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.wallet.ResolveDispute(e.ctx, dispute.ID.Hex(), primitive.NewObjectID().Hex(), wallet.ResolveDisputeRequest{Action: "approve"}); err != nil {
		t.Fatalf("refunding an unused pass: %v", err)
	}
	if c := e.credits(t, buyer); c != -1 {
		t.Fatalf("refunded pass is still current with %d credits", c)
	}

	// A pass with a credit spent can't be refunded in full
	other := primitive.NewObjectID()
	e.passWithCredits(t, other, passQuota)
	if _, err := e.svc.ClaimSpotGig(e.ctx, other, e.openJob(t).ID); err != nil {
		t.Fatal(err)
	}
	list, _ := e.wallet.GetTransactions(e.ctx, other.Hex(), wallet.TransactionQuery{Category: wallet.CategoryPassPurchase})
	d2, err := e.wallet.CreateDispute(e.ctx, other.Hex(), wallet.CreateDisputeRequest{
		TransactionID: list.Transactions[0].ID, Reason: wallet.DisputeReasonTechnicalFailure, Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.wallet.ResolveDispute(e.ctx, d2.ID.Hex(), primitive.NewObjectID().Hex(), wallet.ResolveDisputeRequest{Action: "approve"}); !errors.Is(err, ErrPassUsed) {
		t.Fatalf("refunding a used pass: %v", err)
	}
	summary, _ := e.wallet.GetWalletSummary(e.ctx, other.Hex())
	if summary.MainBalance != 0 {
		t.Fatalf("refused refund still credited ₹%.2f", summary.MainBalance)
	}
}

func TestOnlinePassRefundNeedsUnusedPass(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	order := &payment.Order{UserID: buyer, RazorpayOrderID: "order_test_" + buyer.Hex(), RazorpayPaymentID: "pay_test"}
	if err := e.svc.tx.Run(e.ctx, func(ctx context.Context) error { return e.svc.fulfillPass(ctx, order) }); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.ClaimSpotGig(e.ctx, buyer, e.openJob(t).ID); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.revokePass(e.ctx, order); !errors.Is(err, ErrPassUsed) {
		t.Fatalf("refunding a used online pass: %v", err)
	}
}

func TestJobLifecycle(t *testing.T) {
	e := setup(t)
	worker := primitive.NewObjectID()
	e.passWithCredits(t, worker, passQuota)
	job := e.openJob(t)

	if _, err := e.svc.CompleteSpotJob(e.ctx, worker, job.ID); !errors.Is(err, ErrUnauthorizedJob) {
		t.Fatalf("completing an unclaimed job: %v", err)
	}
	if _, err := e.svc.ClaimSpotGig(e.ctx, worker, job.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CancelSpotJob(e.ctx, job.RecruiterID, job.ID); !errors.Is(err, ErrJobWrongState) {
		t.Fatalf("cancelling an accepted job: %v", err)
	}
	if _, err := e.svc.CloseSpotJob(e.ctx, job.RecruiterID, job.ID); !errors.Is(err, ErrJobNotCompleted) {
		t.Fatalf("closing before completion: %v", err)
	}
	if _, err := e.svc.CompleteSpotJob(e.ctx, worker, job.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CloseSpotJob(e.ctx, job.RecruiterID, job.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CompleteSpotJob(e.ctx, worker, job.ID); !errors.Is(err, ErrJobWrongState) {
		t.Fatalf("reopening a closed job: %v", err)
	}
	w, _ := e.repo.GetWorkerByUserID(e.ctx, worker)
	if w == nil || w.TotalGigs != 1 || w.Rating != 0 || w.IsFreeNow {
		t.Fatalf("worker after one gig: %+v", w)
	}

	// A new job can be cancelled while it waits, and the hirer can then post again
	next, err := e.svc.CreateSpotJob(e.ctx, job.RecruiterID, CreateInstantJobRequest{Skill: "plumber", Lat: 19.07, Lng: 72.87, Address: "Andheri East", PayRate: 400})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CreateSpotJob(e.ctx, job.RecruiterID, CreateInstantJobRequest{Skill: "plumber", Lat: 19.07, Lng: 72.87, Address: "Andheri East", PayRate: 400}); !errors.Is(err, ErrOpenJobExists) {
		t.Fatalf("second open job: %v", err)
	}
	if _, err := e.svc.CancelSpotJob(e.ctx, next.RecruiterID, next.ID); err != nil {
		t.Fatal(err)
	}
}

func TestRadarSkipsExpiredPassesAndShortensNames(t *testing.T) {
	e := setup(t)
	worker := primitive.NewObjectID()
	pass := e.passWithCredits(t, worker, passQuota)
	if _, err := e.svc.ToggleAvailability(e.ctx, worker, ToggleAvailabilityRequest{IsFreeNow: true, Skill: "plumber", HourlyRate: 300, Lat: 19.07, Lng: 72.87}); err != nil {
		t.Fatal(err)
	}
	found, err := e.svc.GetNearbyCandidatesForRecruiter(e.ctx, 72.87, 19.07, 5, "plumber")
	if err != nil || len(found) != 1 || found[0].Name != "Ramesh K." || found[0].Rating != 0 {
		t.Fatalf("radar: %v %+v", err, found)
	}

	past := time.Now().Add(-time.Hour)
	_, _ = e.db.DB.Collection("instant_passes").UpdateByID(e.ctx, pass.ID, bson.M{"$set": bson.M{"expires_at": past}})
	_ = e.repo.SyncWorkerPass(e.ctx, worker, passQuota, past)
	found, _ = e.svc.GetNearbyCandidatesForRecruiter(e.ctx, 72.87, 19.07, 5, "plumber")
	if len(found) != 0 {
		t.Fatalf("expired pass still on radar: %+v", found)
	}
}
