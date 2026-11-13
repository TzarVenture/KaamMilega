package middleware

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Rate limits are fixed windows kept in memory. That fits one API server; with several, move
// the counters to Redis so the servers share them.

// KeyFunc picks who a limit counts against. "" skips the limit for this request.
type KeyFunc func(c *fiber.Ctx) string

// limiter counts hits per key in fixed windows
type limiter struct {
	max    int
	window time.Duration

	mu        sync.Mutex
	buckets   map[string]*bucket
	lastSweep time.Time
}

type bucket struct {
	count int
	reset time.Time
}

func newLimiter(max int, window time.Duration) *limiter {
	return &limiter{max: max, window: window, buckets: map[string]*bucket{}, lastSweep: time.Now()}
}

// hit counts one request and reports whether it is allowed, and if not, how long until it is
func (l *limiter) hit(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if now.Sub(l.lastSweep) > l.window {
		for k, b := range l.buckets {
			if now.After(b.reset) {
				delete(l.buckets, k)
			}
		}
		l.lastSweep = now
	}
	b := l.buckets[key]
	if b == nil || now.After(b.reset) {
		b = &bucket{reset: now.Add(l.window)}
		l.buckets[key] = b
	}
	b.count++
	if b.count > l.max {
		return false, b.reset.Sub(now)
	}
	return true, 0
}

func tooMany(c *fiber.Ctx, wait time.Duration) error {
	secs := int(wait.Seconds()) + 1
	c.Set(fiber.HeaderRetryAfter, strconv.Itoa(secs))
	return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
		"error": "Too many requests. Please wait a moment and try again.",
		"code":  "TOO_MANY_REQUESTS",
	})
}

// Limit allows max requests per key in each window. Use it on a single route.
func Limit(max int, window time.Duration, key KeyFunc) fiber.Handler {
	l := newLimiter(max, window)
	return func(c *fiber.Ctx) error {
		k := key(c)
		if k == "" {
			return c.Next()
		}
		if ok, wait := l.hit(k, time.Now()); !ok {
			return tooMany(c, wait)
		}
		return c.Next()
	}
}

// ByIP counts against the visitor's address
func ByIP(c *fiber.Ctx) string { return "ip:" + ClientIP(c) }

// byUser counts against the signed-in member (signature-checked token, no database call), or
// their address when signed out. A forged token fails the signature, so it can't dodge a limit
// by inventing user IDs.
func byUser(secret string) KeyFunc {
	return func(c *fiber.Ctx) string {
		tok := strings.TrimPrefix(c.Get(fiber.HeaderAuthorization), "Bearer ")
		if tok == "" {
			tok = c.Cookies("km_auth_token")
		}
		if tok != "" {
			if _, id, err := parseToken(tok, secret); err == nil {
				return "user:" + id
			}
		}
		return ByIP(c)
	}
}

// byBodyField counts against a value in the JSON body (the phone or email a code is sent to),
// so one target can't be flooded from many addresses
func byBodyField(fields ...string) KeyFunc {
	return func(c *fiber.Ctx) string {
		var body map[string]any
		if json.Unmarshal(c.Body(), &body) != nil {
			return ""
		}
		for _, f := range fields {
			if v, ok := body[f].(string); ok && strings.TrimSpace(v) != "" {
				return f + ":" + strings.ToLower(strings.TrimSpace(v))
			}
		}
		return ""
	}
}

// rule is one row of the limits table
type rule struct {
	name   string
	method string         // "" matches every method
	path   *regexp.Regexp // matched against the request path
	max    int
	window time.Duration
	key    KeyFunc
	l      *limiter
}

func r(name, method, path string, max int, window time.Duration, key KeyFunc) *rule {
	return &rule{name: name, method: method, path: regexp.MustCompile("^(?:" + path + ")$"), max: max, window: window, key: key, l: newLimiter(max, window)}
}

