// Package storage keeps uploaded media out of the API server. Public media (profile photos,
// covers, company logos, event images) is served from the CDN; private files (resumes,
// verification and KYC documents, chat attachments) are only reachable through short-lived
// signed links handed out after an access check.
package storage

import (
	"context"
	"errors"
	"io"
	"log"
	"path/filepath"
	"time"

	"km-backend/internal/config"
)

// Visibility picks the bucket a file lives in
type Visibility string

const (
	Public  Visibility = "public"
	Private Visibility = "private"
)

// SignedLinkTTL is how long a link to a private file stays valid
const SignedLinkTTL = 10 * time.Minute

var ErrNotFound = errors.New("storage: object not found")

// Object is what an upload hands to the driver
type Object struct {
	Key          string
	Body         io.Reader
	Size         int64
	ContentType  string
	DownloadName string // filename offered when a private file is downloaded
}

type Storage interface {
	Put(ctx context.Context, vis Visibility, obj Object) error
	Delete(ctx context.Context, vis Visibility, key string) error
	// PublicURL is the permanent address of a public object
	PublicURL(key string) string
	// SignedURL is a temporary address of a private object
	SignedURL(ctx context.Context, key, downloadName string, ttl time.Duration) (string, error)
	// Driver names the backend ("r2" or "local") for logs and health checks
	Driver() string
}

// New returns the R2 driver when STORAGE_DRIVER=r2 and its settings are complete, otherwise the
// local-disk driver used in development.
func New(cfg *config.Config) (Storage, error) {
	if cfg.StorageDriver == "r2" {
		s, err := newR2(cfg)
		if err != nil {
			return nil, err
		}
		log.Printf("storage: Cloudflare R2 (public %s, private %s)", cfg.R2PublicBucket, cfg.R2PrivateBucket)
		return s, nil
	}
	log.Printf("storage: local disk at %s", filepath.Join(filepath.Dir(cfg.FSPath), "media"))
	return newLocal(cfg), nil
}
