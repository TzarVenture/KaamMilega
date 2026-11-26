package adsales

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/ads"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Users finds recruiters and names them in the admin list (user.UserRepository)
type Users interface {
	FindUserByID(ctx context.Context, id string) (*user.User, error)
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}

type notifier interface {
	CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error)
}

type Service interface {
	Overview(ctx context.Context, userID string) (*Overview, error)
	// Save writes a new ad (adID "") or changes one. A change to a running ad waits for an admin.
	Save(ctx context.Context, userID, adID string, req SaveRequest) (*Ad, error)
	Delete(ctx context.Context, userID, adID string) error
	PayWithWallet(ctx context.Context, userID, adID, couponCode string) (*Ad, *wallet.WalletSummaryResponse, *promo.Receipt, error)
	CreateOrder(ctx context.Context, userID, adID, couponCode string) (*CheckoutResponse, error)
	VerifyPayment(ctx context.Context, userID string, in payment.ConfirmInput) (*Ad, error)

	AdminPackages(ctx context.Context) ([]Package, error)
	CreatePackage(ctx context.Context, in PackageInput) (*Package, error)
	UpdatePackage(ctx context.Context, id string, in PackageInput) (*Package, error)
	AdminAds(ctx context.Context, q AdminQuery) (*AdminPage, error)
	Approve(ctx context.Context, adID, adminID string) (*Ad, error)
	Reject(ctx context.Context, adID, adminID, reason string) (*Ad, error)
	ApproveChange(ctx context.Context, adID, adminID string) (*Ad, error)
	RejectChange(ctx context.Context, adID, adminID, reason string) (*Ad, error)
}

type service struct {
	repo     Repository
	tx       database.Transactor
	wallet   wallet.WalletService
	payments payment.Service
	promo    promo.Service
	ads      ads.Service
	users    Users
	notify   notifier
	mailer   notification.Mailer
	cfg      *config.Config
	now      func() time.Time
}

// DefaultFreqCap is how often one person sees a recruiter ad a day. The admin can change it on
// the campaign.
const DefaultFreqCap = 3

func NewService(repo Repository, tx database.Transactor, walletService wallet.WalletService, payments payment.Service,
	coupons promo.Service, adServer ads.Service, users user.UserRepository, notify notification.NotificationService,
	mailer notification.Mailer, cfg *config.Config) Service {
	return newService(repo, tx, walletService, payments, coupons, adServer, users, notify, mailer, cfg)
}

func newService(repo Repository, tx database.Transactor, walletService wallet.WalletService, payments payment.Service,
	coupons promo.Service, adServer ads.Service, users Users, notify notifier, mailer notification.Mailer, cfg *config.Config) *service {
	s := &service{repo: repo, tx: tx, wallet: walletService, payments: payments, promo: coupons, ads: adServer,
		users: users, mailer: mailer, cfg: cfg, now: time.Now}
	if notify != nil {
		s.notify = notify
	}
	// The checkout screen prices an ad by its package
	coupons.RegisterPricer(payment.PurposeRecruiterAd, func(ctx context.Context, userID, packageID string) (int64, error) {
		if err := s.recruiter(ctx, userID); err != nil {
			return 0, err
		}
		pkg, err := s.sellable(ctx, packageID)
		if err != nil {
			return 0, err
		}
		return pkg.PricePaise, nil
	})
	// No Revoke: an online ad payment can't be refunded from the admin's Payments page. A
	// rejection refunds it to the wallet instead.
	payments.Register(payment.PurposeRecruiterAd, payment.Handlers{
		Fulfill:   s.fulfill,
		AfterPaid: s.afterPaid,
	})
	walletService.RegisterPurchaseRevoker(wallet.CategoryRecruiterAd, s.revokeWalletAd)
	return s
}

func (s *service) recruiter(ctx context.Context, userID string) error {
	if !primitive.IsValidObjectID(userID) {
		return ErrRecruitersOnly
	}
	u, err := s.users.FindUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if u == nil {
		return ErrRecruitersOnly
	}
	for _, r := range u.Roles {
		if r == user.RoleRecruiter {
			return nil
		}
	}
	return ErrRecruitersOnly
}

