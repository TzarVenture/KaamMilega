package user

import "strings"

// CompanySizes are the headcount bands a recruiter can pick for their company page
var CompanySizes = []string{"1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"}

// CompanyAboutMaxLen caps the company description (in characters)
const CompanyAboutMaxLen = 2000

func IsCompanySize(v string) bool {
	for _, s := range CompanySizes {
		if s == v {
			return true
		}
	}
	return false
}

// cleanCompanyAbout trims the description and cuts it to CompanyAboutMaxLen characters
func cleanCompanyAbout(v string) string {
	v = strings.TrimSpace(v)
	if r := []rune(v); len(r) > CompanyAboutMaxLen {
		v = strings.TrimSpace(string(r[:CompanyAboutMaxLen]))
	}
	return v
}
