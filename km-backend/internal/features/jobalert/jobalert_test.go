package jobalert

import (
	"testing"
	"time"
)

func TestScoreNeedsSkillOrHeadlineMatch(t *testing.T) {
	c := candidate{City: "Pune", Headline: "Electrician", Skills: []string{"Wiring", "Solar Panel Installation"}}
	cases := []struct {
		job  jobDoc
		want bool
	}{
		{jobDoc{Title: "Electrician", CityName: "Mumbai"}, true},
		{jobDoc{Title: "Site Technician", Requirements: []string{"solar panel installation experience"}, CityName: "Pune"}, true},
		{jobDoc{Title: "Delivery Partner", CityName: "Pune"}, false}, // same city alone isn't a match
		{jobDoc{Title: "Rewiring specialist"}, false},              // whole words only
	}
	for _, tc := range cases {
		if got := score(c, tc.job) > 0; got != tc.want {
			t.Errorf("%q in %s: match=%v, want %v", tc.job.Title, tc.job.CityName, got, tc.want)
		}
	}
}

func TestPickRanksLocalAndLimits(t *testing.T) {
	c := candidate{City: "Pune", Skills: []string{"Driving"}}
	now := time.Now()
	var jobs []jobDoc
	for i := 0; i < 8; i++ {
		jobs = append(jobs, jobDoc{Title: "Driving job", CityName: "Delhi", CreatedAt: now.Add(-time.Duration(i) * time.Hour)})
	}
	local := jobDoc{Title: "Driving job", CityName: "pune", CreatedAt: now.Add(-48 * time.Hour)}
	jobs = append(jobs, local)

	got := pick(c, jobs)
	if len(got) != maxJobsPerEmail {
		t.Fatalf("picked %d, want %d", len(got), maxJobsPerEmail)
	}
	if got[0].CityName != "pune" {
		t.Errorf("local job should rank first, got %q", got[0].CityName)
	}
}

func TestSalaryText(t *testing.T) {
	cases := map[[2]int]string{
		{15000, 20000}: "₹15,000 – ₹20,000 / month",
		{120000, 0}:    "₹1,20,000 / month",
		{0, 9000}:      "Up to ₹9,000 / month",
		{0, 0}:         "",
	}
	for in, want := range cases {
		if got := salaryText(in[0], in[1]); got != want {
			t.Errorf("salaryText(%d, %d) = %q, want %q", in[0], in[1], got, want)
		}
	}
}
