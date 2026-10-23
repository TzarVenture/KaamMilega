package account

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/sms"
	"km-backend/internal/features/user"
	"km-backend/internal/middleware"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo   Repository
	mailer notification.Mailer
	sms    sms.SMSService
	cfg    *config.Config
	now    func() time.Time
}

func NewService(repo Repository, mailer notification.Mailer, smsService sms.SMSService, cfg *config.Config) *Service {
	return &Service{repo: repo, mailer: mailer, sms: smsService, cfg: cfg, now: time.Now}
}

func (s *Service) loadUser(ctx context.Context, userID string) (*user.User, primitive.ObjectID, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, oid, ErrNotFound
	}
	u, err := s.repo.FindUser(ctx, oid)
	if err != nil {
		return nil, oid, err
	}
	if u.AccountStatus == user.AccountDeleted {
		return nil, oid, ErrNotFound
	}
	return u, oid, nil
}

func statusOf(u *user.User) string {
	if user.IsActiveAccount(u.AccountStatus) {
		return user.AccountActive
	}
	return u.AccountStatus
}

// ─── Verification codes ─────────────────────────────────────────────────────────

// codeChannel picks where codes go: a verified email first, then the mobile number
func codeChannel(u *user.User) CodeChannel {
	if u.Email != "" && u.IsEmailVerified {
		return CodeChannel{Channel: "email", Destination: maskEmail(u.Email)}
	}
	if u.Mobile != "" {
		return CodeChannel{Channel: "sms", Destination: maskMobile(u.Mobile)}
	}
	return CodeChannel{}
}

func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return "•••"
	}
	local := email[:at]
	keep := 2
	if len(local) <= 2 {
		keep = 1
	}
	return local[:keep] + "•••" + email[at:]
}

func maskMobile(mobile string) string {
	digits := strings.TrimSpace(mobile)
	if len(digits) <= 4 {
		return "••••"
	}
	return "•••••• " + digits[len(digits)-4:]
}

