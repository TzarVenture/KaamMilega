package middleware

import (
	"slices"

	"github.com/gofiber/fiber/v2"
)

// RequireRole allows the request only if the JWT roles claim (set by AuthMiddleware)
// contains at least one of the given roles. Must be registered after AuthMiddleware.
func RequireRole(allowed ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var roles []string
		switch v := c.Locals("roles").(type) {
		case []string:
			roles = v
		case []interface{}:
			for _, r := range v {
				if s, ok := r.(string); ok {
					roles = append(roles, s)
				}
			}
		}

		for _, r := range allowed {
			if slices.Contains(roles, r) {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}
}
