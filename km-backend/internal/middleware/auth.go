package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware validates JWT bearer token from Authorization header OR HttpOnly cookie
func AuthMiddleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var tokenString string

		// 1. Priority: Check Authorization header (Bearer <token>)
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 2. Fallback: Check HttpOnly cookie (km_auth_token)
		if tokenString == "" {
			tokenString = c.Cookies("km_auth_token")
		}

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing authorization token"})
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or expired token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token claims"})
		}

		userID, ok := claims["sub"].(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
		}

		c.Locals("user_id", userID)

		if rolesRaw, ok := claims["roles"]; ok {
			c.Locals("roles", rolesRaw)
		}
		if email, ok := claims["email"].(string); ok {
			c.Locals("email", email)
		}
		if mobile, ok := claims["mobile"].(string); ok {
			c.Locals("mobile", mobile)
		}

		return c.Next()
	}
}
