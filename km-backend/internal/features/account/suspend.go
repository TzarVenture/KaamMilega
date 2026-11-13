package account

import (
	"context"
	"log"
	"slices"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"
	"km-backend/internal/middleware"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Suspensions are admin actions against an account that broke the rules. A suspension has an
// end date; one without an end date is a ban. While it lasts the account is treated like a
// deactivated one (hidden everywhere, jobs hidden, signed out) and sign-in is refused with the
// reason. Ended suspensions are lifted by the account worker and at sign-in.

// MaxSuspensionDays caps a timed suspension; longer than that, ban instead
const MaxSuspensionDays = 365

var (
	ErrSuspendReason   = apperr.New("SUSPEND_REASON_REQUIRED", "add a reason the member will see (at least 10 characters)")
	ErrSuspendDays     = apperr.New("SUSPEND_DAYS_INVALID", "choose between 1 and 365 days, or a permanent ban")
	ErrSuspendNotAllow = apperr.New("SUSPEND_NOT_ALLOWED", "admins can't suspend themselves or other admins")
)

// SuspendRequest comes from the admin users page
type SuspendRequest struct {
	Reason string `json:"reason"`
	// Days the suspension lasts; 0 bans the account until an admin lifts it
	Days int `json:"days"`
}

// suspensionFields are cleared when a suspension ends
var suspensionFields = []string{"suspended_at", "suspended_until", "suspension_reason", "suspended_by"}

// Suspend blocks an active or deactivated account. It returns the end date (nil for a ban).
func (s *Service) Suspend(ctx context.Context, adminID, targetID string, req SuspendRequest) (*time.Time, error) {
	reason := strings.TrimSpace(req.Reason)
	if len([]rune(reason)) < 10 || len([]rune(reason)) > 500 {
		return nil, ErrSuspendReason
	}
	if req.Days < 0 || req.Days > MaxSuspensionDays {
		return nil, ErrSuspendDays
	}
	if adminID == targetID {
		return nil, ErrSuspendNotAllow
	}
	adminOID, err := primitive.ObjectIDFromHex(adminID)
	if err != nil {
		return nil, ErrSuspendNotAllow
	}
	u, oid, err := s.loadUser(ctx, targetID)
	if err != nil {
		return nil, err
	}
	if slices.Contains(u.Roles, user.RoleAdmin) {
		return nil, ErrSuspendNotAllow
	}

	now := s.now()
	set := bson.M{
		"account_status":    user.AccountSuspended,
		"suspended_at":      now,
		"suspension_reason": reason,
		"suspended_by":      adminOID,
	}
	unset := []string{}
	var until *time.Time
	if req.Days > 0 {
		end := now.Add(time.Duration(req.Days) * 24 * time.Hour)
		until = &end
		set["suspended_until"] = end
	} else {
		unset = append(unset, "suspended_until")
	}
	// Suspending again (to change the reason or length) is allowed
	ok, err := s.repo.Transition(ctx, oid, []string{user.AccountActive, user.AccountDeactivated, user.AccountSuspended}, set, unset, true)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrInvalidState
	}
	middleware.InvalidateSession(targetID)
	if err := s.repo.SetJobsHidden(ctx, oid, true); err != nil {
		log.Printf("[account] hide jobs for suspended %s: %v", targetID, err)
	}
	s.notifySuspension(u, notification.AccountNoticeSuspended, until, reason)
	return until, nil
}

// LiftSuspension makes a suspended account active again
func (s *Service) LiftSuspension(ctx context.Context, targetID string) error {
	u, oid, err := s.loadUser(ctx, targetID)
	if err != nil {
		return err
	}
	if err := s.lift(ctx, oid); err != nil {
		return err
	}
	s.notifySuspension(u, notification.AccountNoticeSuspensionLifted, nil, "")
	return nil
}

func (s *Service) lift(ctx context.Context, oid primitive.ObjectID) error {
	ok, err := s.repo.Transition(ctx, oid, []string{user.AccountSuspended},
		bson.M{"account_status": user.AccountActive}, suspensionFields, false)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidState
	}
	middleware.InvalidateSession(oid.Hex())
	return s.repo.SetJobsHidden(ctx, oid, false)
}

// LiftEndedSuspensions runs from the account worker
func (s *Service) LiftEndedSuspensions(ctx context.Context) (int, error) {
	ids, err := s.repo.EndedSuspensions(ctx, s.now(), 200)
	if err != nil {
		return 0, err
	}
	lifted := 0
	for _, id := range ids {
		if err := s.lift(ctx, id); err != nil {
			log.Printf("[account] lift suspension %s: %v", id.Hex(), err)
			continue
		}
		lifted++
	}
	return lifted, nil
}

func (s *Service) notifySuspension(u *user.User, kind string, until *time.Time, reason string) {
	// On their phone too (and in the bell once they can sign in again)
	if s.notices != nil {
		title, msg := "Your account is active again", "You can use KaamMilega as usual."
		if kind == notification.AccountNoticeSuspended {
			title, msg = "Your account is suspended", "Your account is suspended. Check your email for the reason."
			if until != nil {
				msg = "Your account is suspended until " + until.In(time.FixedZone("IST", 5*3600+1800)).Format("2 Jan 2006, 3:04 PM") + ". Check your email for the reason."
			}
		}
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if _, err := s.notices.CreateNotification(ctx, notification.CreateNotificationRequest{
				UserID: u.ID, Type: notification.TypeAccount, Category: notification.CategorySystem,
				Title: title, Message: msg, Link: "/settings",
			}); err != nil {
				log.Printf("[account] %s notification failed: %v", kind, err)
			}
		}()
	}
	if u.Email == "" || !u.IsEmailVerified {
		return
	}
	go func() {
		if err := s.mailer.SendAccountNotice(notification.AccountNoticeParams{
			ToEmail: u.Email, UserName: u.Name, Kind: kind, ScheduledFor: until, Reason: reason,
		}); err != nil {
			log.Printf("[account] %s notice email failed: %v", kind, err)
		}
	}()
}
