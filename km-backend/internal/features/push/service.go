package push

import (
	"context"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"firebase.google.com/go/v4/messaging"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// messenger is the part of the FCM client the service uses (an interface so tests can fake it)
type messenger interface {
	SendEachForMulticast(ctx context.Context, m *messaging.MulticastMessage) (*messaging.BatchResponse, error)
}

// userLookup is satisfied by user.UserRepository
type userLookup interface {
	FindUserByID(ctx context.Context, id string) (*user.User, error)
}

type Service struct {
	repo        Repository
	users       userLookup
	fcm         messenger // nil when Firebase credentials are not configured
	frontendURL string
	now         func() time.Time
}

func NewService(repo Repository, users user.UserRepository, cfg *config.Config) *Service {
	s := &Service{
		repo:        repo,
		users:       users,
		frontendURL: strings.TrimRight(cfg.FrontendURL, "/"),
		now:         time.Now,
	}
	client, err := newFCMClient(cfg)
	switch {
	case err != nil:
		log.Printf("[push] disabled: %v", err)
	case client == nil:
		log.Println("[push] off: set FIREBASE_CREDENTIALS_FILE or FIREBASE_CREDENTIALS_JSON to send push notifications")
	default:
		s.fcm = client
		log.Println("[push] Firebase Cloud Messaging ready")
	}
	return s
}

// Enabled reports whether pushes can be sent (devices can register either way)
func (s *Service) Enabled() bool { return s.fcm != nil }

// Register stores (or refreshes) the device token for the signed-in user. Browsers call it
// every time the site opens, which keeps last_seen_at fresh and moves a shared browser's token
// to whoever is signed in now.
func (s *Service) Register(ctx context.Context, userID string, req RegisterRequest, userAgent string) error {
	token := strings.TrimSpace(req.Token)
	if !validToken(token) {
		return ErrInvalidToken
	}
	platform := strings.ToLower(strings.TrimSpace(req.Platform))
	if platform == "" {
		platform = PlatformWeb
	}
	if platform != PlatformWeb && platform != PlatformAndroid && platform != PlatformIOS {
		return ErrInvalidPlatform
	}
	u, err := s.users.FindUserByID(ctx, userID)
	if err != nil || u == nil {
		return ErrUnknownUser
	}
	if err := s.repo.Upsert(ctx, &Token{
		UserID:         u.ID,
		Token:          token,
		Platform:       platform,
		UserAgent:      truncate(userAgent, 300),
		SessionVersion: u.SessionVersion,
		LastSeenAt:     s.now(),
	}); err != nil {
		return err
	}
	return s.repo.Trim(ctx, u.ID, maxTokensPerUser)
}

// Unregister removes the device token (sign-out, or push switched off in this browser)
func (s *Service) Unregister(ctx context.Context, userID string, req UnregisterRequest) error {
	token := strings.TrimSpace(req.Token)
	if !validToken(token) {
		return ErrInvalidToken
	}
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return ErrUnknownUser
	}
	return s.repo.Delete(ctx, id, token)
}

// Push implements notification.PushSender: it returns at once and delivers in the background.
func (s *Service) Push(n *notification.Notification) {
	if s.fcm == nil || n == nil {
		return
	}
	copied := *n
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := s.deliver(ctx, &copied); err != nil {
			log.Printf("[push] notification %s: %v", copied.ID.Hex(), err)
		}
	}()
}

func (s *Service) deliver(ctx context.Context, n *notification.Notification) error {
	u, err := s.users.FindUserByID(ctx, n.UserID.Hex())
	if err != nil || u == nil {
		return nil // user gone: nothing to deliver
	}
	// Only active accounts that switched push on (Settings → Notifications)
	if !user.IsActiveAccount(u.AccountStatus) || !u.Settings.PushNotifications {
		return nil
	}
	tokens, err := s.repo.ForSession(ctx, u.ID, u.SessionVersion)
	if err != nil || len(tokens) == 0 {
		return err
	}
	list := make([]string, len(tokens))
	for i, t := range tokens {
		list[i] = t.Token
	}

	resp, err := s.fcm.SendEachForMulticast(ctx, s.buildMessage(n, list))
	if err != nil {
		return err
	}
	var dead []string
	for i, r := range resp.Responses {
		if r == nil || r.Success || i >= len(list) {
			continue
		}
		// Only errors that prove the token itself is dead; a bad payload must not wipe devices
		if messaging.IsUnregistered(r.Error) || messaging.IsSenderIDMismatch(r.Error) {
			dead = append(dead, list[i])
		} else {
			log.Printf("[push] send to a device of %s failed: %v", u.ID.Hex(), r.Error)
		}
	}
	return s.repo.DeleteTokens(ctx, dead)
}

