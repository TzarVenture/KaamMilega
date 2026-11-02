package storage

import (
	"context"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"

	"github.com/joho/godotenv"
)

// TestR2Live round-trips a file through the real buckets. It runs only when asked:
//
//	KM_R2_LIVE=1 go test ./internal/storage -run TestR2Live -v
func TestR2Live(t *testing.T) {
	if os.Getenv("KM_R2_LIVE") != "1" {
		t.Skip("set KM_R2_LIVE=1 to test against Cloudflare R2")
	}
	godotenv.Load("../../.env")
	cfg, _ := config.LoadConfig()
	s, err := newR2(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	key := "_healthcheck/" + time.Now().Format("20060102150405") + ".txt"
	body := "kaammilega storage check"

	for _, vis := range []Visibility{Public, Private} {
		if err := s.Put(ctx, vis, Object{Key: key, Body: strings.NewReader(body), Size: int64(len(body)), ContentType: "text/plain"}); err != nil {
			t.Fatalf("%s put: %v", vis, err)
		}
		defer s.Delete(ctx, vis, key)
	}

	get := func(url string) (int, string) {
		res, err := http.Get(url)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		return res.StatusCode, string(b)
	}

	if code, got := get(s.PublicURL(key)); code != 200 || got != body {
		t.Errorf("public URL: HTTP %d", code)
	}
	signed, err := s.SignedURL(ctx, key, "check.txt", false, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if code, got := get(signed); code != 200 || got != body {
		t.Errorf("signed private URL: HTTP %d", code)
	}
	unsigned := signed[:strings.Index(signed, "?")]
	if code, _ := get(unsigned); code == 200 {
		t.Error("private file opened without a signature")
	}
}
