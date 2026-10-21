package user

import (
	"context"

	"km-backend/internal/middleware"
)

// NewSessionLoader lets the auth middleware check each token against the stored session
// version and account status (registered in cmd/main.go).
func NewSessionLoader(repo UserRepository) middleware.SessionLoader {
	return func(ctx context.Context, userID string) (middleware.SessionState, error) {
		found, status, version, err := repo.GetSessionState(ctx, userID)
		if err != nil {
			return middleware.SessionState{}, err
		}
		return middleware.SessionState{Found: found, AccountStatus: status, SessionVersion: version}, nil
	}
}
