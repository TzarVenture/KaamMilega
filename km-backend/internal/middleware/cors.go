package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// allowedOrigin is our own sites, plus localhost outside production. Requests with credentials
// are only accepted from these, so another site can't act as a signed-in member.
func allowedOrigin(origin string, production bool) bool {
	if origin == "https://kaammilega.com" || strings.HasSuffix(origin, ".kaammilega.com") && strings.HasPrefix(origin, "https://") {
		return true
	}
	if production {
		return false
	}
	return origin == "http://localhost" || strings.HasPrefix(origin, "http://localhost:") ||
		origin == "http://127.0.0.1" || strings.HasPrefix(origin, "http://127.0.0.1:")
}

// CORSMiddleware lets our websites call the API with the login cookie
func CORSMiddleware(production bool) fiber.Handler {
	return cors.New(cors.Config{
		// Fiber refuses credentials with the default "*"; the function below decides the rest
		AllowOrigins:     "https://kaammilega.com",
		AllowOriginsFunc: func(origin string) bool { return allowedOrigin(origin, production) },
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Requested-With",
		AllowCredentials: true,
		ExposeHeaders:    "Retry-After",
		MaxAge:           600,
	})
}
