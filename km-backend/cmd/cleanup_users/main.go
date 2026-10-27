// Command cleanup_users removes test accounts (and records that reference them) by exact mobile number.
//
// It is a dry run unless -confirm is passed:
//
//	go run ./cmd/cleanup_users -mobiles 9876543210,9123456789
//	go run ./cmd/cleanup_users -mobiles 9876543210 -confirm
//
// Only exact mobile matches are used to find accounts; names and emails are never pattern-matched.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Fields in other collections that hold a user id (ObjectID or hex string)
var userRefFields = []string{
	"user_id", "userId", "author_id", "authorId", "recruiter_id", "recruiterId",
	"applicant_id", "applicantId", "sender_id", "senderId", "recipient_id", "recipientId",
	"customer_id", "customerId", "worker_id", "workerId", "target_user_id", "actor_id",
	"expert_id", "mentor_id", "participants",
}

func mobileVariants(m string) []string {
	return []string{m, "+91" + m, "91" + m, "0" + m}
}

func main() {
	mobilesFlag := flag.String("mobiles", "", "comma-separated 10-digit mobile numbers of the accounts to remove")
	confirm := flag.Bool("confirm", false, "actually delete (default is a dry run)")
	flag.Parse()

	var mobiles []string
	for _, m := range strings.Split(*mobilesFlag, ",") {
		m = strings.TrimSpace(m)
		if m == "" {
			continue
		}
		if len(m) != 10 || strings.Trim(m, "0123456789") != "" {
			log.Fatalf("invalid mobile %q: expected 10 digits", m)
		}
		mobiles = append(mobiles, m)
	}
	if len(mobiles) == 0 {
		log.Fatal("pass at least one mobile number with -mobiles")
	}

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
	db := client.Database(dbName)

	var variants []string
	for _, m := range mobiles {
		variants = append(variants, mobileVariants(m)...)
	}

	cursor, err := db.Collection("users").Find(ctx, bson.M{"mobile": bson.M{"$in": variants}})
	if err != nil {
		log.Fatalf("failed to search users: %v", err)
	}
	var users []struct {
		ID     primitive.ObjectID `bson:"_id"`
		Name   string             `bson:"name"`
		Mobile string             `bson:"mobile"`
		Roles  []string           `bson:"roles"`
	}
	if err := cursor.All(ctx, &users); err != nil {
		log.Fatalf("failed to decode users: %v", err)
	}

	fmt.Printf("Database %q: %d matching account(s)\n", dbName, len(users))
	var ids []primitive.ObjectID
	var hexes []string
	for _, u := range users {
		fmt.Printf("  %s  %-12s  %q  %v\n", u.ID.Hex(), u.Mobile, u.Name, u.Roles)
		ids = append(ids, u.ID)
		hexes = append(hexes, u.ID.Hex())
	}

	colls, err := db.ListCollectionNames(ctx, bson.M{})
	if err != nil {
		log.Fatalf("failed to list collections: %v", err)
	}

	total := int64(0)
	for _, name := range colls {
		var or []bson.M
		if name == "users" {
			if len(ids) == 0 {
				continue
			}
			or = append(or, bson.M{"_id": bson.M{"$in": ids}})
		} else {
			for _, f := range userRefFields {
				if len(ids) > 0 {
					or = append(or, bson.M{f: bson.M{"$in": ids}}, bson.M{f: bson.M{"$in": hexes}})
				}
			}
			// OTP and similar records keyed by mobile
			or = append(or, bson.M{"mobile": bson.M{"$in": variants}})
		}

		filter := bson.M{"$or": or}
		col := db.Collection(name)
		count, err := col.CountDocuments(ctx, filter)
		if err != nil {
			log.Printf("count failed in %s: %v", name, err)
			continue
		}
		if count == 0 {
			continue
		}

		if !*confirm {
			fmt.Printf("  [dry run] %-28s %d record(s)\n", name, count)
			total += count
			continue
		}
		res, err := col.DeleteMany(ctx, filter)
		if err != nil {
			log.Printf("delete failed in %s: %v", name, err)
			continue
		}
		fmt.Printf("  [deleted] %-28s %d record(s)\n", name, res.DeletedCount)
		total += res.DeletedCount
	}

	if *confirm {
		fmt.Printf("Deleted %d record(s).\n", total)
	} else {
		fmt.Printf("Dry run: %d record(s) would be deleted. Re-run with -confirm to delete.\n", total)
	}
}
