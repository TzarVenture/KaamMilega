package user

import (
	"testing"
	"time"
)

func monthsAgo(n int) string {
	return time.Now().AddDate(0, -n, 0).Format("2006-01")
}

func TestExperienceYears(t *testing.T) {
	cases := []struct {
		name string
		user *User
		want float64
	}{
		{"fresher", &User{ExperienceDetail: "Fresher"}, 0},
		{"declared months", &User{ExperienceDetail: "1-6 Months"}, 0.5},
		{"declared 2 years", &User{ExperienceDetail: "2 Years"}, 2},
		{"declared 3+ years", &User{ExperienceDetail: "3+ Years"}, 3},
		{"year number is not experience", &User{ExperienceDetail: "Graduated 2024"}, 0},
		{"current job 30 months", &User{Experience: []Experience{{StartDate: monthsAgo(29)}}}, 2.5},
		{"two short jobs are not two years", &User{Experience: []Experience{
			{StartDate: monthsAgo(10), EndDate: monthsAgo(8)},
			{StartDate: monthsAgo(5), EndDate: monthsAgo(3)},
		}}, 0.5},
		{"overlapping jobs counted once", &User{Experience: []Experience{
			{StartDate: monthsAgo(23), EndDate: monthsAgo(0)},
			{StartDate: monthsAgo(11), EndDate: monthsAgo(0)},
		}}, 2},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ExperienceYears(c.user); got != c.want {
				t.Errorf("got %v, want %v", got, c.want)
			}
		})
	}
}

func TestCalculateProfileCompletionTiers(t *testing.T) {
	newUser := &User{Name: "Rahul", Mobile: "9876543210"}
	c := CalculateProfileCompletion(newUser)
	if c.Score != 20 || c.Tier != 0 {
		t.Fatalf("new user: got score %d tier %d", c.Score, c.Tier)
	}

	newUser.City = "Pune"
	if c = CalculateProfileCompletion(newUser); c.Score != 30 || c.Tier != 1 {
		t.Fatalf("with city: got score %d tier %d", c.Score, c.Tier)
	}

	full := &User{
		Name: "Rahul", Mobile: "9876543210", City: "Pune", Headline: "Electrician",
		Skills: []string{"Wiring", "Panels"}, ExperienceDetail: "1 Year",
		Email: "r@example.com", IsEmailVerified: true, EducationLevel: "ITI",
		ProfileImage: "x.jpg", About: "Electrician", PortfolioURL: "https://example.com",
	}
	c = CalculateProfileCompletion(full)
	if c.Score != 100 || c.Tier != 3 || len(c.MissingFields) != 0 {
		t.Fatalf("full: got score %d tier %d missing %v", c.Score, c.Tier, c.MissingFields)
	}
	if c.ExpertEligible {
		t.Fatalf("1 year of experience must not be expert eligible")
	}

	full.ExperienceDetail = "2 Years"
	if c = CalculateProfileCompletion(full); !c.ExpertEligible {
		t.Fatalf("2 years of experience must be expert eligible")
	}

	sum := 0
	for _, cr := range c.Criteria {
		sum += cr.Weight
	}
	if sum != 100 {
		t.Fatalf("criteria weights must total 100, got %d", sum)
	}
}