func (s *service) sellable(ctx context.Context, packageID string) (*Package, error) {
	if !primitive.IsValidObjectID(packageID) {
		return nil, ErrPackageNotFound
	}
	pkg, err := s.repo.GetPackage(ctx, packageID)
	if err != nil {
		return nil, err
	}
	if pkg == nil {
		return nil, ErrPackageNotFound
	}
	if !pkg.IsActive {
		return nil, ErrPackageInactive
	}
	return pkg, nil
}

// owned reads the recruiter's own ad; someone else's ad is "not found"
func (s *service) owned(ctx context.Context, userID, adID string, lock bool) (*Ad, error) {
	if !primitive.IsValidObjectID(adID) {
		return nil, ErrAdNotFound
	}
	ad, err := s.repo.GetAd(ctx, adID, lock)
	if err != nil {
		return nil, err
	}
	if ad == nil || ad.UserID != userID {
		return nil, ErrAdNotFound
	}
	return ad, nil
}

func copyPackage(ad *Ad, pkg *Package) {
	ad.PackageID, ad.PackageName, ad.Days, ad.Placements = pkg.ID, pkg.Name, pkg.Days, pkg.Placements
}

// withStats fills in what the lists show: the state and the campaign's counts
func (s *service) withStats(ctx context.Context, list []Ad) []Ad {
	now := s.now()
	ids := []primitive.ObjectID{}
	for i := range list {
		list[i].State = list[i].StateAt(now)
		if oid, err := primitive.ObjectIDFromHex(list[i].CampaignID); err == nil {
			ids = append(ids, oid)
		}
	}
	if len(ids) == 0 {
		return list
	}
	totals, err := s.ads.Totals(ctx, ids)
	if err != nil {
		log.Printf("[adsales] ad counts: %v", err)
		return list
	}
	for i := range list {
		if oid, err := primitive.ObjectIDFromHex(list[i].CampaignID); err == nil {
			list[i].Impressions, list[i].Clicks = totals[oid].Impressions, totals[oid].Clicks
		}
	}
	return list
}

// ---------------------------------------------------------------------------------------------
// Recruiter
// ---------------------------------------------------------------------------------------------

func (s *service) Overview(ctx context.Context, userID string) (*Overview, error) {
	if err := s.recruiter(ctx, userID); err != nil {
		return nil, err
	}
	pkgs, err := s.repo.ListPackages(ctx, true)
	if err != nil {
		return nil, err
	}
	list, err := s.repo.ListUserAds(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &Overview{Packages: pkgs, Ads: s.withStats(ctx, list), Placements: ads.Placements, Audiences: ads.Audiences}, nil
}

func (s *service) Save(ctx context.Context, userID, adID string, req SaveRequest) (*Ad, error) {
	if err := s.recruiter(ctx, userID); err != nil {
		return nil, err
	}
	content, err := req.Content.Clean()
	if err != nil {
		return nil, err
	}

	if adID == "" {
		pkg, err := s.sellable(ctx, req.PackageID)
		if err != nil {
			return nil, err
		}
		ad := &Ad{UserID: userID, Content: content}
		copyPackage(ad, pkg)
		if err := s.repo.CreateAd(ctx, ad); err != nil {
			return nil, err
		}
		return ad, nil
	}

	var out *Ad
	alertChange := false
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		ad, err := s.owned(ctx, userID, adID, true)
		if err != nil {
			return err
		}
		switch {
		case ad.Status == StatusUnpaid:
			pkgID := req.PackageID
			if pkgID == "" {
				pkgID = ad.PackageID
			}
			pkg, err := s.sellable(ctx, pkgID)
			if err != nil {
				return err
			}
			copyPackage(ad, pkg)
			ad.Content = content
			if err := s.repo.UpdateUnpaid(ctx, ad); err != nil {
				return err
			}
		case req.PackageID != "" && req.PackageID != ad.PackageID:
			return ErrNoPackageSwap
		case ad.Status == StatusPending:
			// Not reviewed yet: the change simply replaces the ad
			if err := s.repo.UpdateContent(ctx, ad.ID, content); err != nil {
				return err
			}
		case ad.Status == StatusApproved && ad.StateAt(s.now()) == "running":
			// Who sees the ad is part of what was approved and stays as it is
			content.Cities, content.Audiences = ad.Cities, ad.Audiences
			if err := s.repo.SetRevision(ctx, ad.ID, &content); err != nil {
				return err
			}
			alertChange = true
		case ad.Status == StatusApproved:
			return ErrAlreadyEnded
		default:
			return ErrCantEdit
		}
		out, err = s.repo.GetAd(ctx, ad.ID, false)
		return err
	})
	if err != nil {
		return nil, err
	}
	if alertChange {
		go s.alertAdmin(out, true)
	}
	return out, nil
}

