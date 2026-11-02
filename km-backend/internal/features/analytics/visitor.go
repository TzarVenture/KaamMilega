package analytics

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// VisitorCookie holds an anonymous random ID, so a signed-out visitor counts once a day like a
// member does. It carries nothing about the person and is only read by analytics.
const VisitorCookie = "km_vid"

const visitorCookieAge = 365 * 24 * time.Hour

// visitorIDLength is 16 random bytes, hex encoded
const visitorIDLength = 32

func validVisitorID(id string) bool {
	if len(id) != visitorIDLength {
		return false
	}
	_, err := hex.DecodeString(id)
	return err == nil
}

// VisitorID is the guest's anonymous ID, or "" when they have none yet or are a bot. A guest
// only counts once the cookie has made a round trip, so clients that drop cookies (most
// scripts and crawlers) are never counted.
func VisitorID(c *fiber.Ctx) string {
	if IsBot(c.Get(fiber.HeaderUserAgent)) {
		return ""
	}
	id := c.Cookies(VisitorCookie)
	if !validVisitorID(id) {
		return ""
	}
	return id
}

// VisitorCookieMiddleware gives a signed-out visitor an anonymous ID on pages whose views count
// (the feed), before any impression is sent. Signed-in members and bots don't get one.
func VisitorCookieMiddleware(secure bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if id, _ := c.Locals("user_id").(string); id != "" {
			return c.Next()
		}
		if validVisitorID(c.Cookies(VisitorCookie)) || IsBot(c.Get(fiber.HeaderUserAgent)) {
			return c.Next()
		}
		b := make([]byte, visitorIDLength/2)
		if _, err := rand.Read(b); err != nil {
			return c.Next()
		}
		c.Cookie(&fiber.Cookie{
			Name:     VisitorCookie,
			Value:    hex.EncodeToString(b),
			Path:     "/",
			MaxAge:   int(visitorCookieAge / time.Second),
			Expires:  time.Now().Add(visitorCookieAge),
			HTTPOnly: true,
			Secure:   secure || c.Protocol() == "https",
			SameSite: "Lax",
		})
		return c.Next()
	}
}

// botMarkers are parts of the user agents of crawlers, link previewers and headless browsers
var botMarkers = []string{
	"bot", "crawl", "spider", "slurp", "preview", "facebookexternalhit", "whatsapp",
	"headless", "lighthouse", "pagespeed", "curl", "wget", "python", "go-http-client",
	"java/", "okhttp", "axios", "node-fetch", "postman", "monitor", "uptime",
}

// IsBot reports whether a user agent belongs to software rather than a person. An empty user
// agent counts as a bot: every browser sends one.
func IsBot(userAgent string) bool {
	ua := strings.ToLower(strings.TrimSpace(userAgent))
	if ua == "" {
		return true
	}
	for _, m := range botMarkers {
		if strings.Contains(ua, m) {
			return true
		}
	}
	return false
}
