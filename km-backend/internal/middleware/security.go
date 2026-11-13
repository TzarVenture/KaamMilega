package middleware

import (
	"fmt"
	"log"
	"runtime/debug"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// Recover turns a crash inside a handler into a 500 for that one request, and logs where it
// happened, instead of taking the whole server down
func Recover() fiber.Handler {
	return recover.New(recover.Config{
		EnableStackTrace: true,
		StackTraceHandler: func(c *fiber.Ctx, e any) {
			log.Printf("panic: %s %s: %v\n%s", c.Method(), c.Path(), e, debug.Stack())
		},
	})
}

// SecurityHeaders are the standard browser protections for an API. Files and images are read by
// the website on another subdomain, so resources may be loaded cross-origin.
func SecurityHeaders(production bool) fiber.Handler {
	cfg := helmet.Config{
		XSSProtection:             "0", // the old filter is off in modern browsers and can cause leaks
		ContentTypeNosniff:        "nosniff",
		XFrameOptions:             "DENY",
		ReferrerPolicy:            "strict-origin-when-cross-origin",
		CrossOriginEmbedderPolicy: "unsafe-none",
		CrossOriginOpenerPolicy:   "same-origin",
		CrossOriginResourcePolicy: "cross-origin",
		OriginAgentCluster:        "?1",
		XDNSPrefetchControl:       "off",
		XDownloadOptions:          "noopen",
		XPermittedCrossDomain:     "none",
		// JSON needs nothing from a page; handlers that serve files set their own policy
		ContentSecurityPolicy: "default-src 'none'; frame-ancestors 'none'",
		PermissionPolicy:      "camera=(), microphone=(), geolocation=()",
	}
	if production {
		cfg.HSTSMaxAge = 31536000
		cfg.HSTSExcludeSubdomains = false
	}
	return helmet.New(cfg)
}

// RequestLog writes one line per request: status, method, path (no query string, which can hold
// a login token), time taken and the visitor's address
func RequestLog() fiber.Handler {
	return logger.New(logger.Config{
		Format:     "${time} ${status} ${method} ${path} ${latency} ip=${client_ip}\n",
		TimeFormat: "2006-01-02 15:04:05",
		CustomTags: map[string]logger.LogFunc{
			"client_ip": func(out logger.Buffer, c *fiber.Ctx, _ *logger.Data, _ string) (int, error) {
				return out.WriteString(ClientIP(c))
			},
		},
	})
}

// MaxPageSize is the most items a list endpoint returns in one request
const MaxPageSize = 100

// ClampPageSize caps limit / page_size / per_page on every request, so nobody can ask a list
// endpoint for a whole collection at once
func ClampPageSize() fiber.Handler {
	return func(c *fiber.Ctx) error {
		args := c.Request().URI().QueryArgs()
		for _, name := range []string{"limit", "page_size", "per_page", "pageSize"} {
			v := args.Peek(name)
			if len(v) == 0 {
				continue
			}
			n, err := strconv.Atoi(string(v))
			switch {
			case err != nil || n < 1:
				args.Del(name) // the handler's default applies
			case n > MaxPageSize:
				args.Set(name, fmt.Sprint(MaxPageSize))
			}
		}
		return c.Next()
	}
}