func (s *service) Delete(ctx context.Context, userID, adID string) error {
	ad, err := s.owned(ctx, userID, adID, false)
	if err != nil {
		return err
	}
	if ad.Status != StatusUnpaid {
		return ErrCantDelete
	}
	deleted, err := s.repo.DeleteUnpaid(ctx, ad.ID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrCantDelete
	}
	return nil
}

func (s *service) PayWithWallet(ctx context.Context, userID, adID, couponCode string) (*Ad, *wallet.WalletSummaryResponse, *promo.Receipt, error) {
	if err := s.recruiter(ctx, userID); err != nil {
		return nil, nil, nil, err
	}
	var ad *Ad
	var summary *wallet.WalletSummaryResponse
	var receipt *promo.Receipt
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if ad, err = s.owned(ctx, userID, adID, true); err != nil {
			return err
		}
		if ad.Status != StatusUnpaid {
			return ErrNotUnpaid
		}
		pkg, err := s.sellable(ctx, ad.PackageID)
		if err != nil {
			return err
		}
		price, err := s.promo.PriceForWallet(ctx, userID, payment.PurposeRecruiterAd, pkg.PricePaise, couponCode)
		if err != nil {
			return err
		}
		paid, err := s.promo.PayFromWallet(ctx, price, promo.WalletPay{
			Category:    wallet.CategoryRecruiterAd,
			ReferenceID: Ref(ad.ID) + ":pay",
			PurchaseRef: Ref(ad.ID),
			Description: "Ad: " + pkg.Name,
			Metadata:    map[string]interface{}{"recruiter_ad_id": ad.ID, "package_id": pkg.ID, "channel": ChannelWallet},
		})
		if err != nil {
			return err
		}
		copyPackage(ad, pkg)
		ad.Channel = ChannelWallet
		ad.PricePaise, ad.PaidBonusPaise, ad.PaidMainPaise = price.PricePaise, paid.BonusPaise, paid.MainPaise
		ok, err := s.repo.MarkPaid(ctx, ad)
		if err != nil {
			return err
		}
		if !ok {
			return ErrNotUnpaid
		}
		summary, receipt = paid.Summary, promo.ReceiptOf(price, paid)
		ad, err = s.repo.GetAd(ctx, ad.ID, false)
		return err
	})
	if err != nil {
		return nil, nil, nil, err
	}
	go s.alertAdmin(ad, false)
	return ad, summary, receipt, nil
}

