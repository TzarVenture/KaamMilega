package app_waitlist

import (
	"strings"
	"sync"
	"time"

	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type Api struct {
	ctrl *Controller
	cfg  *config.Config
}

func NewApi(ctrl *Controller, cfg *config.Config) api.Route {
	return &Api{ctrl: ctrl, cfg: cfg}
}

func (a *Api) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(a.cfg.JWTSecret)

	// Public "notify me when the app launches" form (InstantMilega landing page, download dialog)
	app.Post("/api/app-waitlist", rateLimit(5, 10*time.Minute), a.ctrl.Join)

	admin := app.Group("/api/admin/app-waitlist", jwtAuth, middleware.RequireRole("admin"))
	admin.Get("/", a.ctrl.List)
}

// clientIP is the address the reverse proxy saw (the last X-Forwarded-For hop, which the client
// cannot forge), or the direct peer when there is no proxy.
func clientIP(c *fiber.Ctx) string {
	if xff := c.Get(fiber.HeaderXForwardedFor); xff != "" {
		hops := strings.Split(xff, ",")
		if ip := strings.TrimSpace(hops[len(hops)-1]); ip != "" {
			return ip
		}
	}
	return c.IP()
}

// rateLimit allows max requests per client IP in each window (fixed window, in memory: enough
// for one public form on a single instance).
func rateLimit(max int, window time.Duration) fiber.Handler {
	type bucket struct {
		count int
		reset time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	lastSweep := time.Now()

	return func(c *fiber.Ctx) error {
		now := time.Now()
		ip := clientIP(c)

		mu.Lock()
		if now.Sub(lastSweep) > window {
			for k, b := range buckets {
				if now.After(b.reset) {
					delete(buckets, k)
				}
			}
			lastSweep = now
		}
		b := buckets[ip]
		if b == nil || now.After(b.reset) {
			b = &bucket{reset: now.Add(window)}
			buckets[ip] = b
		}
		b.count++
		over := b.count > max
		mu.Unlock()

		if over {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "Too many attempts. Please try again in a few minutes."})
		}
		return c.Next()
	}
}
