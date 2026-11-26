package chat

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type limitRepo struct {
	ChatRepository
	hasPass      bool
	startedToday int64
	since        time.Time
	passUsed     bool
	applied      bool // the receiver applied to one of the sender's jobs
}

func (r *limitRepo) HasApplied(ctx context.Context, candidateID, recruiterID primitive.ObjectID) (bool, error) {
	return r.applied, nil
}

// countingQuota records what was counted against a recruiter's plan
type countingQuota struct{ uses int }

func (q *countingQuota) Use(ctx context.Context, userID primitive.ObjectID, kind, refID string) (func(context.Context), error) {
	q.uses++
	return func(context.Context) {}, nil
}

func (r *limitRepo) ActivePass(ctx context.Context, userID primitive.ObjectID) (bool, int, error) {
	return r.hasPass, 0, nil
}

func (r *limitRepo) CountConversationsStartedSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error) {
	r.since = since
	return r.startedToday, nil
}

func (r *limitRepo) MarkPassBenefitUsed(ctx context.Context, userID primitive.ObjectID) error {
	r.passUsed = true
	return nil
}

func (r *limitRepo) IsBlockedEitherWay(ctx context.Context, a, b primitive.ObjectID) (bool, error) {
	return false, nil
}

func (r *limitRepo) GetConversationByParticipants(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error) {
	return nil, nil // always a new chat
}

// CreateConversation is reached only when the gate lets the chat through
var errGatePassed = errors.New("gate passed")

func (r *limitRepo) CreateConversation(ctx context.Context, participants []primitive.ObjectID) (*Conversation, error) {
	return nil, errGatePassed
}

type limitUsers struct {
	user.UserRepository
	roles map[string][]string
}

func (u limitUsers) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	return &user.User{Roles: u.roles[id], AccountStatus: "active"}, nil
}

func TestNewChatLimit(t *testing.T) {
	seeker, recruiter, peer := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	users := limitUsers{roles: map[string][]string{
		seeker.Hex():    {"user"},
		recruiter.Hex(): {"user", user.RoleRecruiter},
		peer.Hex():      {"user"},
	}}

	cases := []struct {
		name    string
		from    primitive.ObjectID
		to      primitive.ObjectID
		pass    bool
		started int64
		want    error
		used    bool // the chat counts as using the pass, so it can't be refunded (Q5)
	}{
		{"free user to recruiter", seeker, recruiter, false, 2, errGatePassed, false},
		{"free user's 4th chat today", seeker, recruiter, false, 3, ErrChatDailyLimit, false},
		{"free user to someone who isn't a recruiter", seeker, peer, false, 0, ErrChatPassRequired, false},
		{"pass holder to anyone", seeker, peer, true, 10, errGatePassed, true},
		{"pass holder's free chat with a recruiter", seeker, recruiter, true, 2, errGatePassed, false},
		{"pass holder's 4th chat with a recruiter", seeker, recruiter, true, 3, errGatePassed, true},
		{"pass holder to someone who isn't a recruiter", seeker, peer, true, 0, errGatePassed, true},
		{"recruiter has no limit", recruiter, peer, false, 10, errGatePassed, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			repo := &limitRepo{hasPass: c.pass, startedToday: c.started}
			svc := NewService(repo, users, nil, nil, nil)
			_, err := svc.SendMessage(context.Background(), c.from, CreateMessageRequest{ReceiverID: c.to, Content: "hi"})
			if !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
			if repo.passUsed != c.used {
				t.Fatalf("pass marked used = %v, want %v", repo.passUsed, c.used)
			}
		})
	}
}

// A recruiter's first chat with someone who applied to their job doesn't use a plan chat
func TestRecruiterChatWithApplicantIsFree(t *testing.T) {
	recruiter, person := primitive.NewObjectID(), primitive.NewObjectID()
	users := limitUsers{roles: map[string][]string{
		recruiter.Hex(): {"user", user.RoleRecruiter},
		person.Hex():    {"user"},
	}}
	for _, c := range []struct {
		name    string
		applied bool
		want    int
	}{
		{"own applicant", true, 0},
		{"someone who didn't apply", false, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			quota := &countingQuota{}
			svc := NewService(&limitRepo{applied: c.applied}, users, nil, quota, nil)
			_, err := svc.SendMessage(context.Background(), recruiter, CreateMessageRequest{ReceiverID: person, Content: "hi"})
			if !errors.Is(err, errGatePassed) {
				t.Fatalf("got %v", err)
			}
			if quota.uses != c.want {
				t.Fatalf("plan chats used = %d, want %d", quota.uses, c.want)
			}
		})
	}
}

func TestDailyLimitResetsAtMidnightIST(t *testing.T) {
	// 10 Nov 2026, 20:00 UTC is 11 Nov 01:30 in India, so the day started 10 Nov 18:30 UTC
	now := time.Date(2026, 11, 10, 20, 0, 0, 0, time.UTC)
	want := time.Date(2026, 11, 10, 18, 30, 0, 0, time.UTC)
	if got := startOfDayIST(now); !got.Equal(want) {
		t.Fatalf("start of day %v, want %v", got.UTC(), want)
	}
}
