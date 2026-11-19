package wallet

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/payment/paymenttest"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run the ledger against real Postgres transactions (a throwaway schema built from the
// migrations, see pgtest) because that's what the money rules rely on. Users still live in MongoDB,
// so they also need WALLET_TEST_MONGO_URI; both are throwaway.
const testDatabase = "km_wallet_test"

type env struct {
	ctx      context.Context
	db       *database.MongodbDB
	pg       *database.PostgresDB
	repo     WalletRepository
	svc      *WalletServiceImpl
	tx       database.Transactor
	payments *paymenttest.Fake
}

func setup(t *testing.T) *env {
	t.Helper()
	uri := os.Getenv("WALLET_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("WALLET_TEST_MONGO_URI not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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

	for _, name := range []string{"users"} {
		_ = db.DB.Collection(name).Drop(ctx)
		if err := db.DB.CreateCollection(ctx, name); err != nil {
			t.Fatal(err)
		}
	}

	pg := pgtest.New(t)
	tx := database.NewPgTransactor(pg)
	repo := NewWalletRepository(pg, tx, db)
	fake := paymenttest.New()
	svc := NewWalletService(repo, &config.Config{}, nil, nil, fake, tx).(*WalletServiceImpl)

	return &env{ctx: ctx, db: db, pg: pg, repo: repo, svc: svc, tx: tx, payments: fake}
}

func credit(user primitive.ObjectID, balance TargetBalance, amount float64, ref string) RecordTransactionInput {
	return RecordTransactionInput{UserID: user, Type: TypeCredit, TargetBalance: balance, Category: CategoryTopup, Amount: amount, ReferenceID: ref, Description: "test"}
}

func debit(user primitive.ObjectID, balance TargetBalance, amount float64, ref string) RecordTransactionInput {
	return RecordTransactionInput{UserID: user, Type: TypeDebit, TargetBalance: balance, Category: CategoryEventTicket, Amount: amount, ReferenceID: ref, Description: "test"}
}

func (e *env) wallet(t *testing.T, user primitive.ObjectID) *Wallet {
	t.Helper()
	w, err := e.repo.GetOrCreateWallet(e.ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	return w
}

func (e *env) ledgerCount(t *testing.T, user primitive.ObjectID) int64 {
	t.Helper()
	var n int64
	err := e.pg.DB.Raw(`SELECT count(*) FROM wallet_transactions WHERE user_id = ?`, user.Hex()).Scan(&n).Error
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func (e *env) approveKYC(t *testing.T, user primitive.ObjectID) {
	t.Helper()
	_, err := e.db.DB.Collection("users").InsertOne(e.ctx, bson.M{
		"_id":                    user,
		"email":                  "expert@example.com",
		"name":                   "Test Expert",
		"expert_approval_status": "approved",
		"expert_kyc": bson.M{
			"payout_method":  "bank",
			"account_holder": "Test Expert",
			"account_number": "123456789012",
			"account_last4":  "9012",
			"ifsc":           "HDFC0001234",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestRepeatedReferenceChangesTheBalanceOnce(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	for i := 0; i < 3; i++ {
		if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 500, "replay-1")); err != nil {
			t.Fatal(err)
		}
	}
	if got := e.wallet(t, user).MainPaise; got != 50000 {
		t.Fatalf("balance = %d", got)
	}
	if got := e.ledgerCount(t, user); got != 1 {
		t.Fatalf("ledger rows = %d", got)
	}
}

func TestSameReferenceForDifferentMoneyIsRefused(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 500, "ref-1")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 900, "ref-1")); !errors.Is(err, ErrReferenceConflict) {
		t.Fatalf("err = %v", err)
	}
	if got := e.wallet(t, user).MainPaise; got != 50000 {
		t.Fatalf("balance = %d", got)
	}
}

func TestConcurrentDuplicatesPayOnce(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _ = e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 100, "race-1"))
		}()
	}
	wg.Wait()
	if got := e.wallet(t, user).MainPaise; got != 10000 {
		t.Fatalf("balance = %d", got)
	}
	if got := e.ledgerCount(t, user); got != 1 {
		t.Fatalf("ledger rows = %d", got)
	}
}

func TestConcurrentSpendingCannotOverdraw(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 100, "fund")); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	succeeded := 0
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, err := e.repo.RecordAtomicTransaction(e.ctx, debit(user, BalanceMain, 40, fmt.Sprintf("spend-%d", i)))
			if err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()

	w := e.wallet(t, user)
	if succeeded != 2 || w.MainPaise != 2000 {
		t.Fatalf("succeeded = %d, balance = %d", succeeded, w.MainPaise)
	}
}

