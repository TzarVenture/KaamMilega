package policecheck

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/features/file"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type memRepo struct {
	byUser map[primitive.ObjectID]*user.PoliceVerification
}

func (m *memRepo) Get(_ context.Context, id primitive.ObjectID) (*user.PoliceVerification, error) {
	return m.byUser[id], nil
}

func (m *memRepo) Save(_ context.Context, id primitive.ObjectID, v *user.PoliceVerification) error {
	m.byUser[id] = v
	return nil
}

func (m *memRepo) Decide(_ context.Context, id primitive.ObjectID, fileID string, v *user.PoliceVerification) (bool, error) {
	cur := m.byUser[id]
	if cur == nil || cur.Status != user.PoliceStatusPending || cur.FileID != fileID {
		return false, nil
	}
	m.byUser[id] = v
	return true, nil
}

func (m *memRepo) List(context.Context, string, int, int) ([]QueueItem, int64, error) {
	return nil, 0, nil
}

type memFiles map[string]*file.File

func (f memFiles) Get(_ context.Context, id string) (*file.File, error) { return f[id], nil }

func setup(now time.Time) (*service, *memRepo, memFiles, primitive.ObjectID, string) {
	owner := primitive.NewObjectID()
	fid := primitive.NewObjectID()
	files := memFiles{fid.Hex(): {ID: fid, Kind: FileKind, UploadedBy: owner, URL: "/api/files/" + fid.Hex()}}
	repo := &memRepo{byUser: map[primitive.ObjectID]*user.PoliceVerification{}}
	s := &service{repo: repo, files: files, now: func() time.Time { return now }}
	return s, repo, files, owner, fid.Hex()
}

