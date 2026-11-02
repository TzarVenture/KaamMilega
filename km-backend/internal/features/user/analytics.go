package user

import (
	"context"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/analytics"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// analyticsTimeout bounds the background writes behind searches
const analyticsTimeout = 5 * time.Second

var ErrViewedProfileNotFound = apperr.New("PROFILE_NOT_FOUND", "This profile isn't available.")

// ViewerTraits describe a viewer who browses by characteristics: what they do and where,
// never who they are
type ViewerTraits struct {
	// Role is "recruiter", "expert" or "user"
	Role  string `json:"role"`
	Title string `json:"title,omitempty"`
	City  string `json:"city,omitempty"`
}

// AnalyticsViewer is one entry of "Who viewed your profile". Mode decides what's in it: the
// viewer's byline ("name"), only their traits ("characteristics"), or nothing ("private").
// Only "name" entries carry anything that identifies the viewer.
type AnalyticsViewer struct {
	Mode string `json:"mode"`
	*Byline
	Traits   *ViewerTraits `json:"traits,omitempty"`
	ViewedAt time.Time     `json:"viewed_at"`
}

// AnalyticsResponse is GET /api/user/analytics
type AnalyticsResponse struct {
	*analytics.Summary
	// RecentViewers are the latest people to view the profile in the past 90 days, newest first
	RecentViewers []AnalyticsViewer `json:"recent_viewers"`
	// ViewingMode is how the member appears when they view profiles
	ViewingMode string `json:"viewing_mode"`
	// ViewersHidden is true while the member browses privately: like LinkedIn, private mode
	// hides who viewed you (the numbers stay)
	ViewersHidden bool `json:"viewers_hidden"`
}

func viewingMode(u *User) string {
	if u == nil || u.Settings.ProfileViewing == "" {
		return analytics.ViewAsName
	}
	return u.Settings.ProfileViewing
}

// RecordProfileView counts a member opening someone else's profile page. The browser sends it
// once the profile has loaded; loading a member's details anywhere else (chat, lists) doesn't
// count. Admins are never counted.
func (s *UserServiceImpl) RecordProfileView(ctx context.Context, targetID, viewerID string) error {
	if s.stats == nil {
		return nil
	}
	target, err := primitive.ObjectIDFromHex(targetID)
	if err != nil {
		return ErrViewedProfileNotFound
	}
	viewer, err := primitive.ObjectIDFromHex(viewerID)
	if err != nil || viewer == target {
		return nil
	}
	owner, err := s.repo.FindUserByID(ctx, targetID)
	if err != nil {
		return err
	}
	if owner == nil || owner.ID != target {
		return ErrViewedProfileNotFound
	}
	// A profile the viewer can't open (private, closed account) can't have been viewed
	if ok, err := s.CanViewProfile(ctx, owner, viewerID, false); err != nil || !ok {
		if err != nil {
			return err
		}
		return ErrViewedProfileNotFound
	}
	me, err := s.repo.FindUserByID(ctx, viewerID)
	if err != nil {
		return err
	}
	if me == nil {
		return nil
	}
	return s.stats.RecordProfileView(ctx, target, viewer, viewingMode(me))
}

// recordSearchAppearances counts the members a search returned, in the background
func (s *UserServiceImpl) recordSearchAppearances(searcherID string, found []*User) {
	if s.stats == nil || len(found) == 0 {
		return
	}
	searcher, err := primitive.ObjectIDFromHex(searcherID)
	if err != nil {
		return
	}
	ids := make([]primitive.ObjectID, len(found))
	for i, u := range found {
		ids[i] = u.ID
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), analyticsTimeout)
		defer cancel()
		if err := s.stats.RecordSearchAppearances(ctx, searcher, ids); err != nil {
			log.Printf("analytics: recording search appearances: %v", err)
		}
	}()
}

// traitsOf is what a viewer browsing by characteristics shows: their role, current job title
// (or expert category, or job category) and city
func traitsOf(u *User) *ViewerTraits {
	t := &ViewerTraits{Role: BylineOf(u).Role, City: strings.TrimSpace(u.City)}
	if t.Role == "recruiter" {
		return t
	}
	if t.Role == "expert" {
		t.Title = strings.TrimSpace(u.ExpertCategory)
	}
	if t.Title == "" {
		for _, e := range u.Experience {
			if strings.TrimSpace(e.EndDate) == "" && strings.TrimSpace(e.Title) != "" {
				t.Title = strings.TrimSpace(e.Title)
				break
			}
		}
	}
	if t.Title == "" && len(u.Experience) > 0 {
		t.Title = strings.TrimSpace(u.Experience[0].Title)
	}
	if t.Title == "" && len(u.JobCategories) > 0 {
		t.Title = strings.TrimSpace(u.JobCategories[0])
	}
	return t
}

func (s *UserServiceImpl) GetAnalytics(ctx context.Context, userID string, days int) (*AnalyticsResponse, error) {
	// The ID comes from the session, so a bad one is a server-side problem
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}
	summary, err := s.stats.Summary(ctx, id, days)
	if err != nil {
		return nil, err
	}
	me, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	res := &AnalyticsResponse{Summary: summary, RecentViewers: []AnalyticsViewer{}, ViewingMode: viewingMode(me)}
	if res.ViewingMode == analytics.ViewAsPrivate {
		res.ViewersHidden = true
		return res, nil
	}

	ids := make([]primitive.ObjectID, len(summary.RecentViewers))
	for i, v := range summary.RecentViewers {
		ids[i] = v.ViewerID
	}
	users, err := s.repo.FindUsersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}

	// People whose accounts have since closed drop off the list
	for _, v := range summary.RecentViewers {
		u, ok := users[v.ViewerID]
		if !ok || !IsActiveAccount(u.AccountStatus) {
			continue
		}
		entry := AnalyticsViewer{Mode: v.Mode, ViewedAt: v.ViewedAt}
		switch v.Mode {
		case "", analytics.ViewAsName:
			b := BylineOf(u)
			entry.Mode, entry.Byline = analytics.ViewAsName, &b
		case analytics.ViewAsCharacteristics:
			entry.Traits = traitsOf(u)
		default:
			entry.Mode = analytics.ViewAsPrivate
		}
		res.RecentViewers = append(res.RecentViewers, entry)
		if len(res.RecentViewers) == analytics.RecentViewersLimit {
			break
		}
	}
	return res, nil
}
