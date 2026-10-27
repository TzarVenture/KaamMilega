package app_waitlist

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestRateLimitPerClient(t *testing.T) {
	app := fiber.New()
	app.Post("/", rateLimit(2, time.Minute), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	send := func(ip string) int {
		req := httptest.NewRequest("POST", "/", nil)
		req.Header.Set(fiber.HeaderXForwardedFor, "1.1.1.1, "+ip)
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode
	}

	for i, want := range []int{200, 200, 429} {
		if got := send("10.0.0.1"); got != want {
			t.Fatalf("request %d from first client: status %d, want %d", i+1, got, want)
		}
	}
	// The limit is per client (last proxy hop), not shared
	if got := send("10.0.0.2"); got != 200 {
		t.Fatalf("second client: status %d, want 200", got)
	}
}

type memRepo struct{ saved []*Entry }

func (m *memRepo) Upsert(_ context.Context, e *Entry) error { m.saved = append(m.saved, e); return nil }
func (m *memRepo) List(context.Context, string, int64, int64) ([]*Entry, int64, error) {
	return m.saved, int64(len(m.saved)), nil
}

func TestJoin(t *testing.T) {
	repo := &memRepo{}
	app := fiber.New()
	app.Post("/", NewController(repo).Join)

	post := func(body string) int {
		req := httptest.NewRequest("POST", "/", strings.NewReader(body))
		req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode
	}

	if got := post(`{"mobile":"+91 98765 43210","interest":"work","trade":"Electrician"}`); got != 200 {
		t.Fatalf("valid sign-up: status %d", got)
	}
	if len(repo.saved) != 1 || repo.saved[0].Mobile != "9876543210" || repo.saved[0].Trade != "Electrician" {
		t.Fatalf("saved %+v", repo.saved)
	}
	if got := post(`{"mobile":"12345","interest":"work"}`); got != 400 {
		t.Fatalf("bad mobile: status %d, want 400", got)
	}
	if len(repo.saved) != 1 {
		t.Fatal("invalid sign-up was stored")
	}
}
