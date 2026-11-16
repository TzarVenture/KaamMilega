package database

import (
	"context"
	"errors"
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

// PostgresDB is the Supabase Postgres connection, used next to MongoDB while data moves over.
// DB is nil when DATABASE_URI is not set or the database could not be reached at startup;
// nothing depends on Postgres yet, so the API keeps running on MongoDB in that case.
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
		log.Println("Postgres: DATABASE_URI not set, running on MongoDB only")
		return &PostgresDB{}, nil
	}

	dsn, err := withSSL(cfg.PostgresURI)
	if err != nil {
		// Never log the DSN itself: it contains the password
		log.Println("Postgres: DATABASE_URI is not a valid connection string, running on MongoDB only")
		return &PostgresDB{}, nil
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
		log.Printf("Postgres: could not open the connection (%v), running on MongoDB only", err)
		return &PostgresDB{}, nil
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
		log.Printf("Postgres: not reachable at startup (%v), running on MongoDB only", err)
		_ = sqlDB.Close()
		return &PostgresDB{}, nil
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

// withSSL makes sure the connection is encrypted: it adds sslmode=require when no sslmode is set
func withSSL(uri string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(uri))
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" {
		return "", errors.New("invalid postgres uri")
	}
	q := u.Query()
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "require")
		u.RawQuery = q.Encode()
	}
	return u.String(), nil
}