func TestFailedTransactionLeavesNoTrace(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	boom := errors.New("the item could not be created")

	err := e.tx.Run(e.ctx, func(ctx context.Context) error {
		if _, _, err := e.repo.RecordAtomicTransaction(ctx, credit(user, BalanceMain, 500, "rollback-1")); err != nil {
			return err
		}
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	if got := e.wallet(t, user).MainPaise; got != 0 {
		t.Fatalf("balance = %d", got)
	}
	if got := e.ledgerCount(t, user); got != 0 {
		t.Fatalf("ledger rows = %d", got)
	}
}

func TestFrozenWalletCanReceiveButNotSpend(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 500, "f1")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.SetWalletStatus(e.ctx, user.Hex(), WalletFrozen); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, debit(user, BalanceMain, 10, "f2")); !errors.Is(err, ErrFrozen) {
		t.Fatalf("err = %v", err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 10, "f3")); err != nil {
		t.Fatalf("credit: %v", err)
	}
}

func TestTopupCreditsTheAmountOnTheOrderOnly(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	checkout, err := e.svc.CreateTopupOrder(e.ctx, user.Hex(), 250)
	if err != nil {
		t.Fatal(err)
	}
	input := VerifyTopupPaymentRequest{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_1", RazorpaySignature: "sig"}

	for i := 0; i < 2; i++ {
		summary, _, err := e.svc.VerifyTopupPayment(e.ctx, user.Hex(), input)
		if err != nil {
			t.Fatal(err)
		}
		if summary.MainBalance != 250 {
			t.Fatalf("attempt %d: balance = %v", i, summary.MainBalance)
		}
	}
}

func TestTopupLimits(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	cases := []struct {
		amount float64
		code   string
	}{
		{99, "WALLET_TOPUP_MIN"},
		{50001, "WALLET_TOPUP_MAX"},
		{100.555, "WALLET_AMOUNT_INVALID"},
	}
	for _, c := range cases {
		_, err := e.svc.CreateTopupOrder(e.ctx, user.Hex(), c.amount)
		if err == nil || !hasCode(err, c.code) {
			t.Errorf("amount %v: err = %v, want %s", c.amount, err, c.code)
		}
	}

	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 199950, "rich")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CreateTopupOrder(e.ctx, user.Hex(), 100); !hasCode(err, "WALLET_BALANCE_LIMIT") {
		t.Errorf("err = %v", err)
	}
}

func hasCode(err error, code string) bool {
	return apperr.CodeOf(err) == code
}

func TestWithdrawalRequiresApprovedKYC(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceEarnings, 1000, "earn")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.RequestWithdrawal(e.ctx, user.Hex(), WithdrawalRequest{Amount: 500}); !errors.Is(err, ErrKYCRequired) {
		t.Fatalf("err = %v", err)
	}
}

func TestWithdrawalLifecyclePaid(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.approveKYC(t, user)
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceEarnings, 1000, "earn")); err != nil {
		t.Fatal(err)
	}

	res, err := e.svc.RequestWithdrawal(e.ctx, user.Hex(), WithdrawalRequest{Amount: 400})
	if err != nil {
		t.Fatal(err)
	}
	if res.Wallet.EarningsBalance != 600 || res.Withdrawal.Status != WithdrawalRequested {
		t.Fatalf("response = %+v", res)
	}

	row, _ := e.repo.GetTransactionByReference(e.ctx, res.Withdrawal.ReferenceID)
	if row.Status != StatusPending {
		t.Fatalf("ledger status = %s", row.Status)
	}
	if _, found := row.Metadata["account_number"]; found {
		t.Fatal("the ledger must not hold the account number")
	}

	id := res.Withdrawal.ID.Hex()
	if _, err := e.svc.UpdateWithdrawal(e.ctx, id, "admin", UpdateWithdrawalRequest{Status: WithdrawalPaid}); !hasCode(err, "WITHDRAWAL_REFERENCE_REQUIRED") {
		t.Fatalf("err = %v", err)
	}
	if _, err := e.svc.UpdateWithdrawal(e.ctx, id, "admin", UpdateWithdrawalRequest{Status: WithdrawalProcessing}); err != nil {
		t.Fatal(err)
	}
	revealed, err := e.svc.RevealWithdrawalAccount(e.ctx, id, "admin")
	if err != nil || revealed.AccountNumber != "123456789012" {
		t.Fatalf("revealed = %+v, err = %v", revealed, err)
	}
	paid, err := e.svc.UpdateWithdrawal(e.ctx, id, "admin", UpdateWithdrawalRequest{Status: WithdrawalPaid, BankReference: "UTR123"})
	if err != nil || paid.Status != WithdrawalPaid || paid.BankReference != "UTR123" {
		t.Fatalf("paid = %+v, err = %v", paid, err)
	}
	row, _ = e.repo.GetTransactionByReference(e.ctx, res.Withdrawal.ReferenceID)
	if row.Status != StatusCompleted {
		t.Fatalf("ledger status = %s", row.Status)
	}

	if _, err := e.svc.UpdateWithdrawal(e.ctx, id, "admin", UpdateWithdrawalRequest{Status: WithdrawalFailed, FailureReason: "late"}); !errors.Is(err, ErrWithdrawalState) {
		t.Fatalf("err = %v", err)
	}
	if got := e.wallet(t, user).EarningsPaise; got != 60000 {
		t.Fatalf("earnings = %d", got)
	}
}

