package ads

import (
	"math/rand"
	"testing"
	"time"

	"km-backend/internal/common/apperr"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var now = time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)

func running() *Campaign {
	return &Campaign{
		ID:         primitive.NewObjectID(),
		Status:     StatusActive,
		Placements: []string{"feed_sidebar"},
		StartAt:    now.Add(-time.Hour),
		Priority:   5,
	}
}

func TestStateFollowsStatusAndDates(t *testing.T) {
	c := running()
	if got := c.State(now); got != StatusActive {
		t.Fatalf("running campaign: got %s", got)
	}
	c.StartAt = now.Add(time.Hour)
	if got := c.State(now); got != "scheduled" {
		t.Fatalf("future start: got %s", got)
	}
	c.StartAt = now.Add(-2 * time.Hour)
	end := now.Add(-time.Hour)
	c.EndAt = &end
	if got := c.State(now); got != "ended" {
		t.Fatalf("past end: got %s", got)
	}
	c.Status = StatusPaused
	if got := c.State(now); got != StatusPaused {
		t.Fatalf("paused wins: got %s", got)
	}
}

func TestFitsChecksSlotAudienceAndCity(t *testing.T) {
	guest := Audience{Groups: []string{"guest"}}
	member := Audience{Groups: []string{"user"}, City: "Pune"}

	c := running()
	if !c.Fits("feed_sidebar", guest, now) {
		t.Fatal("untargeted campaign should show to anyone in its slot")
	}
	if c.Fits("jobs_inline", guest, now) {
		t.Fatal("campaign must not show outside its slots")
	}

	c.Audiences = []string{"recruiter"}
	if c.Fits("feed_sidebar", member, now) {
		t.Fatal("recruiter-only campaign shown to a jobseeker")
	}
	c.Audiences = []string{"user", "guest"}
	if !c.Fits("feed_sidebar", member, now) || !c.Fits("feed_sidebar", guest, now) {
		t.Fatal("campaign for jobseekers and guests should show to both")
	}

	c.Cities = []string{"pune "}
	if !c.Fits("feed_sidebar", member, now) {
		t.Fatal("city match should ignore case and spaces")
	}
	if c.Fits("feed_sidebar", guest, now) {
		t.Fatal("city-limited campaign shown to someone whose city is unknown")
	}
}

func validInput() *CampaignInput {
	return &CampaignInput{
		Name: "Diwali hiring push", Advertiser: "Acme", Headline: "Hiring drivers in Pune",
		CreativeType: CreativeImage, CreativeURL: "https://cdn.example.com/a.png", LinkURL: "https://acme.example/jobs",
		Placements: []string{"feed_sidebar", "feed_sidebar", " jobs_inline "},
	}
}

func TestCampaignInputDefaultsAndCleansLists(t *testing.T) {
	c, err := validInput().Campaign(now)
	if err != nil {
		t.Fatal(err)
	}
	if c.Priority != 5 || c.Status != StatusActive || !c.StartAt.Equal(now) {
		t.Fatalf("defaults: priority %d, status %s, start %v", c.Priority, c.Status, c.StartAt)
	}
	if len(c.Placements) != 2 || c.Placements[1] != "jobs_inline" {
		t.Fatalf("placements not de-duplicated and trimmed: %v", c.Placements)
	}
}

func TestCampaignInputRejectsBadValues(t *testing.T) {
	past := now.Add(-time.Hour)
	cases := map[string]func(in *CampaignInput){
		"AD_LINK_INVALID":          func(in *CampaignInput) { in.LinkURL = "javascript:alert(1)" },
		"AD_CREATIVE_REQUIRED":     func(in *CampaignInput) { in.CreativeType = "audio" },
		"AD_PLACEMENTS_REQUIRED":   func(in *CampaignInput) { in.Placements = []string{"homepage_takeover"} },
		"AD_AUDIENCE_INVALID":      func(in *CampaignInput) { in.Audiences = []string{"admin"} },
		"AD_DATES_INVALID":         func(in *CampaignInput) { in.EndAt = &past },
		"AD_PRIORITY_INVALID":      func(in *CampaignInput) { in.Priority = 11 },
		"AD_FREQUENCY_CAP_INVALID": func(in *CampaignInput) { in.FreqCap = -1 },
		"AD_HEADLINE_REQUIRED":     func(in *CampaignInput) { in.Headline = "  " },
	}
	for code, mutate := range cases {
		in := validInput()
		mutate(in)
		if _, err := in.Campaign(now); apperr.CodeOf(err) != code {
			t.Errorf("%s: got %v", code, err)
		}
	}
}

func TestUnderCapDropsCampaignsSeenEnoughToday(t *testing.T) {
	capped, open, uncapped := running(), running(), running()
	capped.FreqCap, open.FreqCap = 3, 3
	shown := map[primitive.ObjectID]int{capped.ID: 3, open.ID: 2, uncapped.ID: 40}
	got := underCap([]*Campaign{capped, open, uncapped}, shown)
	if len(got) != 2 || got[0] != open || got[1] != uncapped {
		t.Fatalf("got %d campaigns", len(got))
	}
}

func TestWeightedDrawHasNoRepeatsAndFollowsPriority(t *testing.T) {
	heavy, light := running(), running()
	heavy.Priority, light.Priority = 9, 1
	r := rand.New(rand.NewSource(1))

	both := weightedDraw([]*Campaign{heavy, light}, 3, r)
	if len(both) != 2 || both[0] == both[1] {
		t.Fatalf("expected both campaigns once, got %d", len(both))
	}

	wins := 0
	for i := 0; i < 2000; i++ {
		if weightedDraw([]*Campaign{heavy, light}, 1, r)[0] == heavy {
			wins++
		}
	}
	// Expect about 90%
	if wins < 1700 || wins > 1900 {
		t.Fatalf("priority 9 vs 1 won %d of 2000 draws", wins)
	}
	if len(weightedDraw(nil, 1, r)) != 0 {
		t.Fatal("empty pool should give nothing")
	}
}

func TestPublicAdShowsDomainNotInternals(t *testing.T) {
	c := running()
	c.Name = "internal name"
	c.LinkURL = "https://www.acme.example/jobs?utm_source=km"
	p := c.Public()
	if p.Domain != "acme.example" {
		t.Fatalf("domain: %q", p.Domain)
	}
}

func TestCountedPerDay(t *testing.T) {
	if got := (&Campaign{FreqCap: 3}).countedPerDay(); got != 3 {
		t.Errorf("capped campaign counts %d a day, want 3", got)
	}
	if got := (&Campaign{}).countedPerDay(); got != maxFreqCap {
		t.Errorf("uncapped campaign counts %d a day, want %d", got, maxFreqCap)
	}
}
