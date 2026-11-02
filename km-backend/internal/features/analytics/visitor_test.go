package analytics

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

const browserUA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"

func TestIsBot(t *testing.T) {
	for ua, want := range map[string]bool{
		browserUA: false,
		"":        true,
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)": true,
		"facebookexternalhit/1.1": true,
		"WhatsApp/2.23.20.0":      true,
		"curl/8.4.0":              true,
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36": true,
	} {
		if got := IsBot(ua); got != want {
			t.Errorf("IsBot(%q) = %v, want %v", ua, got, want)
		}
	}
}

func visitorApp() *fiber.App {
	app := fiber.New()
	app.Get("/feed", VisitorCookieMiddleware(false), func(c *fiber.Ctx) error { return c.SendStatus(200) })
	app.Get("/signed-in", func(c *fiber.Ctx) error {
		c.Locals("user_id", "6ad7a66fa21920ab56a205e6")
		return c.Next()
	}, VisitorCookieMiddleware(false), func(c *fiber.Ctx) error { return c.SendStatus(200) })
	app.Get("/who", func(c *fiber.Ctx) error { return c.SendString(VisitorID(c)) })
	return app
}

func get(t *testing.T, app *fiber.App, path, ua, cookie string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("User-Agent", ua)
	if cookie != "" {
		req.Header.Set("Cookie", VisitorCookie+"="+cookie)
	}
	res, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestVisitorCookieIsGivenToGuestsOnly(t *testing.T) {
	app := visitorApp()

	res := get(t, app, "/feed", browserUA, "")
	var id string
	for _, c := range res.Cookies() {
		if c.Name == VisitorCookie {
			id = c.Value
			if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
				t.Errorf("cookie flags: %+v", c)
			}
		}
	}
	if !validVisitorID(id) {
		t.Fatalf("guest got visitor ID %q", id)
	}

	// Kept, not replaced, once the browser has one
	if res := get(t, app, "/feed", browserUA, id); len(res.Cookies()) != 0 {
		t.Error("an existing visitor ID was replaced")
	}
	if res := get(t, app, "/signed-in", browserUA, ""); len(res.Cookies()) != 0 {
		t.Error("a signed-in member got a visitor ID")
	}
	if res := get(t, app, "/feed", "Googlebot/2.1", ""); len(res.Cookies()) != 0 {
		t.Error("a bot got a visitor ID")
	}
}

func TestVisitorIDNeedsAValidCookieAndABrowser(t *testing.T) {
	app := visitorApp()
	id := strings.Repeat("ab", visitorIDLength/2)
	read := func(ua, cookie string) string {
		b, _ := io.ReadAll(get(t, app, "/who", ua, cookie).Body)
		return string(b)
	}
	if got := read(browserUA, id); got != id {
		t.Errorf("VisitorID = %q, want %q", got, id)
	}
	if got := read(browserUA, ""); got != "" {
		t.Errorf("no cookie gave %q", got)
	}
	if got := read(browserUA, "forged-<script>"); got != "" {
		t.Errorf("a malformed cookie gave %q", got)
	}
	if got := read("python-requests/2.31", id); got != "" {
		t.Errorf("a script gave %q", got)
	}
}
