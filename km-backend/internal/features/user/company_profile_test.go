package user

import (
	"strings"
	"testing"
)

func TestCleanCompanyAbout(t *testing.T) {
	if got := cleanCompanyAbout("  hi  "); got != "hi" {
		t.Errorf("got %q", got)
	}
	long := strings.Repeat("क", CompanyAboutMaxLen+50)
	if got := []rune(cleanCompanyAbout(long)); len(got) != CompanyAboutMaxLen {
		t.Errorf("len = %d", len(got))
	}
	if !IsCompanySize("11-50") || IsCompanySize("lots") {
		t.Error("IsCompanySize")
	}
}
