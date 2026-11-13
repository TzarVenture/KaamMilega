package app_waitlist

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

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
