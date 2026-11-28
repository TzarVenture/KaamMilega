package recruiterdigest

import (
	"testing"
	"time"
)

func TestSendingHoursAreIndiaDaytime(t *testing.T) {
	cases := map[string]bool{
		"03:29": false, // 08:59 IST
		"03:30": true,  // 09:00 IST
		"15:29": true,  // 20:59 IST
		"15:30": false, // 21:00 IST
	}
	for utc, want := range cases {
		at, _ := time.Parse("2006-01-02 15:04", "2026-11-28 "+utc)
		if got := sendingHours(at); got != want {
			t.Errorf("%s UTC: sendingHours = %v, want %v", utc, got, want)
		}
	}
}

func TestDayOfUsesIndiaDate(t *testing.T) {
	at := time.Date(2026, 11, 27, 19, 0, 0, 0, time.UTC) // 00:30 on 28 Nov in India
	day, start, end := dayOf(at)
	if day != "2026-11-28" {
		t.Fatalf("day = %s", day)
	}
	if !start.Equal(time.Date(2026, 11, 27, 18, 30, 0, 0, time.UTC)) || end.Sub(start) != 24*time.Hour {
		t.Errorf("bounds = %v .. %v", start, end)
	}
}

func TestSinceIsLastSummaryAtMostThreeDaysBack(t *testing.T) {
	now := time.Date(2026, 11, 28, 4, 0, 0, 0, time.UTC)
	if got := since(now, nil); !got.Equal(now.Add(-24 * time.Hour)) {
		t.Errorf("first summary: %v", got)
	}
	last := now.Add(-5 * time.Hour)
	if got := since(now, &last); !got.Equal(last) {
		t.Errorf("after a summary: %v", got)
	}
	old := now.Add(-10 * 24 * time.Hour)
	if got := since(now, &old); !got.Equal(now.Add(-maxLookback)) {
		t.Errorf("long gap: %v", got)
	}
}
