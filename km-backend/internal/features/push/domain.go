// Package push delivers KaamMilega notifications to browsers and phones through Firebase Cloud
// Messaging (FCM). Every in-app notification created by the notification service is also sent
// as a push to the user's registered devices, when they have push notifications switched on.
package push

import (
	"errors"
	"km-backend/internal/common/apperr"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Platforms a device token can belong to
const (
	PlatformWeb     = "web"
	PlatformAndroid = "android"
	PlatformIOS     = "ios"
)

const (
	// maxTokensPerUser keeps the newest registrations; older ones are dropped
	maxTokensPerUser = 20
	// staleAfter: tokens not refreshed for this long are removed by a TTL index (FCM guidance)
	staleAfter     = 60 * 24 * time.Hour
	minTokenLength = 20
	maxTokenLength = 4096
)

var (
	ErrInvalidToken    = apperr.New("PUSH_TOKEN_INVALID", "invalid push token")
	ErrInvalidPlatform = apperr.New("PUSH_PLATFORM_INVALID", "platform must be web, android or ios")
	ErrUnknownUser     = errors.New("user not found")
	ErrPushDisabled    = apperr.New("PUSH_DISABLED", "push notifications are not configured on the server yet")
	ErrTestTooSoon     = apperr.New("PUSH_TEST_TOO_SOON", "please wait a few seconds before sending another test")
)

// Token is one browser or phone that can receive pushes for a user.
type Token struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"-"`
	UserID   primitive.ObjectID `bson:"user_id" json:"-"`
	Token    string             `bson:"token" json:"-"`
	Platform string             `bson:"platform" json:"platform"`
	// UserAgent helps the user recognise the device later; never used for delivery
	UserAgent string `bson:"user_agent,omitempty" json:"-"`
	// SessionVersion is the user's session version when the token was registered. Signing out
	// everywhere, changing the password or deactivating bumps the user's version, so tokens from
	// those sessions stop receiving pushes until the device signs in and registers again.
	SessionVersion int       `bson:"session_version" json:"-"`
	CreatedAt      time.Time `bson:"created_at" json:"created_at"`
	LastSeenAt     time.Time `bson:"last_seen_at" json:"last_seen_at"`
}

// RegisterRequest is the body of POST /api/push/tokens
type RegisterRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

// UnregisterRequest is the body of DELETE /api/push/tokens
type UnregisterRequest struct {
	Token string `json:"token"`
}
