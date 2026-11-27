package referral

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"km-backend/internal/common/money"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/setting"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Service is the referral feature
type Service interface {
	// Overview is the member's referral page; it makes their invite code the first time
	Overview(ctx context.Context, userID string) (*Overview, error)
	// Claim links a new member to whoever's code they signed up with
	Claim(ctx context.Context, userID, code string) error
	// Run finds new first payments, rewards referrals whose wait is over and forms aggregator
	// groups. Safe to run any number of times.
	Run(ctx context.Context) error

	GetSettings(ctx context.Context) (Settings, error)
	SaveSettings(ctx context.Context, in Settings) (Settings, error)
	ListAggregators(ctx context.Context) ([]Aggregator, error)
	// SetAggregator approves (active) or removes a member, found by id or mobile number
	SetAggregator(ctx context.Context, adminID, who string, active bool, note string) (*Aggregator, error)
	ListPayouts(ctx context.Context, owedOnly bool, page, limit int) ([]Payout, int64, error)
	MarkCashPaid(ctx context.Context, adminID, payoutID, note string) (*Payout, error)
	ListReferrals(ctx context.Context, status string, page, limit int) ([]AdminReferral, int64, error)
}

// SettingStore is where the admin's settings are kept (the platform settings)
type SettingStore interface {
	GetValue(ctx context.Context, key string) (string, error)
	SetValue(ctx context.Context, key, value string) error
}

// Users looks members up in Mongo
type Users interface {
	FindUserByID(ctx context.Context, id string) (*user.User, error)
	FindUserByMobile(ctx context.Context, mobile string) (*user.User, error)
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}

type walletCredits interface {
	RecordTransaction(ctx context.Context, in wallet.RecordTransactionInput) (*wallet.TransactionItemResponse, *wallet.WalletSummaryResponse, error)
}

type notifier interface {
	CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error)
}

type transactor interface {
	Run(ctx context.Context, fn func(ctx context.Context) error) error
}

type service struct {
	repo     Repository
	tx       transactor
	wallet   walletCredits
	settings SettingStore
	users    Users
	notify   notifier
	now      func() time.Time
}

func NewService(repo Repository, tx database.Transactor, w wallet.WalletService, settings setting.SettingService, users user.UserRepository, notify notification.NotificationService) Service {
	s := &service{repo: repo, tx: tx, wallet: w, settings: settings, users: users, now: time.Now}
	if notify != nil {
		s.notify = notify
	}
	return s
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

func (s *service) loadSettings(ctx context.Context) (Settings, error) {
	raw, err := s.settings.GetValue(ctx, SettingsKey)
	if errors.Is(err, mongo.ErrNoDocuments) || (err == nil && strings.TrimSpace(raw) == "") {
		return DefaultSettings(), nil
	}
	if err != nil {
		return DefaultSettings(), err
	}
	out := DefaultSettings()
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return DefaultSettings(), err
	}
	return out, nil
}

func (s *service) GetSettings(ctx context.Context) (Settings, error) { return s.loadSettings(ctx) }

func validAmount(v float64) bool {
	return v >= 0 && v <= 100000 && money.HasAtMostTwoDecimals(v) && !math.IsNaN(v)
}

func (s *service) SaveSettings(ctx context.Context, in Settings) (Settings, error) {
	if !validAmount(in.MemberReward) || !validAmount(in.AggregatorCredit) || !validAmount(in.AggregatorCash) ||
		in.AggregatorGroup < 1 || in.AggregatorGroup > 1000 || in.WaitDays < 0 || in.WaitDays > 365 {
		return in, ErrSettings
	}
	raw, err := json.Marshal(in)
	if err != nil {
		return in, err
	}
	if err := s.settings.SetValue(ctx, SettingsKey, string(raw)); err != nil {
		return in, err
	}
	return in, nil
}

// ---------------------------------------------------------------------------------------------
// Member side
// ---------------------------------------------------------------------------------------------

