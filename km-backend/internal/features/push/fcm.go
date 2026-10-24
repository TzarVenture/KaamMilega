package push

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"km-backend/internal/config"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

// serviceAccount holds the only fields read from the key for validation (never logged)
type serviceAccount struct {
	Type      string `json:"type"`
	ProjectID string `json:"project_id"`
}

// newFCMClient builds the Firebase Messaging client from the service-account key in the
// environment. It returns (nil, nil) when no key is configured, so push stays off quietly.
func newFCMClient(cfg *config.Config) (messenger, error) {
	key, err := loadCredentials(cfg)
	if err != nil || key == nil {
		return nil, err
	}

	var sa serviceAccount
	if err := json.Unmarshal(key, &sa); err != nil || sa.Type != "service_account" {
		return nil, errors.New("Firebase credentials are not a service-account JSON key")
	}
	projectID := cfg.FirebaseProjectID
	if projectID == "" {
		projectID = sa.ProjectID
	}
	if sa.ProjectID != projectID {
		return nil, fmt.Errorf("Firebase key is for project %q, expected %q", sa.ProjectID, projectID)
	}

	ctx := context.Background()
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: projectID}, option.WithCredentialsJSON(key))
	if err != nil {
		return nil, fmt.Errorf("init Firebase: %w", err)
	}
	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("init Firebase Messaging: %w", err)
	}
	return client, nil
}

// loadCredentials reads FIREBASE_CREDENTIALS_FILE, or FIREBASE_CREDENTIALS_JSON as raw JSON or
// base64 (handy for one-line environment variables in Dokploy).
func loadCredentials(cfg *config.Config) ([]byte, error) {
	if path := strings.TrimSpace(cfg.FirebaseCredentialsFile); path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read FIREBASE_CREDENTIALS_FILE: %w", err)
		}
		return b, nil
	}
	raw := strings.TrimSpace(cfg.FirebaseCredentialsJSON)
	if raw == "" {
		return nil, nil
	}
	if strings.HasPrefix(raw, "{") {
		return []byte(raw), nil
	}
	b, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, errors.New("FIREBASE_CREDENTIALS_JSON is neither JSON nor base64")
	}
	return b, nil
}
