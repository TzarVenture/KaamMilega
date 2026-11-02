// Package analytics records who looked at a member's profile, who found them in search and
// who saw their feed posts, and turns that into the numbers on /profile and the feed.
//
// Every event is stored once per person per day (a refresh, a second visit or the same
// search typed letter by letter don't add up), so the numbers can't be inflated by one
// member, and old events expire on their own.
package analytics

import (
	"time"

	"km-backend/internal/common/apperr"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Collection names, shared with account erasure
const (
	ProfileViewsCollection      = "analytics_profile_views"
	SearchAppearancesCollection = "analytics_search_appearances"
	PostImpressionsCollection   = "analytics_post_impressions"
)

// Retention keeps a year of history plus room for the "previous period" of the longest range
const Retention = 400 * 24 * time.Hour

// Days are counted on Indian time, so a view at 1 am belongs to the day it happened for the member
var dayZone = time.FixedZone("IST", 5*60*60+30*60)

const dayLayout = "2006-01-02"

// Ranges the API accepts, in days
var validRanges = map[int]bool{7: true, 28: true, 90: true}

// RecentViewersLimit is how many recent viewers the summary lists
const RecentViewersLimit = 10

// MaxImpressionsPerRequest caps one beacon from the browser
const MaxImpressionsPerRequest = 30

var ErrInvalidRange = apperr.New("ANALYTICS_INVALID_RANGE", "Choose a range of 7, 28 or 90 days.")

// How a member appears to the people whose profiles they view, as on LinkedIn
const (
	// ViewAsName shows their name and headline (the default)
	ViewAsName = "name"
	// ViewAsCharacteristics shows only what they do and where, like "Electrician in Pune"
	ViewAsCharacteristics = "characteristics"
	// ViewAsPrivate shows an anonymous member. In exchange, they can't see who viewed them.
	ViewAsPrivate = "private"
)

// ValidViewMode reports whether a profile viewing mode can be saved; empty means the default
func ValidViewMode(mode string) bool {
	switch mode {
	case "", ViewAsName, ViewAsCharacteristics, ViewAsPrivate:
		return true
	}
	return false
}

// Viewer is whoever saw something: a signed-in member, or a guest known only by the anonymous
// ID in their browser's visitor cookie
type Viewer struct {
	MemberID primitive.ObjectID
	GuestID  string
}

// Member is a signed-in member as a Viewer
func Member(id primitive.ObjectID) Viewer { return Viewer{MemberID: id} }

// Guest is a signed-out visitor as a Viewer
func Guest(visitorID string) Viewer { return Viewer{GuestID: visitorID} }

const guestPrefix = "guest:"

// key tells viewers apart in stored events: a member's ID, or "guest:" and the visitor ID
func (v Viewer) key() string {
	if !v.MemberID.IsZero() {
		return v.MemberID.Hex()
	}
	if v.GuestID != "" {
		return guestPrefix + v.GuestID
	}
	return ""
}

// ProfileView is one member's visit to another member's profile on one day
type ProfileView struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	ProfileID primitive.ObjectID `bson:"profile_id"`
	ViewerID  primitive.ObjectID `bson:"viewer_id"`
	Day       string             `bson:"day"`
	FirstAt   time.Time          `bson:"first_at"`
	LastAt    time.Time          `bson:"last_at"`
	// Mode is how the viewer chose to appear on their latest visit that day; empty means by name
	Mode string `bson:"mode,omitempty"`
}

// SearchAppearance is a member showing up in another member's search results on one day
type SearchAppearance struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	UserID     primitive.ObjectID `bson:"user_id"`
	SearcherID primitive.ObjectID `bson:"searcher_id"`
	Day        string             `bson:"day"`
	At         time.Time          `bson:"at"`
}

// PostImpression is a feed post being on someone else's screen on one day
type PostImpression struct {
	ID       primitive.ObjectID `bson:"_id,omitempty"`
	PostID   primitive.ObjectID `bson:"post_id"`
	AuthorID primitive.ObjectID `bson:"author_id"`
	// Visitor tells viewers apart: a member's ID, or "guest:" and an anonymous visitor ID
	Visitor string `bson:"visitor"`
	// ViewerID is set for members only
	ViewerID primitive.ObjectID `bson:"viewer_id,omitempty"`
	Day      string             `bson:"day"`
	At       time.Time          `bson:"at"`
}

// DayCount is one point of a daily chart
type DayCount struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// Metric is one number for the chosen range, the same number for the range before it, and
// the daily values behind it
type Metric struct {
	Total    int64      `json:"total"`
	Previous int64      `json:"previous"`
	Series   []DayCount `json:"series"`
}

// RecentViewer is someone who viewed the profile, with their latest visit
type RecentViewer struct {
	ViewerID primitive.ObjectID
	ViewedAt time.Time
	// Mode is how they chose to appear on that visit (ViewAsName and so on)
	Mode string
}

// Summary is everything /profile and the feed show
type Summary struct {
	Days int `json:"days"`
	// ProfileViewers counts different people; each day of the series counts that day's viewers
	ProfileViewers    Metric         `json:"profile_viewers"`
	PostImpressions   Metric         `json:"post_impressions"`
	SearchAppearances Metric         `json:"search_appearances"`
	RecentViewers     []RecentViewer `json:"-"`
}
