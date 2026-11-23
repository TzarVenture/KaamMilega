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
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run the pass and gig rules against real Postgres transactions, constraints and
// PostGIS, on a throwaway schema (see pgtest). They skip when no database is configured.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type stubUsers struct{ user.UserRepository }

func (stubUsers) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	return &user.User{Name: "Ramesh Kumar", Mobile: "9000000000"}, nil
}

type env struct {
	ctx      context.Context
	pg       *database.PostgresDB
	repo     InstantWorkRepository
	svc      *InstantWorkServiceImpl
	wallet   wallet.WalletService
	walletDB wallet.WalletRepository
	coupons  promo.Service
	fake     *paymenttest.Fake
}

func setup(t *testing.T) *env {
	t.Helper()
	pg := pgtest.New(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)

	// Users stay in MongoDB. Nothing here needs them (a dispute only looks up the name and email,
	// and carries on without them), so the wallet gets a client that never connects and gives up fast.
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}

	tx := database.NewPgTransactor(pg)
	repo := NewInstantWorkRepository(pg)
	fake := paymenttest.New()
	walletRepo := wallet.NewWalletRepository(pg, tx, mdb)
	walletSvc := wallet.NewWalletService(walletRepo, &config.Config{}, nil, nil, fake, tx)
	coupons := promo.NewService(promo.NewRepository(pg), tx, walletSvc, stubUsers{})
	svc := NewInstantWorkService(repo, stubUsers{}, walletSvc, &config.Config{}, nil, fake, tx, coupons).(*InstantWorkServiceImpl)
	return &env{ctx: ctx, pg: pg, repo: repo, svc: svc, wallet: walletSvc, walletDB: walletRepo, coupons: coupons, fake: fake}
}

func (e *env) exec(t *testing.T, sql string, args ...interface{}) {
	t.Helper()
	if err := e.pg.DB.Exec(sql, args...).Error; err != nil {
		t.Fatal(err)
	}
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
	pass, _, _, err := e.svc.PurchasePassWithWallet(e.ctx, userID, "")
	if err != nil {
		t.Fatal(err)
	}
	if credits != passQuota {
		if err := e.pg.DB.Exec(`UPDATE instant_passes SET quota_remaining = ? WHERE id = ?`, credits, pass.ID.Hex()).Error; err != nil {
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
		go func() { defer wg.Done(); _, _, _, _ = e.svc.PurchasePassWithWallet(e.ctx, buyer, "") }()
	}
	wg.Wait()

	var n int64
	e.pg.DB.Raw(`SELECT count(*) FROM instant_passes WHERE user_id = ?`, buyer.Hex()).Scan(&n)
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
	fresh, _, _, err := e.svc.PurchasePassWithWallet(e.ctx, buyer, "")
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
	if _, _, _, err := e.svc.PurchasePassWithWallet(e.ctx, buyer, ""); !errors.Is(err, ErrPassAlreadyActive) {
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
	// The pass points at its checkout, so the checkout has to exist
	e.exec(t, `INSERT INTO payment_orders (id, razorpay_order_id, razorpay_payment_id, user_id, purpose, amount_paise, status)
		VALUES (?, ?, ?, ?, 'instant_pass', ?, 'paid')`,
		primitive.NewObjectID().Hex(), order.RazorpayOrderID, order.RazorpayPaymentID, buyer.Hex(), PassPricePaise)
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

// A pass can be refunded only within 24 hours of buying it, and only if it paid for nothing:
// no gig credit spent and no chat the free allowance wouldn't cover (client answer Q5)
func TestPassRefundWindowAndChatUse(t *testing.T) {
	e := setup(t)
	fresh, late, chatted := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	freshPass := e.passWithCredits(t, fresh, passQuota)
	latePass := e.passWithCredits(t, late, passQuota)
	chattedPass := e.passWithCredits(t, chatted, passQuota)
	e.exec(t, `UPDATE instant_passes SET activated_at = now() - interval '25 hours' WHERE id = ?`, latePass.ID.Hex())
	e.exec(t, `UPDATE instant_passes SET benefit_used_at = now() WHERE id = ?`, chattedPass.ID.Hex())

	if _, err := e.repo.RefundUnusedPass(e.ctx, latePass.ID, true); !errors.Is(err, ErrPassRefundTooLate) {
		t.Fatalf("refunding a 25-hour-old pass: %v", err)
	}
	if _, err := e.repo.RefundUnusedPass(e.ctx, chattedPass.ID, true); !errors.Is(err, ErrPassUsed) {
		t.Fatalf("refunding a pass used for a chat: %v", err)
	}
	if _, err := e.repo.RefundUnusedPass(e.ctx, freshPass.ID, true); err != nil {
		t.Fatalf("refunding an unused pass bought just now: %v", err)
	}
	if e.credits(t, late) != passQuota || e.credits(t, chatted) != passQuota {
		t.Fatal("a refused refund ended the pass")
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
	e.exec(t, `UPDATE instant_passes SET activated_at = ?, expires_at = ? WHERE id = ?`, past.Add(-time.Hour), past, pass.ID.Hex())
	_ = e.repo.SyncWorkerPass(e.ctx, worker, passQuota, past)
	found, _ = e.svc.GetNearbyCandidatesForRecruiter(e.ctx, 72.87, 19.07, 5, "plumber")
	if len(found) != 0 {
		t.Fatalf("expired pass still on radar: %+v", found)
	}
}