// Codes leave out 0/O and 1/I so they're easy to read out
const codeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func newCode() (string, error) {
	b := make([]byte, 7)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = codeLetters[int(b[i])%len(codeLetters)]
	}
	return "KM" + string(b), nil
}

func (s *service) code(ctx context.Context, userID string) (string, error) {
	if c, err := s.repo.GetCode(ctx, userID); err != nil || c != "" {
		return c, err
	}
	for attempt := 0; attempt < 5; attempt++ {
		c, err := newCode()
		if err != nil {
			return "", err
		}
		saved, err := s.repo.InsertCode(ctx, userID, c)
		if errors.Is(err, ErrCodeTaken) {
			continue
		}
		return saved, err
	}
	return "", errors.New("referral: could not make a unique code")
}

func firstName(u *user.User) string {
	if u == nil {
		return ""
	}
	name := strings.TrimSpace(u.Name)
	if name == "" {
		name = strings.TrimSpace(u.FirstName)
	}
	if i := strings.IndexByte(name, ' '); i > 0 {
		name = name[:i]
	}
	return name
}

func (s *service) isAggregator(ctx context.Context, userID string) (bool, error) {
	a, err := s.repo.GetAggregator(ctx, userID)
	return a != nil && a.Active, err
}

func (s *service) Overview(ctx context.Context, userID string) (*Overview, error) {
	set, err := s.loadSettings(ctx)
	if err != nil {
		return nil, err
	}
	code, err := s.code(ctx, userID)
	if err != nil {
		return nil, err
	}
	counts, err := s.repo.CountsByReferrer(ctx, userID)
	if err != nil {
		return nil, err
	}
	memberPaise, err := s.repo.MemberRewardsPaise(ctx, userID)
	if err != nil {
		return nil, err
	}
	agg, err := s.repo.GetAggregator(ctx, userID)
	if err != nil {
		return nil, err
	}
	payouts, err := s.repo.PayoutsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := &Overview{Enabled: set.Enabled, Code: code, MemberReward: set.MemberReward, WaitDays: set.WaitDays,
		Counts: counts, Earned: money.ToRupees(memberPaise), People: []InvitedPerson{}}
	var credit, owed, received int64
	for _, p := range payouts {
		credit += money.ToPaise(p.Credit)
		if p.CashPaidAt == nil {
			owed += money.ToPaise(p.Cash)
		} else {
			received += money.ToPaise(p.Cash)
		}
	}
	out.Earned = money.ToRupees(memberPaise + credit)
	if (agg != nil && agg.Active) || len(payouts) > 0 {
		out.IsAggregator = agg != nil && agg.Active
		unbatched, err := s.repo.UnbatchedCount(ctx, userID)
		if err != nil {
			return nil, err
		}
		out.Aggregator = &GroupProgress{GroupSize: set.AggregatorGroup, Credit: set.AggregatorCredit, Cash: set.AggregatorCash,
			TowardsNext: unbatched, Groups: len(payouts), CashOwed: money.ToRupees(owed), CashReceived: money.ToRupees(received)}
	}

	list, err := s.repo.ListByReferrer(ctx, userID, 100)
	if err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(list))
	for _, r := range list {
		ids = append(ids, database.OID(r.ReferredID))
	}
	people, err := s.users.FindUsersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, r := range list {
		p := InvitedPerson{FirstName: firstName(people[database.OID(r.ReferredID)]), Status: r.Status, JoinedAt: r.CreatedAt, Reward: r.Reward}
		if p.FirstName == "" {
			p.FirstName = "New member"
		}
		if r.Status == StatusPaid {
			p.ReleaseAt = r.ReleaseAt
		}
		out.People = append(out.People, p)
	}
	return out, nil
}

