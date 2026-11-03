package database

import (
	"context"
	"fmt"
	"log"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// IndexName is the name MongoDB generates for an index key, like "post_id_1_day_-1"
func IndexName(keys bson.D) string {
	parts := make([]string, 0, 2*len(keys))
	for _, k := range keys {
		parts = append(parts, k.Key, fmt.Sprint(k.Value))
	}
	return strings.Join(parts, "_")
}

// SyncIndexes creates a collection's indexes (keys must be bson.D, and each model needs its own
// options value: the driver writes the generated name into it). Before that it drops:
//   - an index on one of these keys stored under another name (sharing one options value used to
//     give several indexes the first one's name, and MongoDB refuses to create a key twice), and
//   - indexes on the obsolete keys, ones the code no longer wants.
//
// Indexes on any other key are left alone.
func SyncIndexes(ctx context.Context, coll *mongo.Collection, models []mongo.IndexModel, obsolete ...bson.D) {
	wanted := make(map[string]bool, len(models))
	for _, m := range models {
		wanted[IndexName(m.Keys.(bson.D))] = true
	}
	drop := make(map[string]bool, len(obsolete))
	for _, keys := range obsolete {
		drop[IndexName(keys)] = true
	}

	specs, err := coll.Indexes().ListSpecifications(ctx)
	if err != nil {
		log.Printf("indexes: listing %s: %v", coll.Name(), err)
		return
	}
	for _, spec := range specs {
		var keys bson.D
		if spec.Name == "_id_" || bson.Unmarshal(spec.KeysDocument, &keys) != nil {
			continue
		}
		name := IndexName(keys)
		if drop[name] || (wanted[name] && spec.Name != name) {
			if _, err := coll.Indexes().DropOne(ctx, spec.Name); err != nil {
				log.Printf("indexes: dropping %s on %s: %v", spec.Name, coll.Name(), err)
			}
		}
	}
	if _, err := coll.Indexes().CreateMany(ctx, models); err != nil {
		log.Printf("indexes: creating on %s: %v", coll.Name(), err)
	}
}
