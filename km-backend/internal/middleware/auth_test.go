package middleware

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret"

func signToken(t *testing.T, method jwt.SigningMethod, claims jwt.MapClaims) string {
	t.Helper()
	tok, err := jwt.NewWithClaims(method, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func claimsFor(userID string, sv int) jwt.MapClaims {
	return jwt.MapClaims{"sub": userID, "sv": sv, "exp": time.Now().Add(time.Hour).Unix()}
}

func testApp() *fiber.App {
	app := fiber.New()
	app.Use(AuthMiddleware(testSecret))
	ok := func(c *fiber.Ctx) error { return c.SendString("ok") }
	app.Get("/api/user/feed", ok)
	app.Get("/api/user/account/overview", ok)
	app.Get("/api/user/accounting", ok) // shares a prefix with /account but is not an account route
	return app
}

func request(t *testing.T, app *fiber.App, path, token string) int {
	t.Helper()
	req := httptest.NewRequest("GET", path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	return res.StatusCode
}

func withLoader(t *testing.T, states map[string]SessionState) {
	t.Helper()
	SetSessionLoader(func(_ context.Context, userID string) (SessionState, error) {
		return states[userID], nil
	})
	t.Cleanup(func() {
		SetSessionLoader(nil)
		for id := range states {
			InvalidateSession(id)
		}
	})
}

func TestSessionVersionMustMatch(t *testing.T) {
	withLoader(t, map[string]SessionState{"u1": {Found: true, SessionVersion: 2}})
	app := testApp()

	if got := request(t, app, "/api/user/feed", signToken(t, jwt.SigningMethodHS256, claimsFor("u1", 2))); got != 200 {
		t.Fatalf("current session: got %d, want 200", got)
	}
	if got := request(t, app, "/api/user/feed", signToken(t, jwt.SigningMethodHS256, claimsFor("u1", 1))); got != 401 {
		t.Fatalf("revoked session: got %d, want 401", got)
	}
}

func TestTokensWithoutVersionMatchVersionZero(t *testing.T) {
	// Tokens issued before session versions existed keep working until the first revocation
	withLoader(t, map[string]SessionState{"u2": {Found: true}})
	legacy := signToken(t, jwt.SigningMethodHS256, jwt.MapClaims{"sub": "u2", "exp": time.Now().Add(time.Hour).Unix()})
	if got := request(t, testApp(), "/api/user/feed", legacy); got != 200 {
		t.Fatalf("legacy token: got %d, want 200", got)
	}
}

func TestInactiveAccountsReachOnlyAccountRoutes(t *testing.T) {
	withLoader(t, map[string]SessionState{"u3": {Found: true, AccountStatus: "deactivated"}})
	app := testApp()
	tok := signToken(t, jwt.SigningMethodHS256, claimsFor("u3", 0))

	if got := request(t, app, "/api/user/feed", tok); got != 403 {
		t.Fatalf("feed while deactivated: got %d, want 403", got)
	}
	if got := request(t, app, "/api/user/account/overview", tok); got != 200 {
		t.Fatalf("account overview while deactivated: got %d, want 200", got)
	}
	if got := request(t, app, "/api/user/accounting", tok); got != 403 {
		t.Fatalf("prefix lookalike while deactivated: got %d, want 403", got)
	}
}

func TestDeletedOrMissingUsersAreSignedOut(t *testing.T) {
	withLoader(t, map[string]SessionState{"gone": {Found: true, AccountStatus: "deleted"}})
	app := testApp()
	if got := request(t, app, "/api/user/account/overview", signToken(t, jwt.SigningMethodHS256, claimsFor("gone", 0))); got != 401 {
		t.Fatalf("deleted account: got %d, want 401", got)
	}
	if got := request(t, app, "/api/user/feed", signToken(t, jwt.SigningMethodHS256, claimsFor("nobody", 0))); got != 401 {
		t.Fatalf("unknown user: got %d, want 401", got)
	}
}

func TestOnlyHS256IsAccepted(t *testing.T) {
	withLoader(t, map[string]SessionState{"u4": {Found: true}})
	hs512 := signToken(t, jwt.SigningMethodHS512, claimsFor("u4", 0))
	if got := request(t, testApp(), "/api/user/feed", hs512); got != 401 {
		t.Fatalf("HS512 token: got %d, want 401", got)
	}
}

func TestVerifyTokenRequiresActiveAccount(t *testing.T) {
	withLoader(t, map[string]SessionState{
		"active": {Found: true},
		"paused": {Found: true, AccountStatus: "pending_deletion"},
	})
	if _, err := VerifyToken(context.Background(), signToken(t, jwt.SigningMethodHS256, claimsFor("active", 0)), testSecret); err != nil {
		t.Fatalf("active user: %v", err)
	}
	if _, err := VerifyToken(context.Background(), signToken(t, jwt.SigningMethodHS256, claimsFor("paused", 0)), testSecret); err == nil {
		t.Fatal("pending-deletion user must not open websockets")
	}
}

func TestInvalidateSessionDropsCache(t *testing.T) {
	state := SessionState{Found: true, SessionVersion: 0}
	SetSessionLoader(func(context.Context, string) (SessionState, error) { return state, nil })
	t.Cleanup(func() { SetSessionLoader(nil); InvalidateSession("u5") })
	app := testApp()
	tok := signToken(t, jwt.SigningMethodHS256, claimsFor("u5", 0))

	if got := request(t, app, "/api/user/feed", tok); got != 200 {
		t.Fatalf("before revoke: got %d", got)
	}
	state.SessionVersion = 1 // signed out everywhere
	InvalidateSession("u5")
	if got := request(t, app, "/api/user/feed", tok); got != 401 {
		t.Fatalf("after revoke + invalidate: got %d, want 401", got)
	}
}
