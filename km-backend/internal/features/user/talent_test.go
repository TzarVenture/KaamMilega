package user

import (
	"encoding/json"
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestTalentQueryLeavesOutEmployersAndAdmins(t *testing.T) {
	b, _ := json.Marshal(talentQuery(TalentFilter{Search: "a.b", OpenToWork: true}, primitive.NewObjectID()))
	q := string(b)
	for _, want := range []string{`"$nin":["recruiter","admin"`, `"settings.profile_visibility":{"$ne":"private"}`, `"open_to_work.is_open":true`, `a\\.b`} {
		if !strings.Contains(q, want) {
			t.Errorf("query lacks %s: %s", want, q)
		}
	}
}

func TestTalentCardHidesContactDetails(t *testing.T) {
	u := &User{Name: "A", Email: "a@x.in", Mobile: "9999999999", Experience: []Experience{{Title: "Old", EndDate: "2020"}, {Title: "Driver", CompanyName: "Q"}}}
	c := talentCard(u)
	b, _ := json.Marshal(c)
	if strings.Contains(string(b), "a@x.in") || strings.Contains(string(b), "9999") {
		t.Fatalf("contact details leaked: %s", b)
	}
	if c.CurrentTitle != "Driver" {
		t.Fatalf("current job: %q", c.CurrentTitle)
	}
}
