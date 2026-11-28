package storage

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCachePurge(t *testing.T) {
	var got struct {
		path, auth string
		files      []string
	}
	ok := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.path, got.auth = r.URL.Path, r.Header.Get("Authorization")
		var body struct {
			Files []string `json:"files"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		got.files = body.Files
		if !ok {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"success":false,"errors":[{"code":10000,"message":"Authentication error"}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"success":true,"errors":[]}`))
	}))
	defer srv.Close()

	p := newCachePurger("zone1", "tok")
	p.api = srv.URL
	url := "https://cdn.test/feed_video/a.mp4"
	if err := p.purge(context.Background(), []string{url}); err != nil {
		t.Fatal(err)
	}
	if got.path != "/zones/zone1/purge_cache" || got.auth != "Bearer tok" || len(got.files) != 1 || got.files[0] != url {
		t.Fatalf("request = %+v", got)
	}

	ok = false
	if err := p.purge(context.Background(), []string{url}); err == nil {
		t.Fatal("a refused purge should be an error")
	}

	// Without settings there is nothing to call
	if newCachePurger("", "tok") != nil || newCachePurger("zone", "") != nil {
		t.Fatal("purger made without its settings")
	}
	var none *cachePurger
	if err := none.purge(context.Background(), []string{url}); err != nil {
		t.Fatal(err)
	}
}