func TestFailedWithdrawalReturnsTheMoneyOnce(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.approveKYC(t, user)
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceEarnings, 1000, "earn")); err != nil {
		t.Fatal(err)
	}
	res, err := e.svc.RequestWithdrawal(e.ctx, user.Hex(), WithdrawalRequest{Amount: 400})
	if err != nil {
		t.Fatal(err)
	}

	id := res.Withdrawal.ID.Hex()
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = e.svc.UpdateWithdrawal(e.ctx, id, "admin", UpdateWithdrawalRequest{Status: WithdrawalFailed, FailureReason: "bad account"})
		}()
	}
	wg.Wait()

	if got := e.wallet(t, user).EarningsPaise; got != 100000 {
		t.Fatalf("earnings = %d", got)
	}
	overview, err := e.svc.GetFinanceOverview(e.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if overview.MismatchesTotal != 0 {
		t.Fatalf("mismatches = %+v", overview.Mismatches)
	}
}

func TestDoubleClickCreatesOneWithdrawal(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.approveKYC(t, user)
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceEarnings, 5000, "earn")); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = e.svc.RequestWithdrawal(e.ctx, user.Hex(), WithdrawalRequest{Amount: 500})
		}()
	}
	wg.Wait()

	if got := e.wallet(t, user).EarningsPaise; got != 450000 {
		t.Fatalf("earnings = %d", got)
	}
	var n int64
	_ = e.pg.DB.Raw(`SELECT count(*) FROM wallet_withdrawals WHERE user_id = ?`, user.Hex()).Scan(&n).Error
	if n != 1 {
		t.Fatalf("withdrawals = %d", n)
	}
}

func TestWithdrawalDailyLimit(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.approveKYC(t, user)
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceEarnings, 60000, "earn")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.RequestWithdrawal(e.ctx, user.Hex(), WithdrawalRequest{Amount: 25001}); !hasCode(err, "WITHDRAWAL_DAILY_LIMIT") {
		t.Fatalf("err = %v", err)
	}
}

func TestChangedBankDetailsBlockReveal(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.approveKYC(t, user)
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceEarnings, 1000, "earn")); err != nil {
		t.Fatal(err)
	}
	res, err := e.svc.RequestWithdrawal(e.ctx, user.Hex(), WithdrawalRequest{Amount: 400})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.DB.Collection("users").UpdateByID(e.ctx, user, bson.M{"$set": bson.M{"expert_kyc.account_last4": "1111"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.RevealWithdrawalAccount(e.ctx, res.Withdrawal.ID.Hex(), "admin"); !errors.Is(err, ErrPayoutChanged) {
		t.Fatalf("err = %v", err)
	}
}

func (e *env) purchase(t *testing.T, user primitive.ObjectID) *WalletTransaction {
	t.Helper()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 1000, "fund-"+user.Hex())); err != nil {
		t.Fatal(err)
	}
	row, _, err := e.repo.RecordAtomicTransaction(e.ctx, debit(user, BalanceMain, 300, "buy-"+user.Hex()))
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func TestDisputeRefundIsCappedAndPaidOnce(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	row := e.purchase(t, user)

	dispute, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: row.ID.Hex(), Reason: DisputeReasonOther, Description: "no show"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: row.ID.Hex(), Reason: DisputeReasonOther, Description: "again"}); !errors.Is(err, ErrDisputeExists) {
		t.Fatalf("second dispute: %v", err)
	}

	tooMuch := 301.0
	if _, _, err := e.svc.ResolveDispute(e.ctx, dispute.ID.Hex(), "admin", ResolveDisputeRequest{Action: "approve", RefundAmount: &tooMuch}); !errors.Is(err, ErrRefundTooLarge) {
		t.Fatalf("err = %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _ = e.svc.ResolveDispute(e.ctx, dispute.ID.Hex(), "admin", ResolveDisputeRequest{Action: "approve"})
		}()
	}
	wg.Wait()

	if got := e.wallet(t, user).MainPaise; got != 100000 {
		t.Fatalf("balance = %d", got)
	}
	resolved, _ := e.repo.GetDisputeByID(e.ctx, dispute.ID)
	if resolved.Status != DisputeStatusApproved || resolved.RefundTransactionID == nil {
		t.Fatalf("dispute = %+v", resolved)
	}
}

