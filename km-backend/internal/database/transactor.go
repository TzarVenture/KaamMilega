package database

import (
	"context"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

// Transactor runs a group of writes as all-or-nothing. Repositories join in by using the ctx
// handed to fn, so features can combine their own writes with a wallet posting. fn can run more
// than once (MongoDB retries on a write conflict), so it must not call anything outside the
// database: no payment gateway, emails or notifications.
type Transactor interface {
	Run(ctx context.Context, fn func(ctx context.Context) error) error
}

type mongoTransactor struct {
	client *mongo.Client
}

// NewTransactor creates a Transactor backed by MongoDB transactions.
func NewTransactor(db *MongodbDB) Transactor {
	return &mongoTransactor{client: db.Client}
}

func (t *mongoTransactor) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	// Already inside a transaction: join it, so the outer one decides commit or abort
	if mongo.SessionFromContext(ctx) != nil {
		return fn(ctx)
	}

	session, err := t.client.StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(context.Background())

	opts := options.Transaction().
		SetReadConcern(readconcern.Snapshot()).
		SetWriteConcern(writeconcern.Majority())
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		return nil, fn(sc)
	}, opts)
	return err
}

// NoopTransactor runs fn directly. For unit tests with in-memory repositories.
type NoopTransactor struct{}

func (NoopTransactor) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}
