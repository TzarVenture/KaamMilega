package database

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"km-backend/internal/config"

	"go.uber.org/fx"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// PostgresDB is the Supabase Postgres connection. It holds money and everything money buys;
// MongoDB keeps users, chat, feed, notifications and analytics. The server does not start
// without it.
type PostgresDB struct {
	DB *gorm.DB
}

// ErrPostgresOff is returned by Ping when Postgres is not configured or not connected
var ErrPostgresOff = errors.New("postgres is not connected")

// Enabled reports whether a Postgres connection is available
func (p *PostgresDB) Enabled() bool { return p != nil && p.DB != nil }

// Ping runs a trivial query to check the connection (also what keeps the free plan awake)
func (p *PostgresDB) Ping(ctx context.Context) error {
	if !p.Enabled() {
		return ErrPostgresOff
	}
	return p.DB.WithContext(ctx).Exec("SELECT 1").Error
}

// keepAliveEvery is how often the backend pings Postgres. Supabase pauses a free project after
// about a week with no activity; a ping every 6 hours keeps it awake with negligible load.
const keepAliveEvery = 6 * time.Hour

// NewPostgres opens the Supabase Postgres connection through GORM
func NewPostgres(lc fx.Lifecycle, cfg *config.Config) (*PostgresDB, error) {
	if strings.TrimSpace(cfg.PostgresURI) == "" {
		return nil, errors.New("postgres: DATABASE_URI is not set (wallet, payments and purchases need it)")
	}

	dsn, err := withSSL(cfg.PostgresURI)
	if err != nil {
		// Never log the DSN itself: it contains the password
		return nil, errors.New("postgres: DATABASE_URI is not a valid connection string")
	}

	logLevel := logger.Warn
	if cfg.Environment == "production" {
		logLevel = logger.Error
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		// Store times in UTC; Indian time is applied when showing them
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("postgres: could not open the connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	// The free plan allows about 60 connections through the pooler, shared by everything that
	// connects (backend, migrations, dashboard). Keep the backend's share small.
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	pg := &PostgresDB{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := pg.Ping(ctx); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("postgres: not reachable at startup: %w", err)
	}
	log.Println("Connected to Postgres!")

	stop := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go pg.keepAlive(stop)
			return nil
		},
		OnStop: func(context.Context) error {
			close(stop)
			log.Println("Disconnecting from Postgres...")
			return sqlDB.Close()
		},
	})
	return pg, nil
}

func (p *PostgresDB) keepAlive(stop <-chan struct{}) {
	t := time.NewTicker(keepAliveEvery)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			if err := p.Ping(ctx); err != nil {
				log.Printf("Postgres keep-alive ping failed: %v", err)
			}
			cancel()
		}
	}
}

// withSSL makes sure the connection is encrypted (sslmode=require unless set) and sets the schema search path
func withSSL(uri string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(uri))
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" {
		return "", errors.New("invalid postgres uri")
	}
	q := u.Query()
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "require")
	}
	// Queries name tables without a schema; they live in "app" (PostGIS types in "extensions").
	// Tests point this at a throwaway schema instead.
	if q.Get("search_path") == "" {
		q.Set("search_path", "app,extensions")
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// PostgresDSN is the connection string the server uses (encrypted, app schema), for tools that
// connect outside the app such as cmd/copy-to-postgres
func PostgresDSN(uri string) (string, error) { return withSSL(uri) }
