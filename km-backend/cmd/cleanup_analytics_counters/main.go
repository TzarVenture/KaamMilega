// Command cleanup_analytics_counters removes the lifetime counters that users carried before
// analytics moved to per-day events (internal/features/analytics). They had no dates, so they
// couldn't become part of the new numbers, and nothing reads them any more.
//
// It is a dry run unless -confirm is passed:
//
//	go run ./cmd/cleanup_analytics_counters
//	go run ./cmd/cleanup_analytics_counters -confirm
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// legacyFields are the old counters, plus the list of viewer IDs that went with them
var legacyFields = []string{"profile_views", "post_impressions", "search_appearances", "profile_viewers"}

func main() {
	confirm := flag.Bool("confirm", false, "actually remove the fields (default is a dry run)")
	flag.Parse()

	_ = godotenv.Load(".env")
	mongoURI := os.Getenv("MONGO_URI")
	dbName := os.Getenv("DB_NAME")
	if mongoURI == "" {
		log.Fatal("MONGO_URI not set in environment or .env")
	}
	if dbName == "" {
		dbName = "km"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}
	defer client.Disconnect(ctx)
	users := client.Database(dbName).Collection("users")

	has := make([]bson.M, len(legacyFields))
	unset := bson.M{}
	for i, f := range legacyFields {
		n, err := users.CountDocuments(ctx, bson.M{f: bson.M{"$exists": true}})
		if err != nil {
			log.Fatalf("counting %s: %v", f, err)
		}
		fmt.Printf("%-20s on %d users\n", f, n)
		has[i] = bson.M{f: bson.M{"$exists": true}}
		unset[f] = ""
	}

	if !*confirm {
		fmt.Println("Dry run. Pass -confirm to remove these fields.")
		return
	}
	res, err := users.UpdateMany(ctx, bson.M{"$or": has}, bson.M{"$unset": unset})
	if err != nil {
		log.Fatalf("removing the counters: %v", err)
	}
	fmt.Printf("Removed the old counters from %d users.\n", res.ModifiedCount)
}
