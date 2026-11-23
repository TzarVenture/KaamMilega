package recruiterplan

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/money"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/promo"
	"km-backend/internal/features/setting"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// SettingStore is the platform settings (setting.SettingService)
type SettingStore interface {
	GetValue(ctx context.Context, key string) (string, error)
	SetValue(ctx context.Context, key string, value string) error
}

// Users looks up accounts in MongoDB (user.UserRepository)
type Users interface {
	FindUserByID(ctx context.Context, id string) (*user.User, error)
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}

type notifier interface {
	CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error)
}

// Releaser gives back a use that was counted for something that then failed to happen
type Releaser = func(ctx context.Context)

type Service interface {
	Overview(ctx context.Context, userID string) (*Overview, error)
	// couponCode is optional
	BuyWithWallet(ctx context.Context, userID, planID, couponCode string) (*Subscription, *wallet.WalletSummaryResponse, *promo.Receipt, error)
	CreateOrder(ctx context.Context, userID, planID, couponCode string) (*CheckoutResponse, error)
	VerifyPayment(ctx context.Context, userID string, in payment.ConfirmInput) (*Subscription, error)

	// Use counts one job post, new chat or resume download for a recruiter. It returns an error
	// only when enforcement is on and the period's limit is used up. Members who aren't
	// recruiters, and admins, are never counted.
	Use(ctx context.Context, userID primitive.ObjectID, kind, refID string) (Releaser, error)

	AdminPlans(ctx context.Context) ([]Plan, error)
	CreatePlan(ctx context.Context, in PlanInput) (*Plan, error)
	UpdatePlan(ctx context.Context, id string, in PlanInput) (*Plan, error)
	GetSettings(ctx context.Context) (Settings, error)
	SaveSettings(ctx context.Context, in Settings) (Settings, error)
	AdminSubscriptions(ctx context.Context, page, limit int) (*AdminSubscriptionPage, error)
}

type service struct {
	repo     Repository
	tx       database.Transactor
	wallet   wallet.WalletService
	payments payment.Service
	settings SettingStore
	users    Users
	notify   notifier
	promo    promo.Service
	now      func() time.Time
}

func NewService(repo Repository, tx database.Transactor, walletService wallet.WalletService, payments payment.Service,
	settings setting.SettingService, users user.UserRepository, notify notification.NotificationService, coupons promo.Service) Service {
	s := &service{repo: repo, tx: tx, wallet: walletService, payments: payments, settings: settings, users: users, promo: coupons, now: time.Now}
	if notify != nil {
		s.notify = notify
	}
	coupons.RegisterPricer(payment.PurposeRecruiterPlan, func(ctx context.Context, userID, planID string) (int64, error) {
		plan, err := s.sellable(ctx, userID, planID)
		if err != nil {
			return 0, err
		}
		return plan.PricePaise, nil
	})
	payments.Register(payment.PurposeRecruiterPlan, payment.Handlers{
		Fulfill:   s.fulfill,
		AfterPaid: s.afterPaid,
		Revoke:    s.revoke,
	})
	return s
}

var ist = time.FixedZone("IST", 5*60*60+30*60)

func hasRole(roles []string, want string) bool {
	for _, r := range roles {
		if r == want {
			return true
		}
	}
	return false
}

func subscriptionRef(subID string) string { return "recruiter_plan:" + subID }

// period works out which allowance applies now: the running plan, or the free calendar month
type period struct {
	key            string
	subscriptionID string
	limits         Limits
	endsAt         time.Time
	current        *Subscription
	queued         []Subscription
}

func currentPeriod(open []Subscription, free Limits, now time.Time) period {
	p := period{}
	for i := range open {
		if !open[i].StartsAt.After(now) && p.current == nil {
			sub := open[i]
			p.current = &sub
			continue
		}
		if open[i].StartsAt.After(now) {
			p.queued = append(p.queued, open[i])
		}
	}
	if p.current != nil {
		p.key, p.subscriptionID, p.limits, p.endsAt = p.current.ID, p.current.ID, p.current.Limits, p.current.ExpiresAt
		return p
	}
	n := now.In(ist)
	month := time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, ist)
	p.key, p.limits, p.endsAt = "free:"+month.Format("2006-01"), free, month.AddDate(0, 1, 0)
	return p
}

