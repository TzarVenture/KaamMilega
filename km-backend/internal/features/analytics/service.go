package analytics

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ViewersWindowDays is how far back the list of recent viewers goes, whatever range is chosen
const ViewersWindowDays = 90

// recentViewerCandidates leaves room for viewers whose accounts have since closed
const recentViewerCandidates = 3 * RecentViewersLimit

type Service interface {
	// RecordProfileView counts a member's visit to someone else's profile; self-views are ignored.
	// mode is how the viewer chose to appear (ViewAsName and so on).
	RecordProfileView(ctx context.Context, profileID, viewerID primitive.ObjectID, mode string) error
	// RecordSearchAppearances counts the members a search returned; the searcher is ignored
	RecordSearchAppearances(ctx context.Context, searcherID primitive.ObjectID, userIDs []primitive.ObjectID) error
	// RecordPostImpression reports whether it was the viewer's first impression of the post today.
	// Authors seeing their own posts don't count.
	RecordPostImpression(ctx context.Context, postID, authorID primitive.ObjectID, viewer Viewer) (bool, error)
	// Summary is the member's numbers for the last `days` days (7, 28 or 90), today included
	Summary(ctx context.Context, userID primitive.ObjectID, days int) (*Summary, error)
}

type service struct {
	repo Repository
	now  func() time.Time
}

func NewService(repo Repository) Service {
	return &service{repo: repo, now: time.Now}
}

func (s *service) RecordProfileView(ctx context.Context, profileID, viewerID primitive.ObjectID, mode string) error {
	if profileID.IsZero() || viewerID.IsZero() || profileID == viewerID {
		return nil
	}
	// An unknown mode is treated as the most private one, never as showing the name
	if mode == "" {
		mode = ViewAsName
	} else if !ValidViewMode(mode) {
		mode = ViewAsPrivate
	}
	return s.repo.RecordProfileView(ctx, profileID, viewerID, mode, s.now())
}

func (s *service) RecordSearchAppearances(ctx context.Context, searcherID primitive.ObjectID, userIDs []primitive.ObjectID) error {
	if searcherID.IsZero() {
		return nil
	}
	seen := make(map[primitive.ObjectID]bool, len(userIDs))
	found := make([]primitive.ObjectID, 0, len(userIDs))
	for _, id := range userIDs {
		if id.IsZero() || id == searcherID || seen[id] {
			continue
		}
		seen[id] = true
		found = append(found, id)
	}
	if len(found) == 0 {
		return nil
	}
	return s.repo.RecordSearchAppearances(ctx, searcherID, found, s.now())
}

func (s *service) RecordPostImpression(ctx context.Context, postID, authorID primitive.ObjectID, viewer Viewer) (bool, error) {
	if postID.IsZero() || viewer.key() == "" || (!viewer.MemberID.IsZero() && authorID == viewer.MemberID) {
		return false, nil
	}
	if viewer.MemberID.IsZero() && !validVisitorID(viewer.GuestID) {
		return false, nil
	}
	return s.repo.RecordPostImpression(ctx, postID, authorID, viewer, s.now())
}

// days lists the calendar days from `start` for `n` days, as stored
func days(start time.Time, n int) []string {
	out := make([]string, n)
	for i := 0; i < n; i++ {
		out[i] = start.AddDate(0, 0, i).Format(dayLayout)
	}
	return out
}

func (s *service) Summary(ctx context.Context, userID primitive.ObjectID, n int) (*Summary, error) {
	if !validRanges[n] {
		return nil, ErrInvalidRange
	}
	now := s.now().In(dayZone)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, dayZone)
	start := today.AddDate(0, 0, -(n - 1))
	window := days(start, n)
	previous := days(start.AddDate(0, 0, -n), n)
	from, to := window[0], window[n-1]
	prevFrom, prevTo := previous[0], previous[n-1]

	// Impressions and search appearances: one event per person per day, so totals are sums
	summed := func(m metric) (Metric, error) {
		counts, err := s.repo.DailyCounts(ctx, m, userID, prevFrom, to)
		if err != nil {
			return Metric{}, err
		}
		out := Metric{Series: make([]DayCount, n)}
		for i, d := range window {
			out.Series[i] = DayCount{Date: d, Count: counts[d]}
			out.Total += counts[d]
		}
		for _, d := range previous {
			out.Previous += counts[d]
		}
		return out, nil
	}

	impressions, err := summed(metricPostImpressions)
	if err != nil {
		return nil, err
	}
	searches, err := summed(metricSearchAppearances)
	if err != nil {
		return nil, err
	}

	// Profile viewers are different people: someone who came back on three days counts once
	daily, err := s.repo.DailyCounts(ctx, metricProfileViews, userID, from, to)
	if err != nil {
		return nil, err
	}
	viewers := Metric{Series: make([]DayCount, n)}
	for i, d := range window {
		viewers.Series[i] = DayCount{Date: d, Count: daily[d]}
	}
	if viewers.Total, err = s.repo.DistinctViewers(ctx, userID, from, to); err != nil {
		return nil, err
	}
	if viewers.Previous, err = s.repo.DistinctViewers(ctx, userID, prevFrom, prevTo); err != nil {
		return nil, err
	}

	recentFrom := today.AddDate(0, 0, -(ViewersWindowDays - 1)).Format(dayLayout)
	recent, err := s.repo.RecentViewers(ctx, userID, recentFrom, recentViewerCandidates)
	if err != nil {
		return nil, err
	}

	return &Summary{
		Days:              n,
		ProfileViewers:    viewers,
		PostImpressions:   impressions,
		SearchAppearances: searches,
		RecentViewers:     recent,
	}, nil
}