func (s *service) CreateOrder(ctx context.Context, userID, adID, couponCode string) (*CheckoutResponse, error) {
	if err := s.recruiter(ctx, userID); err != nil {
		return nil, err
	}
	ad, err := s.owned(ctx, userID, adID, false)
	if err != nil {
		return nil, err
	}
	if ad.Status != StatusUnpaid {
		return nil, ErrNotUnpaid
	}
	pkg, err := s.sellable(ctx, ad.PackageID)
	if err != nil {
		return nil, err
	}
	uid, _ := primitive.ObjectIDFromHex(userID)
	checkout, _, err := s.promo.CheckoutOnline(ctx, userID, payment.PurposeRecruiterAd, pkg.PricePaise, couponCode,
		func(pricePaise int64, coupon map[string]string) (*payment.Checkout, error) {
			// The order carries the package as it is now, so the ad gets what was paid for even if
			// the admin or the recruiter changes the package before the payment lands
			slots, _ := json.Marshal(pkg.Placements)
			details := map[string]string{
				"package_id": pkg.ID, "package_name": pkg.Name, "days": strconv.Itoa(pkg.Days), "placements": string(slots),
			}
			for k, v := range coupon {
				details[k] = v
			}
			checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
				UserID:      uid,
				Purpose:     payment.PurposeRecruiterAd,
				AmountPaise: pricePaise,
				TargetID:    ad.ID,
				Details:     details,
				Description: "Ad: " + pkg.Name,
			})
			return checkout, err
		})
	if err != nil {
		return nil, err
	}
	return &CheckoutResponse{KeyID: checkout.KeyID, OrderID: checkout.OrderID, Amount: checkout.Amount, AmountPaise: checkout.AmountPaise}, nil
}

// fulfill marks an ad paid online. Runs in the payment's transaction. An ad that was deleted or
// already paid gets its payment refunded.
func (s *service) fulfill(ctx context.Context, order *payment.Order) error {
	ad, err := s.repo.GetAd(ctx, order.TargetID, true)
	if err != nil {
		return err
	}
	if ad == nil || ad.UserID != order.UserID.Hex() {
		return payment.Unfulfillable("This ad was deleted")
	}
	if ad.Status != StatusUnpaid {
		return payment.Unfulfillable("This ad was already paid for")
	}
	pkg, err := packageOfOrder(order)
	if err != nil {
		return err
	}
	copyPackage(ad, pkg)
	ad.Channel = ChannelOnline
	ad.PricePaise, ad.PaidOnlinePaise, ad.RazorpayOrderID = order.AmountPaise, order.AmountPaise, order.RazorpayOrderID
	ok, err := s.repo.MarkPaid(ctx, ad)
	if err != nil {
		return err
	}
	if !ok {
		return payment.Unfulfillable("This ad was already paid for")
	}
	return s.promo.RedeemOrder(ctx, order, Ref(ad.ID))
}

// packageOfOrder is the package as it was when the checkout opened
func packageOfOrder(order *payment.Order) (*Package, error) {
	d := order.Details
	days, err := strconv.Atoi(d["days"])
	if err != nil || days < 1 || d["package_id"] == "" || d["package_name"] == "" {
		return nil, fmt.Errorf("adsales: order %s has no package", order.RazorpayOrderID)
	}
	var slots []string
	if err := json.Unmarshal([]byte(d["placements"]), &slots); err != nil || len(slots) == 0 {
		return nil, fmt.Errorf("adsales: order %s has no slots", order.RazorpayOrderID)
	}
	return &Package{ID: d["package_id"], Name: d["package_name"], Days: days, Placements: slots}, nil
}

func (s *service) afterPaid(order *payment.Order) {
	ad, err := s.repo.GetAd(context.Background(), order.TargetID, false)
	if err == nil && ad != nil && ad.Status == StatusPending {
		s.alertAdmin(ad, false)
	}
}

func (s *service) VerifyPayment(ctx context.Context, userID string, in payment.ConfirmInput) (*Ad, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrRecruitersOnly
	}
	order, err := s.payments.Confirm(ctx, uid, payment.PurposeRecruiterAd, in)
	if err != nil {
		return nil, err
	}
	ad, err := s.owned(ctx, userID, order.TargetID, false)
	if err != nil {
		return nil, err
	}
	if ad.Status == StatusUnpaid {
		return nil, payment.ErrNotComplete
	}
	return ad, nil
}

