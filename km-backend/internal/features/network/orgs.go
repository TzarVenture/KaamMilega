package network

import (
	"regexp"
	"sort"
	"strings"
	"unicode"
)

// Workplaces and colleges are typed freely on profiles ("Infosys", "Infosys Ltd.", "INFOSYS
// LIMITED"), so they are compared by a normalised key: lower case, punctuation removed and legal
// endings such as "Pvt Ltd" dropped.

// legalEndings are dropped from the end of a company name before comparing
var legalEndings = map[string]bool{
	"pvt": true, "private": true, "ltd": true, "limited": true, "llp": true, "inc": true,
	"llc": true, "corp": true, "corporation": true, "co": true, "plc": true, "opc": true,
}

// notAWorkplace are entries that don't make two people colleagues
var notAWorkplace = map[string]bool{
	"self": true, "self employed": true, "freelance": true, "freelancer": true, "na": true,
	"none": true, "home": true, "student": true, "unemployed": true, "business": true, "own business": true,
}

// orgKey is the comparison key for a company or college name, "" if it can't be matched
func orgKey(name string) string {
	words := strings.FieldsFunc(strings.ToLower(name), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	for len(words) > 1 && legalEndings[words[len(words)-1]] {
		words = words[:len(words)-1]
	}
	key := strings.Join(words, " ")
	if len(key) < 2 || notAWorkplace[key] {
		return ""
	}
	return key
}

// orgPattern finds names with the same key in the database: the key's words in order, separated
// by anything that isn't a letter or digit, followed by nothing or a legal ending, so "Infosys"
// finds "Infosys Ltd." but not "Infosys BPM"
func orgPattern(key string) string {
	words := strings.Fields(key)
	for i, w := range words {
		words[i] = regexp.QuoteMeta(w)
	}
	return `^\W*` + strings.Join(words, `\W+`) + `(\W+(pvt|private|ltd|limited|llp|inc|llc|corp|corporation|co|plc|opc))*\W*$`
}

// workplace is one company on a profile
type workplace struct {
	name    string // as the person typed it
	current bool   // they still work there
}

// orgs is where someone works, worked and studied, by key
type orgs struct {
	companies map[string]workplace
	schools   map[string]string
}

type experienceEntry struct {
	Title       string `bson:"title"`
	CompanyName string `bson:"company_name"`
	EndDate     string `bson:"end_date"`
}

type educationEntry struct {
	SchoolName string `bson:"school_name"`
}

// orgsOf collects a profile's workplaces and colleges. A recruiter's own company counts as their
// current workplace.
func orgsOf(companyName string, experience []experienceEntry, education []educationEntry) orgs {
	o := orgs{companies: map[string]workplace{}, schools: map[string]string{}}
	add := func(name string, current bool) {
		key := orgKey(name)
		if key == "" {
			return
		}
		w, seen := o.companies[key]
		if !seen {
			w.name = strings.TrimSpace(name)
		}
		w.current = w.current || current
		o.companies[key] = w
	}
	add(companyName, true)
	for _, e := range experience {
		add(e.CompanyName, strings.TrimSpace(e.EndDate) == "")
	}
	for _, e := range education {
		if key := orgKey(e.SchoolName); key != "" {
			if _, seen := o.schools[key]; !seen {
				o.schools[key] = strings.TrimSpace(e.SchoolName)
			}
		}
	}
	return o
}

// sortedKeys gives map keys in a fixed order, so queries and badges don't change between requests
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// orgOverlap is what two profiles share
type orgOverlap struct {
	company    string // a workplace both have, as the viewer typed it
	colleagues bool   // both work there now
	school     string // a college both went to, as the viewer typed it
}

func sharedOrgs(mine, theirs orgs) orgOverlap {
	var out orgOverlap
	for _, key := range sortedKeys(mine.companies) {
		their, ok := theirs.companies[key]
		if !ok {
			continue
		}
		both := mine.companies[key].current && their.current
		// Prefer a place both work now over one they both left
		if out.company == "" || (both && !out.colleagues) {
			out.company, out.colleagues = mine.companies[key].name, both
		}
	}
	for _, key := range sortedKeys(mine.schools) {
		if _, ok := theirs.schools[key]; ok {
			out.school = mine.schools[key]
			break
		}
	}
	return out
}
