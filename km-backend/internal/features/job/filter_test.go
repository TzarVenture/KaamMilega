package job

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

// educationPatterns pulls the education regexes out of a list filter
func educationPatterns(t *testing.T, f bson.M) []string {
	t.Helper()
	var out []string
	for _, cond := range f["$and"].([]bson.M) {
		ors, ok := cond["$or"].([]bson.M)
		if !ok {
			continue
		}
		for _, o := range ors {
			if e, ok := o["education"].(bson.M); ok {
				out = append(out, e["$regex"].(string))
			}
		}
	}
	return out
}

func TestListFilterEducation(t *testing.T) {
	cases := []struct {
		in   []string
		want []string
	}{
		// "^" at the start means "starts with"; the rest is still escaped
		{[]string{"^graduation"}, []string{"^graduation"}},
		// anything else is matched literally, so typed regex can't run
		{[]string{"diploma|iti"}, []string{`diploma\|iti`}},
		{[]string{"diploma", " iti "}, []string{"diploma", "iti"}},
		{[]string{"^.*"}, []string{`^\.\*`}},
		{[]string{"^", " "}, nil},
	}
	for _, c := range cases {
		got := educationPatterns(t, listFilter(JobFilter{Education: c.in}))
		if len(got) != len(c.want) {
			t.Fatalf("%q: got %q, want %q", c.in, got, c.want)
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Fatalf("%q: got %q, want %q", c.in, got, c.want)
			}
		}
	}
}

func TestListFilterAlwaysHidesDeleted(t *testing.T) {
	f := listFilter(JobFilter{})
	found := false
	for _, cond := range f["$and"].([]bson.M) {
		if s, ok := cond["status"].(bson.M); ok && s["$ne"] == "Deleted" {
			found = true
		}
	}
	if !found {
		t.Fatal("deleted jobs are not filtered out")
	}
}
