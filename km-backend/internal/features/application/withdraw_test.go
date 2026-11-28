package application

import "testing"

func TestCanWithdrawOnlyOpenApplications(t *testing.T) {
	for status, want := range map[string]bool{
		"Applied": true, "shortlisted": true, "Interviewing": true, "": true,
		"Hired": false, "Rejected": false, "Withdrawn": false,
	} {
		if got := CanWithdraw(status); got != want {
			t.Errorf("CanWithdraw(%q) = %v, want %v", status, got, want)
		}
	}
}

func TestEmployersCannotSetWithdrawn(t *testing.T) {
	if CanonicalStatus("Withdrawn") != "" {
		t.Error("Withdrawn must not be a stage an employer can move someone to")
	}
	if knownStatus("withdrawn") != StatusWithdrawn {
		t.Error("Withdrawn must still be shown")
	}
}
