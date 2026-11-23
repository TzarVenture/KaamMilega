package promo

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
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run coupons against real Postgres (a throwaway schema built from the migrations,
// see pgtest): the row lock on a coupon is what keeps its limits, so only a real database proves
// them. They skip when no database is configured.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type noUsers struct{ user.UserRepository }

func (noUsers) FindUsersByIDs(context.Context, []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	return map[primitive.ObjectID]*user.User{}, nil
}

type env struct {
	ctx    context.Context
	pg     *database.PostgresDB
	tx     database.Transactor
	svc    *service
	wallet wallet.WalletService
	fake   *paymenttest.Fake
	admin  string
}

func setup(t *testing.T) *env {
	t.Helper()
	pg := pgtest.New(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)

	// The wallet needs a Mongo handle it never uses here; this one never connects
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://127.0.0.1:1").SetServerSelectionTimeout(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}

	tx := database.NewPgTransactor(pg)
	fake := paymenttest.New()
	// Coupon holds point at their order, so orders have to exist in payment_orders
	fake.OnCreate = func(ctx context.Context, o *payment.Order) error {
		return pg.DB.WithContext(ctx).Exec(`INSERT INTO payment_orders (id, razorpay_order_id, user_id, purpose, amount_paise, status)
			VALUES (?, ?, ?, ?, ?, 'created')`, o.ID.Hex(), o.RazorpayOrderID, o.UserID.Hex(), string(o.Purpose), o.AmountPaise).Error
	}
	walletSvc := wallet.NewWalletService(wallet.NewWalletRepository(pg, tx, mdb), &config.Config{}, nil, nil, fake, tx)
	svc := newService(NewRepository(pg), tx, walletSvc, noUsers{})
	svc.RegisterPricer(payment.PurposeInstantPass, func(context.Context, string, string) (int64, error) { return 99_00, nil })
	return &env{ctx: ctx, pg: pg, tx: tx, svc: svc, wallet: walletSvc, fake: fake, admin: primitive.NewObjectID().Hex()}
}

func intp(n int) *int           { return &n }
func rs(v float64) *float64     { return &v }
func at(t time.Time) *time.Time { return &t }

func (e *env) coupon(t *testing.T, in CouponInput) *Coupon {
	t.Helper()
	if in.AppliesTo == nil {
		in.AppliesTo = []string{string(payment.PurposeInstantPass)}
	}
	in.IsActive = true
	c, err := e.svc.CreateCoupon(e.ctx, e.admin, in)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func (e *env) fund(t *testing.T, userID primitive.ObjectID, balance wallet.TargetBalance, rupees float64) {
	t.Helper()
	_, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: userID, Type: wallet.TypeCredit, TargetBalance: balance, Category: wallet.CategoryTopup,
		Amount: rupees, ReferenceID: "fund:" + primitive.NewObjectID().Hex(), Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func (e *env) balances(t *testing.T, userID primitive.ObjectID) (mainBal, bonus float64) {
	t.Helper()
	s, err := e.wallet.GetWalletSummary(e.ctx, userID.Hex())
	if err != nil {
		t.Fatal(err)
	}
	return s.MainBalance, s.BonusBalance
}

// buy pays for a ₹99 pass from the wallet with a code, the way a feature does
func (e *env) buy(userID primitive.ObjectID, code string) (*Applied, *WalletPaid, error) {
	var a *Applied
	var paid *WalletPaid
	ref := "pass:" + primitive.NewObjectID().Hex()
	err := e.tx.Run(e.ctx, func(ctx context.Context) error {
		var err error
		if a, err = e.svc.PriceForWallet(ctx, userID.Hex(), payment.PurposeInstantPass, 99_00, code); err != nil {
			return err
		}
		paid, err = e.svc.PayFromWallet(ctx, a, WalletPay{
			Category: wallet.CategoryPassPurchase, ReferenceID: ref + ":pay", PurchaseRef: ref, Description: "InstantPass",
		})
		return err
	})
	return a, paid, err
}

func (e *env) checkout(userID primitive.ObjectID, code string) (*payment.Checkout, *Applied, error) {
	return e.svc.CheckoutOnline(e.ctx, userID.Hex(), payment.PurposeInstantPass, 99_00, code,
		func(pricePaise int64, details map[string]string) (*payment.Checkout, error) {
			c, _, err := e.fake.CreateOrder(e.ctx, payment.CreateOrderInput{
				UserID: userID, Purpose: payment.PurposeInstantPass, AmountPaise: pricePaise, Details: details,
			})
			return c, err
		})
}

func (e *env) status(t *testing.T, id string) string {
	t.Helper()
	var s string
	if err := e.pg.DB.Raw(`SELECT status FROM coupon_redemptions WHERE id = ?`, id).Scan(&s).Error; err != nil {
		t.Fatal(err)
	}
	return s
}

func TestPriceRules(t *testing.T) {
	flat := func(p int64) *Coupon { return &Coupon{Kind: KindDiscount, ValueType: ValueFlat, AmountPaise: &p} }
	pct := func(n int, capPaise int64) *Coupon {
		c := &Coupon{Kind: KindDiscount, ValueType: ValuePercent, Percent: &n}
		if capPaise > 0 {
			c.MaxBenefitPaise = &capPaise
		}
		return c
	}
	cases := []struct {
		name          string
		c             *Coupon
		list          int64
		wantDiscount  int64
		wantPricePaid int64
	}{
		{"no coupon", nil, 99_00, 0, 99_00},
		{"flat", flat(30_00), 99_00, 30_00, 69_00},
		{"flat above price is free", flat(500_00), 99_00, 99_00, 0},
		{"percent rounds down to the paisa", pct(15, 0), 99_99, 14_99, 85_00},
		{"percent is capped", pct(50, 20_00), 99_00, 20_00, 79_00},
		{"100 percent is free", pct(100, 0), 99_00, 99_00, 0},
		// Razorpay can't take 50 paise, so the price stops at ₹1
		{"price under a rupee becomes a rupee", flat(98_50), 99_00, 98_00, 1_00},
	}
	for _, tc := range cases {
		a := applyTo(tc.c, "u", payment.PurposeInstantPass, tc.list)
		if a.DiscountPaise != tc.wantDiscount || a.PricePaise != tc.wantPricePaid {
			t.Errorf("%s: discount %d price %d, want %d and %d", tc.name, a.DiscountPaise, a.PricePaise, tc.wantDiscount, tc.wantPricePaid)
		}
	}

	ten := 10
	cash := &Applied{coupon: &Coupon{Kind: KindCashback, ValueType: ValuePercent, Percent: &ten}}
	if got := cash.CashbackOn(49_00); got != 4_90 {
		t.Errorf("cashback on ₹49 = %d paise, want 490", got)
	}
	if got := cash.CashbackOn(0); got != 0 {
		t.Errorf("cashback on bonus-only payment = %d, want 0", got)
	}
	if got := (&Applied{coupon: flat(10_00)}).CashbackOn(99_00); got != 0 {
		t.Errorf("a discount coupon gave cashback %d", got)
	}
}

func TestDiscountFromWalletOncePerCustomer(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.fund(t, buyer, wallet.BalanceMain, 200)
	e.coupon(t, CouponInput{Code: "save30", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(30), PerUserLimit: intp(1)})

	a, paid, err := e.buy(buyer, "  Save30 ")
	if err != nil {
		t.Fatal(err)
	}
	if a.PricePaise != 69_00 || paid.MainPaise != 69_00 || paid.BonusPaise != 0 || paid.CashbackPaise != 0 {
		t.Fatalf("applied %+v paid %+v", a, paid)
	}
	if mainBal, _ := e.balances(t, buyer); mainBal != 131 {
		t.Fatalf("main balance = %v, want 131", mainBal)
	}
	if _, _, err := e.buy(buyer, "SAVE30"); !errors.Is(err, ErrAlreadyUsed) {
		t.Fatalf("second use: %v", err)
	}
	// The refused purchase charged nothing
	if mainBal, _ := e.balances(t, buyer); mainBal != 131 {
		t.Fatalf("main balance after refusal = %v", mainBal)
	}
}

func TestBonusFirstAndCashbackOnRealMoneyOnly(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.fund(t, buyer, wallet.BalanceBonus, 50)
	e.fund(t, buyer, wallet.BalanceMain, 100)
	e.coupon(t, CouponInput{Code: "CASH10", Kind: KindCashback, ValueType: ValuePercent, Percent: intp(10)})

	q, err := e.svc.Quote(e.ctx, buyer.Hex(), QuoteRequest{Purpose: string(payment.PurposeInstantPass), Code: "cash10"})
	if err != nil {
		t.Fatal(err)
	}
	if q.Price != 99 || q.Wallet.FromBonus != 50 || q.Wallet.FromMain != 49 || q.Wallet.Cashback != 4.9 || !q.Wallet.Enough || q.OnlineCashback != 9.9 {
		t.Fatalf("quote = %+v", q)
	}

	_, paid, err := e.buy(buyer, "CASH10")
	if err != nil {
		t.Fatal(err)
	}
	if paid.BonusPaise != 50_00 || paid.MainPaise != 49_00 || paid.CashbackPaise != 4_90 {
		t.Fatalf("paid = %+v", paid)
	}
	mainBal, bonus := e.balances(t, buyer)
	if mainBal != 51 || bonus != 4.9 {
		t.Fatalf("balances main %v bonus %v, want 51 and 4.9", mainBal, bonus)
	}
}

func TestCodeRules(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.fund(t, buyer, wallet.BalanceMain, 500)
	now := time.Now()

	e.coupon(t, CouponInput{Code: "LATER", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(5), StartsAt: at(now.Add(time.Hour))})
	e.coupon(t, CouponInput{Code: "OVER", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(5), EndsAt: at(now.Add(-time.Minute))})
	e.coupon(t, CouponInput{Code: "PLANS", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(5), AppliesTo: []string{string(payment.PurposeRecruiterPlan)}})
	e.coupon(t, CouponInput{Code: "BIGSPEND", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(5), MinOrder: 100})
	off := e.coupon(t, CouponInput{Code: "OFFNOW", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(5)})
	in := CouponInput{Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(5), AppliesTo: off.AppliesTo, IsActive: false}
	if _, err := e.svc.UpdateCoupon(e.ctx, off.ID, in); err != nil {
		t.Fatal(err)
	}

	for code, want := range map[string]error{
		"NOPE": ErrInvalid, "x": ErrInvalid, "OFFNOW": ErrInvalid, "LATER": ErrNotStarted, "OVER": ErrExpired,
		"PLANS": ErrNotApplicable, "BIGSPEND": ErrMinOrder,
	} {
		if _, _, err := e.buy(buyer, code); !errors.Is(err, want) {
			t.Errorf("%s: %v, want %v", code, err, want)
		}
	}
	if mainBal, _ := e.balances(t, buyer); mainBal != 500 {
		t.Fatalf("refused codes charged the wallet: main %v", mainBal)
	}
	// No code is the list price
	if a, _, err := e.buy(buyer, ""); err != nil || a.PricePaise != 99_00 {
		t.Fatalf("no code: %+v %v", a, err)
	}
}

func TestTotalLimitHoldsUnderParallelUse(t *testing.T) {
	e := setup(t)
	e.coupon(t, CouponInput{Code: "FIRST3", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(10), TotalLimit: intp(3)})

	const buyers = 8
	ids := make([]primitive.ObjectID, buyers)
	for i := range ids {
		ids[i] = primitive.NewObjectID()
		e.fund(t, ids[i], wallet.BalanceMain, 99)
	}
	var wg sync.WaitGroup
	results := make([]error, buyers)
	for i := range ids {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, results[i] = e.buy(ids[i], "FIRST3")
		}(i)
	}
	wg.Wait()

	ok, usedUp := 0, 0
	for _, err := range results {
		switch {
		case err == nil:
			ok++
		case errors.Is(err, ErrUsedUp):
			usedUp++
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if ok != 3 || usedUp != buyers-3 {
		t.Fatalf("%d uses went through and %d were refused, want 3 and %d", ok, usedUp, buyers-3)
	}
}

func TestOnlineHoldRedeemAndReverse(t *testing.T) {
	e := setup(t)
	buyer, other := primitive.NewObjectID(), primitive.NewObjectID()
	e.coupon(t, CouponInput{Code: "ONLYONE", Kind: KindCashback, ValueType: ValueFlat, Amount: rs(20), TotalLimit: intp(1)})

	first, a1, err := e.checkout(buyer, "ONLYONE")
	if err != nil {
		t.Fatal(err)
	}
	if first.AmountPaise != 99_00 || a1.RedemptionID == "" {
		t.Fatalf("checkout %+v applied %+v", first, a1)
	}
	// The hold takes the only place from everyone else...
	if _, _, err := e.checkout(other, "ONLYONE"); !errors.Is(err, ErrUsedUp) {
		t.Fatalf("other customer: %v", err)
	}
	// ...but the same customer can start again, which gives up their first hold
	second, a2, err := e.checkout(buyer, "ONLYONE")
	if err != nil {
		t.Fatal(err)
	}
	if e.status(t, a1.RedemptionID) != StatusReleased || e.status(t, a2.RedemptionID) != StatusReserved {
		t.Fatalf("holds: %s and %s", e.status(t, a1.RedemptionID), e.status(t, a2.RedemptionID))
	}

	// The second order is paid
	order := e.fake.Orders[second.OrderID]
	if err := e.tx.Run(e.ctx, func(ctx context.Context) error { return e.svc.RedeemOrder(ctx, order, "pass:p2") }); err != nil {
		t.Fatal(err)
	}
	if e.status(t, a2.RedemptionID) != StatusRedeemed {
		t.Fatalf("after payment: %s", e.status(t, a2.RedemptionID))
	}
	if _, bonus := e.balances(t, buyer); bonus != 20 {
		t.Fatalf("cashback = %v, want 20", bonus)
	}
	// Settling twice credits once
	if err := e.svc.RedeemOrder(e.ctx, order, "pass:p2"); err != nil {
		t.Fatal(err)
	}
	if _, bonus := e.balances(t, buyer); bonus != 20 {
		t.Fatalf("cashback after replay = %v", bonus)
	}

	// The released first order is paid late (another tab): the purchase is delivered, but a
	// hold that was given up earns no cashback, so extra checkouts can't beat the limits
	late := e.fake.Orders[first.OrderID]
	if err := e.svc.RedeemOrder(e.ctx, late, "pass:p1"); err != nil {
		t.Fatal(err)
	}
	if e.status(t, a1.RedemptionID) != StatusRedeemed {
		t.Fatalf("late payment: %s", e.status(t, a1.RedemptionID))
	}
	if _, bonus := e.balances(t, buyer); bonus != 20 {
		t.Fatalf("cashback after late payment = %v, want 20", bonus)
	}

	// Refunding the second purchase takes its cashback back and frees its place
	if err := e.svc.Reverse(e.ctx, "pass:p2"); err != nil {
		t.Fatal(err)
	}
	if _, bonus := e.balances(t, buyer); bonus != 0 {
		t.Fatalf("bonus after refund = %v, want 0", bonus)
	}
	if e.status(t, a2.RedemptionID) != StatusReversed {
		t.Fatalf("after refund: %s", e.status(t, a2.RedemptionID))
	}
	if err := e.svc.Reverse(e.ctx, "pass:p2"); err != nil {
		t.Fatalf("second reverse: %v", err)
	}
	if _, bonus := e.balances(t, buyer); bonus != 0 {
		t.Fatalf("bonus after second reverse = %v", bonus)
	}
	// The late purchase earned no cashback, so refunding it takes none back
	if err := e.svc.Reverse(e.ctx, "pass:p1"); err != nil {
		t.Fatalf("reverse late purchase: %v", err)
	}
}

func TestRefundRefusedWhenCashbackSpent(t *testing.T) {
	e := setup(t)
	buyer := primitive.NewObjectID()
	e.fund(t, buyer, wallet.BalanceMain, 99)
	e.coupon(t, CouponInput{Code: "BACK15", Kind: KindCashback, ValueType: ValueFlat, Amount: rs(15)})

	ref := "pass:spent"
	err := e.tx.Run(e.ctx, func(ctx context.Context) error {
		a, err := e.svc.PriceForWallet(ctx, buyer.Hex(), payment.PurposeInstantPass, 99_00, "BACK15")
		if err != nil {
			return err
		}
		_, err = e.svc.PayFromWallet(ctx, a, WalletPay{Category: wallet.CategoryPassPurchase, ReferenceID: ref + ":pay", PurchaseRef: ref, Description: "pass"})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	// The cashback is spent on something else
	if _, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: buyer, Type: wallet.TypeDebit, TargetBalance: wallet.BalanceBonus, Category: wallet.CategoryPassPurchase,
		Amount: 10, ReferenceID: "spend-bonus", Description: "test",
	}); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Reverse(e.ctx, ref); !errors.Is(err, ErrCashbackSpent) {
		t.Fatalf("reverse with spent cashback: %v", err)
	}
}

func TestFailedOrderGivesUpTheHold(t *testing.T) {
	e := setup(t)
	buyer, other := primitive.NewObjectID(), primitive.NewObjectID()
	e.coupon(t, CouponInput{Code: "SOLO", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(10), TotalLimit: intp(1)})

	boom := errors.New("gateway down")
	_, _, err := e.svc.CheckoutOnline(e.ctx, buyer.Hex(), payment.PurposeInstantPass, 99_00, "SOLO",
		func(int64, map[string]string) (*payment.Checkout, error) { return nil, boom })
	if !errors.Is(err, boom) {
		t.Fatalf("checkout: %v", err)
	}
	if _, a, err := e.checkout(other, "SOLO"); err != nil || a.PricePaise != 89_00 {
		t.Fatalf("the place wasn't given back: %+v %v", a, err)
	}

	// A free price can't be paid online
	e.coupon(t, CouponInput{Code: "FREEPASS", Kind: KindDiscount, ValueType: ValuePercent, Percent: intp(100)})
	if _, _, err := e.checkout(buyer, "FREEPASS"); !errors.Is(err, ErrOrderFree) {
		t.Fatalf("free online checkout: %v", err)
	}
	// It goes through the wallet with nothing charged
	if a, paid, err := e.buy(buyer, "FREEPASS"); err != nil || a.PricePaise != 0 || paid.Purchase != nil {
		t.Fatalf("free wallet purchase: %+v %+v %v", a, paid, err)
	}
}

func TestAdminValidation(t *testing.T) {
	e := setup(t)
	base := func() CouponInput {
		return CouponInput{Code: "GOOD-1", Kind: KindDiscount, ValueType: ValueFlat, Amount: rs(10),
			AppliesTo: []string{string(payment.PurposeInstantPass)}, IsActive: true}
	}
	cases := []struct {
		name string
		edit func(*CouponInput)
		want error
	}{
		{"short code", func(in *CouponInput) { in.Code = "AB" }, ErrCodeInvalid},
		{"spaces in code", func(in *CouponInput) { in.Code = "TWO WORDS" }, ErrCodeInvalid},
		{"no kind", func(in *CouponInput) { in.Kind = "" }, ErrKindInvalid},
		{"flat without amount", func(in *CouponInput) { in.Amount = nil }, ErrValueInvalid},
		{"zero amount", func(in *CouponInput) { in.Amount = rs(0) }, ErrValueInvalid},
		{"percent over 100", func(in *CouponInput) { in.ValueType, in.Percent = ValuePercent, intp(101) }, ErrValueInvalid},
		{"zero cap", func(in *CouponInput) { in.ValueType, in.Percent, in.MaxBenefit = ValuePercent, intp(10), rs(0) }, ErrCapInvalid},
		{"negative minimum", func(in *CouponInput) { in.MinOrder = -1 }, ErrMinOrderInvalid},
		{"nothing to apply to", func(in *CouponInput) { in.AppliesTo = nil }, ErrAppliesToInvalid},
		{"unknown purchase", func(in *CouponInput) { in.AppliesTo = []string{"wallet_topup"} }, ErrAppliesToInvalid},
		{"ends before it starts", func(in *CouponInput) {
			in.StartsAt, in.EndsAt = at(time.Now()), at(time.Now().Add(-time.Hour))
		}, ErrDatesInvalid},
		{"zero limit", func(in *CouponInput) { in.PerUserLimit = intp(0) }, ErrLimitInvalid},
	}
	for _, tc := range cases {
		in := base()
		tc.edit(&in)
		if _, err := e.svc.CreateCoupon(e.ctx, e.admin, in); !errors.Is(err, tc.want) {
			t.Errorf("%s: %v, want %v", tc.name, err, tc.want)
		}
	}

	c, err := e.svc.CreateCoupon(e.ctx, e.admin, base())
	if err != nil {
		t.Fatal(err)
	}
	if c.Code != "GOOD-1" || *c.Amount != 10 {
		t.Fatalf("created %+v", c)
	}
	dup := base()
	dup.Code = "good-1"
	if _, err := e.svc.CreateCoupon(e.ctx, e.admin, dup); !errors.Is(err, ErrCodeTaken) {
		t.Fatalf("duplicate code: %v", err)
	}

	// Editing keeps the code and applies the new values
	in := base()
	in.Code = "IGNORED"
	in.ValueType, in.Amount, in.Percent, in.MaxBenefit = ValuePercent, nil, intp(20), rs(15)
	updated, err := e.svc.UpdateCoupon(e.ctx, c.ID, in)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Code != "GOOD-1" || updated.Amount != nil || *updated.Percent != 20 || *updated.MaxBenefit != 15 {
		t.Fatalf("updated %+v", updated)
	}
	if _, err := e.svc.UpdateCoupon(e.ctx, primitive.NewObjectID().Hex(), base()); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing coupon: %v", err)
	}

	list, err := e.svc.AdminCoupons(e.ctx)
	if err != nil || len(list) != 1 || list[0].Used != 0 {
		t.Fatalf("list %+v %v", list, err)
	}
	// The list must carry the coupon itself, not just its counts
	if got := list[0]; got.ID != c.ID || got.Code != "GOOD-1" || got.Percent == nil || *got.Percent != 20 || len(got.AppliesTo) == 0 {
		t.Fatalf("listed coupon %+v", got)
	}
}
