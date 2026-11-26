package promo

import (
	"context"
	"errors"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/money"
	"km-backend/internal/database"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Pricer gives the list price of what a purpose sells, before any coupon. targetID names the
// item when a purpose sells more than one (a recruiter plan's id).
type Pricer func(ctx context.Context, userID, targetID string) (int64, error)

// WalletPay is how a wallet purchase appears in the ledger.
type WalletPay struct {
	Category    wallet.TransactionCategory
	ReferenceID string // the ledger reference for the payment
	PurchaseRef string // what was bought, such as "pass:<id>"; refunds find the coupon use by it
	Description string
	Metadata    map[string]interface{}
}

// WalletPaid is how a wallet purchase was paid.
type WalletPaid struct {
	*wallet.SpendResult
	CashbackPaise int64
}

// Service runs coupons for the features that sell things.
type Service interface {
	// RegisterPricer lets the quote endpoint price a purpose. Call it at startup.
	RegisterPricer(purpose payment.Purpose, fn Pricer)
	// Quote prices a purchase for the checkout screen. It holds nothing.
	Quote(ctx context.Context, userID string, req QuoteRequest) (*Quote, error)

	// PriceForWallet checks the code and works out the price of a wallet purchase. It must run in
	// the purchase's transaction: the coupon stays locked until that commits.
	PriceForWallet(ctx context.Context, userID string, purpose payment.Purpose, listPaise int64, code string) (*Applied, error)
	// PayFromWallet charges a price from PriceForWallet (bonus credit first), records the coupon
	// use and credits any cashback. It runs in the same transaction.
	PayFromWallet(ctx context.Context, a *Applied, pay WalletPay) (*WalletPaid, error)

	// CheckoutOnline holds the coupon, then opens the payment with makeOrder at the coupon price.
	// The hold is given up if the order can't be made. A zero price can't be paid online.
	CheckoutOnline(ctx context.Context, userID string, purpose payment.Purpose, listPaise int64, code string,
		makeOrder func(pricePaise int64, details map[string]string) (*payment.Checkout, error)) (*payment.Checkout, *Applied, error)
	// RedeemOrder turns an online checkout's hold into a use, crediting any cashback. Call it from
	// the purpose's Fulfill handler, in its transaction.
	RedeemOrder(ctx context.Context, order *payment.Order, purchaseRef string) error
	// Reverse gives back the coupon use of a purchase being refunded in full, and takes back its
	// cashback. Call it from the refund (Revoke) handler, in its transaction.
	Reverse(ctx context.Context, purchaseRef string) error
	// ReverseFromRefund is Reverse for a refund that was just credited to the wallet: cashback the
	// member already spent is taken from the main balance instead, so the refund is net of it.
	ReverseFromRefund(ctx context.Context, purchaseRef string) (takenPaise int64, err error)

	AdminCoupons(ctx context.Context) ([]CouponStats, error)
	CreateCoupon(ctx context.Context, adminID string, in CouponInput) (*Coupon, error)
	UpdateCoupon(ctx context.Context, id string, in CouponInput) (*Coupon, error)
	AdminRedemptions(ctx context.Context, couponID string, page, limit int) (*RedemptionPage, error)
}

// Users names the customers in the admin list (user.UserRepository)
type Users interface {
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}

type service struct {
	repo   Repository
	tx     database.Transactor
	wallet wallet.WalletService
	users  Users
	now    func() time.Time

	mu      sync.RWMutex
	pricers map[payment.Purpose]Pricer
}

func NewService(repo Repository, tx database.Transactor, walletService wallet.WalletService, users user.UserRepository) Service {
	return newService(repo, tx, walletService, users)
}

func newService(repo Repository, tx database.Transactor, walletService wallet.WalletService, users Users) *service {
	return &service{repo: repo, tx: tx, wallet: walletService, users: users, now: time.Now, pricers: map[payment.Purpose]Pricer{}}
}

func (s *service) RegisterPricer(purpose payment.Purpose, fn Pricer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pricers[purpose] = fn
}

func (s *service) pricer(purpose payment.Purpose) (Pricer, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	fn, ok := s.pricers[purpose]
	return fn, ok
}

// NormalizeCode is a code as stored: trimmed and in capitals.
func NormalizeCode(code string) string { return strings.ToUpper(strings.TrimSpace(code)) }

// benefit is what a coupon is worth on an amount: never more than its cap or the amount itself.
func benefit(c *Coupon, basePaise int64) int64 {
	var v int64
	switch c.ValueType {
	case ValueFlat:
		if c.AmountPaise != nil {
			v = *c.AmountPaise
		}
	case ValuePercent:
		if c.Percent != nil {
			v = basePaise * int64(*c.Percent) / 100
		}
	}
	if c.MaxBenefitPaise != nil && v > *c.MaxBenefitPaise {
		v = *c.MaxBenefitPaise
	}
	return min(max(v, 0), basePaise)
}

// applyTo works out the price of a purchase with the coupon (nil for none).
func applyTo(c *Coupon, userID string, purpose payment.Purpose, listPaise int64) *Applied {
	a := &Applied{UserID: userID, Purpose: purpose, ListPaise: listPaise, PricePaise: listPaise, coupon: c}
	if c == nil || c.Kind != KindDiscount {
		return a
	}
	a.DiscountPaise = benefit(c, listPaise)
	a.PricePaise = listPaise - a.DiscountPaise
	// An online payment can't be below ₹1, so a price is free or at least ₹1
	if a.PricePaise > 0 && a.PricePaise < MinChargePaise && listPaise >= MinChargePaise {
		a.PricePaise = MinChargePaise
		a.DiscountPaise = listPaise - MinChargePaise
	}
	return a
}

func appliesTo(c *Coupon, purpose payment.Purpose) bool {
	for _, p := range c.AppliesTo {
		if p == string(purpose) {
			return true
		}
	}
	return false
}

// check says whether the customer can use the coupon on this purchase now. Their own unpaid
// holds don't count against them: a new checkout replaces them.
func (s *service) check(ctx context.Context, c *Coupon, userID string, purpose payment.Purpose, listPaise int64) error {
	now := s.now()
	switch {
	case c == nil || !c.IsActive:
		return ErrInvalid
	case c.StartsAt != nil && now.Before(*c.StartsAt):
		return ErrNotStarted
	case c.EndsAt != nil && !now.Before(*c.EndsAt):
		return ErrExpired
	case !appliesTo(c, purpose):
		return ErrNotApplicable
	case listPaise < c.MinOrderPaise:
		return ErrMinOrder
	}
	if c.TotalLimit != nil {
		n, err := s.repo.CountLive(ctx, c.ID, "", userID, now)
		if err != nil {
			return err
		}
		if n >= *c.TotalLimit {
			return ErrUsedUp
		}
	}
	if c.PerUserLimit != nil {
		n, err := s.repo.CountLive(ctx, c.ID, userID, userID, now)
		if err != nil {
			return err
		}
		if n >= *c.PerUserLimit {
			return ErrAlreadyUsed
		}
	}
	return nil
}

// lockAndCheck finds the coupon for a code, locks it, checks it, and gives up the customer's
// earlier unpaid holds on it. It runs in a transaction. An empty code is no coupon.
func (s *service) lockAndCheck(ctx context.Context, userID string, purpose payment.Purpose, listPaise int64, code string) (*Coupon, error) {
	code = NormalizeCode(code)
	if code == "" {
		return nil, nil
	}
	if !codePattern.MatchString(code) {
		return nil, ErrInvalid
	}
	c, err := s.repo.LockCouponByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if err := s.check(ctx, c, userID, purpose, listPaise); err != nil {
		return nil, err
	}
	if err := s.repo.ReleaseHolds(ctx, c.ID, userID); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *service) Quote(ctx context.Context, userID string, req QuoteRequest) (*Quote, error) {
	purpose := payment.Purpose(req.Purpose)
	price, ok := s.pricer(purpose)
	if !ok {
		return nil, ErrNothingToSell
	}
	listPaise, err := price(ctx, userID, req.TargetID)
	if err != nil {
		return nil, err
	}

	var c *Coupon
	if code := NormalizeCode(req.Code); code != "" {
		if !codePattern.MatchString(code) {
			return nil, ErrInvalid
		}
		// Read without locking: a quote holds nothing
		if c, err = s.repo.GetCouponByCode(ctx, code); err != nil {
			return nil, err
		}
		if err := s.check(ctx, c, userID, purpose, listPaise); err != nil {
			return nil, err
		}
	}
	a := applyTo(c, userID, purpose, listPaise)

	q := &Quote{
		ListPrice:      money.ToRupees(a.ListPaise),
		Discount:       money.ToRupees(a.DiscountPaise),
		Price:          money.ToRupees(a.PricePaise),
		PricePaise:     a.PricePaise,
		Free:           a.PricePaise == 0,
		OnlineCashback: money.ToRupees(a.CashbackOn(a.PricePaise)),
	}
	if c != nil {
		q.Code, q.Kind, q.Description = c.Code, c.Kind, c.Description
	}

	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrInvalid
	}
	summary, err := s.wallet.GetWalletSummary(ctx, uid.Hex())
	if err != nil {
		return nil, err
	}
	fromBonus, fromMain, enough := wallet.SpendSplit(a.PricePaise, money.ToPaise(summary.BonusBalance), money.ToPaise(summary.MainBalance))
	q.Wallet = WalletQuote{
		FromBonus: money.ToRupees(fromBonus),
		FromMain:  money.ToRupees(fromMain),
		Cashback:  money.ToRupees(a.CashbackOn(fromMain)),
		Enough:    enough,
	}
	return q, nil
}