func hashCode(userID primitive.ObjectID, code string) string {
	sum := sha256.Sum256([]byte(userID.Hex() + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// SendCode sends a 6-digit verification code for a destructive account action
func (s *Service) SendCode(ctx context.Context, userID string) (*SendCodeResponse, error) {
	u, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	channel := codeChannel(u)
	if channel.Channel == "" {
		return nil, ErrNoChannel
	}

	now := s.now()
	if latest, err := s.repo.LatestCode(ctx, oid, now); err != nil {
		return nil, err
	} else if latest != nil && now.Sub(latest.CreatedAt) < codeResendCooldown {
		return nil, ErrCodeCooldown
	}
	if sent, err := s.repo.CountCodesSince(ctx, oid, now.Add(-time.Hour)); err != nil {
		return nil, err
	} else if sent >= codeMaxPerHour {
		return nil, ErrCodeLimit
	}

	code, err := newCode()
	if err != nil {
		return nil, err
	}
	if err := s.repo.SaveCode(ctx, &ActionCode{
		UserID: oid, CodeHash: hashCode(oid, code), Channel: channel.Channel,
		ExpiresAt: now.Add(codeTTL), CreatedAt: now,
	}); err != nil {
		return nil, err
	}

	switch channel.Channel {
	case "email":
		err = s.mailer.SendEmailOTP(notification.EmailOTPParams{
			ToEmail: u.Email, Code: code, Purpose: "account_action", UserName: u.Name,
		})
	case "sms":
		_, err = s.sms.SendSMS(ctx, u.Mobile, "KM_SMS_LOGIN_OTP", []string{code})
	}
	if err != nil {
		return nil, fmt.Errorf("could not send the code: %w", err)
	}
	if s.cfg.Environment != "production" {
		// Local development has no mail/SMS delivery
		log.Printf("[account] verification code for %s: %s", userID, code)
	}
	return &SendCodeResponse{CodeChannel: channel, ExpiresInSeconds: int(codeTTL.Seconds())}, nil
}

// verifyOwner checks the password (when one is set and given) or the latest verification code
func (s *Service) verifyOwner(ctx context.Context, u *user.User, oid primitive.ObjectID, r Reauth) error {
	if r.Password != "" {
		if u.Password == "" {
			return ErrReauthRequired
		}
		if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(r.Password)) != nil {
			return ErrIncorrectPassword
		}
		return nil
	}
	if strings.TrimSpace(r.Code) == "" {
		return ErrReauthRequired
	}
	latest, err := s.repo.LatestCode(ctx, oid, s.now())
	if err != nil {
		return err
	}
	if latest == nil {
		return ErrInvalidCode
	}
	if subtle.ConstantTimeCompare([]byte(latest.CodeHash), []byte(hashCode(oid, r.Code))) == 1 {
		return s.repo.MarkCodeUsed(ctx, latest.ID)
	}
	if latest.Attempts+1 >= codeMaxAttempts {
		_ = s.repo.MarkCodeUsed(ctx, latest.ID)
		return ErrTooManyAttempts
	}
	_ = s.repo.IncrementCodeAttempts(ctx, latest.ID)
	return ErrInvalidCode
}

// ─── Overview ───────────────────────────────────────────────────────────────────

func formatINR(v float64) string {
	return fmt.Sprintf("₹%.2f", v)
}

// evaluate turns the cross-feature checks into blockers and warnings
func evaluate(c *deletionChecks) ([]Blocker, []Warning) {
	blockers := []Blocker{}
	warnings := []Warning{}
	if w := c.Wallet; w != nil {
		if w.Earnings > 0.0049 {
			blockers = append(blockers, Blocker{
				Code: "wallet_earnings", Title: "Withdraw your earnings",
				Detail:      formatINR(w.Earnings) + " in earnings is still in your wallet.",
				ActionLabel: "Go to wallet", ActionURL: "/wallet",
			})
		}
		if w.Main > 0.0049 {
			blockers = append(blockers, Blocker{
				Code: "wallet_balance", Title: "Use or refund your wallet balance",
				Detail:      formatINR(w.Main) + " is in your wallet. Spend it, or contact support for a refund.",
				ActionLabel: "Go to wallet", ActionURL: "/wallet",
			})
		}
		if w.Locked > 0.0049 {
			blockers = append(blockers, Blocker{
				Code: "wallet_escrow", Title: "Payments on hold",
				Detail:      formatINR(w.Locked) + " is held for sessions or work in progress. It's released once they finish.",
				ActionLabel: "Go to wallet", ActionURL: "/wallet",
			})
		}
		if w.Bonus > 0.0049 {
			warnings = append(warnings, Warning{
				Code: "wallet_bonus", Title: "Bonus credits will be lost",
				Detail: formatINR(w.Bonus) + " in promotional credits can't be withdrawn and will be forfeited.",
			})
		}
	}
	if c.PendingTransactions > 0 {
		blockers = append(blockers, Blocker{
			Code: "pending_payouts", Title: "Payouts in progress",
			Detail:      fmt.Sprintf("%d payout or refund is still being processed.", c.PendingTransactions),
			ActionLabel: "Go to wallet", ActionURL: "/wallet",
		})
	}
	if c.OpenDisputes > 0 {
		blockers = append(blockers, Blocker{
			Code: "open_disputes", Title: "Open payment disputes",
			Detail:      fmt.Sprintf("%d dispute is still being reviewed.", c.OpenDisputes),
			ActionLabel: "View disputes", ActionURL: "/wallet",
		})
	}
	if c.UpcomingSessions > 0 {
		blockers = append(blockers, Blocker{
			Code: "upcoming_sessions", Title: "Upcoming mentorship sessions",
			Detail:      fmt.Sprintf("You have %d booked session(s). Complete or cancel them first.", c.UpcomingSessions),
			ActionLabel: "View sessions", ActionURL: "/mentorship/my-sessions",
		})
	}
	if c.SubscriptionEndsAt != nil {
		warnings = append(warnings, Warning{
			Code: "subscription", Title: "Your subscription will be cancelled",
			Detail: "Your Expert plan (valid until " + c.SubscriptionEndsAt.Format("2 Jan 2006") + ") ends with your account. Unused time isn't refunded.",
		})
	}
	if c.OpenJobs > 0 {
		warnings = append(warnings, Warning{
			Code: "open_jobs", Title: "Your job posts will close",
			Detail: fmt.Sprintf("%d open job post(s) are hidden now and closed permanently when your account is deleted.", c.OpenJobs),
		})
	}
	return blockers, warnings
}

func (s *Service) Overview(ctx context.Context, userID string) (*Overview, error) {
	u, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	checks, err := s.repo.DeletionChecks(ctx, oid, s.now())
	if err != nil {
		return nil, err
	}
	blockers, warnings := evaluate(checks)
	return &Overview{
		AccountStatus:        statusOf(u),
		DeactivatedAt:        u.DeactivatedAt,
		DeletionScheduledFor: u.DeletionScheduledFor,
		GracePeriodDays:      int(DeletionGracePeriod.Hours() / 24),
		HasPassword:          u.Password != "",
		CodeChannel:          codeChannel(u),
		Blockers:             blockers,
		Warnings:             warnings,
		CanDelete:            len(blockers) == 0,
	}, nil
}

// ─── Transitions ────────────────────────────────────────────────────────────────

func (s *Service) notify(u *user.User, kind string, scheduledFor *time.Time) {
	if u.Email == "" || !u.IsEmailVerified {
		return
	}
	go func() {
		if err := s.mailer.SendAccountNotice(notification.AccountNoticeParams{
			ToEmail: u.Email, UserName: u.Name, Kind: kind, ScheduledFor: scheduledFor,
		}); err != nil {
			log.Printf("[account] %s notice email failed: %v", kind, err)
		}
	}()
}

// Deactivate hides the account everywhere and signs the user out on every device
func (s *Service) Deactivate(ctx context.Context, userID string, req DeactivateRequest) error {
	u, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	if statusOf(u) != user.AccountActive {
		return ErrInvalidState
	}
	if err := s.verifyOwner(ctx, u, oid, req.Reauth); err != nil {
		return err
	}
	now := s.now()
	ok, err := s.repo.Transition(ctx, oid, []string{user.AccountActive},
		bson.M{"account_status": user.AccountDeactivated, "deactivated_at": now}, nil, true)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidState
	}
	middleware.InvalidateSession(userID)
	if err := s.repo.SetJobsHidden(ctx, oid, true); err != nil {
		log.Printf("[account] hide jobs for %s: %v", userID, err)
	}
	_ = s.repo.SaveFeedback(ctx, "deactivate", req.Reason, req.Feedback, now)
	s.notify(u, notification.AccountNoticeDeactivated, nil)
	return nil
}

// Reactivate restores a deactivated account (the user has just signed in again)
func (s *Service) Reactivate(ctx context.Context, userID string) error {
	u, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	if statusOf(u) != user.AccountDeactivated {
		return ErrInvalidState
	}
	// Bumping the version here too means no copy read while deactivated can be written back
	ok, err := s.repo.Transition(ctx, oid, []string{user.AccountDeactivated},
		bson.M{"account_status": user.AccountActive}, []string{"deactivated_at"}, true)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidState
	}
	middleware.InvalidateSession(userID)
	return s.repo.SetJobsHidden(ctx, oid, false)
}