// revokeWalletAd stops an ad whose wallet payment an admin refunds in full from a dispute
func (s *service) revokeWalletAd(ctx context.Context, purchase *wallet.WalletTransaction) error {
	id, _ := purchase.Metadata["recruiter_ad_id"].(string)
	ad, err := s.repo.GetAd(ctx, id, true)
	if err != nil {
		return err
	}
	if ad == nil {
		return ErrAdNotFound
	}
	if err := s.repo.MarkRefunded(ctx, ad.ID); err != nil {
		return err
	}
	if err := s.promo.Reverse(ctx, Ref(ad.ID)); err != nil {
		return err
	}
	if oid, err := primitive.ObjectIDFromHex(ad.CampaignID); err == nil {
		return s.ads.SetStatus(ctx, oid, ads.StatusPaused)
	}
	return nil
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

func (s *service) AdminPackages(ctx context.Context) ([]Package, error) {
	return s.repo.ListPackages(ctx, false)
}

func packageFromInput(in PackageInput) (*Package, error) {
	p := &Package{
		Name: strings.TrimSpace(in.Name), Description: strings.TrimSpace(in.Description), Days: in.Days,
		PricePaise: money.ToPaise(in.Price), Placements: cleanList(in.Placements), SortOrder: in.SortOrder, IsActive: in.IsActive,
	}
	switch {
	case p.Name == "" || runes(p.Name) > 60:
		return nil, ErrPackageName
	case runes(p.Description) > 300:
		return nil, ErrPackageDesc
	case p.Days < 1 || p.Days > 366:
		return nil, ErrPackageDays
	case math.IsNaN(in.Price) || p.PricePaise < 100 || p.PricePaise > maxPricePaise:
		return nil, ErrPackagePrice
	case len(p.Placements) == 0:
		return nil, ErrPackageSlots
	}
	for _, id := range p.Placements {
		if !validPlacement(id) {
			return nil, ErrPackageSlots
		}
	}
	return p, nil
}

func (s *service) CreatePackage(ctx context.Context, in PackageInput) (*Package, error) {
	p, err := packageFromInput(in)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreatePackage(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *service) UpdatePackage(ctx context.Context, id string, in PackageInput) (*Package, error) {
	if !primitive.IsValidObjectID(id) {
		return nil, ErrPackageNotFound
	}
	p, err := packageFromInput(in)
	if err != nil {
		return nil, err
	}
	p.ID = id
	if err := s.repo.UpdatePackage(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *service) AdminAds(ctx context.Context, q AdminQuery) (*AdminPage, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit < 1 || q.Limit > 100 {
		q.Limit = 20
	}
	list, total, err := s.repo.ListAds(ctx, q)
	if err != nil {
		return nil, err
	}
	list = s.withStats(ctx, list)
	ids := []primitive.ObjectID{}
	for _, a := range list {
		if oid, err := primitive.ObjectIDFromHex(a.UserID); err == nil {
			ids = append(ids, oid)
		}
	}
	if len(ids) > 0 {
		people, err := s.users.FindUsersByIDs(ctx, ids)
		if err == nil {
			for i := range list {
				if u := people[database.OID(list[i].UserID)]; u != nil {
					list[i].UserName, list[i].UserEmail = displayName(u), u.Email
				}
			}
		}
	}
	pages := int((total + int64(q.Limit) - 1) / int64(q.Limit))
	if pages < 1 {
		pages = 1
	}
	return &AdminPage{Ads: list, Total: total, Page: q.Page, TotalPages: pages}, nil
}

func displayName(u *user.User) string {
	if name := strings.TrimSpace(u.FirstName + " " + u.LastName); name != "" {
		return name
	}
	return strings.TrimSpace(u.Name)
}

func (s *service) Approve(ctx context.Context, adID, adminID string) (*Ad, error) {
	if !primitive.IsValidObjectID(adID) {
		return nil, ErrAdNotFound
	}
	campaignID := primitive.NewObjectID()
	started := false
	var ad *Ad
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if ad, err = s.repo.GetAd(ctx, adID, true); err != nil {
			return err
		}
		if ad == nil {
			return ErrAdNotFound
		}
		if ad.Status != StatusPending {
			return ErrState
		}
		// MongoDB keeps milliseconds, so the dates stored here and on the campaign agree
		start := s.now().Truncate(time.Millisecond)
		end := start.Add(time.Duration(ad.Days) * 24 * time.Hour)
		if err := s.repo.Approve(ctx, ad.ID, campaignID.Hex(), adminID, start, end); err != nil {
			return err
		}
		// Last, so a failure here undoes the approval; the campaign is removed again if the
		// approval doesn't commit
		started = true
		return s.ads.RunPaid(ctx, &ads.Campaign{
			ID:            campaignID,
			Name:          "Recruiter ad: " + ad.Advertiser + " (" + ad.PackageName + ")",
			Advertiser:    ad.Advertiser,
			Headline:      ad.Headline,
			Body:          ad.Body,
			CTALabel:      ad.CTALabel,
			CreativeURL:   ad.ImageURL,
			LinkURL:       ad.LinkURL,
			Placements:    ad.Placements,
			Cities:        ad.Cities,
			Audiences:     ad.Audiences,
			StartAt:       start,
			EndAt:         &end,
			FreqCap:       DefaultFreqCap,
			RecruiterAdID: ad.ID,
			OwnerID:       ad.UserID,
		})
	})
	if err != nil {
		if started {
			if rmErr := s.ads.Remove(context.Background(), campaignID); rmErr != nil {
				log.Printf("[adsales] approval of %s failed and campaign %s couldn't be removed: %v", adID, campaignID.Hex(), rmErr)
			}
		}
		return nil, err
	}
	ad, err = s.repo.GetAd(ctx, adID, false)
	if err != nil {
		return nil, err
	}
	go s.notifyRecruiter(ad, "Your ad is live",
		fmt.Sprintf("Your ad \"%s\" was approved and runs until %s.", ad.Headline, ad.EndsAt.In(ist).Format("2 Jan 2006")))
	return ad, nil
}

var ist = time.FixedZone("IST", 5*60*60+30*60)

func cleanReason(reason string) (string, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" || runes(reason) > maxReason {
		return "", ErrReason
	}
	return reason, nil
}