func (s *service) Claim(ctx context.Context, userID, code string) error {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" || len(code) > 12 {
		return ErrCodeNotFound
	}
	set, err := s.loadSettings(ctx)
	if err != nil {
		return err
	}
	if !set.Enabled {
		return ErrDisabled
	}
	referrerID, err := s.repo.FindCode(ctx, code)
	if err != nil {
		return err
	}
	if referrerID == "" {
		return ErrCodeNotFound
	}
	if referrerID == userID {
		return ErrOwnCode
	}
	me, err := s.users.FindUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if me == nil {
		return ErrUserNotFound
	}
	if s.now().Sub(me.CreatedAt) > ClaimWindow {
		return ErrTooLate
	}
	inviter, err := s.users.FindUserByID(ctx, referrerID)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}
	if inviter == nil || (inviter.AccountStatus != "" && inviter.AccountStatus != user.AccountActive) {
		return ErrInviterGone
	}
	return s.tx.Run(ctx, func(ctx context.Context) error {
		existing, err := s.repo.GetByReferred(ctx, userID)
		if err != nil {
			return err
		}
		if existing != nil {
			if existing.ReferrerID == referrerID {
				return nil // the same code sent twice
			}
			return ErrAlreadyLinked
		}
		// Nobody can pay first and add an inviter afterwards
		if ref, _, err := s.repo.FirstPayment(ctx, userID); err != nil {
			return err
		} else if ref != "" {
			return ErrAlreadyPaid
		}
		now := s.now()
		err = s.repo.Create(ctx, &Referral{ID: newID(), ReferrerID: referrerID, ReferredID: userID, CreatedAt: now})
		if database.PgErrCode(err) == "23505" {
			return ErrAlreadyLinked
		}
		return err
	})
}

// ---------------------------------------------------------------------------------------------
// The timer
// ---------------------------------------------------------------------------------------------

func (s *service) Run(ctx context.Context) error {
	set, err := s.loadSettings(ctx)
	if err != nil {
		return err
	}
	if err := s.markPaid(ctx, set); err != nil {
		return err
	}
	ids, err := s.repo.DueIDs(ctx, s.now(), 200)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := s.release(ctx, id, set); err != nil {
			log.Printf("[referral] release %s: %v", id, err)
		}
	}
	due, err := s.repo.AggregatorsDue(ctx, set.AggregatorGroup)
	if err != nil {
		return err
	}
	for _, uid := range due {
		if err := s.formGroups(ctx, uid, set); err != nil {
			log.Printf("[referral] groups for %s: %v", uid, err)
		}
	}
	return nil
}

func (s *service) markPaid(ctx context.Context, set Settings) error {
	hits, err := s.repo.NewlyPaid(ctx, 500)
	if err != nil {
		return err
	}
	wait := time.Duration(set.WaitDays) * 24 * time.Hour
	for _, h := range hits {
		if err := s.repo.MarkPaid(ctx, h.ID, h.Ref, h.At, h.At.Add(wait)); err != nil {
			return err
		}
	}
	return nil
}

// release rewards one referral whose wait is over, or cancels it if the money came back
func (s *service) release(ctx context.Context, id string, set Settings) error {
	var notice func()
	var aggregatorID string
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		now := s.now()
		r, err := s.repo.LockDue(ctx, id, now)
		if err != nil || r == nil {
			return err
		}
		net, err := s.repo.NetSpentPaise(ctx, r.ReferredID)
		if err != nil {
			return err
		}
		if net <= 0 {
			return s.repo.Cancel(ctx, r.ID, "refunded", now)
		}
		agg, err := s.isAggregator(ctx, r.ReferrerID)
		if err != nil {
			return err
		}
		switch {
		case agg:
			aggregatorID = r.ReferrerID
			return s.repo.Release(ctx, r.ID, RewardAggregator, 0, now)
		case set.MemberReward > 0:
			if err := s.repo.Release(ctx, r.ID, RewardMember, money.ToPaise(set.MemberReward), now); err != nil {
				return err
			}
			if _, _, err := s.wallet.RecordTransaction(ctx, wallet.RecordTransactionInput{
				UserID: database.OID(r.ReferrerID), Type: wallet.TypeCredit, TargetBalance: wallet.BalanceBonus,
				Category: wallet.CategoryReferralReward, Amount: set.MemberReward, ReferenceID: "referral:" + r.ID + ":reward",
				Description: "Reward for inviting a member", Metadata: map[string]interface{}{"referral_id": r.ID},
			}); err != nil {
				return err
			}
			reward := set.MemberReward
			notice = func() {
				s.send(r.ReferrerID, "Referral reward added", fmt.Sprintf("%s was added to your wallet for inviting a member.", money.INR(money.ToPaise(reward))))
			}
			return nil
		default:
			return s.repo.Release(ctx, r.ID, RewardNone, 0, now)
		}
	})
	if err != nil {
		return err
	}
	if notice != nil {
		notice()
	}
	if aggregatorID != "" {
		return s.formGroups(ctx, aggregatorID, set)
	}
	return nil
}

