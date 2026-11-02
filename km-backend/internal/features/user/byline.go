package user

import "strings"

// Byline is how a member appears next to something they did: a feed post, a comment, a visit
// to someone's profile
type Byline struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Headline   string `json:"headline,omitempty"`
	Avatar     string `json:"avatar,omitempty"`
	IsVerified bool   `json:"is_verified"`
	// Role is "recruiter", "expert" or "user", for the small badge next to the name
	Role string `json:"role"`
}

// BylineOf builds a member's byline. It only needs the fields FindUsersByIDs loads.
func BylineOf(u *User) Byline {
	name := strings.TrimSpace(u.Name)
	if name == "" {
		name = strings.TrimSpace(u.FirstName + " " + u.LastName)
	}
	b := Byline{ID: u.ID.Hex(), Name: name, Headline: strings.TrimSpace(u.Headline), Avatar: u.ProfileImage, Role: "user"}
	for _, r := range u.Roles {
		switch r {
		case RoleRecruiter:
			b.Role = "recruiter"
		case RoleExpert:
			if b.Role != "recruiter" {
				b.Role = "expert"
			}
		}
	}
	if b.Role == "recruiter" && b.Headline == "" {
		b.Headline = strings.TrimSpace(u.CompanyName)
	}
	// Verified means checked by our team (company or expert documents), not just an email
	b.IsVerified = u.VerificationStatus == "verified"
	return b
}
