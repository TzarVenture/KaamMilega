package adsales

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/ads"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These tests run the ad sales rules against real Postgres (a throwaway schema, see pgtest), with
// the ad server faked in memory. They skip when no database is configured.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type memUsers struct {
	user.UserRepository
	roles map[string][]string
}

func (m memUsers) FindUserByID(_ context.Context, id string) (*user.User, error) {
	roles, ok := m.roles[id]
	if !ok {
		return nil, nil
	}
	return &user.User{Name: "Asha Traders", Roles: roles}, nil
}

func (m memUsers) FindUsersByIDs(context.Context, []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	return map[primitive.ObjectID]*user.User{}, nil
}

// memAds is the ad server: the campaigns recruiter ads start
type memAds struct {
	ads.Service
	mu        sync.Mutex
	campaigns map[primitive.ObjectID]*ads.Campaign
}

func (m *memAds) RunPaid(_ context.Context, c *ads.Campaign) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *c
	cp.Status = ads.StatusActive
	m.campaigns[c.ID] = &cp
	return nil
}

func (m *memAds) SetCreative(_ context.Context, id primitive.ObjectID, cr ads.Creative) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.campaigns[id]
	if !ok {
		return ads.ErrNotFound
	}
	c.Advertiser, c.Headline, c.Body, c.CTALabel, c.CreativeURL, c.LinkURL =
		cr.Advertiser, cr.Headline, cr.Body, cr.CTALabel, cr.ImageURL, cr.LinkURL
	return nil
}

func (m *memAds) SetStatus(_ context.Context, id primitive.ObjectID, status string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.campaigns[id]; ok {
		c.Status = status
	}
	return nil
}

func (m *memAds) Remove(_ context.Context, id primitive.ObjectID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.campaigns, id)
	return nil
}

func (m *memAds) Totals(_ context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]ads.Totals, error) {
	out := map[primitive.ObjectID]ads.Totals{}
	for _, id := range ids {
		if c, ok := m.campaigns[id]; ok {
			out[id] = ads.Totals{Impressions: c.Impressions, Clicks: c.Clicks}
		}
	}
	return out, nil
}

type env struct {
	ctx     context.Context
	pg      *database.PostgresDB
	svc     *service
	wallet  wallet.WalletService
	coupons promo.Service
	users   memUsers
	fake    *paymenttest.Fake
	ads     *memAds
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
	// The ad and the coupon use point at the checkout's row, so it has to exist
	fake.OnCreate = func(ctx context.Context, o *payment.Order) error {
		return pg.DB.WithContext(ctx).Exec(`INSERT INTO payment_orders (id, razorpay_order_id, user_id, purpose, amount_paise, status)
			VALUES (?, ?, ?, ?, ?, 'created')`, o.ID.Hex(), o.RazorpayOrderID, o.UserID.Hex(), string(o.Purpose), o.AmountPaise).Error
	}
	walletSvc := wallet.NewWalletService(wallet.NewWalletRepository(pg, tx, mdb), &config.Config{}, nil, nil, fake, tx)
	users := memUsers{roles: map[string][]string{}}
	coupons := promo.NewService(promo.NewRepository(pg), tx, walletSvc, users)
	adServer := &memAds{campaigns: map[primitive.ObjectID]*ads.Campaign{}}
	svc := newService(NewRepository(pg), tx, walletSvc, fake, coupons, adServer, users, nil, nil, nil,
		func(key string) string { return "https://cdn.example.com/" + key })
	return &env{ctx: ctx, pg: pg, svc: svc, wallet: walletSvc, coupons: coupons, users: users, fake: fake, ads: adServer}
}

func (e *env) recruiter() string {
	id := primitive.NewObjectID().Hex()
	e.users.roles[id] = []string{user.RoleRecruiter}
	return id
}

