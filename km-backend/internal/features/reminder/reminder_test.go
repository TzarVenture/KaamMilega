package reminder

import (
	"testing"
	"time"
)

func TestEventStart(t *testing.T) {
	cases := []struct {
		date, clock string
		want        string // IST
		ok          bool
	}{
		{"2026-10-25", "19:00", "2026-10-25 19:00", true},
		{"2026-10-25", "7:30 PM", "2026-10-25 19:30", true},
		{"2026-10-25", "07:30 pm", "2026-10-25 19:30", true},
		{"2026-10-25", "", "2026-10-25 10:00", true},
		{"25/10/2026", "19:00", "", false},
	}
	for _, c := range cases {
		got, ok := EventStart(c.date, c.clock)
		if ok != c.ok {
			t.Fatalf("%s %s: ok=%v", c.date, c.clock, ok)
		}
		if ok && got.In(ist).Format("2006-01-02 15:04") != c.want {
			t.Fatalf("%s %s: got %s, want %s", c.date, c.clock, got.In(ist).Format(time.DateTime), c.want)
		}
	}
}
