package jobstale

import (
	"testing"
	"time"
)

func TestOpenedAtUsesLatestRestart(t *testing.T) {
	created := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	renewed := created.AddDate(0, 0, 40)
	paused := created.AddDate(0, 0, 20)
	if got := (staleJob{CreatedAt: created}).openedAt(); !got.Equal(created) {
		t.Errorf("no restarts: %v", got)
	}
	if got := (staleJob{CreatedAt: created, RenewedAt: &renewed, PausedAt: &paused}).openedAt(); !got.Equal(renewed) {
		t.Errorf("renewed later than pause: %v", got)
	}
}
