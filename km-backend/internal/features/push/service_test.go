package push

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"firebase.google.com/go/v4/messaging"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeRepo struct {
	tokens  map[string]Token
	deleted []string
}

func newFakeRepo() *fakeRepo { return &fakeRepo{tokens: map[string]Token{}} }

func (f *fakeRepo) Upsert(_ context.Context, t *Token) error { f.tokens[t.Token] = *t; return nil }
func (f *fakeRepo) Delete(_ context.Context, userID primitive.ObjectID, token string) error {
	if t, ok := f.tokens[token]; ok && t.UserID == userID {
		delete(f.tokens, token)
	}
	return nil
}
func (f *fakeRepo) DeleteTokens(_ context.Context, tokens []string) error {
	f.deleted = append(f.deleted, tokens...)
	for _, t := range tokens {
		delete(f.tokens, t)
	}
	return nil
}
func (f *fakeRepo) ForSession(_ context.Context, userID primitive.ObjectID, sv int) ([]Token, error) {
	var out []Token
	for _, t := range f.tokens {
		if t.UserID == userID && t.SessionVersion == sv {
			out = append(out, t)
		}
	}
	return out, nil
}
func (f *fakeRepo) Trim(context.Context, primitive.ObjectID, int) error { return nil }

type fakeUsers map[string]*user.User

func (f fakeUsers) FindUserByID(_ context.Context, id string) (*user.User, error) {
	if u, ok := f[id]; ok {
		return u, nil
	}
	return nil, errors.New("not found")
}

type fakeFCM struct {
	calls []*messaging.MulticastMessage
	fail  error
}

func (f *fakeFCM) SendEachForMulticast(_ context.Context, m *messaging.MulticastMessage) (*messaging.BatchResponse, error) {
	f.calls = append(f.calls, m)
	resp := &messaging.BatchResponse{}
	for range m.Tokens {
		resp.Responses = append(resp.Responses, &messaging.SendResponse{Success: f.fail == nil, Error: f.fail})
	}
	return resp, nil
}

const tokA = "token-aaaaaaaaaaaaaaaaaaaaaaaa"
const tokB = "token-bbbbbbbbbbbbbbbbbbbbbbbb"

func setup(u *user.User) (*Service, *fakeRepo, *fakeFCM) {
	repo, fcm := newFakeRepo(), &fakeFCM{}
	s := &Service{repo: repo, users: fakeUsers{u.ID.Hex(): u}, fcm: fcm, frontendURL: "https://kaammilega.com", now: time.Now}
	return s, repo, fcm
}

func activeUser() *user.User {
	u := &user.User{ID: primitive.NewObjectID(), SessionVersion: 3}
	u.Settings.PushNotifications = true
	return u
}

func TestRegisterValidatesAndRecordsSession(t *testing.T) {
	u := activeUser()
	s, repo, _ := setup(u)
	ctx := context.Background()

	if err := s.Register(ctx, u.ID.Hex(), RegisterRequest{Token: "short"}, ""); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("short token: got %v", err)
	}
	if err := s.Register(ctx, u.ID.Hex(), RegisterRequest{Token: "token with spaces in it ......"}, ""); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("token with spaces: got %v", err)
	}
	if err := s.Register(ctx, u.ID.Hex(), RegisterRequest{Token: tokA, Platform: "blackberry"}, ""); !errors.Is(err, ErrInvalidPlatform) {
		t.Fatalf("bad platform: got %v", err)
	}
	if err := s.Register(ctx, primitive.NewObjectID().Hex(), RegisterRequest{Token: tokA}, ""); !errors.Is(err, ErrUnknownUser) {
		t.Fatalf("unknown user: got %v", err)
	}
	if err := s.Register(ctx, u.ID.Hex(), RegisterRequest{Token: "  " + tokA + "  ", Platform: "Android"}, "UA"); err != nil {
		t.Fatal(err)
	}
	got := repo.tokens[tokA]
	if got.UserID != u.ID || got.Platform != PlatformAndroid || got.SessionVersion != 3 {
		t.Fatalf("stored %+v", got)
	}
}

func TestUnregisterOnlyOwnToken(t *testing.T) {
	u := activeUser()
	s, repo, _ := setup(u)
	repo.tokens[tokA] = Token{UserID: primitive.NewObjectID(), Token: tokA}
	if err := s.Unregister(context.Background(), u.ID.Hex(), UnregisterRequest{Token: tokA}); err != nil {
		t.Fatal(err)
	}
	if _, ok := repo.tokens[tokA]; !ok {
		t.Fatal("another user's token must not be removed")
	}
}

func TestDeliverRules(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(u *user.User)
		sends  bool
	}{
		{"active with push on", func(u *user.User) {}, true},
		{"push switched off", func(u *user.User) { u.Settings.PushNotifications = false }, false},
		{"deactivated", func(u *user.User) { u.AccountStatus = user.AccountDeactivated }, false},
		{"signed out everywhere since", func(u *user.User) { u.SessionVersion = 4 }, false},
	}
	for _, tc := range cases {
		u := activeUser()
		s, repo, fcm := setup(u)
		repo.tokens[tokA] = Token{UserID: u.ID, Token: tokA, SessionVersion: 3}
		tc.mutate(u)
		n := &notification.Notification{ID: primitive.NewObjectID(), UserID: u.ID, Title: "Hi", Message: "There", Link: "/jobs"}
		if err := s.deliver(context.Background(), n); err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if (len(fcm.calls) == 1) != tc.sends {
			t.Errorf("%s: sent=%v, want %v", tc.name, len(fcm.calls) == 1, tc.sends)
		}
	}
}

