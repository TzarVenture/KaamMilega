package account

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// ─── Fakes ──────────────────────────────────────────────────────────────────────

type fakeRepo struct {
	users       map[primitive.ObjectID]*user.User
	codes       []*ActionCode
	checks      deletionChecks
	jobsHidden  map[primitive.ObjectID]bool
	erased      []primitive.ObjectID
	files       []fileRecord
	deletedRecs []primitive.ObjectID
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{users: map[primitive.ObjectID]*user.User{}, jobsHidden: map[primitive.ObjectID]bool{}}
}

func (f *fakeRepo) FindUser(_ context.Context, id primitive.ObjectID) (*user.User, error) {
	u, ok := f.users[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *u
	return &cp, nil
}
func (f *fakeRepo) SaveCode(_ context.Context, c *ActionCode) error {
	c.ID = primitive.NewObjectID()
	f.codes = append(f.codes, c)
	return nil
}
func (f *fakeRepo) LatestCode(_ context.Context, uid primitive.ObjectID, now time.Time) (*ActionCode, error) {
	for i := len(f.codes) - 1; i >= 0; i-- {
		c := f.codes[i]
		if c.UserID == uid && !c.Used && c.ExpiresAt.After(now) {
			return c, nil
		}
	}
	return nil, nil
}
func (f *fakeRepo) CountCodesSince(_ context.Context, uid primitive.ObjectID, since time.Time) (int64, error) {
	var n int64
	for _, c := range f.codes {
		if c.UserID == uid && !c.CreatedAt.Before(since) {
			n++
		}
	}
	return n, nil
}
func (f *fakeRepo) code(id primitive.ObjectID) *ActionCode {
	for _, c := range f.codes {
		if c.ID == id {
			return c
		}
	}
	return nil
}
func (f *fakeRepo) IncrementCodeAttempts(_ context.Context, id primitive.ObjectID) error {
	f.code(id).Attempts++
	return nil
}
func (f *fakeRepo) MarkCodeUsed(_ context.Context, id primitive.ObjectID) error {
	f.code(id).Used = true
	return nil
}
func (f *fakeRepo) DeleteCodes(context.Context, primitive.ObjectID) error { return nil }
func (f *fakeRepo) Transition(_ context.Context, id primitive.ObjectID, from []string, set bson.M, unset []string, endSessions bool) (bool, error) {
	u, ok := f.users[id]
	if !ok {
		return false, nil
	}
	allowed := false
	for _, s := range from {
		if statusOf(u) == s {
			allowed = true
		}
	}
	if !allowed {
		return false, nil
	}
	if v, ok := set["account_status"].(string); ok {
		u.AccountStatus = v
	}
	if v, ok := set["deletion_scheduled_for"].(time.Time); ok {
		u.DeletionScheduledFor = &v
	}
	for _, field := range unset {
		if field == "deletion_scheduled_for" {
			u.DeletionScheduledFor = nil
		}
	}
	if endSessions {
		u.SessionVersion++
	}
	return true, nil
}
func (f *fakeRepo) SetJobsHidden(_ context.Context, id primitive.ObjectID, hidden bool) error {
	f.jobsHidden[id] = hidden
	return nil
}
func (f *fakeRepo) SaveFeedback(context.Context, string, string, string, time.Time) error { return nil }
func (f *fakeRepo) DeletionChecks(context.Context, primitive.ObjectID, time.Time) (*deletionChecks, error) {
	c := f.checks
	return &c, nil
}
func (f *fakeRepo) Export(context.Context, primitive.ObjectID) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}
func (f *fakeRepo) DueDeletions(_ context.Context, now time.Time, _ int64) ([]user.User, error) {
	var out []user.User
	for _, u := range f.users {
		if u.AccountStatus == user.AccountPendingDeletion && u.DeletionScheduledFor != nil && !u.DeletionScheduledFor.After(now) {
			out = append(out, *u)
		}
	}
	return out, nil
}
func (f *fakeRepo) EraseRelatedData(_ context.Context, u *user.User, _ time.Time) error {
	f.erased = append(f.erased, u.ID)
	return nil
}
func (f *fakeRepo) AnonymiseUser(_ context.Context, id primitive.ObjectID, _ time.Time) (bool, error) {
	u := f.users[id]
	if u.AccountStatus != user.AccountPendingDeletion {
		return false, nil
	}
	u.AccountStatus, u.Name, u.Mobile, u.Email = user.AccountDeleted, "Deleted user", "", ""
	return true, nil
}
func (f *fakeRepo) FilesByURL(context.Context, []string) ([]fileRecord, error) { return f.files, nil }
func (f *fakeRepo) DeleteFileRecords(_ context.Context, ids []primitive.ObjectID) error {
	f.deletedRecs = append(f.deletedRecs, ids...)
	return nil
}

type captureMailer struct {
	notification.Mailer
	lastCode string
}

func (m *captureMailer) SendEmailOTP(p notification.EmailOTPParams) error {
	m.lastCode = p.Code
	return nil
}
func (m *captureMailer) SendAccountNotice(notification.AccountNoticeParams) error { return nil }

