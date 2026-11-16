package database

import (
	"context"
	"strings"
	"testing"
)

func TestWithSSL(t *testing.T) {
	cases := map[string]string{
		"postgresql://u:p@host:5432/postgres":                     "sslmode=require",
		"postgresql://u:p@host:5432/postgres?sslmode=verify-full": "sslmode=verify-full",
		"postgres://u:p@host/db?application_name=km":              "sslmode=require",
	}
	for in, want := range cases {
		out, err := withSSL(in)
		if err != nil {
			t.Fatalf("%s: %v", in, err)
		}
		if !strings.Contains(out, want) {
			t.Errorf("%s: got %s, want it to contain %s", in, out, want)
		}
	}
	for _, bad := range []string{"", "mongodb://x", "not a url"} {
		if _, err := withSSL(bad); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestPostgresOff(t *testing.T) {
	var p *PostgresDB
	if p.Enabled() {
		t.Fatal("nil PostgresDB must not be enabled")
	}
	if err := (&PostgresDB{}).Ping(context.Background()); err != ErrPostgresOff {
		t.Fatalf("want ErrPostgresOff, got %v", err)
	}
}
