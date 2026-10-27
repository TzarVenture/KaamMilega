package user

import (
	"context"
	"testing"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type passwordRepo struct {
	UserRepository
	user         *User
	newHash      string
	sessionBumps int
	access       bool
}

func (r *passwordRepo) FindUserByID(context.Context, string) (*User, error) {
	cp := *r.user
	return &cp, nil
}
func (r *passwordRepo) UpdatePassword(_ context.Context, _ string, hash string) error {
	r.newHash = hash
	return nil
}
func (r *passwordRepo) BumpSessionVersion(context.Context, string) (int, error) {
	r.sessionBumps++
	return r.sessionBumps, nil
}
func (r *passwordRepo) HasRestrictedProfileAccess(context.Context, string, string, bool) (bool, error) {
	return r.access, nil
}

func serviceWith(repo UserRepository) *UserServiceImpl {
	return &UserServiceImpl{repo: repo, config: &config.Config{}}
}

func TestChangingPasswordRequiresCurrentPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.MinCost)
	repo := &passwordRepo{user: &User{ID: primitive.NewObjectID(), Password: string(hash)}}
	svc := serviceWith(repo)
	ctx := context.Background()

	// The old bug: an empty current password skipped verification
	if err := svc.SetPassword(ctx, "id", SetPasswordRequest{NewPassword: "new-password-1"}); err == nil {
		t.Fatal("changing a password without the current one must fail")
	}
	if err := svc.SetPassword(ctx, "id", SetPasswordRequest{CurrentPassword: "wrong", NewPassword: "new-password-1"}); err == nil {
		t.Fatal("wrong current password must fail")
	}
	if err := svc.SetPassword(ctx, "id", SetPasswordRequest{CurrentPassword: "old-password", NewPassword: "short"}); err == nil {
		t.Fatal("passwords under 8 characters must fail")
	}
	if repo.newHash != "" {
		t.Fatal("no failed attempt may write a password")
	}
	if err := svc.SetPassword(ctx, "id", SetPasswordRequest{CurrentPassword: "old-password", NewPassword: "new-password-1"}); err != nil {
		t.Fatalf("valid change: %v", err)
	}
	if repo.sessionBumps != 1 {
		t.Fatal("a password change must sign out other devices")
	}
}

func TestOTPOnlyAccountsCanSetFirstPassword(t *testing.T) {
	repo := &passwordRepo{user: &User{ID: primitive.NewObjectID()}}
	if err := serviceWith(repo).SetPassword(context.Background(), "id", SetPasswordRequest{NewPassword: "first-password"}); err != nil {
		t.Fatalf("first password: %v", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(repo.newHash), []byte("first-password")) != nil {
		t.Fatal("stored hash should match the new password")
	}
}

func TestCanViewProfile(t *testing.T) {
	ctx := context.Background()
	owner := &User{ID: primitive.NewObjectID()}
	cases := []struct {
		name       string
		visibility string
		status     string
		viewer     string
		admin      bool
		access     bool
		want       bool
	}{
		{"public, anyone", "public", "", "v", false, false, true},
		{"private, stranger", "private", "", "v", false, false, false},
		{"private, recruiter applied to", "private", "", "v", false, true, true},
		{"connections, connection", "connections", "", "v", false, true, true},
		{"connections, signed out", "connections", "", "", false, true, false},
		{"deactivated, member", "public", AccountDeactivated, "v", false, true, false},
		{"deactivated, admin", "public", AccountDeactivated, "v", true, false, true},
	}
	for _, tc := range cases {
		o := *owner
		o.Settings.ProfileVisibility = tc.visibility
		o.AccountStatus = tc.status
		got, err := serviceWith(&passwordRepo{access: tc.access}).CanViewProfile(ctx, &o, tc.viewer, tc.admin)
		if err != nil || got != tc.want {
			t.Errorf("%s: got %v (err %v), want %v", tc.name, got, err, tc.want)
		}
	}
}

// GET /api/user/settings used to be swallowed by GET /api/user/:id registered before it
func TestStaticUserRoutesComeBeforeProfileLookup(t *testing.T) {
	app := fiber.New()
	(&UserApi{controller: NewUserController(nil, &config.Config{JWTSecret: "x"})}).Setup(app)

	index := map[string]int{}
	for i, r := range app.GetRoutes(true) {
		if r.Method == fiber.MethodGet {
			if _, seen := index[r.Path]; !seen {
				index[r.Path] = i
			}
		}
	}
	lookup, ok := index["/api/user/:id"]
	if !ok {
		t.Fatal("profile lookup route missing")
	}
	for _, p := range []string{"/api/user/settings", "/api/user/bookmarks", "/api/user/profile", "/api/user/search"} {
		if i, ok := index[p]; !ok || i > lookup {
			t.Errorf("%s must be registered before /api/user/:id", p)
		}
	}
}
