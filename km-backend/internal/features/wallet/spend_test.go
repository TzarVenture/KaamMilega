package wallet

import (
	"errors"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestSpendSplit(t *testing.T) {
	cases := []struct {
		price, bonus, main  int64
		fromBonus, fromMain int64
		ok                  bool
	}{
		{99_00, 0, 100_00, 0, 99_00, true},
		{99_00, 30_00, 100_00, 30_00, 69_00, true},
		{99_00, 200_00, 0, 99_00, 0, true},
		{99_00, 30_00, 60_00, 30_00, 69_00, false},
		{0, 0, 0, 0, 0, true},
	}
	for _, c := range cases {
		b, m, ok := SpendSplit(c.price, c.bonus, c.main)
		if b != c.fromBonus || m != c.fromMain || ok != c.ok {
			t.Errorf("SpendSplit(%d, %d, %d) = %d, %d, %v", c.price, c.bonus, c.main, b, m, ok)
		}
	}
}

func (e *env) spend(t *testing.T, user primitive.ObjectID, paise int64, ref string) (*SpendResult, error) {
	t.Helper()
	return e.svc.Spend(e.ctx, SpendInput{UserID: user, Category: CategoryPassPurchase, AmountPaise: paise, ReferenceID: ref, Description: "InstantPass"})
}

func (e *env) balancesOf(t *testing.T, user primitive.ObjectID) (mainPaise, bonusPaise int64) {
	t.Helper()
	w, err := e.repo.GetOrCreateWallet(e.ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	return w.MainPaise, w.BonusPaise
}

func TestSpendUsesBonusFirstAndRepeatsFree(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceBonus, 30, "b")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 100, "m")); err != nil {
		t.Fatal(err)
	}

	res, err := e.spend(t, user, 99_00, "pass:1:pay")
	if err != nil {
		t.Fatal(err)
	}
	if res.BonusPaise != 30_00 || res.MainPaise != 69_00 || res.Purchase.TargetBalance != BalanceMain || res.Purchase.AmountPaise != 69_00 {
		t.Fatalf("result %+v purchase %+v", res, res.Purchase)
	}
	if m, b := e.balancesOf(t, user); m != 31_00 || b != 0 {
		t.Fatalf("balances main %d bonus %d", m, b)
	}

	// More bonus arrives, then the same purchase is retried: nothing more is charged and the
	// answer is what was charged the first time
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceBonus, 500, "b2")); err != nil {
		t.Fatal(err)
	}
	again, err := e.spend(t, user, 99_00, "pass:1:pay")
	if err != nil {
		t.Fatal(err)
	}
	if again.BonusPaise != 30_00 || again.MainPaise != 69_00 || again.Purchase.ID != res.Purchase.ID {
		t.Fatalf("replay %+v", again)
	}
	if m, b := e.balancesOf(t, user); m != 31_00 || b != 500_00 {
		t.Fatalf("balances after replay main %d bonus %d", m, b)
	}
	// The same reference for a different amount is refused
	if _, err := e.spend(t, user, 50_00, "pass:1:pay"); !errors.Is(err, ErrReferenceConflict) {
		t.Fatalf("conflicting replay: %v", err)
	}
}

func TestSpendRefusesWhenShortAndPostsNothing(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceBonus, 20, "b")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 20, "m")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.spend(t, user, 99_00, "pass:short:pay"); !errors.Is(err, ErrInsufficient) {
		t.Fatalf("short wallet: %v", err)
	}
	if m, b := e.balancesOf(t, user); m != 20_00 || b != 20_00 {
		t.Fatalf("balances changed: main %d bonus %d", m, b)
	}
	if row, _ := e.repo.GetTransactionByReference(e.ctx, "pass:short:pay:bonus"); row != nil {
		t.Fatal("the bonus half was posted for a refused purchase")
	}

	free, err := e.spend(t, user, 0, "pass:free:pay")
	if err != nil || free.Purchase != nil || free.BonusPaise != 0 || free.MainPaise != 0 {
		t.Fatalf("free purchase: %+v %v", free, err)
	}
}

func TestFullDisputeRefundReturnsBonusHalf(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceBonus, 30, "b")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 100, "m")); err != nil {
		t.Fatal(err)
	}
	res, err := e.spend(t, user, 99_00, "pass:split:pay")
	if err != nil {
		t.Fatal(err)
	}

	// Only the purchase row can be disputed, not its bonus half
	half, _ := e.repo.GetTransactionByReference(e.ctx, "pass:split:pay:bonus")
	if _, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: half.ID.Hex(), Reason: DisputeReasonOther, Description: "x"}); !errors.Is(err, ErrDisputeNotEligible) {
		t.Fatalf("dispute on the bonus half: %v", err)
	}
	dispute, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: res.Purchase.ID.Hex(), Reason: DisputeReasonOther, Description: "never worked"})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.ResolveDispute(e.ctx, dispute.ID.Hex(), primitive.NewObjectID().Hex(), ResolveDisputeRequest{Action: "approve"}); err != nil {
		t.Fatal(err)
	}
	if m, b := e.balancesOf(t, user); m != 100_00 || b != 30_00 {
		t.Fatalf("after full refund main %d bonus %d, want 10000 and 3000", m, b)
	}
}

func TestPartialRefundKeepsBonusAndBonusOnlyRefundsToBonus(t *testing.T) {
	e := setup(t)
	user := primitive.NewObjectID()
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceBonus, 130, "b")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.repo.RecordAtomicTransaction(e.ctx, credit(user, BalanceMain, 100, "m")); err != nil {
		t.Fatal(err)
	}
	// Paid wholly with bonus credit: the purchase row is on bonus and refunds go back there
	res, err := e.spend(t, user, 99_00, "pass:bonus:pay")
	if err != nil {
		t.Fatal(err)
	}
	if res.Purchase.TargetBalance != BalanceBonus || res.MainPaise != 0 {
		t.Fatalf("bonus-only purchase %+v", res)
	}
	dispute, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: res.Purchase.ID.Hex(), Reason: DisputeReasonOther, Description: "x"})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.ResolveDispute(e.ctx, dispute.ID.Hex(), primitive.NewObjectID().Hex(), ResolveDisputeRequest{Action: "approve"}); err != nil {
		t.Fatal(err)
	}
	if m, b := e.balancesOf(t, user); m != 100_00 || b != 130_00 {
		t.Fatalf("after bonus refund main %d bonus %d", m, b)
	}

	// A split purchase refunded in part: only main money comes back, the bonus half stays spent
	split, err := e.spend(t, user, 199_00, "pass:split2:pay")
	if err != nil {
		t.Fatal(err)
	}
	d2, err := e.svc.CreateDispute(e.ctx, user.Hex(), CreateDisputeRequest{TransactionID: split.Purchase.ID.Hex(), Reason: DisputeReasonOther, Description: "x"})
	if err != nil {
		t.Fatal(err)
	}
	ten := 10.0
	if _, _, err := e.svc.ResolveDispute(e.ctx, d2.ID.Hex(), primitive.NewObjectID().Hex(), ResolveDisputeRequest{Action: "approve", RefundAmount: &ten}); err != nil {
		t.Fatal(err)
	}
	if m, b := e.balancesOf(t, user); m != 31_00+10_00 || b != 0 {
		t.Fatalf("after partial refund main %d bonus %d", m, b)
	}
}
