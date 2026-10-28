package mentorship

import (
	"net/http/httptest"
	"testing"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// The public mentorship detail must open without a login, while the routes registered next to it under
// the same prefix still require one. (A login check on the whole group used to block it.)
func TestPublicDetailNeedsNoLogin(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}
	app := fiber.New()
	// The handlers have no service behind them here; a panic becomes a 500, never a 401
	app.Use(recover.New())
	NewMentorshipApi(&MentorshipController{config: cfg}).Setup(app)

	status := func(method, path string) int {
		res, err := app.Test(httptest.NewRequest(method, path, nil))
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode
	}

	if got := status("GET", "/api/mentorships/6adc525aec708287c87ec7f5"); got == fiber.StatusUnauthorized {
		t.Fatalf("GET /api/mentorships/6adc525aec708287c87ec7f5 without login: got 401, want the public mentorship detail")
	}
	if got := status("GET", "/api/mentorships/bookings/my"); got != fiber.StatusUnauthorized {
		t.Fatalf("GET /api/mentorships/bookings/my without login: got %d, want 401", got)
	}
}
