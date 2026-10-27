package user

// PublicView returns a copy of u that is safe to show to anyone other than the owner or an
// admin. Contact details, private documents, location traces, activity and settings stay
// with the owner; only what a visitor sees on the profile page is kept.
func (u *User) PublicView() *User {
	if u == nil {
		return nil
	}
	p := *u

	// Contact and identity
	p.Mobile = ""
	p.Email = ""
	p.EmailVerifiedAt = nil
	p.Address = ""
	p.DateOfBirth = ""
	p.MaritalStatus = ""
	p.GST = ""

	// Private documents and review state
	p.CompanyDocuments = nil
	p.ExpertDocuments = nil

	// Location, activity and private lists
	p.LastLoginLat = 0
	p.LastLoginLng = 0
	p.BookmarkedJobs = nil
	p.ProfileViewers = nil

	// Account internals
	p.Roles = publicRoles(u.Roles)
	p.DeactivatedAt = nil
	p.DeletionRequestedAt = nil
	p.DeletionScheduledFor = nil
	p.HasPassword = false

	// Only the two settings the profile page needs for its robots tag
	p.Settings = UserSettings{
		ProfileVisibility:    u.Settings.ProfileVisibility,
		SearchEngineIndexing: u.Settings.SearchEngineIndexing,
	}
	return &p
}

// publicRoles keeps roles that change how a profile is shown (recruiter, expert) and drops
// staff roles, which visitors have no reason to see.
func publicRoles(roles []string) []string {
	out := make([]string, 0, len(roles))
	for _, r := range roles {
		if r != RoleAdmin {
			out = append(out, r)
		}
	}
	return out
}

// PublicViews applies PublicView to a list.
func PublicViews(users []*User) []*User {
	out := make([]*User, 0, len(users))
	for _, u := range users {
		if u != nil {
			out = append(out, u.PublicView())
		}
	}
	return out
}