func TestDeliverKeepsTokensOnNonTokenErrors(t *testing.T) {
	u := activeUser()
	s, repo, fcm := setup(u)
	repo.tokens[tokA] = Token{UserID: u.ID, Token: tokA, SessionVersion: 3}
	repo.tokens[tokB] = Token{UserID: u.ID, Token: tokB, SessionVersion: 3}
	fcm.fail = errors.New("quota exceeded")
	n := &notification.Notification{ID: primitive.NewObjectID(), UserID: u.ID, Title: "Hi"}
	if err := s.deliver(context.Background(), n); err != nil {
		t.Fatal(err)
	}
	if len(repo.deleted) != 0 || len(repo.tokens) != 2 {
		t.Fatalf("tokens must survive a non-token error, deleted %v", repo.deleted)
	}
}

func TestBuildMessage(t *testing.T) {
	u := activeUser()
	s, _, _ := setup(u)
	actor := primitive.NewObjectID()
	n := &notification.Notification{
		ID: primitive.NewObjectID(), UserID: u.ID, ActorID: &actor, ActorName: "Priya",
		Type: notification.TypeChatMessage, Category: notification.CategoryMessages,
		Message: strings.Repeat("x", 300), Link: "/chat?user=1",
	}
	m := s.buildMessage(n, []string{tokA})
	if m.Notification.Title != "Priya" {
		t.Errorf("title falls back to actor, got %q", m.Notification.Title)
	}
	if len([]rune(m.Notification.Body)) > maxBody {
		t.Errorf("body not truncated: %d", len([]rune(m.Notification.Body)))
	}
	if m.Webpush.FCMOptions.Link != "https://kaammilega.com/chat?user=1" {
		t.Errorf("link %q", m.Webpush.FCMOptions.Link)
	}
	if m.Webpush.Notification.Tag != "km-chat-"+actor.Hex() || !m.Webpush.Notification.Renotify {
		t.Errorf("chat pushes share a tag per sender and renotify: %+v", m.Webpush.Notification)
	}
	if m.Android.Priority != "high" || m.Webpush.Headers["Urgency"] != "high" {
		t.Error("chat pushes are high priority")
	}
	if m.Data["link"] != "/chat?user=1" || m.Data["notification_id"] != n.ID.Hex() {
		t.Errorf("data %v", m.Data)
	}
	if m.APNS.Payload.Aps.Sound != "default" {
		t.Error("iOS sound")
	}
}

func TestSafePath(t *testing.T) {
	actor := primitive.NewObjectID()
	cases := []struct {
		n    notification.Notification
		want string
	}{
		{notification.Notification{Link: "/jobs/123"}, "/jobs/123"},
		{notification.Notification{Link: ""}, "/notifications"},
		{notification.Notification{Link: "https://evil.example"}, "/notifications"},
		{notification.Notification{Link: "//evil.example/x"}, "/notifications"},
		{notification.Notification{Link: "/\\evil.example"}, "/notifications"},
		{notification.Notification{Link: "javascript:alert(1)"}, "/notifications"},
		{notification.Notification{Link: "/candidate/applications/42"}, "/applications/42"},
		{notification.Notification{Link: "/candidate/interview"}, "/interviews"},
		{notification.Notification{Link: "/candidate/profile"}, "/profile"},
		{notification.Notification{Type: "connection_accepted", ActorID: &actor, Link: "/network"}, "/profile/" + actor.Hex()},
	}
	for _, tc := range cases {
		if got := safePath(&tc.n); got != tc.want {
			t.Errorf("safePath(%q) = %q, want %q", tc.n.Link, got, tc.want)
		}
	}
}

func TestCredentials(t *testing.T) {
	// No key configured: push stays off without an error
	if c, err := newFCMClient(&config.Config{}); c != nil || err != nil {
		t.Fatalf("no key: got %v, %v", c, err)
	}
	raw := `{"type":"service_account","project_id":"other-project"}`
	b, err := loadCredentials(&config.Config{FirebaseCredentialsJSON: base64.StdEncoding.EncodeToString([]byte(raw))})
	if err != nil || string(b) != raw {
		t.Fatalf("base64 key: %q, %v", b, err)
	}
	if _, err := loadCredentials(&config.Config{FirebaseCredentialsJSON: "not-a-key%%"}); err == nil {
		t.Fatal("garbage must be rejected")
	}
	// A key for another Firebase project is refused before any network call
	_, err = newFCMClient(&config.Config{FirebaseProjectID: "kaammilega-7a667", FirebaseCredentialsJSON: raw})
	if err == nil || !strings.Contains(err.Error(), "expected") {
		t.Fatalf("wrong project: %v", err)
	}
	if _, err := newFCMClient(&config.Config{FirebaseCredentialsJSON: `{"type":"authorized_user"}`}); err == nil {
		t.Fatal("non service-account key must be rejected")
	}
}