func (s *service) loadSettings(ctx context.Context) (Settings, error) {
	raw, err := s.settings.GetValue(ctx, SettingsKey)
	if errors.Is(err, mongo.ErrNoDocuments) || (err == nil && strings.TrimSpace(raw) == "") {
		return DefaultSettings(), nil
	}
	if err != nil {
		return DefaultSettings(), err
	}
	var out Settings
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return DefaultSettings(), err
	}
	return out, nil
}

func (s *service) recruiter(ctx context.Context, userID string) error {
	u, err := s.users.FindUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if u == nil || !hasRole(u.Roles, user.RoleRecruiter) {
		return ErrRecruitersOnly
	}
	return nil
}

func validID(id string) bool { return primitive.IsValidObjectID(id) }

// ---------------------------------------------------------------------------------------------
// Recruiter
// ---------------------------------------------------------------------------------------------

func (s *service) Overview(ctx context.Context, userID string) (*Overview, error) {
	if err := s.recruiter(ctx, userID); err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx)
	if err != nil {
		log.Printf("recruiterplan: reading settings: %v", err)
	}
	plans, err := s.repo.ListPlans(ctx, true)
	if err != nil {
		return nil, err
	}
	now := s.now()
	open, err := s.repo.OpenSubscriptions(ctx, userID, now)
	if err != nil {
		return nil, err
	}
	p := currentPeriod(open, settings.Free, now)

	allowance := func(kind string) (Allowance, error) {
		n, err := s.repo.CountUsage(ctx, userID, p.key, kind)
		return Allowance{Used: n, Limit: p.limits.of(kind)}, err
	}
	var usage Usage
	if usage.JobPosts, err = allowance(KindJobPost); err != nil {
		return nil, err
	}
	if usage.NewChats, err = allowance(KindNewChat); err != nil {
		return nil, err
	}
	if usage.ResumeDownloads, err = allowance(KindResumeDownload); err != nil {
		return nil, err
	}
	queued := p.queued
	if queued == nil {
		queued = []Subscription{}
	}
	return &Overview{
		Plans: plans, Current: p.current, Queued: queued, Usage: usage,
		PeriodEndsAt: p.endsAt, Enforced: settings.Enforce,
		AIJobWriter: p.current != nil && p.current.AIJobWriter,
	}, nil
}

// startFor is when a plan bought now begins: now, or when the last bought plan ends
func startFor(open []Subscription, now time.Time) time.Time {
	start := now
	for _, sub := range open {
		if sub.ExpiresAt.After(start) {
			start = sub.ExpiresAt
		}
	}
	return start
}

func queuedCount(open []Subscription, now time.Time) int {
	n := 0
	for _, sub := range open {
		if sub.StartsAt.After(now) {
			n++
		}
	}
	return n
}

// newSubscription adds a bought plan for the recruiter. Runs in a transaction.
func (s *service) newSubscription(ctx context.Context, userID string, plan *Plan, pricePaise int64, channel, orderID, paymentID string) (*Subscription, error) {
	if err := s.repo.LockUser(ctx, userID); err != nil {
		return nil, err
	}
	now := s.now()
	open, err := s.repo.OpenSubscriptions(ctx, userID, now)
	if err != nil {
		return nil, err
	}
	if queuedCount(open, now) >= MaxQueued {
		return nil, ErrQueueFull
	}
	// Postgres keeps microseconds, so the plan returned matches the one stored
	start := startFor(open, now).Truncate(time.Microsecond)
	sub := &Subscription{
		UserID: userID, PlanID: plan.ID, PlanName: plan.Name,
		Price: money.ToRupees(pricePaise), PricePaise: pricePaise,
		Limits: plan.Limits, AIJobWriter: plan.AIJobWriter,
		Channel: channel, Status: StatusActive,
		RazorpayOrderID: orderID, RazorpayPaymentID: paymentID,
		StartsAt: start, ExpiresAt: start.Add(time.Duration(plan.PeriodDays) * 24 * time.Hour),
	}
	if err := s.repo.CreateSubscription(ctx, sub); err != nil {
		return nil, err
	}
	return sub, nil
}