func TestUnderReviewKeepsTheDisputeOpen(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	row := e.purchase(t, user)
	dispute, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: row.ID.Hex(), Reason: DisputeReasonOther, Description: "no show"})
	if err != nil {
		t.Fatal(err)
	}

	updated, _, err := e.svc.ResolveDispute(e.ctx, dispute.ID.Hex(), "admin", ResolveDisputeRequest{Action: "under_review"})
	if err != nil || updated.Status != DisputeStatusUnderReview || updated.ResolvedAt != nil {
		t.Fatalf("updated = %+v, err = %v", updated, err)
	}
	if _, _, err := e.svc.ResolveDispute(e.ctx, dispute.ID.Hex(), "admin", ResolveDisputeRequest{Action: "reject"}); err != nil {
		t.Fatalf("reject after review: %v", err)
	}
	if got := e.wallet(t, user).MainPaise; got != 70000 {
		t.Fatalf("balance = %d", got)
	}
}

func TestOnlyWalletPurchasesCanBeDisputed(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	refused := []RecordTransactionInput{
		credit(user, BalanceMain, 1000, "a-credit"),
		{UserID: user, Type: TypeDebit, TargetBalance: BalanceMain, Category: CategorySessionBooking, Amount: 100, ReferenceID: "a-session", Description: "t"},
		{UserID: user, Type: TypeDebit, TargetBalance: BalanceMain, Category: CategoryWithdrawal, Amount: 100, ReferenceID: "a-withdraw", Description: "t"},
	}
	for _, input := range refused {
		row, _, err := e.repo.RecordAtomicTransaction(e.ctx, input)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: row.ID.Hex(), Reason: DisputeReasonOther, Description: "x"}); !errors.Is(err, ErrDisputeNotEligible) {
			t.Errorf("%s: err = %v", input.ReferenceID, err)
		}
	}
}

func TestSomeoneElsesTransactionCanNotBeDisputed(t *testing.T) {
	e := setup(t)
	row := e.purchase(t, primitive.NewObjectID())
	if _, err := e.svc.CreateDispute(e.ctx, primitive.NewObjectID().Hex(), CreateDisputeRequest{TransactionID: row.ID.Hex(), Reason: DisputeReasonOther, Description: "x"}); !errors.Is(err, ErrDisputeNotEligible) {
		t.Fatalf("err = %v", err)
	}
}

func TestOldPurchasesCanNotBeDisputed(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	row := e.purchase(t, user)
	if err := e.pg.DB.Exec(`UPDATE wallet_transactions SET created_at = ? WHERE id = ?`, time.Now().Add(-31*24*time.Hour), row.ID.Hex()).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: row.ID.Hex(), Reason: DisputeReasonOther, Description: "x"}); !errors.Is(err, ErrDisputeExpired) {
		t.Fatalf("err = %v", err)
	}
}

// The ₹99 pass can only be disputed in its first 24 hours; other purchases have 30 days (client answer Q5)
func TestPassDisputesCloseAfter24Hours(t *testing.T) {
	now := time.Now()
	row := func(category TransactionCategory, age time.Duration) *WalletTransaction {
		return &WalletTransaction{Type: TypeDebit, TargetBalance: BalanceMain, Category: category, CreatedAt: now.Add(-age)}
	}
	cases := []struct {
		tx   *WalletTransaction
		want error
	}{
		{row(CategoryPassPurchase, 23*time.Hour), nil},
		{row(CategoryPassPurchase, 25*time.Hour), ErrDisputeExpired},
		{row(CategoryEventTicket, 25*time.Hour), nil},
	}
	for _, c := range cases {
		if err := disputeRefusal(c.tx, now); err != c.want {
			t.Errorf("%s, %v old: err = %v, want %v", c.tx.Category, now.Sub(c.tx.CreatedAt), err, c.want)
		}
	}
}

func TestFinanceOverviewFlagsABalanceChangedOutsideTheLedger(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	e.purchase(t, user)

	overview, err := e.svc.GetFinanceOverview(e.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if overview.MismatchesTotal != 0 || overview.MainBalance != 700 {
		t.Fatalf("overview = %+v", overview)
	}

	if err := e.pg.DB.Exec(`UPDATE wallets SET main_paise = main_paise + 100 WHERE user_id = ?`, user.Hex()).Error; err != nil {
		t.Fatal(err)
	}
	overview, err = e.svc.GetFinanceOverview(e.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if overview.MismatchesTotal != 1 || overview.Mismatches[0].Computed != 700 || overview.Mismatches[0].Stored != 701 {
		t.Fatalf("overview = %+v", overview)
	}
}

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }
