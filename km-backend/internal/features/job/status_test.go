package job

import "testing"

func TestCanonicalStatus(t *testing.T) {
	for in, want := range map[string]string{"": "Open", "active": "Open", "OPEN": "Open", "On Hold": "Paused", "paused": "Paused", "closed": "Closed", "Deleted": "", "weird": ""} {
		if got := CanonicalStatus(in); got != want {
			t.Errorf("%q: got %q want %q", in, got, want)
		}
	}
}