func (s *service) sellable(ctx context.Context, userID, planID string) (*Plan, error) {
	if !validID(planID) {
		return nil, ErrPlanNotFound
	}
	if err := s.recruiter(ctx, userID); err != nil {
		return nil, err
	}
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	if plan == nil {
		return nil, ErrPlanNotFound
	}
	if !plan.IsActive {
		return nil, ErrPlanInactive
	}
	return plan, nil
}

func (s *service) BuyWithWallet(ctx context.Context, userID, planID, couponCode string) (*Subscription, *wallet.WalletSummaryResponse, *promo.Receipt, error) {
	plan, err := s.sellable(ctx, userID, planID)
	if err != nil {
		return nil, nil, nil, err
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, nil, nil, ErrRecruitersOnly
	}

	var sub *Subscription
	var summary *wallet.WalletSummaryResponse
	var receipt *promo.Receipt
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		price, err := s.promo.PriceForWallet(ctx, userID, payment.PurposeRecruiterPlan, plan.PricePaise, couponCode)
		if err != nil {
			return err
		}
		if sub, err = s.newSubscription(ctx, userID, plan, price.PricePaise, ChannelWallet, "", ""); err != nil {
			return err
		}
		paid, err := s.promo.PayFromWallet(ctx, price, promo.WalletPay{
			Category:    wallet.CategoryRecruiterPlan,
			ReferenceID: subscriptionRef(sub.ID) + ":pay",
			PurchaseRef: subscriptionRef(sub.ID),
			Description: "Recruiter plan: " + plan.Name,
			Metadata:    map[string]interface{}{"subscription_id": sub.ID, "plan_id": plan.ID, "channel": ChannelWallet},
		})
		if err != nil {
			return err
		}
		summary, receipt = paid.Summary, promo.ReceiptOf(price, paid)
		return nil
	})
	if err != nil {
		return nil, nil, nil, err
	}
	go s.notifyActive(uid, sub)
	return sub, summary, receipt, nil
}

func (s *service) CreateOrder(ctx context.Context, userID, planID, couponCode string) (*CheckoutResponse, error) {
	plan, err := s.sellable(ctx, userID, planID)
	if err != nil {
		return nil, err
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrRecruitersOnly
	}
	// Checked again when the payment arrives; this just saves a payment that would be refunded
	open, err := s.repo.OpenSubscriptions(ctx, userID, s.now())
	if err != nil {
		return nil, err
	}
	if queuedCount(open, s.now()) >= MaxQueued {
		return nil, ErrQueueFull
	}
	checkout, _, err := s.promo.CheckoutOnline(ctx, userID, payment.PurposeRecruiterPlan, plan.PricePaise, couponCode,
		func(pricePaise int64, coupon map[string]string) (*payment.Checkout, error) {
			details := map[string]string{"plan_id": plan.ID}
			for k, v := range coupon {
				details[k] = v
			}
			checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
				UserID:      uid,
				Purpose:     payment.PurposeRecruiterPlan,
				AmountPaise: pricePaise,
				TargetID:    plan.ID,
				Details:     details,
				Description: "Recruiter plan: " + plan.Name,
			})
			return checkout, err
		})
	if err != nil {
		return nil, err
	}
	return &CheckoutResponse{KeyID: checkout.KeyID, OrderID: checkout.OrderID, Amount: checkout.Amount, AmountPaise: checkout.AmountPaise}, nil
}

// fulfill delivers a plan paid online. The plan is delivered even if the admin switched it off
// after the order was made, at the price paid.
func (s *service) fulfill(ctx context.Context, order *payment.Order) error {
	plan, err := s.repo.GetPlan(ctx, order.TargetID)
	if err != nil {
		return err
	}
	if plan == nil {
		return payment.Unfulfillable("This plan no longer exists")
	}
	sub, err := s.newSubscription(ctx, order.UserID.Hex(), plan, order.AmountPaise, ChannelOnline, order.RazorpayOrderID, order.RazorpayPaymentID)
	if errors.Is(err, ErrQueueFull) {
		return payment.Unfulfillable("You already have a plan waiting to start")
	}
	if err != nil {
		return err
	}
	return s.promo.RedeemOrder(ctx, order, subscriptionRef(sub.ID))
}

func (s *service) afterPaid(order *payment.Order) {
	sub, err := s.repo.GetSubscriptionByOrder(context.Background(), order.RazorpayOrderID)
	if err == nil && sub != nil {
		s.notifyActive(order.UserID, sub)
	}
}

