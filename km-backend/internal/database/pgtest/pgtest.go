// Package pgtest gives integration tests their own throwaway copy of the Postgres tables.
//
// The copy is a fresh schema built from the real migration files, so tests always run against
// the real tables, constraints and indexes. The live "app" schema is never touched. One schema and
// one small connection pool are shared by every test in a package (Supabase allows few
// connections), so tests must use their own fresh ids. Call Run from TestMain so the schema is
// dropped at the end. Tests skip when none of TEST_DATABASE_URI, DATABASE_ADMIN_URI or DATABASE_URI is set.
package pgtest

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	once      sync.Once
	shared    *database.PostgresDB
	sharedErr error
	schema    string
	errSkip   = errors.New("no test database configured")
	appSchema = regexp.MustCompile(`\bapp\b`)
)

// New returns the package's throwaway Postgres handle, creating it on first use.
func New(t *testing.T) *database.PostgresDB {
	t.Helper()
	once.Do(func() { shared, sharedErr = open() })
	if errors.Is(sharedErr, errSkip) {
		t.Skip("set TEST_DATABASE_URI to run Postgres integration tests")
	}
	if sharedErr != nil {
		t.Fatalf("pgtest: %v", sharedErr)
	}
	// Every test starts from empty tables (tests in a package run one at a time unless they call
	// t.Parallel, which tests using pgtest must not do)
	if err := truncateAll(shared.DB); err != nil {
		t.Fatalf("pgtest: emptying tables: %v", err)
	}
	return shared
}

func truncateAll(db *gorm.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	var tables []string
	if err := db.WithContext(ctx).Raw(`SELECT tablename FROM pg_tables WHERE schemaname = ?`, schema).Scan(&tables).Error; err != nil {
		return err
	}
	if len(tables) == 0 {
		return nil
	}
	quoted := make([]string, len(tables))
	for i, name := range tables {
		quoted[i] = fmt.Sprintf("%q.%q", schema, name)
	}
	return db.WithContext(ctx).Exec(`TRUNCATE ` + strings.Join(quoted, ", ") + ` CASCADE`).Error
}

// Run runs the package's tests, then drops the throwaway schema. Use it from TestMain:
//
//	func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }
func Run(m *testing.M) int {
	code := m.Run()
	if shared != nil {
		dropSchema(shared.DB, schema)
		if sqlDB, err := shared.DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}
	return code
}

func open() (*database.PostgresDB, error) {
	// Building a schema needs the admin user; the server's own user (km_app) can't create one
	uri := os.Getenv("TEST_DATABASE_URI")
	if uri == "" {
		uri = os.Getenv("DATABASE_ADMIN_URI")
	}
	if uri == "" {
		uri = os.Getenv("DATABASE_URI")
	}
	if uri == "" {
		return nil, errSkip
	}

	schema = "test_" + primitive.NewObjectID().Hex()
	dsn, err := withSearchPath(uri, schema)
	if err != nil {
		return nil, err
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(4)

	files, err := migrationFiles()
	if err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	for _, file := range files {
		body, err := os.ReadFile(file)
		if err != nil {
			_ = sqlDB.Close()
			return nil, err
		}
		if err := db.WithContext(ctx).Exec(appSchema.ReplaceAllString(string(body), schema)).Error; err != nil {
			dropSchema(db, schema)
			_ = sqlDB.Close()
			return nil, fmt.Errorf("applying %s: %w", filepath.Base(file), err)
		}
	}
	return &database.PostgresDB{DB: db}, nil
}

func dropSchema(db *gorm.DB, name string) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	_ = db.WithContext(ctx).Exec(fmt.Sprintf(`DROP SCHEMA IF EXISTS %q CASCADE`, name)).Error
}

func withSearchPath(uri, name string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(uri))
	if err != nil || u.Host == "" {
		return "", errors.New("invalid database uri")
	}
	q := u.Query()
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "require")
	}
	q.Set("search_path", name+",extensions")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// migrationFiles lists km-backend/migrations/*.sql in order.
func migrationFiles() ([]string, error) {
	_, here, _, _ := runtime.Caller(0)
	dir := filepath.Join(filepath.Dir(here), "..", "..", "..", "migrations")
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil || len(files) == 0 {
		return nil, fmt.Errorf("no migration files found in %s", dir)
	}
	sort.Strings(files)
	return files, nil
}
