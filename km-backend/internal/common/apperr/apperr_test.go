package apperr

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

var errSample = New("SAMPLE_CODE", "sample message")

func TestCodeOf(t *testing.T) {
	if got := CodeOf(errSample); got != "SAMPLE_CODE" {
		t.Fatalf("CodeOf = %q", got)
	}
	if got := CodeOf(fmt.Errorf("wrapped: %w", errSample)); got != "SAMPLE_CODE" {
		t.Fatalf("CodeOf(wrapped) = %q", got)
	}
	if got := CodeOf(errors.New("plain")); got != "" {
		t.Fatalf("CodeOf(plain) = %q", got)
	}
	if !errors.Is(fmt.Errorf("x: %w", errSample), errSample) {
		t.Fatal("errors.Is must still match the sentinel")
	}
}

func body(t *testing.T, app *fiber.App, path string) map[string]any {
	t.Helper()
	res, err := app.Test(httptest.NewRequest("GET", path, nil))
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(res.Body)
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("%s: %v (%s)", path, err, raw)
	}
	return m
}

func TestCodesMiddleware(t *testing.T) {
	app := fiber.New()
	app.Use(Codes())
	app.Get("/plain", func(c *fiber.Ctx) error {
		return c.Status(404).JSON(fiber.Map{"error": "job not found", "amount": 1000000})
	})
	app.Get("/coded", func(c *fiber.Ctx) error {
		return c.Status(400).JSON(Body(fmt.Errorf("ctx: %w", errSample)))
	})
	app.Get("/ok", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": 1})
	})

	plain := body(t, app, "/plain")
	if plain["code"] != "NOT_FOUND" || plain["error"] != "job not found" {
		t.Fatalf("plain: %v", plain)
	}
	if n, ok := plain["amount"].(float64); !ok || n != 1000000 {
		t.Fatalf("other fields must be kept as written: %v", plain["amount"])
	}
	if coded := body(t, app, "/coded"); coded["code"] != "SAMPLE_CODE" {
		t.Fatalf("coded: %v", coded)
	}
	if ok := body(t, app, "/ok"); ok["code"] != nil {
		t.Fatalf("success responses must not get a code: %v", ok)
	}
}

func TestStatusOf(t *testing.T) {
	cases := []struct {
		err  error
		want int
	}{
		{errors.New("pq: connection reset"), fiber.StatusInternalServerError},
		{fmt.Errorf("saving: %w", errors.New("timeout")), fiber.StatusInternalServerError},
		{New("UNAUTHORIZED", "sign in"), fiber.StatusUnauthorized},
		{New("EVENT_NOT_FOUND", "event not found"), fiber.StatusNotFound},
		{fmt.Errorf("loading: %w", New("MENTORSHIP_NOT_FOUND", "gone")), fiber.StatusNotFound},
		{New("MENTORSHIP_FORBIDDEN", "not yours"), fiber.StatusForbidden},
		{New("PAYMENT_GATEWAY_ERROR", "down"), fiber.StatusServiceUnavailable},
		{New("PAYMENT_NOT_CONFIGURED", "off"), fiber.StatusServiceUnavailable},
		{New("MENTORSHIP_SELF_BOOKING", "your own"), fiber.StatusBadRequest},
		{New("WALLET_INSUFFICIENT", "top up"), fiber.StatusBadRequest},
	}
	for _, c := range cases {
		if got := StatusOf(c.err); got != c.want {
			t.Errorf("StatusOf(%v) = %d, want %d", c.err, got, c.want)
		}
	}
}

// A server fault answered with Respond reaches the user as the plain message, never its own text
func TestRespondHidesServerFaults(t *testing.T) {
	app := fiber.New()
	app.Use(Codes())
	app.Get("/fault", func(c *fiber.Ctx) error { return Respond(c, errors.New("pq: password authentication failed")) })
	app.Get("/refused", func(c *fiber.Ctx) error { return Respond(c, New("MENTORSHIP_SELF_BOOKING", "you can't book your own session")) })

	res, _ := app.Test(httptest.NewRequest("GET", "/fault", nil))
	if res.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("fault status %d", res.StatusCode)
	}
	if m := body(t, app, "/fault"); m["error"] != ServerErrorMessage || m["code"] != "SERVER_ERROR" {
		t.Fatalf("fault body %v", m)
	}
	res, _ = app.Test(httptest.NewRequest("GET", "/refused", nil))
	if res.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("refused status %d", res.StatusCode)
	}
	if m := body(t, app, "/refused"); m["code"] != "MENTORSHIP_SELF_BOOKING" {
		t.Fatalf("refused body %v", m)
	}
}
