package user

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestPublicViewStripsPrivateFields(t *testing.T) {
	now := time.Now()
	u := &User{
		Name:             "Asha",
		Headline:         "Electrician",
		City:             "Pune",
		Mobile:           "9876543210",
		Email:            "asha@example.com",
		EmailVerifiedAt:  &now,
		Address:          "12 MG Road",
		DateOfBirth:      "1995-01-01",
		MaritalStatus:    "single",
		GST:              "27ABCDE1234F1Z5",
		CompanyDocuments: []Document{{}},
		ExpertDocuments:  []Document{{}},
		LastLoginLat:     18.52,
		LastLoginLng:     73.85,
		BookmarkedJobs:   []string{"j1"},
		ProfileViewers:   []string{"v1"},
		Roles:            []string{RoleUser, RoleAdmin, RoleExpert},
		Settings:         UserSettings{ProfileVisibility: "public", SearchEngineIndexing: true, EmailMarketing: true, Language: "hi"},
	}

	p := u.PublicView()
	raw, _ := json.Marshal(p)
	out := string(raw)
	for _, secret := range []string{"9876543210", "asha@example.com", "12 MG Road", "1995-01-01", "27ABCDE1234F1Z5", "18.52", "j1", "v1", `"admin"`, "email_marketing\":true", `"hi"`} {
		if strings.Contains(out, secret) {
			t.Errorf("public view leaks %s: %s", secret, out)
		}
	}
	for _, kept := range []string{"Asha", "Electrician", "Pune", `"expert"`, `"profile_visibility":"public"`, `"search_engine_indexing":true`} {
		if !strings.Contains(out, kept) {
			t.Errorf("public view lost %s", kept)
		}
	}
	if u.Mobile == "" || len(u.Roles) != 3 {
		t.Error("PublicView must not modify the original user")
	}
	if PublicViews([]*User{u, nil})[0].Email != "" {
		t.Error("PublicViews must strip each user")
	}
}