type noSMS struct{}

func (noSMS) SendSMS(context.Context, string, string, []string) (interface{}, error) { return nil, nil }

func setup(t *testing.T) (*Service, *fakeRepo, *captureMailer, *user.User, *time.Time) {
	t.Helper()
	repo := newFakeRepo()
	mailer := &captureMailer{}
	u := &user.User{ID: primitive.NewObjectID(), Name: "Asha", Email: "asha@example.com", IsEmailVerified: true, Mobile: "9876543210"}
	repo.users[u.ID] = u
	svc := NewService(repo, mailer, noSMS{}, &config.Config{Environment: "production", FSPath: t.TempDir()})
	now := time.Date(2026, 10, 21, 10, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }
	return svc, repo, mailer, u, &now
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

func TestEvaluateBlocksOnMoneyAndSessions(t *testing.T) {
	ends := time.Now().Add(72 * time.Hour)
	blockers, warnings := evaluate(&deletionChecks{
		Wallet:              &walletState{Main: 50, Earnings: 120.5, Locked: 10, Bonus: 25},
		PendingTransactions: 1, OpenDisputes: 1, UpcomingSessions: 2,
		SubscriptionEndsAt: &ends, OpenJobs: 3,
	})
	codes := map[string]bool{}
	for _, b := range blockers {
		codes[b.Code] = true
	}
	for _, want := range []string{"wallet_earnings", "wallet_balance", "wallet_escrow", "pending_payouts", "open_disputes", "upcoming_sessions"} {
		if !codes[want] {
			t.Errorf("missing blocker %s", want)
		}
	}
	if len(warnings) != 3 { // bonus, subscription, open jobs
		t.Errorf("warnings = %d, want 3", len(warnings))
	}

	if b, w := evaluate(&deletionChecks{Wallet: &walletState{}}); len(b) != 0 || len(w) != 0 {
		t.Errorf("empty wallet: blockers %d warnings %d, want none", len(b), len(w))
	}
}

func TestCodeVerificationAndAttemptLimit(t *testing.T) {
	svc, repo, mailer, u, _ := setup(t)
	ctx := context.Background()
	if _, err := svc.SendCode(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if len(mailer.lastCode) != 6 {
		t.Fatalf("code %q should be 6 digits", mailer.lastCode)
	}
	if repo.codes[0].CodeHash == mailer.lastCode {
		t.Fatal("code must be stored hashed")
	}
	for i := 0; i < codeMaxAttempts-1; i++ {
		if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Code: "000000"}}); !errors.Is(err, ErrInvalidCode) {
			t.Fatalf("attempt %d: %v, want ErrInvalidCode", i, err)
		}
	}
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Code: "000000"}}); !errors.Is(err, ErrTooManyAttempts) {
		t.Fatalf("final attempt: %v, want ErrTooManyAttempts", err)
	}
	// The correct code no longer works once burned
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Code: mailer.lastCode}}); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("burned code: %v, want ErrInvalidCode", err)
	}
}

func TestSendCodeCooldown(t *testing.T) {
	svc, _, _, u, now := setup(t)
	ctx := context.Background()
	if _, err := svc.SendCode(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SendCode(ctx, u.ID.Hex()); !errors.Is(err, ErrCodeCooldown) {
		t.Fatalf("immediate resend: %v, want ErrCodeCooldown", err)
	}
	*now = now.Add(codeResendCooldown + time.Second)
	if _, err := svc.SendCode(ctx, u.ID.Hex()); err != nil {
		t.Fatalf("after cooldown: %v", err)
	}
}

func TestDeactivateAndReactivate(t *testing.T) {
	svc, repo, mailer, u, _ := setup(t)
	ctx := context.Background()
	if _, err := svc.SendCode(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Code: mailer.lastCode}}); err != nil {
		t.Fatal(err)
	}
	stored := repo.users[u.ID]
	if stored.AccountStatus != user.AccountDeactivated || stored.SessionVersion != 1 || !repo.jobsHidden[u.ID] {
		t.Fatalf("after deactivate: status %q version %d hidden %v", stored.AccountStatus, stored.SessionVersion, repo.jobsHidden[u.ID])
	}
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Code: mailer.lastCode}}); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("second deactivate: %v, want ErrInvalidState", err)
	}
	if err := svc.Reactivate(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if statusOf(repo.users[u.ID]) != user.AccountActive || repo.jobsHidden[u.ID] {
		t.Fatal("reactivate should restore the account and its jobs")
	}
}

func TestPasswordReauth(t *testing.T) {
	svc, repo, _, u, _ := setup(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct horse"), bcrypt.MinCost)
	repo.users[u.ID].Password = string(hash)
	ctx := context.Background()
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Password: "wrong"}}); !errors.Is(err, ErrIncorrectPassword) {
		t.Fatalf("wrong password: %v", err)
	}
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{}); !errors.Is(err, ErrReauthRequired) {
		t.Fatalf("no proof: %v", err)
	}
	if err := svc.Deactivate(ctx, u.ID.Hex(), DeactivateRequest{Reauth: Reauth{Password: "correct horse"}}); err != nil {
		t.Fatalf("correct password: %v", err)
	}
}

