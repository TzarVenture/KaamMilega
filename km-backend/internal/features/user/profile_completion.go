package user

import (
	"errors"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// MinExpertExperienceYears is the client rule: an Expert needs at least 2 years of experience.
const MinExpertExperienceYears = 2.0

var ErrExpertExperienceRequired = errors.New("at least 2 years of work experience is required to become an Expert. Add your experience on your profile first")

// ProfileCriterion is one scored item of the profile checklist.
// The frontend renders titles/actions from the ID, so this is the single scoring source.
type ProfileCriterion struct {
	ID        string `json:"id"`
	Weight    int    `json:"weight"`
	Earned    int    `json:"earned"`
	Completed bool   `json:"completed"`
}

var (
	declaredYearsRe  = regexp.MustCompile(`(\d+(?:\.\d+)?)\s*\+?\s*(?:yr|year)`)
	declaredMonthsRe = regexp.MustCompile(`(\d+)\s*(?:mo|month)`)
)

// parseMonth converts "2006-01" or "2006-01-02" into a month index (year*12 + month-1).
func parseMonth(value string) (int, bool) {
	value = strings.TrimSpace(value)
	for _, layout := range []string{"2006-01", "2006-01-02"} {
		if t, err := time.Parse(layout, value); err == nil {
			return t.Year()*12 + int(t.Month()) - 1, true
		}
	}
	return 0, false
}

// declaredExperienceYears reads self-declared buckets such as "2 Years", "3+ Years" or "1-6 Months".
func declaredExperienceYears(values ...string) float64 {
	best := 0.0
	for _, v := range values {
		v = strings.ToLower(v)
		if m := declaredYearsRe.FindStringSubmatch(v); m != nil {
			if n, err := strconv.ParseFloat(m[1], 64); err == nil && n > best {
				best = n
			}
		}
		if m := declaredMonthsRe.FindStringSubmatch(v); m != nil {
			if n, err := strconv.Atoi(m[1]); err == nil && float64(n)/12 > best {
				best = float64(n) / 12
			}
		}
	}
	return best
}

// ExperienceYears returns the user's total experience in years: the larger of the
// dated experience entries (overlapping periods counted once) and the declared bucket.
func ExperienceYears(u *User) float64 {
	if u == nil {
		return 0
	}

	now := time.Now()
	nowIdx := now.Year()*12 + int(now.Month()) - 1

	type span struct{ start, end int }
	var spans []span
	for _, e := range u.Experience {
		start, ok := parseMonth(e.StartDate)
		if !ok || start > nowIdx {
			continue
		}
		end, ok := parseMonth(e.EndDate)
		if !ok || end > nowIdx {
			end = nowIdx // empty end date means "present"
		}
		if end < start {
			continue
		}
		spans = append(spans, span{start, end + 1})
	}

	sort.Slice(spans, func(i, j int) bool { return spans[i].start < spans[j].start })
	months, curStart, curEnd := 0, -1, -1
	for _, s := range spans {
		if curEnd < 0 || s.start > curEnd {
			if curEnd >= 0 {
				months += curEnd - curStart
			}
			curStart, curEnd = s.start, s.end
		} else if s.end > curEnd {
			curEnd = s.end
		}
	}
	if curEnd >= 0 {
		months += curEnd - curStart
	}

	years := math.Max(float64(months)/12, declaredExperienceYears(u.ExperienceDetail, u.WorkExperience))
	return math.Round(years*10) / 10
}

// CalculateProfileCompletion scores the profile (100 points) and derives the tier.
// Tiers follow docs/client_queries_deep_analysis.md §1.1:
//
//	30%  Basic        – browse jobs, wage benchmarks, chat with up to 3 people
//	70%  Professional – 1-click applications, recruiter search discovery
//	100% Complete     – Expert application (needs 2+ years experience) & Instant Milega gigs
func CalculateProfileCompletion(u *User) ProfileCompletion {
	has := func(s string) bool { return strings.TrimSpace(s) != "" }

	add := func(list []ProfileCriterion, id string, weight, earned int) []ProfileCriterion {
		return append(list, ProfileCriterion{ID: id, Weight: weight, Earned: earned, Completed: earned == weight})
	}
	pick := func(ok bool, weight int) int {
		if ok {
			return weight
		}
		return 0
	}

	var criteria []ProfileCriterion

	// Basic identity
	criteria = add(criteria, "name", 10, pick(has(u.Name), 10))
	criteria = add(criteria, "mobile", 10, pick(has(u.Mobile), 10))
	criteria = add(criteria, "city", 10, pick(has(u.City), 10))

	// Professional core
	criteria = add(criteria, "headline", 10, pick(has(u.Headline), 10))
	skillPts := 0
	if len(u.Skills) >= 2 {
		skillPts = 10
	} else if len(u.Skills) == 1 {
		skillPts = 5
	}
	criteria = add(criteria, "skills", 10, skillPts)
	criteria = add(criteria, "work_experience", 10,
		pick(has(u.WorkExperience) || has(u.ExperienceDetail) || len(u.Experience) > 0, 10))

	// Credibility & contact
	emailPts := 0
	if has(u.Email) && u.IsEmailVerified {
		emailPts = 10
	} else if has(u.Email) {
		emailPts = 5
	}
	criteria = add(criteria, "email", 10, emailPts)
	criteria = add(criteria, "education", 10, pick(has(u.EducationLevel) || len(u.Education) > 0, 10))
	criteria = add(criteria, "profile_image", 5, pick(has(u.ProfileImage), 5))

	// Showcase
	criteria = add(criteria, "about", 5, pick(has(u.About), 5))
	criteria = add(criteria, "portfolio", 10, pick(has(u.PortfolioURL) || len(u.Projects) > 0, 10))

	score := 0
	var missing []string
	for _, c := range criteria {
		score += c.Earned
		if !c.Completed {
			missing = append(missing, c.ID)
		}
	}

	years := ExperienceYears(u)
	expertEligible := years >= MinExpertExperienceYears

	tier, tierName := 0, "Getting Started"
	var unlocked []string
	if score >= 30 {
		tier, tierName = 1, "Basic"
		unlocked = append(unlocked, "browse_jobs", "wage_benchmarks", "direct_chat_3")
	}
	if score >= 70 {
		tier, tierName = 2, "Professional"
		unlocked = append(unlocked, "one_click_apply", "recruiter_discovery")
	}
	if score >= 100 {
		tier, tierName = 3, "Complete"
		unlocked = append(unlocked, "instant_milega_gigs")
		if expertEligible {
			unlocked = append(unlocked, "expert_application")
		}
	}

	return ProfileCompletion{
		Score:            score,
		Tier:             tier,
		TierName:         tierName,
		MissingFields:    missing,
		UnlockedServices: unlocked,
		Criteria:         criteria,
		ExperienceYears:  years,
		ExpertEligible:   expertEligible,
	}
}