func (s *service) PriceForWallet(ctx context.Context, userID string, purpose payment.Purpose, listPaise int64, code string) (*Applied, error) {
	if !database.InPgTx(ctx) {
		return nil, errors.New("promo: PriceForWallet must run in the purchase's transaction")
	}
	c, err := s.lockAndCheck(ctx, userID, purpose, listPaise, code)
	if err != nil {
		return nil, err
	}
	return applyTo(c, userID, purpose, listPaise), nil
}

func (s *service) PayFromWallet(ctx context.Context, a *Applied, pay WalletPay) (*WalletPaid, error) {
	if !database.InPgTx(ctx) {
		return nil, errors.New("promo: PayFromWallet must run in the purchase's transaction")
	}
	uid, err := primitive.ObjectIDFromHex(a.UserID)
	if err != nil {
		return nil, errors.New("promo: invalid user id")
	}
	meta := map[string]interface{}{}
	for k, v := range pay.Metadata {
		meta[k] = v
	}
	if a.coupon != nil {
		meta["coupon"] = a.coupon.Code
		if a.DiscountPaise > 0 {
			meta["list_paise"] = a.ListPaise
			meta["discount_paise"] = a.DiscountPaise
		}
	}
	spent, err := s.wallet.Spend(ctx, wallet.SpendInput{
		UserID:      uid,
		Category:    pay.Category,
		AmountPaise: a.PricePaise,
		ReferenceID: pay.ReferenceID,
		Description: pay.Description,
		Metadata:    meta,
	})
	if err != nil {
		return nil, err
	}
	paid := &WalletPaid{SpendResult: spent}
	if a.coupon == nil {
		return paid, nil
	}

	now := s.now()
	use := &Redemption{
		CouponID: a.coupon.ID, UserID: a.UserID, Purpose: string(a.Purpose), Channel: ChannelWallet,
		Status: StatusRedeemed, ListPaise: a.ListPaise, DiscountPaise: a.DiscountPaise,
		CashbackPaise: a.CashbackOn(spent.MainPaise), PurchaseRef: pay.PurchaseRef, RedeemedAt: &now,
	}
	if err := s.repo.CreateRedemption(ctx, use); err != nil {
		return nil, err
	}
	if err := s.creditCashback(ctx, uid, use); err != nil {
		return nil, err
	}
	paid.CashbackPaise = use.CashbackPaise
	return paid, nil
}

