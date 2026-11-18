package logger

import (
	"context"
	"fmt"
	"time"

	"km-backend/internal/config"
	common_models "km-backend/internal/common/models"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap/zapcore"
)

// logRetentionSeconds is how long log rows are kept (30 days)
const logRetentionSeconds = 30 * 24 * 3600

// LogEntry holds the data passed from Zap to our worker
type LogEntry struct {
	Level      zapcore.Level
	Message    string
	IpAddress  string
	CustomerId *int
	Caller     string // Function name
}

// DBLogWriter handles the async writing
type DBLogWriter struct {
	db      *mongo.Database // Use generic *gorm.DB (works for MSSQL/Oracle)
	logChan chan LogEntry
}

// NewDBLogWriter initializes the worker
func NewDBLogWriter(mongodb *database.MongodbDB, cfg *config.Config) *DBLogWriter {
	// Log rows delete themselves after 30 days, so the collection stays small
	database.SyncIndexesInBackground(mongodb.DB.Collection("logs"), []mongo.IndexModel{
		{Keys: bson.D{{Key: "created_on_utc", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(logRetentionSeconds)},
	})
	writer := &DBLogWriter{
		db:      mongodb.DB,                // Assuming we log to MSSQL. Swap for Oracle if needed.
		logChan: make(chan LogEntry, 1000), // Buffer 1000 logs
	}

	// Start the background worker immediately
	go writer.processLogs()

	return writer
}

// AddLog is called by our Zap hook
func (w *DBLogWriter) AddLog(entry LogEntry) {
	select {
	case w.logChan <- entry:
		// Log pushed to channel
	default:
		// Channel full: drop log or print to stderr to prevent blocking the API
		fmt.Println("DB Log Channel Full! Dropping log:", entry.Message)
	}
}

func (w *DBLogWriter) processLogs() {
	for entry := range w.logChan {
		// Map Zap Level to your Int ID
		levelId := mapLevelToInt(entry.Level)

		// Handle nil CustomerId
		var customerId int
		if entry.CustomerId != nil {
			customerId = *entry.CustomerId
		}

		// Create the DB Record
		logRecord := common_models.Log{
			Message:      entry.Message,
			IpAddress:    entry.IpAddress, // Actual IP
			CustomerId:   customerId,
			LogLevelId:   levelId,
			CreatedOnUtc: time.Now().UTC(),
		}

		// Insert into DB (safely ignore errors to keep app running)
		// Note: efficient apps might batch insert here every 10 logs
		w.db.Collection("logs").InsertOne(context.Background(), logRecord)
	}
}

func mapLevelToInt(l zapcore.Level) int {
	switch l {
	case zapcore.DebugLevel:
		return 10
	case zapcore.InfoLevel:
		return 20
	case zapcore.WarnLevel:
		return 30
	case zapcore.ErrorLevel:
		return 40
	case zapcore.FatalLevel:
		return 50
	default:
		return 20
	}
}