func (s *service) Reject(ctx context.Context, adID, adminID, reason string) (*Ad, error) {
	reason, err := cleanReason(reason)
	if err != nil {
		return nil, err
	}
	if !primitive.IsValidObjectID(adID) {
		return nil, ErrAdNotFound
	}
	var ad *Ad
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if ad, err = s.repo.GetAd(ctx, adID, true); err != nil {
			return err
		}
		if ad == nil {
			return ErrAdNotFound
		}
		if ad.Status != StatusPending {
			return ErrState
		}
		uid := database.OID(ad.UserID)
		meta := map[string]interface{}{"recruiter_ad_id": ad.ID}
		// Bonus credit goes back as bonus credit, so it never becomes money that can be withdrawn
		if ad.PaidBonusPaise > 0 {
			if _, _, err := s.wallet.RecordTransaction(ctx, wallet.RecordTransactionInput{
				UserID: uid, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceBonus, Category: wallet.CategoryRefund,
				Amount: money.ToRupees(ad.PaidBonusPaise), ReferenceID: Ref(ad.ID) + ":refund_bonus",
				Description: "Bonus credit back for a rejected ad", Metadata: meta,
			}); err != nil {
				return err
			}
		}
		if main := ad.PaidMainPaise + ad.PaidOnlinePaise; main > 0 {
			if _, _, err := s.wallet.RecordTransaction(ctx, wallet.RecordTransactionInput{
				UserID: uid, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceMain, Category: wallet.CategoryRefund,
				Amount: money.ToRupees(main), ReferenceID: Ref(ad.ID) + ":refund",
				Description: "Refund for a rejected ad", Metadata: meta,
			}); err != nil {
				return err
			}
		}
		// Gives the coupon use back and takes back its cashback, from the refund if it was spent
		if err := s.promo.ReverseFromRefund(ctx, Ref(ad.ID)); err != nil {
			return err
		}
		return s.repo.Reject(ctx, ad.ID, adminID, reason, ad.PricePaise)
	})
	if err != nil {
		return nil, err
	}
	ad, err = s.repo.GetAd(ctx, adID, false)
	if err != nil {
		return nil, err
	}
	msg := fmt.Sprintf("Your ad \"%s\" wasn't approved: %s", ad.Headline, reason)
	if ad.PricePaise > 0 {
		msg += fmt.Sprintf(" %s is back in your KaamMilega wallet.", money.INR(ad.PricePaise))
	}
	go s.notifyRecruiter(ad, "Ad not approved", msg)
	return ad, nil
}