const (
	maxTitle = 80
	maxBody  = 180
	pushTTL  = 24 * time.Hour
)

// buildMessage turns an in-app notification into one FCM message for all of the user's devices.
func (s *Service) buildMessage(n *notification.Notification, tokens []string) *messaging.MulticastMessage {
	title := strings.TrimSpace(n.Title)
	if title == "" {
		title = strings.TrimSpace(n.ActorName)
	}
	if title == "" {
		title = "KaamMilega"
	}
	title = truncate(title, maxTitle)
	body := truncate(strings.TrimSpace(n.Message), maxBody)
	path := safePath(n)

	isChat := n.Type == notification.TypeChatMessage
	// One alert per conversation: later messages from the same person replace the earlier one
	tag := "km-" + n.ID.Hex()
	if isChat && n.ActorID != nil && !n.ActorID.IsZero() {
		tag = "km-chat-" + n.ActorID.Hex()
	}
	urgency, priority := "normal", "normal"
	if isChat {
		urgency, priority = "high", "high"
	}
	ttl := pushTTL

	return &messaging.MulticastMessage{
		Tokens:       tokens,
		Notification: &messaging.Notification{Title: title, Body: body},
		Data: map[string]string{
			"notification_id": n.ID.Hex(),
			"type":            n.Type,
			"category":        n.Category,
			"link":            path,
		},
		Webpush: &messaging.WebpushConfig{
			Headers: map[string]string{"TTL": "86400", "Urgency": urgency},
			Notification: &messaging.WebpushNotification{
				Title:    title,
				Body:     body,
				Icon:     s.frontendURL + "/kaammilega-logo-icon.png",
				Tag:      tag,
				Renotify: isChat,
			},
			FCMOptions: &messaging.WebpushFCMOptions{Link: s.frontendURL + path},
		},
		Android: &messaging.AndroidConfig{
			Priority: priority,
			TTL:      &ttl,
			Notification: &messaging.AndroidNotification{
				Tag: tag,
			},
		},
		// iOS: default sound, and one thread per conversation in Notification Centre
		APNS: &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{Sound: "default", ThreadID: tag},
			},
		},
	}
}

// safePath returns an in-site path for the notification (mirrors the website's
// sanitizeNotificationLink) and refuses anything that could leave kaammilega.com.
func safePath(n *notification.Notification) string {
	if n.Type == "connection_accepted" && n.ActorID != nil && !n.ActorID.IsZero() {
		return "/profile/" + n.ActorID.Hex()
	}
	link := strings.TrimSpace(n.Link)
	if link == "" || !strings.HasPrefix(link, "/") || strings.HasPrefix(link, "//") ||
		strings.ContainsAny(link, "\\\r\n\t ") || len(link) > 512 {
		return "/notifications"
	}
	switch {
	case strings.HasPrefix(link, "/candidate/applications"), strings.HasPrefix(link, "/candidate/application"):
		link = "/applications" + strings.TrimPrefix(strings.TrimPrefix(link, "/candidate/applications"), "/candidate/application")
	case strings.HasPrefix(link, "/candidate/interviews"), strings.HasPrefix(link, "/candidate/interview"):
		link = "/interviews" + strings.TrimPrefix(strings.TrimPrefix(link, "/candidate/interviews"), "/candidate/interview")
	case strings.HasPrefix(link, "/candidate/profile"):
		link = "/profile" + strings.TrimPrefix(link, "/candidate/profile")
	}
	return link
}

func validToken(t string) bool {
	if len(t) < minTokenLength || len(t) > maxTokenLength {
		return false
	}
	for _, r := range t {
		if r <= ' ' || r == 0x7f {
			return false
		}
	}
	return true
}

func truncate(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	r := []rune(s)
	return strings.TrimSpace(string(r[:max-1])) + "…"
}
