package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// CORSMiddleware returns Fiber's built-in CORS middleware with secure credentials support
func CORSMiddleware() fiber.Handler {
	return cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			if origin == "" {
				return true
			}
			// Allow local development (any port on localhost or 127.0.0.1)
			if strings.HasPrefix(origin, "http://localhost:") || origin == "http://localhost" ||
				strings.HasPrefix(origin, "http://127.0.0.1:") || origin == "http://127.0.0.1" {
				return true
			}
			// Allow production & preview domains
			if origin == "https://kaammilega.com" || origin == "https://www.kaammilega.com" ||
				strings.HasSuffix(origin, ".kaammilega.com") || strings.HasSuffix(origin, ".vercel.app") {
				return true
			}
			return false
		},
		AllowOrigins:     "http://localhost:3000, http://127.0.0.1:3000, https://kaammilega.com, https://www.kaammilega.com",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Requested-With",
		AllowCredentials: true,
		ExposeHeaders:    "Set-Cookie",
	})
}
