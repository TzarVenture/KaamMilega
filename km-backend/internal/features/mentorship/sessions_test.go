package mentorship

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func validSession() CreateMentorshipRequest {
	return CreateMentorshipRequest{
		Title: "  Resume review  ", Description: "We go through your resume line by line.",
		Category: "Career", Duration: 45, Price: 499,
	}
}

func TestSessionFieldsAreChecked(t *testing.T) {
	f := newFixture()
	cases := map[string]struct {
		edit func(*CreateMentorshipRequest)
		want error
	}{
		"no title":       {func(r *CreateMentorshipRequest) { r.Title = "   " }, ErrSessionTitle},
		"long title":     {func(r *CreateMentorshipRequest) { r.Title = strings.Repeat("a", MaxTitleLength+1) }, ErrSessionTitle},
		"no category":    {func(r *CreateMentorshipRequest) { r.Category = "" }, ErrSessionDetails},
		"no description": {func(r *CreateMentorshipRequest) { r.Description = "" }, ErrSessionDetails},
		"too short":      {func(r *CreateMentorshipRequest) { r.Duration = 5 }, ErrSessionDuration},
		"too long":       {func(r *CreateMentorshipRequest) { r.Duration = 600 }, ErrSessionDuration},
		"free":           {func(r *CreateMentorshipRequest) { r.Price = 0 }, ErrSessionPrice},
		"negative price": {func(r *CreateMentorshipRequest) { r.Price = -100 }, ErrSessionPrice},
		"extra zero":     {func(r *CreateMentorshipRequest) { r.Price = 1000000 }, ErrSessionPrice},
		"under ₹99":      {func(r *CreateMentorshipRequest) { r.Price = 50 }, ErrSessionPrice},
		"unknown status": {func(r *CreateMentorshipRequest) { r.Status = "deleted" }, ErrSessionStatus},
	}
	for name, c := range cases {
		req := validSession()
		c.edit(&req)
		if _, err := f.svc.CreateMentorship(f.ctx, f.expert.Hex(), req); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", name, err, c.want)
		}
	}

	m, err := f.svc.CreateMentorship(f.ctx, f.expert.Hex(), validSession())
	if err != nil {
		t.Fatalf("valid session: %v", err)
	}
	if m.Title != "Resume review" || m.Status != "active" {
		t.Fatalf("saved %q with status %q, want the trimmed title and active", m.Title, m.Status)
	}
}

func TestOnlyTheOwnerEditsOrDeletesASession(t *testing.T) {
	f := newFixture()
	m, _ := f.svc.CreateMentorship(f.ctx, f.expert.Hex(), validSession())
	other := primitive.NewObjectID().Hex()

	if _, err := f.svc.UpdateMentorship(f.ctx, other, m.ID.Hex(), validSession()); !errors.Is(err, ErrNotYourSession) {
		t.Fatalf("edit by another expert: %v", err)
	}
	if err := f.svc.DeleteMentorship(f.ctx, other, m.ID.Hex()); !errors.Is(err, ErrNotYourSession) {
		t.Fatalf("delete by another expert: %v", err)
	}
	if _, err := f.svc.UpdateMentorship(f.ctx, f.expert.Hex(), primitive.NewObjectID().Hex(), validSession()); !errors.Is(err, ErrMentorshipGone) {
		t.Fatalf("edit of a missing session: %v", err)
	}

	paused := validSession()
	paused.Status = "inactive"
	got, err := f.svc.UpdateMentorship(f.ctx, f.expert.Hex(), m.ID.Hex(), paused)
	if err != nil || got.Status != "inactive" {
		t.Fatalf("pausing: status %v, err %v", got, err)
	}
}

func TestSessionWithOpenBookingsCanNotBeDeleted(t *testing.T) {
	f := newFixture()
	m, _ := f.svc.CreateMentorship(f.ctx, f.expert.Hex(), validSession())
	b := f.paidBooking(BookingConfirmed, methodWallet)
	b.MentorshipID = m.ID
	f.repo.bookings[b.ID.Hex()] = b

	if err := f.svc.DeleteMentorship(f.ctx, f.expert.Hex(), m.ID.Hex()); !errors.Is(err, ErrSessionHasBooked) {
		t.Fatalf("delete with a confirmed booking: %v", err)
	}

	b.Status = BookingCompleted
	if err := f.svc.DeleteMentorship(f.ctx, f.expert.Hex(), m.ID.Hex()); err != nil {
		t.Fatalf("delete once every booking is finished: %v", err)
	}
}

func TestSessionErrorsGetTheRightStatus(t *testing.T) {
	cases := map[error]int{
		ErrMentorshipGone:   fiber.StatusNotFound,
		ErrNotYourSession:   fiber.StatusForbidden,
		ErrSessionHasBooked: fiber.StatusConflict,
		ErrSessionPrice:     fiber.StatusBadRequest,
		errors.New("db"):    fiber.StatusInternalServerError,
	}
	for err, want := range cases {
		if got := sessionErrorStatus(err); got != want {
			t.Errorf("%v: got %d, want %d", err, got, want)
		}
	}
}

// Publishing a session needs a login; without one the route answers 401 before any handler runs
func TestPublishingASessionNeedsALogin(t *testing.T) {
	app := fiber.New()
	app.Use(recover.New())
	NewMentorshipApi(&MentorshipController{config: &config.Config{JWTSecret: "test-secret"}}).Setup(app)

	for _, r := range []struct{ method, path string }{
		{"POST", "/api/mentorships/"},
		{"PATCH", "/api/mentorships/6adc525aec708287c87ec7f5"},
		{"DELETE", "/api/mentorships/6adc525aec708287c87ec7f5"},
		{"PUT", "/api/mentorships/availability"},
	} {
		res, err := app.Test(httptest.NewRequest(r.method, r.path, nil))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != fiber.StatusUnauthorized {
			t.Errorf("%s %s without login: got %d, want 401", r.method, r.path, res.StatusCode)
		}
	}
}