func (e *env) credit(t *testing.T, userID string, balance wallet.TargetBalance, rupees float64) {
	t.Helper()
	category := wallet.CategoryTopup
	if balance == wallet.BalanceBonus {
		category = wallet.CategoryBonusReward
	}
	_, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: database.OID(userID), Type: wallet.TypeCredit, TargetBalance: balance, Category: category,
		Amount: rupees, ReferenceID: "fund:" + primitive.NewObjectID().Hex(), Description: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func (e *env) balances(t *testing.T, userID string) (main, bonus float64) {
	t.Helper()
	s, err := e.wallet.GetWalletSummary(e.ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	return s.MainBalance, s.BonusBalance
}

func (e *env) pkg(t *testing.T, price float64, days int) *Package {
	t.Helper()
	p, err := e.svc.CreatePackage(e.ctx, PackageInput{Name: "Week", Days: days, Price: price,
		Placements: []string{"feed_sidebar", "jobs_inline"}, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	return p
}

// content is an ad whose image the recruiter uploaded
func content(userID string) Content {
	return Content{
		Advertiser: "Asha Traders", Headline: "We're hiring drivers", Body: "Good pay", CTALabel: "Apply",
		ImageURL: "https://cdn.example.com/ad_image/" + userID + "/2026/11/ad.png", LinkURL: "https://asha.example.com/jobs",
		Cities: []string{"Pune"}, Audiences: []string{"user"},
	}
}

func (e *env) write(t *testing.T, userID string, p *Package) *Ad {
	t.Helper()
	ad, err := e.svc.Save(e.ctx, userID, "", SaveRequest{PackageID: p.ID, Content: content(userID)})
	if err != nil {
		t.Fatal(err)
	}
	return ad
}

// seen is the updated_at the admin sees for a pending ad
func (e *env) seen(t *testing.T, adID string) *time.Time {
	t.Helper()
	ad, err := e.svc.repo.GetAd(e.ctx, adID, false)
	if err != nil || ad == nil {
		t.Fatal(err)
	}
	return viaJSON(t, &ad.UpdatedAt)
}

// viaJSON sends a time to the browser and back, as the admin page does
func viaJSON(t *testing.T, at *time.Time) *time.Time {
	t.Helper()
	if at == nil {
		return nil
	}
	b, err := json.Marshal(Ad{UpdatedAt: *at})
	if err != nil {
		t.Fatal(err)
	}
	var shown struct {
		UpdatedAt string `json:"updated_at"`
	}
	if err := json.Unmarshal(b, &shown); err != nil {
		t.Fatal(err)
	}
	var req RejectRequest
	if err := json.Unmarshal([]byte(`{"seen":"`+shown.UpdatedAt+`"}`), &req); err != nil {
		t.Fatal(err)
	}
	return req.Seen
}

// seenChange is the revision_at the admin sees for a change waiting on a running ad
func (e *env) seenChange(t *testing.T, adID string) *time.Time {
	t.Helper()
	ad, err := e.svc.repo.GetAd(e.ctx, adID, false)
	if err != nil || ad == nil {
		t.Fatal(err)
	}
	return viaJSON(t, ad.RevisionAt)
}

func (e *env) coupon(t *testing.T, in promo.CouponInput) {
	t.Helper()
	in.AppliesTo, in.IsActive = []string{string(payment.PurposeRecruiterAd)}, true
	if _, err := e.coupons.CreateCoupon(e.ctx, primitive.NewObjectID().Hex(), in); err != nil {
		t.Fatal(err)
	}
}

func (e *env) useStatus(t *testing.T, purchaseRef string) string {
	t.Helper()
	var s string
	if err := e.pg.DB.Raw(`SELECT status FROM coupon_redemptions WHERE purchase_ref = ?`, purchaseRef).Scan(&s).Error; err != nil {
		t.Fatal(err)
	}
	return s
}

func TestWalletAdRejectedGoesBackToBonusAndMain(t *testing.T) {
	e := setup(t)
	rec := e.recruiter()
	p := e.pkg(t, 500, 7)
	e.credit(t, rec, wallet.BalanceBonus, 100)
	e.credit(t, rec, wallet.BalanceMain, 600)

	ad := e.write(t, rec, p)
	if ad.Status != StatusUnpaid || ad.Days != 7 || len(ad.Placements) != 2 || ad.Cities[0] != "Pune" {
		t.Fatalf("written = %+v", ad)
	}
	// Unpaid ads never reach the admin
	if page, err := e.svc.AdminAds(e.ctx, AdminQuery{Status: "review"}); err != nil || page.Total != 0 {
		t.Fatalf("review before paying: %v %+v", err, page)
	}

	paid, _, _, err := e.svc.PayWithWallet(e.ctx, rec, ad.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != StatusPending || paid.Channel != ChannelWallet || paid.PricePaise != 500_00 ||
		paid.PaidBonusPaise != 100_00 || paid.PaidMainPaise != 400_00 {
		t.Fatalf("paid = %+v", paid)
	}
	if main, bonus := e.balances(t, rec); main != 200 || bonus != 0 {
		t.Fatalf("after paying main %v bonus %v", main, bonus)
	}
	if _, _, _, err := e.svc.PayWithWallet(e.ctx, rec, ad.ID, ""); !errors.Is(err, ErrNotUnpaid) {
		t.Fatalf("second payment: %v", err)
	}
	if page, _ := e.svc.AdminAds(e.ctx, AdminQuery{Status: "review"}); page.Total != 1 {
		t.Fatalf("review list = %d", page.Total)
	}

	if _, err := e.svc.Reject(e.ctx, ad.ID, "admin-1", " "); !errors.Is(err, ErrReason) {
		t.Fatalf("reject without reason: %v", err)
	}
	rejected, err := e.svc.Reject(e.ctx, ad.ID, "admin-1", "The image is blurry")
	if err != nil {
		t.Fatal(err)
	}
	if rejected.Status != StatusRejected || rejected.RefundedPaise != 500_00 || rejected.RejectReason != "The image is blurry" {
		t.Fatalf("rejected = %+v", rejected)
	}
	// Bonus credit back to bonus, never to the withdrawable balance
	if main, bonus := e.balances(t, rec); main != 600 || bonus != 100 {
		t.Fatalf("after refund main %v bonus %v", main, bonus)
	}
	if _, err := e.svc.Reject(e.ctx, ad.ID, "admin-1", "again"); !errors.Is(err, ErrState) {
		t.Fatalf("second reject: %v", err)
	}
	if _, err := e.svc.Approve(e.ctx, ad.ID, "admin-1", e.seen(t, ad.ID)); !errors.Is(err, ErrState) {
		t.Fatalf("approve after reject: %v", err)
	}
	if len(e.ads.campaigns) != 0 {
		t.Fatalf("campaigns = %d", len(e.ads.campaigns))
	}
	if _, err := e.svc.Save(e.ctx, rec, ad.ID, SaveRequest{Content: content(rec)}); !errors.Is(err, ErrCantEdit) {
		t.Fatalf("edit after reject: %v", err)
	}
}

func TestOnlineAdApprovedRunsForItsDaysFromApproval(t *testing.T) {
	e := setup(t)
	rec := e.recruiter()
	p := e.pkg(t, 300, 10)
	ad := e.write(t, rec, p)

	checkout, err := e.svc.CreateOrder(e.ctx, rec, ad.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if checkout.AmountPaise != 300_00 {
		t.Fatalf("checkout = %+v", checkout)
	}
	// The admin changes the package before the payment lands: the ad gets what was paid for
	if _, err := e.svc.UpdatePackage(e.ctx, p.ID, PackageInput{Name: "Week", Days: 14, Price: 900,
		Placements: []string{"feed_sidebar"}, IsActive: true}); err != nil {
		t.Fatal(err)
	}
	paid, err := e.svc.VerifyPayment(e.ctx, rec, payment.ConfirmInput{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_1"})
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != StatusPending || paid.Channel != ChannelOnline || paid.PaidOnlinePaise != 300_00 || paid.RazorpayOrderID != checkout.OrderID ||
		paid.Days != 10 || len(paid.Placements) != 2 {
		t.Fatalf("paid = %+v", paid)
	}

	// An admin looking at an older version can't approve it
	stale := e.seen(t, ad.ID).Add(-time.Second)
	if _, err := e.svc.Approve(e.ctx, ad.ID, "admin-1", &stale); !errors.Is(err, ErrChanged) {
		t.Fatalf("approve an older version: %v", err)
	}
	if _, err := e.svc.Approve(e.ctx, ad.ID, "admin-1", nil); !errors.Is(err, ErrChanged) {
		t.Fatalf("approve without saying what was seen: %v", err)
	}
	before := time.Now()
	approved, err := e.svc.Approve(e.ctx, ad.ID, "admin-1", e.seen(t, ad.ID))
	if err != nil {
		t.Fatal(err)
	}
	if approved.Status != StatusApproved || approved.StartsAt == nil || approved.StartsAt.Before(before.Add(-time.Second)) {
		t.Fatalf("approved = %+v", approved)
	}
	if got := approved.EndsAt.Sub(*approved.StartsAt); got != time.Duration(approved.Days)*24*time.Hour {
		t.Fatalf("runs for %v, days %d", got, approved.Days)
	}
	c := e.ads.campaigns[database.OID(approved.CampaignID)]
	if c == nil || c.RecruiterAdID != ad.ID || c.OwnerID != rec || !c.EndAt.Equal(*approved.EndsAt) ||
		c.CreativeURL != content(rec).ImageURL || len(c.Cities) != 1 || c.FreqCap != DefaultFreqCap {
		t.Fatalf("campaign = %+v", c)
	}
	if _, err := e.svc.Approve(e.ctx, ad.ID, "admin-1", e.seen(t, ad.ID)); !errors.Is(err, ErrState) {
		t.Fatalf("second approve: %v", err)
	}
	if _, err := e.svc.Reject(e.ctx, ad.ID, "admin-1", "late"); !errors.Is(err, ErrState) {
		t.Fatalf("reject after approve: %v", err)
	}

	ov, err := e.svc.Overview(e.ctx, rec)
	if err != nil {
		t.Fatal(err)
	}
	if len(ov.Ads) != 1 || ov.Ads[0].State != "running" {
		t.Fatalf("overview ads = %+v", ov.Ads)
	}
}

func TestChangeToRunningAdWaitsAndOldVersionKeepsRunning(t *testing.T) {
	e := setup(t)
	rec := e.recruiter()
	p := e.pkg(t, 200, 5)
	e.credit(t, rec, wallet.BalanceMain, 200)
	ad := e.write(t, rec, p)
	if _, _, _, err := e.svc.PayWithWallet(e.ctx, rec, ad.ID, ""); err != nil {
		t.Fatal(err)
	}
	approved, err := e.svc.Approve(e.ctx, ad.ID, "admin-1", e.seen(t, ad.ID))
	if err != nil {
		t.Fatal(err)
	}
	campaign := e.ads.campaigns[database.OID(approved.CampaignID)]

	changed := content(rec)
	changed.Headline = "Now hiring cooks"
	changed.Cities = []string{"Mumbai"} // who sees it stays as approved
	saved, err := e.svc.Save(e.ctx, rec, ad.ID, SaveRequest{Content: changed})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Headline != "We're hiring drivers" || saved.Revision == nil || saved.Revision.Headline != "Now hiring cooks" ||
		saved.Revision.Cities[0] != "Pune" {
		t.Fatalf("saved = %+v revision %+v", saved, saved.Revision)
	}
	if campaign.Headline != "We're hiring drivers" {
		t.Fatalf("campaign changed before approval: %s", campaign.Headline)
	}
	if page, _ := e.svc.AdminAds(e.ctx, AdminQuery{Status: "review"}); page.Total != 1 {
		t.Fatalf("review list = %d", page.Total)
	}
	// A change left on an ad that has ended drops out of the review list
	if err := e.pg.DB.Exec(`UPDATE recruiter_ads SET starts_at = now() - interval '6 days', ends_at = now() - interval '1 day' WHERE id = ?`, ad.ID).Error; err != nil {
		t.Fatal(err)
	}
	if page, _ := e.svc.AdminAds(e.ctx, AdminQuery{Status: "review"}); page.Total != 0 {
		t.Fatalf("review list after the ad ended = %d", page.Total)
	}
	if err := e.pg.DB.Exec(`UPDATE recruiter_ads SET starts_at = now(), ends_at = now() + interval '5 days' WHERE id = ?`, ad.ID).Error; err != nil {
		t.Fatal(err)
	}

	refused, err := e.svc.RejectChange(e.ctx, ad.ID, "admin-1", "Headline is misleading.")
	if err != nil {
		t.Fatal(err)
	}
	if refused.Revision != nil || refused.RevisionNote != "Headline is misleading." || refused.Headline != "We're hiring drivers" {
		t.Fatalf("refused = %+v", refused)
	}
	if _, err := e.svc.ApproveChange(e.ctx, ad.ID, "admin-1", e.seenChange(t, ad.ID)); !errors.Is(err, ErrNoRevision) {
		t.Fatalf("approve with nothing waiting: %v", err)
	}

	if _, err := e.svc.Save(e.ctx, rec, ad.ID, SaveRequest{Content: changed}); err != nil {
		t.Fatal(err)
	}
	// The recruiter edits the change while the admin is looking at it
	looked := e.seenChange(t, ad.ID)
	time.Sleep(2 * time.Millisecond)
	if _, err := e.svc.Save(e.ctx, rec, ad.ID, SaveRequest{Content: changed}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.ApproveChange(e.ctx, ad.ID, "admin-1", looked); !errors.Is(err, ErrChanged) {
		t.Fatalf("approve a change that changed again: %v", err)
	}
	live, err := e.svc.ApproveChange(e.ctx, ad.ID, "admin-1", e.seenChange(t, ad.ID))
	if err != nil {
		t.Fatal(err)
	}
	if live.Headline != "Now hiring cooks" || live.Revision != nil || live.Cities[0] != "Pune" || campaign.Headline != "Now hiring cooks" {
		t.Fatalf("live = %+v campaign %s", live, campaign.Headline)
	}
	if _, err := e.svc.Save(e.ctx, rec, ad.ID, SaveRequest{PackageID: primitive.NewObjectID().Hex(), Content: changed}); !errors.Is(err, ErrNoPackageSwap) {
		t.Fatalf("package swap: %v", err)
	}
}

func TestRejectedAdWithSpentCashbackRefundsTheRest(t *testing.T) {
	e := setup(t)
	rec := e.recruiter()
	p := e.pkg(t, 1000, 30)
	hundred := 100.0
	e.coupon(t, promo.CouponInput{Code: "ADBACK", Kind: promo.KindCashback, ValueType: promo.ValueFlat, Amount: &hundred})
	ad := e.write(t, rec, p)

	checkout, err := e.svc.CreateOrder(e.ctx, rec, ad.ID, "ADBACK")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.VerifyPayment(e.ctx, rec, payment.ConfirmInput{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_2"}); err != nil {
		t.Fatal(err)
	}
	if _, bonus := e.balances(t, rec); bonus != 100 {
		t.Fatalf("cashback = %v", bonus)
	}
	// The recruiter spends ₹60 of the ₹100 cashback
	if _, _, err := e.wallet.RecordTransaction(e.ctx, wallet.RecordTransactionInput{
		UserID: database.OID(rec), Type: wallet.TypeDebit, TargetBalance: wallet.BalanceBonus, Category: wallet.CategoryRecruiterPlan,
		Amount: 60, ReferenceID: "spend-cashback", Description: "test",
	}); err != nil {
		t.Fatal(err)
	}

	rejected, err := e.svc.Reject(e.ctx, ad.ID, "admin-1", "Not a job ad")
	if err != nil {
		t.Fatal(err)
	}
	// The ₹40 left comes from bonus, only the ₹60 spent from the refund
	if rejected.RefundedPaise != 900_00 {
		t.Fatalf("refunded = %d", rejected.RefundedPaise)
	}
	if main, bonus := e.balances(t, rec); main != 940 || bonus != 0 {
		t.Fatalf("after refund main %v bonus %v", main, bonus)
	}
	if got := e.useStatus(t, Ref(ad.ID)); got != promo.StatusReversed {
		t.Fatalf("coupon use = %s", got)
	}
}

func TestUnpaidAdRules(t *testing.T) {
	e := setup(t)
	rec := e.recruiter()
	other := e.recruiter()
	p := e.pkg(t, 200, 5)
	ad := e.write(t, rec, p)

	if _, err := e.svc.Save(e.ctx, other, ad.ID, SaveRequest{Content: content(other)}); !errors.Is(err, ErrAdNotFound) {
		t.Fatalf("someone else's ad: %v", err)
	}
	if _, err := e.svc.Overview(e.ctx, primitive.NewObjectID().Hex()); !errors.Is(err, ErrRecruitersOnly) {
		t.Fatalf("not a recruiter: %v", err)
	}
	bad := content(rec)
	bad.ImageURL = "https://cdn.example.com/ad_image/" + rec + "/ad.mp4"
	if _, err := e.svc.Save(e.ctx, rec, "", SaveRequest{PackageID: p.ID, Content: bad}); !errors.Is(err, ErrImage) {
		t.Fatalf("video: %v", err)
	}
	// Only the recruiter's own upload: another server's image could be swapped after approval
	for _, img := range []string{"https://evil.example.com/ad_image/" + rec + "/ad.png", content(other).ImageURL} {
		bad.ImageURL = img
		if _, err := e.svc.Save(e.ctx, rec, "", SaveRequest{PackageID: p.ID, Content: bad}); !errors.Is(err, ErrImage) {
			t.Fatalf("image %s: %v", img, err)
		}
	}

	// Paying online for an ad deleted meanwhile refunds the payment
	checkout, err := e.svc.CreateOrder(e.ctx, rec, ad.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Delete(e.ctx, rec, ad.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.VerifyPayment(e.ctx, rec, payment.ConfirmInput{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_3"}); !errors.Is(err, payment.ErrRefunding) {
		t.Fatalf("payment for a deleted ad: %v", err)
	}

	// A switched-off package can't be bought
	ad = e.write(t, rec, p)
	if _, err := e.svc.UpdatePackage(e.ctx, p.ID, PackageInput{Name: "Week", Days: 5, Price: 200, Placements: []string{"feed_sidebar"}}); err != nil {
		t.Fatal(err)
	}
	e.credit(t, rec, wallet.BalanceMain, 200)
	if _, _, _, err := e.svc.PayWithWallet(e.ctx, rec, ad.ID, ""); !errors.Is(err, ErrPackageInactive) {
		t.Fatalf("inactive package: %v", err)
	}
	if err := e.svc.Delete(e.ctx, rec, ad.ID); err != nil {
		t.Fatal(err)
	}
}