func (s *service) ApproveChange(ctx context.Context, adID, adminID string) (*Ad, error) {
	if !primitive.IsValidObjectID(adID) {
		return nil, ErrAdNotFound
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		ad, err := s.repo.GetAd(ctx, adID, true)
		if err != nil {
			return err
		}
		if ad == nil {
			return ErrAdNotFound
		}
		if ad.Status != StatusApproved || ad.Revision == nil {
			return ErrNoRevision
		}
		if err := s.repo.ApplyRevision(ctx, ad.ID, *ad.Revision); err != nil {
			return err
		}
		// Last, so a failure here keeps the change waiting
		return s.ads.SetCreative(ctx, database.OID(ad.CampaignID), ad.Revision.Creative())
	})
	if err != nil {
		return nil, err
	}
	ad, err := s.repo.GetAd(ctx, adID, false)
	if err != nil {
		return nil, err
	}
	go s.notifyRecruiter(ad, "Ad change approved", fmt.Sprintf("Your change to the ad \"%s\" is now live.", ad.Headline))
	return ad, nil
}

func (s *service) RejectChange(ctx context.Context, adID, adminID, reason string) (*Ad, error) {
	reason, err := cleanReason(reason)
	if err != nil {
		return nil, err
	}
	if !primitive.IsValidObjectID(adID) {
		return nil, ErrAdNotFound
	}
	if err := s.repo.RejectRevision(ctx, adID, reason); err != nil {
		return nil, err
	}
	ad, err := s.repo.GetAd(ctx, adID, false)
	if err != nil {
		return nil, err
	}
	go s.notifyRecruiter(ad, "Ad change not approved",
		fmt.Sprintf("Your change to the ad \"%s\" wasn't approved: %s The ad keeps running as it was.", ad.Headline, reason))
	return ad, nil
}

// ---------------------------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------------------------

func (s *service) notifyRecruiter(ad *Ad, title, message string) {
	if s.notify == nil || ad == nil {
		return
	}
	_, err := s.notify.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID:   database.OID(ad.UserID),
		Type:     notification.TypeRecruiterAd,
		Category: notification.CategorySystem,
		Title:    title,
		Message:  message,
		Link:     "/recruiter/ads",
		Metadata: map[string]interface{}{"recruiter_ad_id": ad.ID},
	})
	if err != nil {
		log.Printf("[adsales] notification for ad %s: %v", ad.ID, err)
	}
}

// alertAdmin emails the admin inbox that an ad, or a change to one, is waiting
func (s *service) alertAdmin(ad *Ad, change bool) {
	if s.mailer == nil || s.cfg == nil || s.cfg.SMTPFromEmail == "" || ad == nil {
		return
	}
	who := ad.Advertiser
	if u, err := s.users.FindUserByID(context.Background(), ad.UserID); err == nil && u != nil {
		who = strings.TrimSpace(displayName(u) + " (" + ad.Advertiser + ")")
	}
	subject := "New recruiter ad to review: " + ad.Advertiser
	what := fmt.Sprintf("paid %s for the %s package and sent an ad", money.INR(ad.PricePaise), html.EscapeString(ad.PackageName))
	if change {
		subject = "Recruiter ad change to review: " + ad.Advertiser
		what = "changed their running ad"
	}
	body := fmt.Sprintf(`<p>%s %s: <strong>%s</strong>.</p>
<p>Please approve or reject it in the admin panel under Ads &gt; Recruiter ads.</p>`,
		html.EscapeString(who), what, html.EscapeString(ad.Headline))
	if err := s.mailer.SendRaw(s.cfg.SMTPFromEmail, subject, body); err != nil {
		log.Printf("[adsales] ad %s: admin email failed: %v", ad.ID, err)
	}
}