// RequestDeletion schedules permanent deletion after the grace period and signs the user out
func (s *Service) RequestDeletion(ctx context.Context, userID string, req DeleteRequest) (*time.Time, []Blocker, error) {
	u, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	status := statusOf(u)
	if status != user.AccountActive && status != user.AccountDeactivated {
		return nil, nil, ErrInvalidState
	}
	if strings.TrimSpace(req.Confirm) != ConfirmDeletionPhrase {
		return nil, nil, ErrConfirmPhrase
	}
	now := s.now()
	checks, err := s.repo.DeletionChecks(ctx, oid, now)
	if err != nil {
		return nil, nil, err
	}
	blockers, warnings := evaluate(checks)
	if len(blockers) > 0 {
		return nil, blockers, ErrBlocked
	}
	if len(warnings) > 0 && !req.AcknowledgeWarnings {
		return nil, nil, ErrAcknowledge
	}
	if err := s.verifyOwner(ctx, u, oid, req.Reauth); err != nil {
		return nil, nil, err
	}

	scheduled := now.Add(DeletionGracePeriod)
	ok, err := s.repo.Transition(ctx, oid, []string{user.AccountActive, user.AccountDeactivated},
		bson.M{
			"account_status":         user.AccountPendingDeletion,
			"deletion_requested_at":  now,
			"deletion_scheduled_for": scheduled,
		}, nil, true)
	if err != nil {
		return nil, nil, err
	}
	if !ok {
		return nil, nil, ErrInvalidState
	}
	middleware.InvalidateSession(userID)
	if err := s.repo.SetJobsHidden(ctx, oid, true); err != nil {
		log.Printf("[account] hide jobs for %s: %v", userID, err)
	}
	_ = s.repo.SaveFeedback(ctx, "delete", req.Reason, req.Feedback, now)
	s.notify(u, notification.AccountNoticeDeletionScheduled, &scheduled)
	return &scheduled, nil, nil
}