// limitRules is every rate limit in one place. A request is checked against each matching row,
// so a route can have both an address limit and a per-account or per-target limit.
func limitRules(secret string) []*rule {
	user := byUser(secret)
	const min, hour, day = time.Minute, time.Hour, 24 * time.Hour
	return []*rule{
		// Sign-in: codes cost us an SMS or email, and passwords can be guessed
		r("otp-send-ip", "POST", `/api/auth/otp(/email)?/send`, 5, 10*min, ByIP),
		r("otp-send-target", "POST", `/api/auth/otp(/email)?/send`, 5, hour, byBodyField("mobile", "email")),
		r("otp-verify-ip", "POST", `/api/auth/otp(/email)?/verify`, 15, 10*min, ByIP),
		r("login-ip", "POST", `/api/auth/login/password`, 10, 15*min, ByIP),
		r("login-account", "POST", `/api/auth/login/password`, 5, 15*min, byBodyField("email", "identifier")),
		r("forgot-ip", "POST", `/api/auth/password/forgot`, 5, hour, ByIP),
		r("forgot-account", "POST", `/api/auth/password/forgot`, 3, hour, byBodyField("email")),
		r("reset-ip", "POST", `/api/auth/password/reset`, 10, hour, ByIP),
		r("register", "POST", `/api/user/register`, 10, hour, ByIP),
		r("account-code", "POST", `/api/user/account/verification-code`, 5, 10*min, user),
		r("password-change", "PUT", `/api/user/password`, 10, hour, user),

		// Things that message or cost other people
		r("chat-send", "POST", `/api/chats(/messages)?/?`, 60, min, user),
		r("connect", "POST", `/api/network/connect`, 40, hour, user),
		r("reports", "POST", `/api/(feed|chats)/[^/]+/report|/api/mentorships/bookings/[^/]+/report`, 20, hour, user),
		r("comment", "POST", `/api/feed/[^/]+/comments`, 60, 10*min, user),
		r("post", "POST", `/api/feed/?`, 30, hour, user),
		r("react", "PUT", `/api/feed/[^/]+/reaction`, 120, min, user),
		r("endorse", "POST", `/api/credentials/users/[^/]+/endorsements`, 60, min, user),
		r("apply", "POST", `/api/applications/?`, 50, hour, user),
		r("upload", "POST", `/api/files/upload`, 60, hour, user),

		// Money: orders and withdrawals
		r("orders", "POST", `/api/.*(create-order|pass/order)`, 20, 10*min, user),
		r("pay-verify", "POST", `/api/.*(verify-payment|pass/verify|topup/verify|payments/confirm)`, 30, 10*min, user),
		r("wallet-pay", "POST", `/api/.*(book-wallet|wallet-checkout|pay-wallet)`, 20, 10*min, user),
		r("withdraw", "POST", `/api/wallet/withdraw`, 10, day, user),
		r("disputes", "POST", `/api/wallet/disputes`, 10, day, user),

		// Counters anyone can hit
		r("impressions", "POST", `/api/(feed/impressions|ads/[^/]+/impression|courses/[^/]+/view|user/[^/]+/view)`, 120, min, ByIP),
		r("ad-click", "GET", `/api/ads/[^/]+/click`, 60, min, ByIP),

		// Admin tools that send messages
		r("sms", "POST", `/api/sms/send`, 30, hour, user),

		// Every other write: a broad ceiling per account
		r("writes", "", `/api/.*`, 300, min, func(c *fiber.Ctx) string {
			if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead || c.Method() == fiber.MethodOptions {
				return ""
			}
			return user(c)
		}),
		// And everything per address, to blunt floods (high, as offices and mobile networks
		// put many people behind one address). Image reads are left out: the website proxies
		// them through its own server, so in production they'd all share that one address.
		r("all", "", `/api/.*`, 1200, min, func(c *fiber.Ctx) string {
			if c.Method() == fiber.MethodGet && strings.HasPrefix(c.Path(), "/api/files/") {
				return ""
			}
			return ByIP(c)
		}),
	}
}

// RateLimits applies the limits table to every request
func RateLimits(secret string) fiber.Handler {
	rules := limitRules(secret)
	return func(c *fiber.Ctx) error {
		if c.Method() == fiber.MethodOptions {
			return c.Next()
		}
		path, method := c.Path(), c.Method()
		now := time.Now()
		for _, rl := range rules {
			if (rl.method != "" && rl.method != method) || !rl.path.MatchString(path) {
				continue
			}
			k := rl.key(c)
			if k == "" {
				continue
			}
			if ok, wait := rl.l.hit(rl.name+"|"+k, now); !ok {
				return tooMany(c, wait)
			}
		}
		return c.Next()
	}
}
