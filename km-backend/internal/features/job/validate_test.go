package job

import (
	"strings"
	"testing"

	"km-backend/internal/common/apperr"
)

func goodJob() CreateJobRequest {
	return CreateJobRequest{
		Title: "Delivery Partner", Description: strings.Repeat("Deliver parcels on time. ", 3),
		CityID: "abc", JobType: "full time", SalaryMin: 15000, SalaryMax: 20000,
		Requirements: []string{" Two-wheeler ", "", "Licence"},
	}
}

func TestValidateCreate(t *testing.T) {
	r := goodJob()
	if err := validateCreate(&r); err != nil {
		t.Fatalf("good job refused: %v", err)
	}
	if r.JobType != "Full-time" || len(r.Requirements) != 2 || r.Requirements[0] != "Two-wheeler" {
		t.Errorf("not tidied: %q %q", r.JobType, r.Requirements)
	}

	cases := map[string]func(*CreateJobRequest){
		"JOB_TITLE_INVALID":       func(r *CreateJobRequest) { r.Title = "ab" },
		"JOB_DESCRIPTION_INVALID": func(r *CreateJobRequest) { r.Description = "too short" },
		"JOB_CITY_REQUIRED":       func(r *CreateJobRequest) { r.CityID = " " },
		"JOB_TYPE_INVALID":        func(r *CreateJobRequest) { r.JobType = "Gig" },
		"JOB_SALARY_INVALID":      func(r *CreateJobRequest) { r.SalaryMin, r.SalaryMax = 30000, 20000 },
		"JOB_EXPERIENCE_INVALID":  func(r *CreateJobRequest) { r.ExperienceMin = -1 },
		"JOB_LIST_INVALID":        func(r *CreateJobRequest) { r.WeOffer = make([]string, 21); for i := range r.WeOffer { r.WeOffer[i] = "x" } },
	}
	for code, spoil := range cases {
		r := goodJob()
		spoil(&r)
		if got := apperr.CodeOf(validateCreate(&r)); got != code {
			t.Errorf("want %s, got %q", code, got)
		}
	}
}

func TestOneSidedRangesAllowed(t *testing.T) {
	r := goodJob()
	r.SalaryMin, r.SalaryMax = 0, 18000 // "up to ₹18,000"
	r.ExperienceMin, r.ExperienceMax = 2, 0 // "2+ years"
	if err := validateCreate(&r); err != nil {
		t.Fatalf("one-sided range refused: %v", err)
	}
}
