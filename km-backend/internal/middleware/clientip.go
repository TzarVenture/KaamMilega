package middleware

import (
	"net"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// Cloudflare's published edge ranges (https://www.cloudflare.com/ips/). Update when they change.
var cloudflareRanges = mustCIDRs(
	"173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
	"141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
	"197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
	"104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
	"2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
	"2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
)

func mustCIDRs(cidrs ...string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			panic("bad CIDR " + c)
		}
		out = append(out, n)
	}
	return out
}

func inRanges(ip net.IP, ranges []*net.IPNet) bool {
	for _, n := range ranges {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// ClientIP is the visitor's real address, for rate limits and logs.
//
// The chain in production is visitor → Cloudflare → our reverse proxy → this app. The proxy puts
// the address it saw last in X-Forwarded-For, and a client can't forge that last entry. When that
// address is a Cloudflare server, Cloudflare's CF-Connecting-IP header holds the visitor.
// Otherwise (someone reaching the server without Cloudflare, or local development) that last
// address, or the direct peer, is the visitor. So a forged CF-Connecting-IP is only believed
// when the request really came through Cloudflare.
func ClientIP(c *fiber.Ctx) string {
	hop := ""
	if xff := c.Get(fiber.HeaderXForwardedFor); xff != "" {
		parts := strings.Split(xff, ",")
		hop = strings.TrimSpace(parts[len(parts)-1])
	}
	if hop == "" {
		hop = c.Context().RemoteIP().String()
	}
	if ip := net.ParseIP(hop); ip != nil && inRanges(ip, cloudflareRanges) {
		if v := strings.TrimSpace(c.Get("CF-Connecting-IP")); net.ParseIP(v) != nil {
			return v
		}
	}
	return hop
}