// revoke ends a plan an admin refunds from Payments. Only a plan with nothing used can be refunded.
func (s *service) revoke(ctx context.Context, order *payment.Order) error {
	sub, err := s.repo.GetSubscriptionByOrder(ctx, order.RazorpayOrderID)
	if err != nil {
		return err
	}
	if sub == nil || sub.Status != StatusActive {
		return ErrPlanNotFound
	}
	used, err := s.repo.CountSubscriptionUsage(ctx, sub.ID)
	if err != nil {
		return err
	}
	if used > 0 {
		return ErrRefundUsed
	}
	if err := s.repo.MarkRefunded(ctx, sub.ID); err != nil {
		return err
	}
	// Gives the coupon use back and takes back any cashback (refused if it was spent)
	return s.promo.Reverse(ctx, subscriptionRef(sub.ID))
}

func (s *service) VerifyPayment(ctx context.Context, userID string, in payment.ConfirmInput) (*Subscription, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrRecruitersOnly
	}
	order, err := s.payments.Confirm(ctx, uid, payment.PurposeRecruiterPlan, in)
	if err != nil {
		return nil, err
	}
	sub, err := s.repo.GetSubscriptionByOrder(ctx, order.RazorpayOrderID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, payment.ErrNotComplete
	}
	return sub, nil
}

func (s *service) notifyActive(userID primitive.ObjectID, sub *Subscription) {
	if s.notify == nil || sub == nil {
		return
	}
	msg := "Your " + sub.PlanName + " plan is active until " + sub.ExpiresAt.In(ist).Format("2 Jan 2006") + "."
	if sub.StartsAt.After(s.now()) {
		msg = "Your " + sub.PlanName + " plan starts on " + sub.StartsAt.In(ist).Format("2 Jan 2006") + ", when your current plan ends."
	}
	_, err := s.notify.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID:   userID,
		Type:     notification.TypeRecruiterPlan,
		Category: notification.CategorySystem,
		Title:    "Recruiter plan bought",
		Message:  msg,
		Link:     "/recruiter/plan",
	})
	if err != nil {
		log.Printf("recruiterplan: notification for %s: %v", userID.Hex(), err)
	}
}

// ---------------------------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------------------------

func usedUp(kind string) error {
	switch kind {
	case KindJobPost:
		return ErrJobPostsUsedUp
	case KindNewChat:
		return ErrChatsUsedUp
	}
	return ErrResumesUsedUp
}

func noRelease(context.Context) {}

func (s *service) Use(ctx context.Context, userID primitive.ObjectID, kind, refID string) (Releaser, error) {
	u, err := s.users.FindUserByID(ctx, userID.Hex())
	if err != nil || u == nil || !hasRole(u.Roles, user.RoleRecruiter) || hasRole(u.Roles, user.RoleAdmin) {
		return noRelease, nil
	}
	settings, err := s.loadSettings(ctx)
	if err != nil {
		// Unreadable settings never block hiring
		log.Printf("recruiterplan: reading settings: %v", err)
		settings.Enforce = false
	}

	var added string
	var limitErr error
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		added, limitErr = "", nil
		if err := s.repo.LockUser(ctx, userID.Hex()); err != nil {
			return err
		}
		open, err := s.repo.OpenSubscriptions(ctx, userID.Hex(), s.now())
		if err != nil {
			return err
		}
		p := currentPeriod(open, settings.Free, s.now())
		if limit := p.limits.of(kind); settings.Enforce && limit != nil {
			seen, err := s.repo.HasUsage(ctx, userID.Hex(), p.key, kind, refID)
			if err != nil {
				return err
			}
			if !seen {
				n, err := s.repo.CountUsage(ctx, userID.Hex(), p.key, kind)
				if err != nil {
					return err
				}
				if n >= *limit {
					limitErr = usedUp(kind)
					return nil
				}
			}
		}
		added, err = s.repo.AddUsage(ctx, userID.Hex(), p.key, p.subscriptionID, kind, refID)
		return err
	})
	if limitErr != nil {
		return noRelease, limitErr
	}
	if err != nil {
		if !settings.Enforce {
			log.Printf("recruiterplan: counting %s for %s: %v", kind, userID.Hex(), err)
			return noRelease, nil
		}
		return noRelease, err
	}
	if added == "" {
		return noRelease, nil
	}
	return func(ctx context.Context) {
		if err := s.repo.DeleteUsage(ctx, added); err != nil {
			log.Printf("recruiterplan: releasing %s %s: %v", kind, refID, err)
		}
	}, nil
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

