package middleware

import (
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func TestClientIP(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error { return c.SendString(ClientIP(c)) })
	get := func(xff, cf string) string {
		req := httptest.NewRequest("GET", "/", nil)
		if xff != "" {
			req.Header.Set(fiber.HeaderXForwardedFor, xff)
		}
		if cf != "" {
			req.Header.Set("CF-Connecting-IP", cf)
		}
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		b := make([]byte, 64)
		n, _ := res.Body.Read(b)
		return string(b[:n])
	}
	cases := []struct{ name, xff, cf, want string }{
		{"last proxy hop wins over forged earlier hops", "9.9.9.9, 10.0.0.5", "", "10.0.0.5"},
		{"through Cloudflare the visitor header is used", "1.2.3.4, 104.16.0.1", "5.6.7.8", "5.6.7.8"},
		{"forged visitor header without Cloudflare is ignored", "10.0.0.5", "5.6.7.8", "10.0.0.5"},
		{"garbage visitor header is ignored", "104.16.0.1", "not-an-ip", "104.16.0.1"},
	}
	for _, tc := range cases {
		if got := get(tc.xff, tc.cf); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestAllowedOrigin(t *testing.T) {
	cases := []struct {
		origin     string
		production bool
		want       bool
	}{
		{"https://kaammilega.com", true, true},
		{"https://www.kaammilega.com", true, true},
		{"http://www.kaammilega.com", true, false},
		{"https://kaammilega.com.evil.com", true, false},
		{"https://evilkaammilega.com", true, false},
		{"http://localhost:3000", true, false},
		{"http://localhost:3000", false, true},
		{"http://localhost.evil.com", false, false},
		{"https://km.vercel.app", false, false},
	}
	for _, tc := range cases {
		if got := allowedOrigin(tc.origin, tc.production); got != tc.want {
			t.Errorf("allowedOrigin(%q, production=%v) = %v, want %v", tc.origin, tc.production, got, tc.want)
		}
	}
}

func TestClampPageSize(t *testing.T) {
	app := fiber.New()
	app.Use(ClampPageSize())
	app.Get("/", func(c *fiber.Ctx) error { return c.SendString(c.Query("limit", "default")) })
	for q, want := range map[string]string{"100000": "100", "20": "20", "-5": "default", "abc": "default"} {
		res, err := app.Test(httptest.NewRequest("GET", "/?limit="+q, nil))
		if err != nil {
			t.Fatal(err)
		}
		b := make([]byte, 32)
		n, _ := res.Body.Read(b)
		if got := string(b[:n]); got != want {
			t.Errorf("limit=%s: handler saw %q, want %q", q, got, want)
		}
	}
}

func TestLimiterWindow(t *testing.T) {
	l := newLimiter(2, time.Minute)
	now := time.Now()
	if ok, _ := l.hit("a", now); !ok {
		t.Fatal("first hit refused")
	}
	if ok, _ := l.hit("a", now); !ok {
		t.Fatal("second hit refused")
	}
	if ok, wait := l.hit("a", now); ok || wait <= 0 {
		t.Fatalf("third hit: ok=%v wait=%v, want refused with a wait", ok, wait)
	}
	if ok, _ := l.hit("b", now); !ok {
		t.Fatal("another key shares the count")
	}
	if ok, _ := l.hit("a", now.Add(61*time.Second)); !ok {
		t.Fatal("not reset after the window")
	}
}

func TestRateLimitsRules(t *testing.T) {
	app := fiber.New()
	app.Use(RateLimits(testSecret))
	app.All("/*", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })
	send := func(method, path, body, ip, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if body != "" {
			req = httptest.NewRequest(method, path, stringsReader(body))
			req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
		}
		req.Header.Set(fiber.HeaderXForwardedFor, ip)
		if token != "" {
			req.Header.Set(fiber.HeaderAuthorization, "Bearer "+token)
		}
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		rec := httptest.NewRecorder()
		rec.Code = res.StatusCode
		rec.Header().Set(fiber.HeaderRetryAfter, res.Header.Get(fiber.HeaderRetryAfter))
		return rec
	}

	// OTP send: 5 per address per 10 minutes
	for i := 1; i <= 5; i++ {
		if got := send("POST", "/api/auth/otp/send", `{"mobile":"900000000`+strconv.Itoa(i)+`"}`, "10.1.1.1", "").Code; got != 200 {
			t.Fatalf("otp send %d: %d", i, got)
		}
	}
	res := send("POST", "/api/auth/otp/send", `{"mobile":"9000000099"}`, "10.1.1.1", "")
	if res.Code != 429 || res.Header().Get(fiber.HeaderRetryAfter) == "" {
		t.Fatalf("6th otp send from one address: %d retry-after=%q", res.Code, res.Header().Get(fiber.HeaderRetryAfter))
	}

	// OTP send: 5 per phone number per hour, from any address
	for i := 1; i <= 5; i++ {
		if got := send("POST", "/api/auth/otp/send", `{"mobile":"9111111111"}`, "10.2.0."+strconv.Itoa(i), "").Code; got != 200 {
			t.Fatalf("otp to one phone %d: %d", i, got)
		}
	}
	if got := send("POST", "/api/auth/otp/send", `{"mobile":"9111111111"}`, "10.2.0.99", "").Code; got != 429 {
		t.Fatalf("6th code to one phone from a new address: %d, want 429", got)
	}

	// Per member: a valid token counts against the member, whatever the address
	tok := signToken(t, jwt.SigningMethodHS256, jwt.MapClaims{"sub": "abc123", "exp": time.Now().Add(time.Hour).Unix()})
	for i := 1; i <= 10; i++ {
		if got := send("PUT", "/api/user/password", "", "10.3.0."+strconv.Itoa(i), tok).Code; got != 200 {
			t.Fatalf("password change %d: %d", i, got)
		}
	}
	if got := send("PUT", "/api/user/password", "", "10.3.0.50", tok).Code; got != 429 {
		t.Fatalf("11th password change: %d, want 429", got)
	}

	// The reports pattern has alternatives; each must be anchored on its own
	if !anyRule("reports").path.MatchString("/api/feed/abc/report") || anyRule("reports").path.MatchString("/api/feed/abc/report/extra") {
		t.Fatal("reports pattern is not anchored")
	}

	// OPTIONS preflights are never limited
	for i := 0; i < 20; i++ {
		if got := send("OPTIONS", "/api/auth/otp/send", "", "10.1.1.1", "").Code; got == 429 {
			t.Fatal("preflight was rate limited")
		}
	}
}

func anyRule(name string) *rule {
	for _, rl := range limitRules(testSecret) {
		if rl.name == name {
			return rl
		}
	}
	panic("no rule " + name)
}

func stringsReader(s string) *strings.Reader { return strings.NewReader(s) }
