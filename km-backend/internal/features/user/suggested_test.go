package user

import (
	"reflect"
	"testing"
)

func TestMatchTerms(t *testing.T) {
	got := matchTerms(suggestJob{Title: "Urgent Hiring - Delivery Boy / Driver", Requirements: []string{"Two wheeler licence", "Must be able to work night shifts in the warehouse", "DL"}})
	want := []string{"delivery", "boy", "driver", "two wheeler licence"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("matchTerms = %v, want %v", got, want)
	}
	if n := len(matchTerms(suggestJob{Title: "and for the"})); n != 0 {
		t.Errorf("stop words only should give no terms, got %d", n)
	}
}
