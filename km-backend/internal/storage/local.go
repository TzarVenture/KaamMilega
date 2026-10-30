package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"km-backend/internal/config"
)

// LocalPublicPrefix and LocalPrivatePrefix are the API paths the local driver serves files from
const (
	LocalPublicPrefix  = "/api/files/media"
	LocalPrivatePrefix = "/api/files/private"
)

// localStorage keeps files on the API server's disk for development. Private files are served
// only with an HMAC-signed, expiring link, the same contract as R2's presigned URLs.
type localStorage struct {
	root    string
	baseURL string
	secret  []byte
}

func newLocal(cfg *config.Config) *localStorage {
	return &localStorage{
		// Beside the legacy uploads folder, which is served publicly as a whole
		root:    filepath.Join(filepath.Dir(cfg.FSPath), "media"),
		baseURL: strings.TrimRight(cfg.Host, "/"),
		secret:  []byte(cfg.JWTSecret),
	}
}

// Path returns the file on disk for a key, refusing anything that could leave the folder
func (s *localStorage) Path(vis Visibility, key string) (string, error) {
	clean := filepath.ToSlash(filepath.Clean("/" + key))[1:]
	if clean == "" || clean != key || strings.Contains(key, "..") {
		return "", ErrNotFound
	}
	return filepath.Join(s.root, string(vis), filepath.FromSlash(clean)), nil
}

func (s *localStorage) Put(_ context.Context, vis Visibility, obj Object) error {
	p, err := s.Path(vis, obj.Key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, obj.Body); err != nil {
		f.Close()
		os.Remove(p)
		return err
	}
	return f.Close()
}

func (s *localStorage) Delete(_ context.Context, vis Visibility, key string) error {
	p, err := s.Path(vis, key)
	if err != nil {
		return nil
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (s *localStorage) PublicURL(key string) string {
	return s.baseURL + LocalPublicPrefix + "/" + key
}

func (s *localStorage) SignedURL(_ context.Context, key, downloadName string, download bool, ttl time.Duration) (string, error) {
	exp := strconv.FormatInt(time.Now().Add(ttl).Unix(), 10)
	q := url.Values{"exp": {exp}, "sig": {s.sign(key, exp)}}
	if downloadName != "" {
		q.Set("name", downloadName)
	}
	if download {
		q.Set("dl", "1")
	}
	return s.baseURL + LocalPrivatePrefix + "/" + key + "?" + q.Encode(), nil
}

// Verify checks a signed local link
func (s *localStorage) Verify(key, exp, sig string) bool {
	t, err := strconv.ParseInt(exp, 10, 64)
	if err != nil || time.Now().Unix() > t {
		return false
	}
	return hmac.Equal([]byte(sig), []byte(s.sign(key, exp)))
}

func (s *localStorage) sign(key, exp string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte("private-file\n" + key + "\n" + exp))
	return hex.EncodeToString(m.Sum(nil))
}

func (s *localStorage) Driver() string { return "local" }

// Local exposes the disk driver's file lookups to the routes that serve it
type Local interface {
	Path(vis Visibility, key string) (string, error)
	Verify(key, exp, sig string) bool
}

// AsLocal returns the local driver, or false when files live on R2
func AsLocal(s Storage) (Local, bool) {
	l, ok := s.(*localStorage)
	return l, ok
}