func (s *service) CheckoutOnline(ctx context.Context, userID string, purpose payment.Purpose, listPaise int64, code string,
	makeOrder func(pricePaise int64, details map[string]string) (*payment.Checkout, error)) (*payment.Checkout, *Applied, error) {

	var a *Applied
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		c, err := s.lockAndCheck(ctx, userID, purpose, listPaise, code)
		if err != nil {
			return err
		}
		a = applyTo(c, userID, purpose, listPaise)
		if a.PricePaise == 0 {
			return ErrOrderFree
		}
		if c == nil {
			return nil
		}
		until := s.now().Add(payment.OrderLifetime)
		hold := &Redemption{
			CouponID: c.ID, UserID: userID, Purpose: string(purpose), Channel: ChannelOnline,
			Status: StatusReserved, ListPaise: listPaise, DiscountPaise: a.DiscountPaise,
			CashbackPaise: a.CashbackOn(a.PricePaise), ReservedUntil: &until,
		}
		if err := s.repo.CreateRedemption(ctx, hold); err != nil {
			return err
		}
		a.RedemptionID = hold.ID
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	// The payment provider is called outside any transaction
	var details map[string]string
	if a.RedemptionID != "" {
		details = map[string]string{DetailKey: a.RedemptionID}
	}
	checkout, err := makeOrder(a.PricePaise, details)
	if err == nil && a.RedemptionID != "" {
		err = s.repo.AttachOrder(ctx, a.RedemptionID, checkout.OrderID)
	}
	if err != nil {
		if a.RedemptionID != "" {
			if _, relErr := s.repo.SetStatus(context.WithoutCancel(ctx), a.RedemptionID, []string{StatusReserved}, StatusReleased, "", 0, s.now()); relErr != nil {
				log.Printf("[promo] releasing hold %s: %v", a.RedemptionID, relErr)
			}
		}
		return nil, nil, err
	}
	return checkout, a, nil
}