func TestSubmitChecksTheFileAndDate(t *testing.T) {
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	s, _, files, owner, fid := setup(now)
	ctx := context.Background()

	someoneElse := primitive.NewObjectID()
	other := primitive.NewObjectID()
	files[other.Hex()] = &file.File{ID: other, Kind: FileKind, UploadedBy: someoneElse}
	wrongKind := primitive.NewObjectID()
	files[wrongKind.Hex()] = &file.File{ID: wrongKind, Kind: "resume", UploadedBy: owner}

	cases := []struct {
		name string
		req  SubmitRequest
		want error
	}{
		{"someone else's file", SubmitRequest{FileID: other.Hex(), IssuedOn: "2026-10-01"}, ErrFile},
		{"not a certificate upload", SubmitRequest{FileID: wrongKind.Hex(), IssuedOn: "2026-10-01"}, ErrFile},
		{"missing file", SubmitRequest{FileID: "nope", IssuedOn: "2026-10-01"}, ErrFile},
		{"bad date", SubmitRequest{FileID: fid, IssuedOn: "01/10/2026"}, ErrIssuedOn},
		{"future date", SubmitRequest{FileID: fid, IssuedOn: "2026-12-01"}, ErrFutureDate},
		{"older than 12 months", SubmitRequest{FileID: fid, IssuedOn: "2025-11-01"}, ErrTooOld},
	}
	for _, c := range cases {
		if _, err := s.Submit(ctx, owner.Hex(), c.req); !errors.Is(err, c.want) {
			t.Errorf("%s: err = %v, want %v", c.name, err, c.want)
		}
	}

	res, err := s.Submit(ctx, owner.Hex(), SubmitRequest{FileID: fid, IssuedOn: "2026-10-01"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Verification.Status != user.PoliceStatusPending || res.Badge || !res.CanSubmit {
		t.Fatalf("status = %+v", res)
	}
	if want := time.Date(2027, 10, 1, 0, 0, 0, 0, istLocation()); !res.Verification.ExpiresAt.Equal(want) {
		t.Fatalf("expires = %v, want %v", res.Verification.ExpiresAt, want)
	}
}

func TestReviewGivesTheBadgeUntilExpiry(t *testing.T) {
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	s, repo, _, owner, fid := setup(now)
	ctx := context.Background()
	if _, err := s.Submit(ctx, owner.Hex(), SubmitRequest{FileID: fid, IssuedOn: "2026-10-01"}); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Review(ctx, "admin", owner.Hex(), ReviewRequest{Status: "maybe"}); !errors.Is(err, ErrDecision) {
		t.Fatalf("err = %v", err)
	}
	if _, err := s.Review(ctx, "admin", owner.Hex(), ReviewRequest{Status: user.PoliceStatusRejected}); !errors.Is(err, ErrReason) {
		t.Fatalf("err = %v", err)
	}
	// A decision about a file the member has since replaced is refused
	if _, err := s.Review(ctx, "admin", owner.Hex(), ReviewRequest{Status: user.PoliceStatusApproved, FileID: "older"}); !errors.Is(err, ErrNotPending) {
		t.Fatalf("err = %v", err)
	}
	v, err := s.Review(ctx, "admin", owner.Hex(), ReviewRequest{Status: user.PoliceStatusApproved, FileID: fid})
	if err != nil {
		t.Fatal(err)
	}
	if v.Status != user.PoliceStatusApproved || v.ReviewedBy != "admin" {
		t.Fatalf("decided = %+v", v)
	}
	// Reviewing twice is refused
	if _, err := s.Review(ctx, "admin", owner.Hex(), ReviewRequest{Status: user.PoliceStatusRejected, Reason: "late"}); !errors.Is(err, ErrNotPending) {
		t.Fatalf("err = %v", err)
	}

	u := &user.User{PoliceVerification: repo.byUser[owner]}
	if !user.HasBadge(user.BadgesOf(u, now), user.BadgePoliceChecked) {
		t.Fatal("approved certificate should give the badge")
	}
	if user.HasBadge(user.BadgesOf(u, v.ExpiresAt.Add(time.Second)), user.BadgePoliceChecked) {
		t.Fatal("the badge must end when the certificate expires")
	}

	// A valid approved certificate can't be replaced until its last 30 days
	mine, _ := s.Mine(ctx, owner.Hex())
	if !mine.Badge || mine.CanSubmit {
		t.Fatalf("mine = %+v", mine)
	}
	if _, err := s.Submit(ctx, owner.Hex(), SubmitRequest{FileID: fid, IssuedOn: "2026-11-01"}); !errors.Is(err, ErrStillValid) {
		t.Fatalf("err = %v", err)
	}
	s.now = func() time.Time { return v.ExpiresAt.Add(-10 * 24 * time.Hour) }
	if mine, _ := s.Mine(ctx, owner.Hex()); !mine.CanSubmit {
		t.Fatal("renewal should open in the last 30 days")
	}
}

func TestBadges(t *testing.T) {
	now := time.Now()
	cases := []struct {
		name string
		u    user.User
		want []string
	}{
		{"nothing", user.User{}, []string{}},
		{"verified company", user.User{VerificationStatus: "verified"}, []string{user.BadgeVerified}},
		{"approved expert", user.User{ExpertApprovalStatus: user.ExpertStatusApproved}, []string{user.BadgeVerified}},
		{"pending expert", user.User{ExpertApprovalStatus: user.ExpertStatusPending}, []string{}},
		{"top rated", user.User{RatingAverage: 4.5, RatingCount: 10}, []string{user.BadgeTopRated}},
		{"too few reviews", user.User{RatingAverage: 5, RatingCount: 9}, []string{}},
		{"average too low", user.User{RatingAverage: 4.49, RatingCount: 40}, []string{}},
		{"rejected certificate", user.User{PoliceVerification: &user.PoliceVerification{Status: user.PoliceStatusRejected, ExpiresAt: now.Add(time.Hour)}}, []string{}},
		{"all three", user.User{VerificationStatus: "verified", RatingAverage: 4.8, RatingCount: 12,
			PoliceVerification: &user.PoliceVerification{Status: user.PoliceStatusApproved, ExpiresAt: now.Add(time.Hour)}},
			[]string{user.BadgeVerified, user.BadgeTopRated, user.BadgePoliceChecked}},
	}
	for _, c := range cases {
		got := user.BadgesOf(&c.u, now)
		if len(got) != len(c.want) {
			t.Errorf("%s: badges = %v, want %v", c.name, got, c.want)
			continue
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Errorf("%s: badges = %v, want %v", c.name, got, c.want)
			}
		}
	}
}
