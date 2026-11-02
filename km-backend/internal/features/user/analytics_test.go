package user

import (
	"testing"

	"km-backend/internal/features/analytics"
)

func TestTraitsShowWhatAndWhereNeverWho(t *testing.T) {
	cases := []struct {
		name string
		u    User
		want ViewerTraits
	}{
		{"current job wins", User{Name: "Ravi", City: "Pune", Experience: []Experience{{Title: "Helper", EndDate: "2023"}, {Title: "Electrician"}}},
			ViewerTraits{Role: "user", Title: "Electrician", City: "Pune"}},
		{"latest past job", User{City: "Nagpur", Experience: []Experience{{Title: "Plumber", EndDate: "2024"}}},
			ViewerTraits{Role: "user", Title: "Plumber", City: "Nagpur"}},
		{"job category", User{JobCategories: []string{"Driver"}}, ViewerTraits{Role: "user", Title: "Driver"}},
		{"expert category", User{Roles: []string{RoleExpert}, ExpertCategory: "Solar installation", City: "Surat"},
			ViewerTraits{Role: "expert", Title: "Solar installation", City: "Surat"}},
		// A company name would identify a small employer, so recruiters show only the role
		{"recruiter", User{Roles: []string{RoleRecruiter}, CompanyName: "Acme Pvt Ltd", City: "Mumbai"},
			ViewerTraits{Role: "recruiter", City: "Mumbai"}},
	}
	for _, c := range cases {
		if got := traitsOf(&c.u); *got != c.want {
			t.Errorf("%s: got %+v, want %+v", c.name, *got, c.want)
		}
	}
}

func TestViewingModeDefaultsToName(t *testing.T) {
	if got := viewingMode(&User{}); got != analytics.ViewAsName {
		t.Errorf("default mode = %q", got)
	}
	u := &User{Settings: UserSettings{ProfileViewing: analytics.ViewAsPrivate}}
	if got := viewingMode(u); got != analytics.ViewAsPrivate {
		t.Errorf("mode = %q", got)
	}
}
