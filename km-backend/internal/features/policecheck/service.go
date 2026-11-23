package policecheck

import (
	"context"
	"log"
	"strings"
	"time"

	"km-backend/internal/features/file"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	defaultLimit = 20
	maxLimit     = 50
	reasonMaxLen = 500
)

type Service interface {
	Mine(ctx context.Context, userID string) (*MyStatus, error)
	Submit(ctx context.Context, userID string, req SubmitRequest) (*MyStatus, error)
	Queue(ctx context.Context, status string, page, limit int) (*QueuePage, error)
	Review(ctx context.Context, adminID, userID string, req ReviewRequest) (*user.PoliceVerification, error)
}

type fileLookup interface {
	Get(ctx context.Context, id string) (*file.File, error)
}

type notifier interface {
	CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error)
}

type service struct {
	repo   Repository
	files  fileLookup
	notify notifier
	now    func() time.Time
}

func NewService(repo Repository, files file.FileRepository, notify notification.NotificationService) Service {
	return &service{repo: repo, files: files, notify: notify, now: time.Now}
}

func parseID(id string) (primitive.ObjectID, error) {
	oid, err := primitive.ObjectIDFromHex(strings.TrimSpace(id))
	if err != nil {
		return primitive.NilObjectID, ErrBadUserID
	}
	return oid, nil
}

func (s *service) status(v *user.PoliceVerification) *MyStatus {
	now := s.now()
	return &MyStatus{
		Verification: v,
		Badge:        v.Valid(now),
		ValidMonths:  user.PoliceCheckValidMonths,
		CanSubmit:    !v.Valid(now) || v.ExpiresAt.Sub(now) <= RenewWindow,
	}
}

func (s *service) Mine(ctx context.Context, userID string) (*MyStatus, error) {
	oid, err := parseID(userID)
	if err != nil {
		return nil, err
	}
	v, err := s.repo.Get(ctx, oid)
	if err != nil {
		return nil, err
	}
	return s.status(v), nil
}

// Submit saves the member's certificate for review. A new upload replaces one that is waiting or
// was rejected; an approved one can only be replaced near its expiry.
func (s *service) Submit(ctx context.Context, userID string, req SubmitRequest) (*MyStatus, error) {
	oid, err := parseID(userID)
	if err != nil {
		return nil, err
	}
	now := s.now()

	issued, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(req.IssuedOn), istLocation())
	if err != nil {
		return nil, ErrIssuedOn
	}
	if issued.After(now) {
		return nil, ErrFutureDate
	}
	expires := user.PoliceCheckExpiry(issued)
	if !expires.After(now) {
		return nil, ErrTooOld
	}

	fid := strings.TrimSpace(req.FileID)
	if _, err := primitive.ObjectIDFromHex(fid); err != nil {
		return nil, ErrFile
	}
	f, err := s.files.Get(ctx, fid)
	if err != nil || f == nil || f.UploadedBy != oid || f.Kind != FileKind {
		return nil, ErrFile
	}

	current, err := s.repo.Get(ctx, oid)
	if err != nil {
		return nil, err
	}
	if current.Valid(now) && current.ExpiresAt.Sub(now) > RenewWindow {
		return nil, ErrStillValid
	}

	v := &user.PoliceVerification{
		Status:      user.PoliceStatusPending,
		FileID:      fid,
		FileURL:     f.URL,
		IssuedOn:    issued,
		ExpiresAt:   expires,
		SubmittedAt: now,
	}
	if err := s.repo.Save(ctx, oid, v); err != nil {
		return nil, err
	}
	return s.status(v), nil
}

func (s *service) Queue(ctx context.Context, status string, page, limit int) (*QueuePage, error) {
	switch status {
	case user.PoliceStatusPending, user.PoliceStatusApproved, user.PoliceStatusRejected:
	default:
		status = user.PoliceStatusPending
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	items, total, err := s.repo.List(ctx, status, page, limit)
	if err != nil {
		return nil, err
	}
	return &QueuePage{Items: items, Total: total, Page: page, Limit: limit}, nil
}

// Review approves or rejects the certificate that is waiting. Approval starts the badge, which
// lasts until 12 months after the issue date.
func (s *service) Review(ctx context.Context, adminID, userID string, req ReviewRequest) (*user.PoliceVerification, error) {
	oid, err := parseID(userID)
	if err != nil {
		return nil, err
	}
	reason := strings.TrimSpace(req.Reason)
	switch req.Status {
	case user.PoliceStatusApproved:
		reason = ""
	case user.PoliceStatusRejected:
		if reason == "" {
			return nil, ErrReason
		}
		if r := []rune(reason); len(r) > reasonMaxLen {
			reason = string(r[:reasonMaxLen])
		}
	default:
		return nil, ErrDecision
	}

	current, err := s.repo.Get(ctx, oid)
	if err != nil {
		return nil, err
	}
	if current == nil || current.Status != user.PoliceStatusPending {
		return nil, ErrNotPending
	}
	// The admin decides on the file they opened; a newer upload needs its own look
	if req.FileID != "" && req.FileID != current.FileID {
		return nil, ErrNotPending
	}
	now := s.now()
	decided := *current
	decided.Status = req.Status
	decided.ReviewedAt = &now
	decided.ReviewedBy = adminID
	decided.RejectionReason = reason
	decided.ExpiresAt = user.PoliceCheckExpiry(current.IssuedOn)

	ok, err := s.repo.Decide(ctx, oid, current.FileID, &decided)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotPending
	}
	s.tell(oid, &decided)
	return &decided, nil
}

// tell lets the member know the outcome (bell, live update and push)
func (s *service) tell(userID primitive.ObjectID, v *user.PoliceVerification) {
	if s.notify == nil {
		return
	}
	req := notification.CreateNotificationRequest{
		UserID:   userID,
		Type:     notification.TypePoliceVerification,
		Category: notification.CategorySystem,
		Link:     "/settings?tab=verification",
		Metadata: map[string]interface{}{"status": v.Status},
	}
	if v.Status == user.PoliceStatusApproved {
		req.Title = "Police verification approved"
		req.Message = "The Police checked badge now shows on your profile until " + v.ExpiresAt.In(istLocation()).Format("2 Jan 2006") + "."
	} else {
		req.Title = "Police verification needs a new upload"
		req.Message = "Reason: " + v.RejectionReason
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := s.notify.CreateNotification(ctx, req); err != nil {
			log.Printf("police verification notification for %s: %v", userID.Hex(), err)
		}
	}()
}

// istLocation is India time; certificates carry Indian dates
func istLocation() *time.Location {
	if loc, err := time.LoadLocation("Asia/Kolkata"); err == nil {
		return loc
	}
	return time.FixedZone("IST", 5*3600+1800)
}