func (s *service) AdminPlans(ctx context.Context) ([]Plan, error) {
	return s.repo.ListPlans(ctx, false)
}

func validLimits(l Limits) bool {
	for _, n := range []*int{l.JobPosts, l.NewChats, l.ResumeDownloads} {
		if n != nil && (*n < 0 || *n > 100000) {
			return false
		}
	}
	return true
}

func planFromInput(in PlanInput) (*Plan, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" || utf8.RuneCountInString(name) > 60 {
		return nil, ErrPlanName
	}
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > 300 {
		return nil, ErrPlanDescription
	}
	if in.Price < 1 || in.Price > 100000 {
		return nil, ErrPlanPrice
	}
	if in.PeriodDays < 1 || in.PeriodDays > 366 {
		return nil, ErrPlanPeriod
	}
	if !validLimits(in.Limits) {
		return nil, ErrPlanLimit
	}
	paise := money.ToPaise(in.Price)
	return &Plan{
		Name: name, Description: desc, Price: money.ToRupees(paise), PricePaise: paise, PeriodDays: in.PeriodDays,
		Limits: in.Limits, AIJobWriter: in.AIJobWriter, SortOrder: in.SortOrder, IsActive: in.IsActive,
	}, nil
}

func (s *service) CreatePlan(ctx context.Context, in PlanInput) (*Plan, error) {
	p, err := planFromInput(in)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreatePlan(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *service) UpdatePlan(ctx context.Context, id string, in PlanInput) (*Plan, error) {
	if !validID(id) {
		return nil, ErrPlanNotFound
	}
	p, err := planFromInput(in)
	if err != nil {
		return nil, err
	}
	p.ID = id
	if err := s.repo.UpdatePlan(ctx, p); err != nil {
		return nil, err
	}
	return s.repo.GetPlan(ctx, id)
}

func (s *service) GetSettings(ctx context.Context) (Settings, error) { return s.loadSettings(ctx) }

func (s *service) SaveSettings(ctx context.Context, in Settings) (Settings, error) {
	if !validLimits(in.Free) {
		return Settings{}, ErrSettings
	}
	raw, err := json.Marshal(in)
	if err != nil {
		return Settings{}, err
	}
	if err := s.settings.SetValue(ctx, SettingsKey, string(raw)); err != nil {
		return Settings{}, err
	}
	return in, nil
}

// AdminSubscription is a bought plan with who bought it
type AdminSubscription struct {
	Subscription
	RecruiterName string `json:"recruiter_name"`
	CompanyName   string `json:"company_name,omitempty"`
}

// AdminSubscriptionPage is one page of bought plans
type AdminSubscriptionPage struct {
	Items []AdminSubscription `json:"items"`
	Total int64               `json:"total"`
	Page  int                 `json:"page"`
	Limit int                 `json:"limit"`
}

func (s *service) AdminSubscriptions(ctx context.Context, page, limit int) (*AdminSubscriptionPage, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	subs, total, err := s.repo.ListSubscriptions(ctx, page, limit)
	if err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(subs))
	for _, sub := range subs {
		if oid, err := primitive.ObjectIDFromHex(sub.UserID); err == nil {
			ids = append(ids, oid)
		}
	}
	found, err := s.users.FindUsersByIDs(ctx, ids)
	if err != nil {
		log.Printf("recruiterplan: names for subscriptions: %v", err)
	}
	items := make([]AdminSubscription, 0, len(subs))
	for _, sub := range subs {
		item := AdminSubscription{Subscription: sub}
		if oid, err := primitive.ObjectIDFromHex(sub.UserID); err == nil {
			if u := found[oid]; u != nil {
				item.RecruiterName, item.CompanyName = u.Name, u.CompanyName
			}
		}
		items = append(items, item)
	}
	return &AdminSubscriptionPage{Items: items, Total: total, Page: page, Limit: limit}, nil
}