func (s *service) RedeemOrder(ctx context.Context, order *payment.Order, purchaseRef string) error {
	id := order.Details[DetailKey]
	if id == "" {
		return nil
	}
	use, err := s.repo.GetRedemption(ctx, id)
	if err != nil {
		return err
	}
	// The customer paid the price on the order, so the purchase is delivered whatever happened
	// to the hold, and a discount already in that price stands.
	if use == nil || use.RazorpayOrderID != order.RazorpayOrderID {
		log.Printf("[promo] order %s: coupon use %s doesn't match, delivering without it", order.RazorpayOrderID, id)
		return nil
	}
	// Cashback is paid only on a hold that was still live. A hold given up for a newer checkout
	// gets none, or opening several checkouts and paying them all would beat the coupon's limits.
	if use.Status != StatusReserved {
		use.CashbackPaise = 0
	}
	moved, err := s.repo.SetStatus(ctx, id, []string{StatusReserved, StatusReleased}, StatusRedeemed, purchaseRef, use.CashbackPaise, s.now())
	if err != nil || !moved {
		return err
	}
	use.PurchaseRef = purchaseRef
	return s.creditCashback(ctx, order.UserID, use)
}

func (s *service) creditCashback(ctx context.Context, userID primitive.ObjectID, use *Redemption) error {
	if use.CashbackPaise <= 0 {
		return nil
	}
	_, _, err := s.wallet.RecordTransaction(ctx, wallet.RecordTransactionInput{
		UserID:        userID,
		Type:          wallet.TypeCredit,
		TargetBalance: wallet.BalanceBonus,
		Category:      wallet.CategoryCashback,
		Amount:        money.ToRupees(use.CashbackPaise),
		ReferenceID:   "coupon:" + use.ID + ":cashback",
		Description:   "Cashback from a coupon",
		Metadata:      map[string]interface{}{"coupon_redemption_id": use.ID, "purchase_ref": use.PurchaseRef},
	})
	return err
}

func (s *service) Reverse(ctx context.Context, purchaseRef string) error {
	return s.reverse(ctx, purchaseRef, false)
}

func (s *service) ReverseFromRefund(ctx context.Context, purchaseRef string) (int64, error) {
	return s.reverseTaken(ctx, purchaseRef, true)
}

