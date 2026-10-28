package event

import (
	"net/http/httptest"
	"testing"

	"km-backend/internal/config"

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
