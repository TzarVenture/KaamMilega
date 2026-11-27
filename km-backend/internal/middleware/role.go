package middleware

import (
	"slices"

	"github.com/gofiber/fiber/v2"
)

// Roles returns the request's roles (set by AuthMiddleware)
func Roles(c *fiber.Ctx) []string {
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
	return roles
}

// HasRole reports whether the request's roles include role
func HasRole(c *fiber.Ctx, role string) bool {
	return slices.Contains(Roles(c), role)
}

// RequireRole allows the request only if the JWT roles claim (set by AuthMiddleware)
// contains at least one of the given roles. Must be registered after AuthMiddleware.
func RequireRole(allowed ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles := Roles(c)
		for _, r := range allowed {
			if slices.Contains(roles, r) {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}
}