// formGroups turns every full group of an aggregator's released referrals into a reward
func (s *service) formGroups(ctx context.Context, userID string, set Settings) error {
	for {
		var formed *Payout
		err := s.tx.Run(ctx, func(ctx context.Context) error {
			a, err := s.repo.LockAggregator(ctx, userID)
			if err != nil || a == nil || !a.Active {
				return err
			}
			n, err := s.repo.UnbatchedCount(ctx, userID)
			if err != nil || n < set.AggregatorGroup {
				return err
			}
			batch, err := s.repo.NextBatchNo(ctx, userID)
			if err != nil {
				return err
			}
			p := &Payout{ID: newID(), UserID: userID, BatchNo: batch, Referrals: set.AggregatorGroup,
				Credit: set.AggregatorCredit, Cash: set.AggregatorCash, CreatedAt: s.now()}
			if err := s.repo.CreatePayout(ctx, p); err != nil {
				return err
			}
			assigned, err := s.repo.AssignBatch(ctx, userID, p.ID, set.AggregatorGroup)
			if err != nil {
				return err
			}
			if assigned != int64(set.AggregatorGroup) {
				return fmt.Errorf("referral: group %d got %d referrals", batch, assigned)
			}
			if p.Credit > 0 {
				if _, _, err := s.wallet.RecordTransaction(ctx, wallet.RecordTransactionInput{
					UserID: database.OID(userID), Type: wallet.TypeCredit, TargetBalance: wallet.BalanceBonus,
					Category: wallet.CategoryReferralReward, Amount: p.Credit, ReferenceID: "referral_payout:" + p.ID + ":credit",
					Description: fmt.Sprintf("Reward for %d paid referrals", p.Referrals),
					Metadata:    map[string]interface{}{"referral_payout_id": p.ID, "batch_no": batch},
				}); err != nil {
					return err
				}
			}
			formed = p
			return nil
		})
		if err != nil || formed == nil {
			return err
		}
		msg := fmt.Sprintf("%d of your invites have paid. %s was added to your wallet",
			formed.Referrals, money.INR(money.ToPaise(formed.Credit)))
		if formed.Cash > 0 {
			msg += fmt.Sprintf(", and %s cash will be paid to you", money.INR(money.ToPaise(formed.Cash)))
		}
		s.send(userID, "Referral group reward", msg+".")
	}
}

func (s *service) send(userID, title, message string) {
	if s.notify == nil {
		return
	}
	_, err := s.notify.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID: database.OID(userID), Type: notification.TypeReferral, Category: notification.CategorySystem,
		Title: title, Message: message, Link: "/referrals",
	})
	if err != nil {
		log.Printf("[referral] notify %s: %v", userID, err)
	}
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

func (s *service) ListAggregators(ctx context.Context) ([]Aggregator, error) {
	list, err := s.repo.ListAggregators(ctx)
	if err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(list))
	for _, a := range list {
		ids = append(ids, database.OID(a.UserID))
	}
	people, err := s.users.FindUsersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if u := people[database.OID(list[i].UserID)]; u != nil {
			list[i].Name, list[i].Mobile = u.Name, u.Mobile
		}
	}
	return list, nil
}