func TestDeletionRules(t *testing.T) {
	svc, repo, mailer, u, now := setup(t)
	ctx := context.Background()
	if _, err := svc.SendCode(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	good := DeleteRequest{Reauth: Reauth{Code: mailer.lastCode}, Confirm: "DELETE"}

	bad := good
	bad.Confirm = "delete"
	if _, _, err := svc.RequestDeletion(ctx, u.ID.Hex(), bad); !errors.Is(err, ErrConfirmPhrase) {
		t.Fatalf("lowercase confirm: %v", err)
	}

	repo.checks = deletionChecks{Wallet: &walletState{Earnings: 500}}
	if _, blockers, err := svc.RequestDeletion(ctx, u.ID.Hex(), good); !errors.Is(err, ErrBlocked) || len(blockers) != 1 {
		t.Fatalf("with balance: err %v blockers %d", err, len(blockers))
	}

	repo.checks = deletionChecks{OpenJobs: 2}
	if _, _, err := svc.RequestDeletion(ctx, u.ID.Hex(), good); !errors.Is(err, ErrAcknowledge) {
		t.Fatalf("unacknowledged warnings: %v", err)
	}

	good.AcknowledgeWarnings = true
	scheduled, _, err := svc.RequestDeletion(ctx, u.ID.Hex(), good)
	if err != nil {
		t.Fatal(err)
	}
	if want := now.Add(DeletionGracePeriod); !scheduled.Equal(want) {
		t.Fatalf("scheduled %v, want %v", scheduled, want)
	}
	if repo.users[u.ID].AccountStatus != user.AccountPendingDeletion || repo.users[u.ID].SessionVersion != 1 {
		t.Fatal("deletion request should mark pending and sign out everywhere")
	}

	if err := svc.CancelDeletion(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if statusOf(repo.users[u.ID]) != user.AccountActive || repo.users[u.ID].DeletionScheduledFor != nil {
		t.Fatal("cancel should restore the account")
	}
}

func TestWorkerDeletesOnlyDueUnblockedAccounts(t *testing.T) {
	svc, repo, _, u, now := setup(t)
	ctx := context.Background()
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)
	u.AccountStatus = user.AccountPendingDeletion
	u.DeletionScheduledFor = &past

	notDue := &user.User{ID: primitive.NewObjectID(), AccountStatus: user.AccountPendingDeletion, DeletionScheduledFor: &future}
	repo.users[notDue.ID] = notDue

	// A refund landed during the grace period: postponed
	repo.checks = deletionChecks{Wallet: &walletState{Main: 99}}
	if n, err := svc.ProcessDueDeletions(ctx); err != nil || n != 0 {
		t.Fatalf("blocked run: n=%d err=%v", n, err)
	}
	if repo.users[u.ID].AccountStatus != user.AccountPendingDeletion {
		t.Fatal("blocked account must stay pending")
	}

	repo.checks = deletionChecks{}
	if n, err := svc.ProcessDueDeletions(ctx); err != nil || n != 1 {
		t.Fatalf("clear run: n=%d err=%v", n, err)
	}
	if got := repo.users[u.ID]; got.AccountStatus != user.AccountDeleted || got.Email != "" || got.Mobile != "" {
		t.Fatalf("not anonymised: %+v", got)
	}
	if len(repo.erased) != 1 || repo.erased[0] != u.ID {
		t.Fatal("related data must be erased before anonymising")
	}
	if notDue.AccountStatus != user.AccountPendingDeletion {
		t.Fatal("account still in grace period must not be touched")
	}
}

func TestUploadedFilesAreRemovedOnlyInsideUploadDir(t *testing.T) {
	svc, repo, _, u, _ := setup(t)
	inside := filepath.Join(svc.cfg.FSPath, "photo.jpg")
	outsideDir := t.TempDir()
	outside := filepath.Join(outsideDir, "keep.txt")
	for _, p := range []string{inside, outside} {
		if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	insideID, outsideID := primitive.NewObjectID(), primitive.NewObjectID()
	repo.files = []fileRecord{{ID: insideID, Path: inside}, {ID: outsideID, Path: outside}}
	u.ProfileImage = "http://files/photo.jpg"

	svc.deleteUploadedFiles(context.Background(), u)

	if _, err := os.Stat(inside); !os.IsNotExist(err) {
		t.Error("upload inside FS_PATH should be deleted")
	}
	if _, err := os.Stat(outside); err != nil {
		t.Error("file outside FS_PATH must never be deleted")
	}
	if len(repo.deletedRecs) != 1 || repo.deletedRecs[0] != insideID {
		t.Errorf("deleted records %v, want only the inside file", repo.deletedRecs)
	}
}

func TestMasking(t *testing.T) {
	if got := maskEmail("rahul.sharma@gmail.com"); got != "ra•••@gmail.com" {
		t.Errorf("maskEmail = %q", got)
	}
	if got := maskMobile("9876543210"); got != "•••••• 3210" {
		t.Errorf("maskMobile = %q", got)
	}
}
