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
	ErrSessionRevoked   = errors.New("session revoked")
	ErrAccountInactive  = errors.New("account inactive")
	ErrSignupIncomplete = errors.New("signup incomplete")
)

// SessionTTL is how long a login lasts without use. Each day of use renews it
// (see renewSession), so active people stay signed in.
const SessionTTL = 30 * 24 * time.Hour

// sessionRenewAfter is how old a token gets before a request swaps it for a fresh one
const sessionRenewAfter = 24 * time.Hour

// SecureCookies marks auth cookies Secure; set in production (cmd/main.go). Requests that
// arrive over HTTPS get Secure cookies either way.
var SecureCookies bool

// SessionState is what the validator needs to know about the token's user
type SessionState struct {
	Found          bool
	AccountStatus  string // "" / "active", "deactivated", "pending_deletion", "deleted"
	SessionVersion int
	// Roles as stored now. Roles in a token go stale when someone becomes a recruiter or an
	// Expert; nil means "use the token's roles".
	Roles []string
	// Incomplete is true for someone who verified their mobile but never finished sign-up
	Incomplete bool
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

// Endpoints someone who has not finished sign-up may call: their profile, the sign-up step
// itself (candidate name/city or the recruiter company form, with its logo and document
// uploads) and sign-out. Everything else waits until sign-up is done.
var incompleteAllowedPrefixes = []string{
	"/api/user/profile",
	"/api/user/register",
	"/api/user/logout",
	"/api/auth",
	"/api/files",
}

func inactiveAllowed(path string) bool {
	return hasAllowedPrefix(path, inactiveAllowedPrefixes)
}

func hasAllowedPrefix(path string, prefixes []string) bool {
	for _, p := range prefixes {
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

// checkSession enforces the session version, account status and sign-up state for a verified
// token, and returns the user's current roles (nil: use the token's). path is the request
// path (inactive or unfinished accounts may reach a few endpoints); an empty path means the
// caller needs a fully active account (websockets, optional auth).
func checkSession(ctx context.Context, userID string, claims jwt.MapClaims, path string) ([]string, error) {
	if sessionLoader == nil {
		return nil, nil
	}
	state, err := loadSession(ctx, userID)
	if err != nil {
		// Fail closed would lock everyone out on a database blip; the token is already
		// signature-verified, so allow the request and let the next call re-check.
		return nil, nil
	}
	if !state.Found || state.AccountStatus == "deleted" {
		return nil, ErrSessionRevoked
	}
	tokenVersion := 0
	if v, ok := claims["sv"].(float64); ok {
		tokenVersion = int(v)
	}
	if tokenVersion != state.SessionVersion {
		return nil, ErrSessionRevoked
	}
	if state.AccountStatus != "" && state.AccountStatus != "active" && (path == "" || !inactiveAllowed(path)) {
		return nil, ErrAccountInactive
	}
	if state.Incomplete && (path == "" || !hasAllowedPrefix(path, incompleteAllowedPrefixes)) {
		return nil, ErrSignupIncomplete
	}
	return state.Roles, nil
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
	if _, err := checkSession(ctx, userID, claims, ""); err != nil {
		return "", err
	}
	return userID, nil
}

// renewSession swaps a day-old cookie token for a fresh 30-day one, so a person who keeps
// using the site never gets signed out. Tokens sent in the Authorization header are left
// alone: their owner (an app) stores them itself.
func renewSession(c *fiber.Ctx, claims jwt.MapClaims, roles []string, jwtSecret string) {
	issued, _ := claims["iat"].(float64)
	if time.Since(time.Unix(int64(issued), 0)) < sessionRenewAfter {
		return
	}
	fresh := jwt.MapClaims{}
	for k, v := range claims {
		fresh[k] = v
	}
	if roles != nil {
		fresh["roles"] = roles
	}
	now := time.Now()
	fresh["iat"] = now.Unix()
	fresh["exp"] = now.Add(SessionTTL).Unix()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, fresh).SignedString([]byte(jwtSecret))
	if err != nil {
		return
	}
	secure := SecureCookies || c.Protocol() == "https"
	c.Cookie(&fiber.Cookie{
		Name: "km_auth_token", Value: token, Path: "/",
		Expires: now.Add(SessionTTL), MaxAge: int(SessionTTL.Seconds()),
		HTTPOnly: true, Secure: secure, SameSite: "Lax",
	})
	// The readable portal cookie the website routes by lives as long as the session
	if portal := c.Cookies("km_user_role"); portal != "" {
		c.Cookie(&fiber.Cookie{
			Name: "km_user_role", Value: portal, Path: "/",
			Expires: now.Add(SessionTTL), MaxAge: int(SessionTTL.Seconds()),
			Secure: secure, SameSite: "Lax",
		})
	}
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
		fromCookie := false
		if tokenString == "" {
			tokenString = c.Cookies("km_auth_token")
			fromCookie = true
		}

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing authorization token"})
		}

		claims, userID, err := parseToken(tokenString, jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or expired token"})
		}

		roles, err := checkSession(c.Context(), userID, claims, c.Path())
		switch {
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
		case errors.Is(err, ErrSignupIncomplete):
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Please finish creating your account first.",
				"code":  "SIGNUP_INCOMPLETE",
			})
		}

		c.Locals("user_id", userID)

		if roles != nil {
			c.Locals("roles", roles)
		} else if rolesRaw, ok := claims["roles"]; ok {
			c.Locals("roles", rolesRaw)
		}
		if fromCookie {
			renewSession(c, claims, roles, jwtSecret)
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
