// Package ads is Kaammilega's own ad server. Admins run campaigns (an advertiser, an image or
// video, a link) into named slots on the site; the site asks for an ad per slot and reports
// when one was actually seen and clicked.
//
//   - Targeting: a campaign can be limited to cities (the member's profile city) and audiences
//     (signed-out visitors, jobseekers, recruiters, experts). A city-limited campaign never shows
//     to someone whose city is unknown.
//   - Choice: among the campaigns that fit, one is drawn at random weighted by priority (1-10).
//   - Frequency cap: at most N impressions per person per day for a campaign (0 = no cap).
//   - Impressions are viewable impressions (half the ad on screen for a second), reported by the
//     browser. Clicks go through a redirect so the click is counted before the advertiser's page
//     opens. Bots and admins are never counted.
package ads

import (
	"net/url"
	"strings"
	"time"

	"km-backend/internal/common/apperr"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	CampaignsCollection = "ad_campaigns"
	// DailyCollection holds one row per campaign per day with that day's totals
	DailyCollection = "ad_daily"
	// ViewsCollection holds one row per campaign, person and day, for the frequency cap,
	// reach and one counted click per person per day
	ViewsCollection = "ad_views"
)

// Days are counted on Indian time, like the rest of the analytics
var dayZone = time.FixedZone("IST", 5*60*60+30*60)

const dayLayout = "2006-01-02"

func dayOf(t time.Time) string { return t.In(dayZone).Format(dayLayout) }

// viewRetention keeps per-person rows only as long as the cap and reach need them
const viewRetention = 3 * 24 * time.Hour

// maxFreqCap is the highest daily cap a campaign can have
const maxFreqCap = 50

// countedPerDay is how many of one person's impressions a day count. The ad stops being served at
// the daily cap, so reports beyond it are repeats, not views; uncapped campaigns use the highest cap.
func (c *Campaign) countedPerDay() int {
	if c.FreqCap > 0 {
		return c.FreqCap
	}
	return maxFreqCap
}

// Placement is a named slot on the site
type Placement struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Format string `json:"format"` // "rail": a 300 x 250 box in a side column; "inline": a card in a list
}

// Placements are the slots the website has. Keep in step with AdPlacement in
// km-frontend/src/components/ads/AdSlot.tsx.
var Placements = []Placement{
	{ID: "feed_sidebar", Label: "Feed, side column", Format: "rail"},
	{ID: "feed_inline", Label: "Feed, between posts", Format: "inline"},
	{ID: "post_sidebar", Label: "Single post, side column", Format: "rail"},
	{ID: "jobs_inline", Label: "Job search, between results", Format: "inline"},
	{ID: "job_detail_sidebar", Label: "Job page, side column", Format: "rail"},
	{ID: "events_inline", Label: "Events, between events", Format: "inline"},
	{ID: "event_detail_sidebar", Label: "Event page, side column", Format: "rail"},
	{ID: "events_sidebar", Label: "Events, side column", Format: "rail"},
	{ID: "mentorship_inline", Label: "Mentorship, between experts", Format: "inline"},
	{ID: "network_sidebar", Label: "My network, side column", Format: "rail"},
	{ID: "company_sidebar", Label: "Company page, side column", Format: "rail"},
	{ID: "notifications_sidebar", Label: "Notifications, side column", Format: "rail"},
	{ID: "resources_inline", Label: "Learn, between videos", Format: "inline"},
	{ID: "resources_sidebar", Label: "Learn, side column", Format: "rail"},
	{ID: "resource_detail_sidebar", Label: "Learn video page, side column", Format: "rail"},
}

func validPlacement(id string) bool {
	for _, p := range Placements {
		if p.ID == id {
			return true
		}
	}
	return false
}

// Audiences a campaign can be limited to. A member can be in several (a jobseeker who is also
// an expert); "guest" is anyone signed out.
var Audiences = []string{"guest", "user", "recruiter", "expert"}

func validAudience(a string) bool {
	for _, x := range Audiences {
		if x == a {
			return true
		}
	}
	return false
}

const (
	StatusActive = "active"
	StatusPaused = "paused"

	CreativeImage = "image"
	CreativeVideo = "video"
)

