package event

import (
	"net/http/httptest"
	"testing"

	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// The public event detail must open without a login, while the routes registered next to it under
// the same prefix still require one. (A login check on the whole group used to block it.)
func TestPublicDetailNeedsNoLogin(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}
	app := fiber.New()
	// The handlers have no service behind them here; a panic becomes a 500, never a 401
	app.Use(recover.New())
	NewEventApi(&EventController{}, cfg).Setup(app)

	status := func(method, path string) int {
		res, err := app.Test(httptest.NewRequest(method, path, nil))
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode
	}

	if got := status("GET", "/api/events/6adc525aec708287c87ec7f5"); got == fiber.StatusUnauthorized {
		t.Fatalf("GET /api/events/6adc525aec708287c87ec7f5 without login: got 401, want the public event detail")
	}
	if got := status("GET", "/api/events/my/tickets"); got != fiber.StatusUnauthorized {
		t.Fatalf("GET /api/events/my/tickets without login: got %d, want 401", got)
	}
}

// Experts, recruiters and admins may host an event; a member with only the user role may not
func TestWhoCanHostAnEvent(t *testing.T) {
	for role, want := range map[string]int{"expert": 200, "recruiter": 200, "admin": 200, "user": 403} {
		app := fiber.New()
		app.Post("/", func(c *fiber.Ctx) error {
			c.Locals("roles", []string{"user", role})
			return c.Next()
		}, middleware.RequireRole(HostRoles...), func(c *fiber.Ctx) error { return c.SendStatus(200) })
		res, err := app.Test(httptest.NewRequest("POST", "/", nil))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != want {
			t.Errorf("%s: got %d, want %d", role, res.StatusCode, want)
		}
	}
}