// CancelDeletion restores an account during the grace period
func (s *Service) CancelDeletion(ctx context.Context, userID string) error {
	u, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	if statusOf(u) != user.AccountPendingDeletion {
		return ErrInvalidState
	}
	ok, err := s.repo.Transition(ctx, oid, []string{user.AccountPendingDeletion},
		bson.M{"account_status": user.AccountActive},
		[]string{"deletion_requested_at", "deletion_scheduled_for", "deactivated_at"}, true)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidState
	}
	middleware.InvalidateSession(userID)
	if err := s.repo.SetJobsHidden(ctx, oid, false); err != nil {
		log.Printf("[account] unhide jobs for %s: %v", userID, err)
	}
	s.notify(u, notification.AccountNoticeDeletionCancelled, nil)
	return nil
}

// Export returns a copy of the personal data held about the user (DPDP Act right to access)
func (s *Service) Export(ctx context.Context, userID string) (map[string]interface{}, error) {
	_, oid, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.Export(ctx, oid)
}

// ─── Final deletion (worker) ────────────────────────────────────────────────────

// ProcessDueDeletions anonymises accounts whose grace period has ended. Accounts that gained a
// blocker during the grace period (e.g. a refund landed in the wallet) are left pending and
// retried on the next run.
func (s *Service) ProcessDueDeletions(ctx context.Context) (deleted int, err error) {
	now := s.now()
	due, err := s.repo.DueDeletions(ctx, now, 50)
	if err != nil {
		return 0, err
	}
	for i := range due {
		u := &due[i]
		checks, err := s.repo.DeletionChecks(ctx, u.ID, now)
		if err != nil {
			log.Printf("[account] deletion checks for %s: %v", u.ID.Hex(), err)
			continue
		}
		if blockers, _ := evaluate(checks); len(blockers) > 0 {
			log.Printf("[account] deletion of %s postponed: %d blocker(s)", u.ID.Hex(), len(blockers))
			continue
		}
		// Related data first: if anything fails the account stays pending and is retried
		if err := s.repo.EraseRelatedData(ctx, u, now); err != nil {
			log.Printf("[account] erase related data for %s: %v", u.ID.Hex(), err)
			continue
		}
		s.deleteUploadedFiles(ctx, u)
		ok, err := s.repo.AnonymiseUser(ctx, u.ID, now)
		if err != nil {
			log.Printf("[account] anonymise %s: %v", u.ID.Hex(), err)
			continue
		}
		if !ok {
			continue // restored by the user in the meantime
		}
		middleware.InvalidateSession(u.ID.Hex())
		s.notify(u, notification.AccountNoticeDeleted, nil)
		deleted++
	}
	return deleted, nil
}

// deleteUploadedFiles removes the user's own uploads (photos, documents, resumes) from disk
func (s *Service) deleteUploadedFiles(ctx context.Context, u *user.User) {
	urls := []string{u.ProfileImage, u.CoverImage, u.CompanyLogo}
	for _, d := range u.CompanyDocuments {
		urls = append(urls, d.URL)
	}
	for _, d := range u.ExpertDocuments {
		urls = append(urls, d.URL)
	}
	clean := urls[:0]
	for _, v := range urls {
		if v != "" {
			clean = append(clean, v)
		}
	}
	files, err := s.repo.FilesByURL(ctx, clean)
	if err != nil {
		log.Printf("[account] find files for %s: %v", u.ID.Hex(), err)
		return
	}
	root, err := filepath.Abs(s.cfg.FSPath)
	if err != nil {
		return
	}
	var ids []primitive.ObjectID
	for _, f := range files {
		abs, err := filepath.Abs(f.Path)
		if err != nil {
			continue
		}
		// Never touch anything outside the upload directory
		if rel, err := filepath.Rel(root, abs); err != nil || strings.HasPrefix(rel, "..") {
			continue
		}
		if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
			log.Printf("[account] remove %s: %v", abs, err)
			continue
		}
		ids = append(ids, f.ID)
	}
	if err := s.repo.DeleteFileRecords(ctx, ids); err != nil {
		log.Printf("[account] delete file records for %s: %v", u.ID.Hex(), err)
	}
}
