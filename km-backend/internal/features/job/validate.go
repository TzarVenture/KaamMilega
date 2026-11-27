package job

import (
	"strings"
	"unicode/utf8"

	"km-backend/internal/common/apperr"
)

// Limits on what an employer can write into a job post
const (
	TitleMin       = 3
	TitleMax       = 100
	DescriptionMin = 30
	DescriptionMax = 5000
	ListItemsMax   = 20
	ListItemMax    = 200
	SalaryMax      = 10_000_000 // ₹1 crore a month: anything above is a typing mistake
	ExperienceMax  = 50
	LocationMax    = 200
)

// JobTypes an employer can choose
var JobTypes = []string{"Full-time", "Part-time", "Contract", "Freelance", "Internship"}

var (
	ErrTitleInvalid       = apperr.New("JOB_TITLE_INVALID", "job title must be 3 to 100 characters")
	ErrDescriptionInvalid = apperr.New("JOB_DESCRIPTION_INVALID", "job description must be 30 to 5000 characters")
	ErrCityRequired       = apperr.New("JOB_CITY_REQUIRED", "please choose the city of the job")
	ErrCityInvalid        = apperr.New("JOB_CITY_INVALID", "that city is not on KaamMilega")
	ErrJobTypeInvalid     = apperr.New("JOB_TYPE_INVALID", "job type must be Full-time, Part-time, Contract, Freelance or Internship")
	ErrSalaryInvalid      = apperr.New("JOB_SALARY_INVALID", "salary must be 0 or more, and the maximum not below the minimum")
	ErrExperienceInvalid  = apperr.New("JOB_EXPERIENCE_INVALID", "experience must be 0 to 50 years, and the maximum not below the minimum")
	ErrListInvalid        = apperr.New("JOB_LIST_INVALID", "requirements and benefits take up to 20 items of 200 characters each")
	ErrLocationInvalid    = apperr.New("JOB_LOCATION_INVALID", "address must be 200 characters or fewer")
)

// CanonicalJobType matches a job type in any case or spacing ("full time" → "Full-time"); "" if unknown
func CanonicalJobType(s string) string {
	key := func(v string) string {
		return strings.NewReplacer("-", "", " ", "", "_", "").Replace(strings.ToLower(strings.TrimSpace(v)))
	}
	for _, t := range JobTypes {
		if key(t) == key(s) {
			return t
		}
	}
	return ""
}

// cleanList trims each item and drops empty ones
func cleanList(items []string) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		if it = strings.TrimSpace(it); it != "" {
			out = append(out, it)
		}
	}
	return out
}

func checkList(items []string) error {
	if len(items) > ListItemsMax {
		return ErrListInvalid
	}
	for _, it := range items {
		if utf8.RuneCountInString(it) > ListItemMax {
			return ErrListInvalid
		}
	}
	return nil
}

func between(s string, lo, hi int) bool {
	n := utf8.RuneCountInString(strings.TrimSpace(s))
	return n >= lo && n <= hi
}

func rangeOK(lo, hi, limit int) bool {
	return lo >= 0 && hi >= 0 && lo <= limit && hi <= limit && (hi == 0 || lo == 0 || hi >= lo)
}

// validateCreate checks and tidies a new job post in place
func validateCreate(req *CreateJobRequest) error {
	req.Title, req.Description, req.Location = strings.TrimSpace(req.Title), strings.TrimSpace(req.Description), strings.TrimSpace(req.Location)
	if !between(req.Title, TitleMin, TitleMax) {
		return ErrTitleInvalid
	}
	if !between(req.Description, DescriptionMin, DescriptionMax) {
		return ErrDescriptionInvalid
	}
	if strings.TrimSpace(req.CityID) == "" {
		return ErrCityRequired
	}
	if utf8.RuneCountInString(req.Location) > LocationMax {
		return ErrLocationInvalid
	}
	if req.JobType = CanonicalJobType(req.JobType); req.JobType == "" {
		return ErrJobTypeInvalid
	}
	if !rangeOK(req.SalaryMin, req.SalaryMax, SalaryMax) {
		return ErrSalaryInvalid
	}
	if !rangeOK(req.ExperienceMin, req.ExperienceMax, ExperienceMax) {
		return ErrExperienceInvalid
	}
	req.Requirements, req.WeOffer = cleanList(req.Requirements), cleanList(req.WeOffer)
	if err := checkList(req.Requirements); err != nil {
		return err
	}
	return checkList(req.WeOffer)
}

// validateUpdate checks the fields an edit sends; the merged job is checked by validateMerged
func validateUpdate(req *UpdateJobRequest) error {
	if req.Title != "" {
		if req.Title = strings.TrimSpace(req.Title); !between(req.Title, TitleMin, TitleMax) {
			return ErrTitleInvalid
		}
	}
	if req.Description != "" {
		if req.Description = strings.TrimSpace(req.Description); !between(req.Description, DescriptionMin, DescriptionMax) {
			return ErrDescriptionInvalid
		}
	}
	if utf8.RuneCountInString(strings.TrimSpace(req.Location)) > LocationMax {
		return ErrLocationInvalid
	}
	if req.JobType != "" {
		if req.JobType = CanonicalJobType(req.JobType); req.JobType == "" {
			return ErrJobTypeInvalid
		}
	}
	if req.Requirements != nil {
		req.Requirements = cleanList(req.Requirements)
		if err := checkList(req.Requirements); err != nil {
			return err
		}
	}
	if req.WeOffer != nil {
		req.WeOffer = cleanList(req.WeOffer)
		if err := checkList(req.WeOffer); err != nil {
			return err
		}
	}
	return nil
}

// validateMerged checks the ranges once an edit is applied (one end may come from the saved job)
func validateMerged(j *Job) error {
	if !rangeOK(j.SalaryMin, j.SalaryMax, SalaryMax) {
		return ErrSalaryInvalid
	}
	if !rangeOK(j.ExperienceMin, j.ExperienceMax, ExperienceMax) {
		return ErrExperienceInvalid
	}
	return nil
}
