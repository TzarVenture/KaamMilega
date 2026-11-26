package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// Public files are cached by Cloudflare for a year (their keys are never reused), so deleting a
// file from R2 isn't enough: the CDN would keep serving it to anyone with the link. After each
// public delete the cached copy is purged through Cloudflare's API.
//
// Needs CLOUDFLARE_ZONE_ID (the zone of the CDN domain) and CLOUDFLARE_CACHE_PURGE_TOKEN (an API
// token with only the Zone > Cache Purge permission). Without them deletes still work, but a
// deleted file stays reachable from the cache until it expires; a warning says so at start-up.

const cloudflareAPI = "https://api.cloudflare.com/client/v4"

type cachePurger struct {
	zoneID string
	token  string
	api    string
	client *http.Client
}

func newCachePurger(zoneID, token string) *cachePurger {
	zoneID, token = strings.TrimSpace(zoneID), strings.TrimSpace(token)
	if zoneID == "" || token == "" {
		log.Printf("storage: CLOUDFLARE_ZONE_ID or CLOUDFLARE_CACHE_PURGE_TOKEN not set; deleted public files stay in the CDN cache")
		return nil
	}
	return &cachePurger{zoneID: zoneID, token: token, api: cloudflareAPI, client: &http.Client{Timeout: 15 * time.Second}}
}

// purge drops the cached copies of these URLs (at most 30 per call, Cloudflare's limit)
func (p *cachePurger) purge(ctx context.Context, urls []string) error {
	if p == nil || len(urls) == 0 {
		return nil
	}
	body, _ := json.Marshal(map[string][]string{"files": urls})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/zones/%s/purge_cache", p.api, p.zoneID), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")
	res, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	var out struct {
		Success bool `json:"success"`
		Errors  []struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	_ = json.Unmarshal(raw, &out)
	if res.StatusCode != http.StatusOK || !out.Success {
		return fmt.Errorf("cloudflare purge: status %d %+v", res.StatusCode, out.Errors)
	}
	return nil
}