// Campaign is one ad and the rules for where and to whom it shows
type Campaign struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name       string             `bson:"name" json:"name"` // internal, never shown on the site
	Advertiser string             `bson:"advertiser" json:"advertiser"`
	Headline   string             `bson:"headline" json:"headline"`
	Body       string             `bson:"body,omitempty" json:"body,omitempty"`
	CTALabel   string             `bson:"cta_label,omitempty" json:"cta_label,omitempty"`

	CreativeType string `bson:"creative_type" json:"creative_type"`
	CreativeURL  string `bson:"creative_url" json:"creative_url"`
	LinkURL      string `bson:"link_url" json:"link_url"`

	Placements []string   `bson:"placements" json:"placements"`
	Cities     []string   `bson:"cities,omitempty" json:"cities"`
	Audiences  []string   `bson:"audiences,omitempty" json:"audiences"`
	StartAt    time.Time  `bson:"start_at" json:"start_at"`
	EndAt      *time.Time `bson:"end_at,omitempty" json:"end_at,omitempty"`
	Priority   int        `bson:"priority" json:"priority"`
	FreqCap    int        `bson:"frequency_cap" json:"frequency_cap"`
	Status     string     `bson:"status" json:"status"`

	Impressions int64 `bson:"impressions" json:"impressions"`
	Clicks      int64 `bson:"clicks" json:"clicks"`

	CreatedBy primitive.ObjectID `bson:"created_by,omitempty" json:"-"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

// State is what the campaign is doing now: active, paused, scheduled (starts later) or ended
func (c *Campaign) State(now time.Time) string {
	switch {
	case c.Status == StatusPaused:
		return StatusPaused
	case c.EndAt != nil && !now.Before(*c.EndAt):
		return "ended"
	case now.Before(c.StartAt):
		return "scheduled"
	}
	return StatusActive
}

// Audience is who is looking: their audiences and their profile city ("" when unknown)
type Audience struct {
	Groups []string
	City   string
}

// Fits reports whether the campaign may show in this slot to this person now
func (c *Campaign) Fits(placement string, who Audience, now time.Time) bool {
	if c.State(now) != StatusActive || !containsFold(c.Placements, placement) {
		return false
	}
	if len(c.Audiences) > 0 {
		match := false
		for _, g := range who.Groups {
			if containsFold(c.Audiences, g) {
				match = true
				break
			}
		}
		if !match {
			return false
		}
	}
	if len(c.Cities) > 0 && (who.City == "" || !containsFold(c.Cities, who.City)) {
		return false
	}
	return true
}

func containsFold(list []string, v string) bool {
	v = strings.TrimSpace(v)
	for _, x := range list {
		if strings.EqualFold(strings.TrimSpace(x), v) {
			return true
		}
	}
	return false
}

// PublicAd is what the site gets: nothing internal (name, targeting, counts)
type PublicAd struct {
	ID           string `json:"id"`
	Advertiser   string `json:"advertiser"`
	Headline     string `json:"headline"`
	Body         string `json:"body,omitempty"`
	CTALabel     string `json:"cta_label,omitempty"`
	CreativeType string `json:"creative_type"`
	CreativeURL  string `json:"creative_url"`
	// Domain is the advertiser's site, shown so people know where the ad leads
	Domain string `json:"domain"`
}

func (c *Campaign) Public() *PublicAd {
	return &PublicAd{
		ID:           c.ID.Hex(),
		Advertiser:   c.Advertiser,
		Headline:     c.Headline,
		Body:         c.Body,
		CTALabel:     c.CTALabel,
		CreativeType: c.CreativeType,
		CreativeURL:  c.CreativeURL,
		Domain:       displayDomain(c.LinkURL),
	}
}

func displayDomain(link string) string {
	u, err := url.Parse(link)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(u.Hostname(), "www.")
}

// CampaignInput is the admin's form
type CampaignInput struct {
	Name         string     `json:"name"`
	Advertiser   string     `json:"advertiser"`
	Headline     string     `json:"headline"`
	Body         string     `json:"body"`
	CTALabel     string     `json:"cta_label"`
	CreativeType string     `json:"creative_type"`
	CreativeURL  string     `json:"creative_url"`
	LinkURL      string     `json:"link_url"`
	Placements   []string   `json:"placements"`
	Cities       []string   `json:"cities"`
	Audiences    []string   `json:"audiences"`
	StartAt      *time.Time `json:"start_at"`
	EndAt        *time.Time `json:"end_at"`
	Priority     int        `json:"priority"`
	FreqCap      int        `json:"frequency_cap"`
	Status       string     `json:"status"`
}

var (
	errName       = apperr.New("AD_NAME_REQUIRED", "Give the campaign a name.")
	errAdvertiser = apperr.New("AD_ADVERTISER_REQUIRED", "Enter the advertiser's name.")
	errHeadline   = apperr.New("AD_HEADLINE_REQUIRED", "Enter a headline of up to 80 characters.")
	errBody       = apperr.New("AD_BODY_TOO_LONG", "Keep the text to 160 characters.")
	errCTA        = apperr.New("AD_CTA_TOO_LONG", "Keep the button text to 24 characters.")
	errCreative   = apperr.New("AD_CREATIVE_REQUIRED", "Upload an image or a video.")
	errLink       = apperr.New("AD_LINK_INVALID", "Enter the full link people go to, starting with https://.")
	errPlacements = apperr.New("AD_PLACEMENTS_REQUIRED", "Pick at least one place on the site.")
	errAudience   = apperr.New("AD_AUDIENCE_INVALID", "Pick audiences from the list.")
	errDates      = apperr.New("AD_DATES_INVALID", "The end date must be after the start date.")
	errPriority   = apperr.New("AD_PRIORITY_INVALID", "Priority goes from 1 to 10.")
	errFreqCap    = apperr.New("AD_FREQUENCY_CAP_INVALID", "The daily cap goes from 0 (no cap) to 50.")
	errStatus     = apperr.New("AD_STATUS_INVALID", "Status is active or paused.")
)

func validLink(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
}

func cleanList(in []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v == "" || seen[strings.ToLower(v)] {
			continue
		}
		seen[strings.ToLower(v)] = true
		out = append(out, v)
	}
	return out
}

// Campaign checks the form and returns the campaign it describes (without ID or counts)
func (in *CampaignInput) Campaign(now time.Time) (*Campaign, error) {
	c := &Campaign{
		Name:         strings.TrimSpace(in.Name),
		Advertiser:   strings.TrimSpace(in.Advertiser),
		Headline:     strings.TrimSpace(in.Headline),
		Body:         strings.TrimSpace(in.Body),
		CTALabel:     strings.TrimSpace(in.CTALabel),
		CreativeType: strings.TrimSpace(in.CreativeType),
		CreativeURL:  strings.TrimSpace(in.CreativeURL),
		LinkURL:      strings.TrimSpace(in.LinkURL),
		Placements:   cleanList(in.Placements),
		Cities:       cleanList(in.Cities),
		Audiences:    cleanList(in.Audiences),
		Priority:     in.Priority,
		FreqCap:      in.FreqCap,
		Status:       strings.TrimSpace(in.Status),
		EndAt:        in.EndAt,
	}
	switch {
	case c.Name == "" || len(c.Name) > 120:
		return nil, errName
	case c.Advertiser == "" || len(c.Advertiser) > 80:
		return nil, errAdvertiser
	case c.Headline == "" || len([]rune(c.Headline)) > 80:
		return nil, errHeadline
	case len([]rune(c.Body)) > 160:
		return nil, errBody
	case len([]rune(c.CTALabel)) > 24:
		return nil, errCTA
	case (c.CreativeType != CreativeImage && c.CreativeType != CreativeVideo) || !validLink(c.CreativeURL):
		return nil, errCreative
	case !validLink(c.LinkURL):
		return nil, errLink
	case len(c.Placements) == 0:
		return nil, errPlacements
	}
	for _, p := range c.Placements {
		if !validPlacement(p) {
			return nil, errPlacements
		}
	}
	for _, a := range c.Audiences {
		if !validAudience(a) {
			return nil, errAudience
		}
	}
	if c.Priority == 0 {
		c.Priority = 5
	}
	if c.Priority < 1 || c.Priority > 10 {
		return nil, errPriority
	}
	if c.FreqCap < 0 || c.FreqCap > maxFreqCap {
		return nil, errFreqCap
	}
	if c.Status == "" {
		c.Status = StatusActive
	}
	if c.Status != StatusActive && c.Status != StatusPaused {
		return nil, errStatus
	}
	c.StartAt = now
	if in.StartAt != nil && !in.StartAt.IsZero() {
		c.StartAt = *in.StartAt
	}
	if c.EndAt != nil && c.EndAt.IsZero() {
		c.EndAt = nil
	}
	if c.EndAt != nil && !c.EndAt.After(c.StartAt) {
		return nil, errDates
	}
	return c, nil
}

// DayStats is one day of a campaign's numbers
type DayStats struct {
	Day         string `bson:"day" json:"day"`
	Impressions int64  `bson:"impressions" json:"impressions"`
	Reach       int64  `bson:"reach" json:"reach"`
	Clicks      int64  `bson:"clicks" json:"clicks"`
}