func (s *service) findMember(ctx context.Context, who string) (*user.User, error) {
	who = strings.TrimSpace(who)
	if who == "" {
		return nil, ErrUserNotFound
	}
	if _, err := primitive.ObjectIDFromHex(who); err == nil {
		u, err := s.users.FindUserByID(ctx, who)
		if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
			return nil, err
		}
		if u != nil {
			return u, nil
		}
		return nil, ErrUserNotFound
	}
	u, err := s.users.FindUserByMobile(ctx, who)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrUserNotFound
	}
	return u, nil
}

func (s *service) SetAggregator(ctx context.Context, adminID, who string, active bool, note string) (*Aggregator, error) {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 200 {
		return nil, ErrNote
	}
	u, err := s.findMember(ctx, who)
	if err != nil {
		return nil, err
	}
	uid := u.ID.Hex()
	if err := s.repo.SaveAggregator(ctx, uid, active, note, adminID, s.now()); err != nil {
		return nil, err
	}
	if active {
		// Referrals released while they weren't approved count as normal-member ones; anything
		// already counted towards a group (from before a removal) forms groups again now
		set, err := s.loadSettings(ctx)
		if err != nil {
			return nil, err
		}
		if err := s.formGroups(ctx, uid, set); err != nil {
			return nil, err
		}
	}
	a, err := s.repo.GetAggregator(ctx, uid)
	if err != nil || a == nil {
		return a, err
	}
	a.Name, a.Mobile = u.Name, u.Mobile
	return a, nil
}

func (s *service) fillPayoutNames(ctx context.Context, list []Payout) error {
	ids := make([]primitive.ObjectID, 0, len(list))
	for _, p := range list {
		ids = append(ids, database.OID(p.UserID))
	}
	people, err := s.users.FindUsersByIDs(ctx, ids)
	if err != nil {
		return err
	}
	for i := range list {
		if u := people[database.OID(list[i].UserID)]; u != nil {
			list[i].UserName, list[i].UserMobile = u.Name, u.Mobile
		}
	}
	return nil
}

func (s *service) ListPayouts(ctx context.Context, owedOnly bool, page, limit int) ([]Payout, int64, error) {
	list, total, err := s.repo.ListPayouts(ctx, owedOnly, page, limit)
	if err != nil {
		return nil, 0, err
	}
	return list, total, s.fillPayoutNames(ctx, list)
}

func (s *service) MarkCashPaid(ctx context.Context, adminID, payoutID, note string) (*Payout, error) {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 200 {
		return nil, ErrNote
	}
	var out *Payout
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		p, err := s.repo.LockPayout(ctx, payoutID)
		if err != nil {
			return err
		}
		if p == nil {
			return ErrPayoutNotFound
		}
		if p.CashPaidAt != nil {
			return ErrCashPaid
		}
		now := s.now()
		if err := s.repo.MarkCashPaid(ctx, payoutID, adminID, note, now); err != nil {
			return err
		}
		p.CashPaidAt, p.CashPaidBy, p.CashNote = &now, adminID, note
		out = p
		return nil
	})
	if err != nil {
		return nil, err
	}
	list := []Payout{*out}
	if err := s.fillPayoutNames(ctx, list); err != nil {
		return nil, err
	}
	return &list[0], nil
}

func (s *service) ListReferrals(ctx context.Context, status string, page, limit int) ([]AdminReferral, int64, error) {
	switch status {
	case "", StatusPending, StatusPaid, StatusReleased, StatusCancelled:
	default:
		status = ""
	}
	list, total, err := s.repo.ListReferrals(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]primitive.ObjectID, 0, len(list)*2)
	for _, r := range list {
		ids = append(ids, database.OID(r.ReferrerID), database.OID(r.ReferredID))
	}
	people, err := s.users.FindUsersByIDs(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	out := make([]AdminReferral, 0, len(list))
	for _, r := range list {
		row := AdminReferral{Referral: r}
		if u := people[database.OID(r.ReferrerID)]; u != nil {
			row.ReferrerName, row.ReferrerMobile = u.Name, u.Mobile
		}
		if u := people[database.OID(r.ReferredID)]; u != nil {
			row.ReferredName, row.ReferredMobile = u.Name, u.Mobile
		}
		out = append(out, row)
	}
	return out, total, nil
}