func (s *service) reverse(ctx context.Context, purchaseRef string, mainIfSpent bool) error {
	_, err := s.reverseTaken(ctx, purchaseRef, mainIfSpent)
	return err
}

// reverseTaken gives the coupon use back and takes back its cashback from the bonus balance. With
// mainIfSpent, cashback already spent is taken from main: what bonus is left first, then only the
// rest from main. It returns how much was taken back.
func (s *service) reverseTaken(ctx context.Context, purchaseRef string, mainIfSpent bool) (int64, error) {
	use, err := s.repo.GetRedemptionByPurchase(ctx, purchaseRef)
	if err != nil || use == nil || use.Status != StatusRedeemed {
		return 0, err
	}
	if use.CashbackPaise > 0 {
		fromBonus := use.CashbackPaise
		if mainIfSpent {
			sum, err := s.wallet.GetWalletSummary(ctx, use.UserID)
			if err != nil {
				return 0, err
			}
			if left := money.ToPaise(sum.BonusBalance); left < fromBonus {
				fromBonus = max(left, 0)
			}
		}
		in := wallet.RecordTransactionInput{
			UserID:      database.OID(use.UserID),
			Type:        wallet.TypeDebit,
			Category:    wallet.CategoryCashback,
			Description: "Cashback taken back with a refund",
			Metadata:    map[string]interface{}{"coupon_redemption_id": use.ID, "purchase_ref": use.PurchaseRef},
		}
		if fromBonus > 0 {
			in.TargetBalance, in.Amount = wallet.BalanceBonus, money.ToRupees(fromBonus)
			in.ReferenceID = "coupon:" + use.ID + ":cashback_reversal"
			if _, _, err := s.wallet.RecordTransaction(ctx, in); errors.Is(err, wallet.ErrInsufficient) {
				return 0, ErrCashbackSpent
			} else if err != nil {
				return 0, err
			}
		}
		if rest := use.CashbackPaise - fromBonus; rest > 0 {
			in.TargetBalance, in.Amount = wallet.BalanceMain, money.ToRupees(rest)
			in.ReferenceID = "coupon:" + use.ID + ":cashback_reversal:main"
			in.Description = "Spent cashback taken from your refund"
			if _, _, err := s.wallet.RecordTransaction(ctx, in); errors.Is(err, wallet.ErrInsufficient) {
				return 0, ErrCashbackSpent
			} else if err != nil {
				return 0, err
			}
		}
	}
	if _, err := s.repo.SetStatus(ctx, use.ID, []string{StatusRedeemed}, StatusReversed, "", 0, s.now()); err != nil {
		return 0, err
	}
	return use.CashbackPaise, nil
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

var codePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{2,23}$`)

func validID(id string) bool { return primitive.IsValidObjectID(id) }

func positiveLimit(n *int) error {
	if n != nil && *n < 1 {
		return ErrLimitInvalid
	}
	return nil
}

// toCoupon checks the admin's input and turns it into a coupon (without id or code)
func toCoupon(in CouponInput) (*Coupon, error) {
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > 200 {
		return nil, ErrDescriptionTooLong
	}
	if (in.Kind != KindDiscount && in.Kind != KindCashback) || (in.ValueType != ValueFlat && in.ValueType != ValuePercent) {
		return nil, ErrKindInvalid
	}
	c := &Coupon{Description: desc, Kind: in.Kind, ValueType: in.ValueType, IsActive: in.IsActive}

	switch in.ValueType {
	case ValueFlat:
		if in.Amount == nil {
			return nil, ErrValueInvalid
		}
		p := money.ToPaise(*in.Amount)
		if p <= 0 {
			return nil, ErrValueInvalid
		}
		c.AmountPaise = &p
	case ValuePercent:
		if in.Percent == nil || *in.Percent < 1 || *in.Percent > 100 {
			return nil, ErrValueInvalid
		}
		pct := *in.Percent
		c.Percent = &pct
		if in.MaxBenefit != nil {
			p := money.ToPaise(*in.MaxBenefit)
			if p <= 0 {
				return nil, ErrCapInvalid
			}
			c.MaxBenefitPaise = &p
		}
	}

	if in.MinOrder < 0 {
		return nil, ErrMinOrderInvalid
	}
	c.MinOrderPaise = money.ToPaise(in.MinOrder)

	seen := map[string]bool{}
	for _, p := range in.AppliesTo {
		ok := false
		for _, known := range Purposes {
			if p == string(known) {
				ok = true
			}
		}
		if !ok {
			return nil, ErrAppliesToInvalid
		}
		if !seen[p] {
			seen[p] = true
			c.AppliesTo = append(c.AppliesTo, p)
		}
	}
	if len(c.AppliesTo) == 0 {
		return nil, ErrAppliesToInvalid
	}

	if in.StartsAt != nil && in.EndsAt != nil && !in.EndsAt.After(*in.StartsAt) {
		return nil, ErrDatesInvalid
	}
	c.StartsAt, c.EndsAt = truncate(in.StartsAt), truncate(in.EndsAt)

	if err := positiveLimit(in.TotalLimit); err != nil {
		return nil, err
	}
	if err := positiveLimit(in.PerUserLimit); err != nil {
		return nil, err
	}
	c.TotalLimit, c.PerUserLimit = in.TotalLimit, in.PerUserLimit
	return c, nil
}

// truncate keeps what Postgres stores (microseconds), so a saved coupon reads back the same
func truncate(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	v := t.Truncate(time.Microsecond)
	return &v
}

func (s *service) AdminCoupons(ctx context.Context) ([]CouponStats, error) {
	return s.repo.ListCoupons(ctx)
}

func (s *service) CreateCoupon(ctx context.Context, adminID string, in CouponInput) (*Coupon, error) {
	code := NormalizeCode(in.Code)
	if !codePattern.MatchString(code) {
		return nil, ErrCodeInvalid
	}
	if !validID(adminID) {
		return nil, errors.New("promo: invalid admin id")
	}
	c, err := toCoupon(in)
	if err != nil {
		return nil, err
	}
	c.Code, c.CreatedBy = code, adminID
	if err := s.repo.CreateCoupon(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *service) UpdateCoupon(ctx context.Context, id string, in CouponInput) (*Coupon, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	c, err := toCoupon(in)
	if err != nil {
		return nil, err
	}
	c.ID = id
	// Changes apply to future uses; past ones keep the amounts they were given
	if err := s.repo.UpdateCoupon(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *service) AdminRedemptions(ctx context.Context, couponID string, page, limit int) (*RedemptionPage, error) {
	if couponID != "" && !validID(couponID) {
		return nil, ErrNotFound
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	items, total, err := s.repo.ListRedemptions(ctx, couponID, page, limit)
	if err != nil {
		return nil, err
	}
	if s.users != nil && len(items) > 0 {
		ids := make([]primitive.ObjectID, 0, len(items))
		for _, it := range items {
			ids = append(ids, database.OID(it.UserID))
		}
		// Names are a nicety; the list still shows if the lookup fails
		if found, err := s.users.FindUsersByIDs(ctx, ids); err == nil {
			for i := range items {
				if u := found[database.OID(items[i].UserID)]; u != nil {
					items[i].UserName = u.Name
				}
			}
		}
	}
	return &RedemptionPage{Items: items, Total: total, Page: page, Limit: limit}, nil
}

// ReceiptOf describes a wallet purchase priced with a and paid as paid.
func ReceiptOf(a *Applied, paid *WalletPaid) *Receipt {
	r := &Receipt{
		ListPrice: money.ToRupees(a.ListPaise),
		Discount:  money.ToRupees(a.DiscountPaise),
		Paid:      money.ToRupees(a.PricePaise),
	}
	if a.coupon != nil {
		r.Code = a.coupon.Code
	}
	if paid != nil {
		r.FromBonus = money.ToRupees(paid.BonusPaise)
		r.FromMain = money.ToRupees(paid.MainPaise)
		r.Cashback = money.ToRupees(paid.CashbackPaise)
	}
	return r
}
