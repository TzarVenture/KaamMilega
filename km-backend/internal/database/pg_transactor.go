package database

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

type pgTxKey struct{}

// PgTransactor runs a group of Postgres writes as one ACID transaction. Repositories join it by
// getting their handle from Conn(ctx, db). A nested Run joins the outer transaction, so the
// outermost one decides commit or rollback. fn can run more than once (a deadlock or
// serialization failure is retried), so it must not call anything outside the database.
type PgTransactor struct {
	db *gorm.DB
}

// NewPgTransactor creates a Transactor backed by Postgres transactions.
func NewPgTransactor(pg *PostgresDB) *PgTransactor {
	return &PgTransactor{db: pg.DB}
}

const maxTxAttempts = 3

func (t *PgTransactor) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	if _, ok := ctx.Value(pgTxKey{}).(*gorm.DB); ok {
		return fn(ctx)
	}
	if t.db == nil {
		return ErrPostgresOff
	}

	var err error
	for attempt := 1; attempt <= maxTxAttempts; attempt++ {
		err = t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			return fn(context.WithValue(ctx, pgTxKey{}, tx))
		})
		if !retryable(err) || ctx.Err() != nil {
			return err
		}
	}
	return err
}

// Conn is the handle a repository uses: the running transaction if there is one, else the pool.
func Conn(ctx context.Context, db *gorm.DB) *gorm.DB {
	if tx, ok := ctx.Value(pgTxKey{}).(*gorm.DB); ok {
		// A fresh statement on the transaction's connection, so one query's conditions never
		// leak into the next
		return tx.Session(&gorm.Session{NewDB: true, Context: ctx})
	}
	return db.WithContext(ctx)
}

// InPgTx reports whether ctx carries a Postgres transaction.
func InPgTx(ctx context.Context) bool {
	_, ok := ctx.Value(pgTxKey{}).(*gorm.DB)
	return ok
}

// retryable is a serialization failure or deadlock: the database rolled back and asks for a retry.
func retryable(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && (pgErr.Code == "40001" || pgErr.Code == "40P01")
}

// Postgres error codes repositories map to domain errors.
const (
	PgUniqueViolation = "23505"
	PgCheckViolation  = "23514"
	PgFKViolation     = "23503"
)

// PgErrCode returns the Postgres error code of err, or "".
func PgErrCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// PgConstraint returns the name of the constraint err violated, or "".
func PgConstraint(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}

// OID turns a stored 24-character id back into an ObjectID. The column's domain guarantees the
// format, so an invalid value can only mean a programming error; it becomes the zero id.
func OID(hex string) primitive.ObjectID {
	id, _ := primitive.ObjectIDFromHex(hex)
	return id
}
