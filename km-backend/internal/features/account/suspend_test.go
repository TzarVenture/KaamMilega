package account

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestSuspendAndLift(t *testing.T) {
	svc, repo, _, u, now := setup(t)
	ctx := context.Background()
	admin := primitive.NewObjectID().Hex()

	until, err := svc.Suspend(ctx, admin, u.ID.Hex(), SuspendRequest{Reason: "Posted fake job offers", Days: 7})
	if err != nil {
		t.Fatal(err)
	}
	if want := now.Add(7 * 24 * time.Hour); until == nil || !until.Equal(want) {
		t.Fatalf("until %v, want %v", until, want)
	}
	if u.AccountStatus != user.AccountSuspended || u.SessionVersion != 1 || !repo.jobsHidden[u.ID] {
		t.Fatalf("status %q, sessions %d, jobs hidden %v", u.AccountStatus, u.SessionVersion, repo.jobsHidden[u.ID])
	}

	if err := svc.LiftSuspension(ctx, u.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if u.AccountStatus != user.AccountActive || u.SuspendedUntil != nil || u.SuspensionReason != "" || repo.jobsHidden[u.ID] {
		t.Fatalf("after lift: status %q until %v reason %q jobs hidden %v", u.AccountStatus, u.SuspendedUntil, u.SuspensionReason, repo.jobsHidden[u.ID])
	}
	if err := svc.LiftSuspension(ctx, u.ID.Hex()); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("lifting an active account: %v", err)
	}
}

func TestBanHasNoEndAndStaysAfterWorker(t *testing.T) {
	svc, _, _, u, now := setup(t)
	ctx := context.Background()
	until, err := svc.Suspend(ctx, primitive.NewObjectID().Hex(), u.ID.Hex(), SuspendRequest{Reason: "Harassing other members", Days: 0})
	if err != nil || until != nil {
		t.Fatalf("ban: until %v err %v", until, err)
	}
	*now = now.Add(5 * 365 * 24 * time.Hour)
	if n, _ := svc.LiftEndedSuspensions(ctx); n != 0 || u.AccountStatus != user.AccountSuspended {
		t.Fatalf("worker lifted a ban: n=%d status %q", n, u.AccountStatus)
	}
}

func TestWorkerLiftsEndedSuspension(t *testing.T) {
	svc, _, _, u, now := setup(t)
	ctx := context.Background()
	if _, err := svc.Suspend(ctx, primitive.NewObjectID().Hex(), u.ID.Hex(), SuspendRequest{Reason: "Spam messages to recruiters", Days: 3}); err != nil {
		t.Fatal(err)
	}
	*now = now.Add(2 * 24 * time.Hour)
	if n, _ := svc.LiftEndedSuspensions(ctx); n != 0 {
		t.Fatalf("lifted %d before the end date", n)
	}
	*now = now.Add(2 * 24 * time.Hour)
	if n, _ := svc.LiftEndedSuspensions(ctx); n != 1 || u.AccountStatus != user.AccountActive {
		t.Fatalf("after end date: n=%d status %q", n, u.AccountStatus)
	}
}

func TestSuspendRules(t *testing.T) {
	svc, repo, _, u, _ := setup(t)
	ctx := context.Background()
	admin := primitive.NewObjectID()
	other := &user.User{ID: primitive.NewObjectID(), Roles: []string{user.RoleAdmin}}
	repo.users[other.ID] = other

	cases := []struct {
		name   string
		by     string
		target string
		req    SuspendRequest
		want   error
	}{
		{"reason too short", admin.Hex(), u.ID.Hex(), SuspendRequest{Reason: "spam", Days: 1}, ErrSuspendReason},
		{"too many days", admin.Hex(), u.ID.Hex(), SuspendRequest{Reason: "Posted fake job offers", Days: 400}, ErrSuspendDays},
		{"another admin", admin.Hex(), other.ID.Hex(), SuspendRequest{Reason: "Posted fake job offers", Days: 1}, ErrSuspendNotAllow},
		{"self", u.ID.Hex(), u.ID.Hex(), SuspendRequest{Reason: "Posted fake job offers", Days: 1}, ErrSuspendNotAllow},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := svc.Suspend(ctx, c.by, c.target, c.req); !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}
	if u.AccountStatus == user.AccountSuspended {
		t.Fatal("a rejected request suspended the account")
	}
}
