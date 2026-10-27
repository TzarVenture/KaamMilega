package middleware

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Session errors returned by a SessionValidator. Each maps to a distinct API error code so the
// frontend can tell a revoked session (sign in again) from an inactive account (restore screen).
var (
	ErrSessionRevoked  = errors.New("session revoked")
	ErrAccountInactive = errors.New("account inactive")
)

// SessionState is what the validator needs to know about the token's user
type SessionState struct {
	Found          bool
	AccountStatus  string // "" / "active", "deactivated", "pending_deletion", "deleted"
	SessionVersion int
}

// SessionLoader fetches the current SessionState for a user (registered by the user module)
type SessionLoader func(ctx context.Context, userID string) (SessionState, error)

var (
	sessionLoader SessionLoader
	sessionCache  sync.Map // userID -> cachedSession
)

// sessionCacheTTL bounds how long a revoked session or new account status can go unnoticed
// by an instance that served the user recently
const sessionCacheTTL = 15 * time.Second

type cachedSession struct {
	state     SessionState
	fetchedAt time.Time
}

// SetSessionLoader enables per-request session checks (session version + account status).
// Without a loader the middleware only verifies the token signature and expiry.
func SetSessionLoader(loader SessionLoader) { sessionLoader = loader }

// InvalidateSession drops the cached state so the next request sees changes immediately
func InvalidateSession(userID string) { sessionCache.Delete(userID) }

// Endpoints a deactivated or pending-deletion account may still call: enough to load the
// profile, restore the account, export data and sign out.
var inactiveAllowedPrefixes = []string{
	"/api/user/account",
	"/api/user/profile",
	"/api/user/logout",
	"/api/auth/logout",
}

func inactiveAllowed(path string) bool {
	for _, p := range inactiveAllowedPrefixes {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}

func loadSession(ctx context.Context, userID string) (SessionState, error) {
	if v, ok := sessionCache.Load(userID); ok {
		if c := v.(cachedSession); time.Since(c.fetchedAt) < sessionCacheTTL {
			return c.state, nil
		}
	}
	state, err := sessionLoader(ctx, userID)
	if err != nil {
		return SessionState{}, err
	}
	sessionCache.Store(userID, cachedSession{state: state, fetchedAt: time.Now()})
	return state, nil
}

// checkSession enforces the session version and account status for a verified token.
// path is the request path (inactive accounts may reach a few account endpoints); an empty
// path means the caller needs a fully active account (websockets, optional auth).
func checkSession(ctx context.Context, userID string, claims jwt.MapClaims, path string) error {
	if sessionLoader == nil {
		return nil
	}
	state, err := loadSession(ctx, userID)
	if err != nil {
		// Fail closed would lock everyone out on a database blip; the token is already
		// signature-verified, so allow the request and let the next call re-check.
		return nil
	}
	if !state.Found || state.AccountStatus == "deleted" {
		return ErrSessionRevoked
	}
	tokenVersion := 0
	if v, ok := claims["sv"].(float64); ok {
		tokenVersion = int(v)
	}
	if tokenVersion != state.SessionVersion {
		return ErrSessionRevoked
	}
	if state.AccountStatus != "" && state.AccountStatus != "active" && (path == "" || !inactiveAllowed(path)) {
		return ErrAccountInactive
	}
	return nil
}

func parseToken(tokenString, jwtSecret string) (jwt.MapClaims, string, error) {
	// Only HS256 is ever issued; pinning it rules out algorithm-confusion tokens
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return []byte(jwtSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return nil, "", errors.New("invalid or expired token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, "", errors.New("invalid token claims")
	}
	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		return nil, "", errors.New("user ID not found in token")
	}
	return claims, userID, nil
}

// VerifyToken checks a login token outside the HTTP middleware (websockets, optional auth on
// public routes) with the same rules: HS256 signature, current session version, active account.
// It returns the user ID, or an error when the token must be treated as signed out.
func VerifyToken(ctx context.Context, tokenString, jwtSecret string) (string, error) {
	claims, userID, err := parseToken(tokenString, jwtSecret)
	if err != nil {
		return "", err
	}
	if err := checkSession(ctx, userID, claims, ""); err != nil {
		return "", err
	}
	return userID, nil
}

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

		claims, userID, err := parseToken(tokenString, jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or expired token"})
		}

		switch err := checkSession(c.Context(), userID, claims, c.Path()); {
		case errors.Is(err, ErrSessionRevoked):
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Your session has ended. Please sign in again.",
				"code":  "SESSION_REVOKED",
			})
		case errors.Is(err, ErrAccountInactive):
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Your account is deactivated or scheduled for deletion.",
				"code":  "ACCOUNT_INACTIVE",
			})
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
