package user

import (
	"context"
	"strings"

	"km-backend/internal/middleware"
)

// NewSessionLoader lets the auth middleware check each token against the stored session
// version, account status, roles and sign-up state (registered in cmd/main.go).
func NewSessionLoader(repo UserRepository) middleware.SessionLoader {
	return func(ctx context.Context, userID string) (middleware.SessionState, error) {
		rec, err := repo.GetSessionState(ctx, userID)
		if err != nil {
			return middleware.SessionState{}, err
		}
		if rec == nil {
			return middleware.SessionState{}, nil
		}
		roles := rec.Roles
		if roles == nil {
			roles = []string{}
		}
		return middleware.SessionState{
			Found:          true,
			AccountStatus:  rec.AccountStatus,
			SessionVersion: rec.SessionVersion,
			Roles:          roles,
			Incomplete:     !IsSignupComplete(rec.IsRegistered, rec.Name),
		}, nil
	}
}

// IsSignupComplete reports whether a person finished sign-up. Accounts that verified their
// mobile but never gave a name are not. Older accounts made before the is_registered flag
// existed have a name, so they count as complete.
func IsSignupComplete(isRegistered bool, name string) bool {
	return isRegistered || strings.TrimSpace(name) != ""
}
