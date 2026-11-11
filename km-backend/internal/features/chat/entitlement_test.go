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
}

func (r *limitRepo) ActivePass(ctx context.Context, userID primitive.ObjectID) (bool, int, error) {
	return r.hasPass, 0, nil
}

func (r *limitRepo) CountConversationsStartedSince(ctx context.Context, userID primitive.ObjectID, since time.Time) (int64, error) {
	r.since = since
	return r.startedToday, nil
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
	}{
		{"free user to recruiter", seeker, recruiter, false, 2, errGatePassed},
		{"free user's 4th chat today", seeker, recruiter, false, 3, ErrChatDailyLimit},
		{"free user to someone who isn't a recruiter", seeker, peer, false, 0, ErrChatPassRequired},
		{"pass holder to anyone", seeker, peer, true, 10, errGatePassed},
		{"recruiter has no limit", recruiter, peer, false, 10, errGatePassed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			repo := &limitRepo{hasPass: c.pass, startedToday: c.started}
			svc := NewService(repo, users, nil)
			_, err := svc.SendMessage(context.Background(), c.from, CreateMessageRequest{ReceiverID: c.to, Content: "hi"})
			if !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
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
