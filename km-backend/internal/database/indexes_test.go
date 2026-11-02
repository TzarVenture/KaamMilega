package database

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestIndexNameMatchesMongoDB(t *testing.T) {
	cases := map[string]bson.D{
		"post_id_1_visitor_1_day_1": {{Key: "post_id", Value: 1}, {Key: "visitor", Value: 1}, {Key: "day", Value: 1}},
		"status_1__id_-1":           {{Key: "status", Value: 1}, {Key: "_id", Value: -1}},
		// Keys read back from the server are int32
		"at_1": {{Key: "at", Value: int32(1)}},
	}
	for want, keys := range cases {
		if got := IndexName(keys); got != want {
			t.Errorf("IndexName(%v) = %q, want %q", keys, got, want)
		}
	}
}
