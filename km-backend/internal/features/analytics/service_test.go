package analytics

import (
	"context"
	"sort"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// memRepo keeps events in memory with the same one-per-person-per-day rule as the indexes
type memRepo struct {
	views       map[[3]string]ProfileView
	searches    map[[3]string]SearchAppearance
	impressions map[[3]string]PostImpression
}

func newMemRepo() *memRepo {
	return &memRepo{
		views:       map[[3]string]ProfileView{},
		searches:    map[[3]string]SearchAppearance{},
		impressions: map[[3]string]PostImpression{},
	}
}

func (m *memRepo) RecordProfileView(_ context.Context, profileID, viewerID primitive.ObjectID, mode string, at time.Time) error {
	k := [3]string{profileID.Hex(), viewerID.Hex(), dayOf(at)}
	v, ok := m.views[k]
	if !ok {
		v = ProfileView{ProfileID: profileID, ViewerID: viewerID, Day: dayOf(at), FirstAt: at}
	}
	v.LastAt, v.Mode = at, mode
	m.views[k] = v
	return nil
}

func (m *memRepo) RecordSearchAppearances(_ context.Context, searcherID primitive.ObjectID, userIDs []primitive.ObjectID, at time.Time) error {
	for _, id := range userIDs {
		k := [3]string{id.Hex(), searcherID.Hex(), dayOf(at)}
		if _, ok := m.searches[k]; !ok {
			m.searches[k] = SearchAppearance{UserID: id, SearcherID: searcherID, Day: dayOf(at), At: at}
		}
	}
	return nil
}

func (m *memRepo) RecordPostImpression(_ context.Context, postID, authorID primitive.ObjectID, viewer Viewer, at time.Time) (bool, error) {
	k := [3]string{postID.Hex(), viewer.key(), dayOf(at)}
	if _, ok := m.impressions[k]; ok {
		return false, nil
	}
	m.impressions[k] = PostImpression{PostID: postID, AuthorID: authorID, Visitor: viewer.key(), ViewerID: viewer.MemberID, Day: dayOf(at), At: at}
	return true, nil
}

func (m *memRepo) DailyCounts(_ context.Context, mt metric, ownerID primitive.ObjectID, fromDay, toDay string) (map[string]int64, error) {
	out := map[string]int64{}
	add := func(owner primitive.ObjectID, day string) {
		if owner == ownerID && day >= fromDay && day <= toDay {
			out[day]++
		}
	}
	switch mt {
	case metricProfileViews:
		for _, v := range m.views {
			add(v.ProfileID, v.Day)
		}
	case metricSearchAppearances:
		for _, v := range m.searches {
			add(v.UserID, v.Day)
		}
	case metricPostImpressions:
		for _, v := range m.impressions {
			add(v.AuthorID, v.Day)
		}
	}
	return out, nil
}

func (m *memRepo) DistinctViewers(_ context.Context, profileID primitive.ObjectID, fromDay, toDay string) (int64, error) {
	seen := map[primitive.ObjectID]bool{}
	for _, v := range m.views {
		if v.ProfileID == profileID && v.Day >= fromDay && v.Day <= toDay {
			seen[v.ViewerID] = true
		}
	}
	return int64(len(seen)), nil
}

func (m *memRepo) RecentViewers(_ context.Context, profileID primitive.ObjectID, fromDay string, limit int) ([]RecentViewer, error) {
	latest := map[primitive.ObjectID]ProfileView{}
	for _, v := range m.views {
		if v.ProfileID == profileID && v.Day >= fromDay && v.LastAt.After(latest[v.ViewerID].LastAt) {
			latest[v.ViewerID] = v
		}
	}
	out := make([]RecentViewer, 0, len(latest))
	for id, v := range latest {
		out = append(out, RecentViewer{ViewerID: id, ViewedAt: v.LastAt, Mode: v.Mode})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ViewedAt.After(out[j].ViewedAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// clock is a settable "now" for the service
type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func newTestService() (*service, *memRepo, *clock) {
	repo := newMemRepo()
	c := &clock{t: time.Date(2026, 11, 2, 12, 0, 0, 0, dayZone)}
	return &service{repo: repo, now: c.now}, repo, c
}

var ctx = context.Background()

func TestSummaryRejectsOtherRanges(t *testing.T) {
	s, _, _ := newTestService()
	for _, n := range []int{0, 1, 30, 365} {
		if _, err := s.Summary(ctx, primitive.NewObjectID(), n); err != ErrInvalidRange {
			t.Errorf("range %d: got %v, want ErrInvalidRange", n, err)
		}
	}
}

func TestProfileViewsCountPeopleOncePerDayAndIgnoreSelf(t *testing.T) {
	s, _, c := newTestService()
	me, a, b := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()

	_ = s.RecordProfileView(ctx, me, me, "") // own profile
	_ = s.RecordProfileView(ctx, me, a, "")
	_ = s.RecordProfileView(ctx, me, a, "") // refresh, same day
	_ = s.RecordProfileView(ctx, me, b, "")
	c.t = c.t.AddDate(0, 0, -1)
	_ = s.RecordProfileView(ctx, me, a, "") // came back yesterday too
	c.t = c.t.AddDate(0, 0, 1)

	sum, err := s.Summary(ctx, me, 7)
	if err != nil {
		t.Fatal(err)
	}
	if sum.ProfileViewers.Total != 2 {
		t.Errorf("viewers = %d, want 2 different people", sum.ProfileViewers.Total)
	}
	series := sum.ProfileViewers.Series
	if len(series) != 7 || series[6].Date != "2026-11-02" || series[6].Count != 2 || series[5].Count != 1 {
		t.Errorf("series = %+v", series)
	}
	if len(sum.RecentViewers) != 2 {
		t.Errorf("recent viewers = %d, want 2", len(sum.RecentViewers))
	}
}

func TestImpressionsOncePerViewerPerPostPerDay(t *testing.T) {
	s, _, c := newTestService()
	author, viewer, post := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()

	if first, _ := s.RecordPostImpression(ctx, post, author, Member(author)); first {
		t.Error("the author's own impression counted")
	}
	if first, _ := s.RecordPostImpression(ctx, post, author, Member(viewer)); !first {
		t.Error("first impression not counted")
	}
	if first, _ := s.RecordPostImpression(ctx, post, author, Member(viewer)); first {
		t.Error("the same impression counted twice in a day")
	}
	c.t = c.t.AddDate(0, 0, 1)
	if first, _ := s.RecordPostImpression(ctx, post, author, Member(viewer)); !first {
		t.Error("next day's impression not counted")
	}

	sum, _ := s.Summary(ctx, author, 7)
	if sum.PostImpressions.Total != 2 {
		t.Errorf("impressions = %d, want 2", sum.PostImpressions.Total)
	}
}

func TestGuestImpressionsCountOncePerVisitor(t *testing.T) {
	s, _, _ := newTestService()
	author, post := primitive.NewObjectID(), primitive.NewObjectID()
	guestA, guestB := "0123456789abcdef0123456789abcdef", "fedcba9876543210fedcba9876543210"

	if first, _ := s.RecordPostImpression(ctx, post, author, Guest(guestA)); !first {
		t.Error("a guest's first impression not counted")
	}
	if first, _ := s.RecordPostImpression(ctx, post, author, Guest(guestA)); first {
		t.Error("the same guest counted twice in a day")
	}
	if first, _ := s.RecordPostImpression(ctx, post, author, Guest(guestB)); !first {
		t.Error("a second guest not counted")
	}
	for _, bad := range []string{"", "not-a-visitor-id", guestA + "00"} {
		if first, _ := s.RecordPostImpression(ctx, post, author, Guest(bad)); first {
			t.Errorf("invalid visitor ID %q counted", bad)
		}
	}
	// A member and a guest are different people even with the same day and post
	if first, _ := s.RecordPostImpression(ctx, post, author, Member(primitive.NewObjectID())); !first {
		t.Error("member impression not counted next to guests")
	}

	sum, _ := s.Summary(ctx, author, 7)
	if sum.PostImpressions.Total != 3 {
		t.Errorf("impressions = %d, want 3", sum.PostImpressions.Total)
	}
}

func TestProfileViewsKeepTheViewersLatestMode(t *testing.T) {
	s, _, c := newTestService()
	me, a, b, d := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()

	_ = s.RecordProfileView(ctx, me, a, ViewAsName)
	c.t = c.t.Add(time.Minute)
	_ = s.RecordProfileView(ctx, me, a, ViewAsPrivate)   // same day, now browsing privately
	_ = s.RecordProfileView(ctx, me, b, "")              // default
	_ = s.RecordProfileView(ctx, me, d, "something-new") // unknown modes never reveal the name

	sum, _ := s.Summary(ctx, me, 7)
	if sum.ProfileViewers.Total != 3 {
		t.Errorf("viewers = %d, want 3", sum.ProfileViewers.Total)
	}
	modes := map[primitive.ObjectID]string{}
	for _, v := range sum.RecentViewers {
		modes[v.ViewerID] = v.Mode
	}
	if modes[a] != ViewAsPrivate || modes[b] != ViewAsName || modes[d] != ViewAsPrivate {
		t.Errorf("modes = %v", modes)
	}
}

func TestSearchAppearancesSkipSearcherAndDuplicates(t *testing.T) {
	s, _, _ := newTestService()
	searcher, a := primitive.NewObjectID(), primitive.NewObjectID()
	_ = s.RecordSearchAppearances(ctx, searcher, []primitive.ObjectID{a, a, searcher})
	_ = s.RecordSearchAppearances(ctx, searcher, []primitive.ObjectID{a}) // typed one more letter
	_ = s.RecordSearchAppearances(ctx, primitive.NilObjectID, []primitive.ObjectID{a})

	sum, _ := s.Summary(ctx, a, 7)
	if sum.SearchAppearances.Total != 1 {
		t.Errorf("appearances = %d, want 1", sum.SearchAppearances.Total)
	}
	if mine, _ := s.Summary(ctx, searcher, 7); mine.SearchAppearances.Total != 0 {
		t.Errorf("searcher counted as appearing in their own search")
	}
}

func TestSummarySplitsCurrentAndPreviousPeriods(t *testing.T) {
	s, _, c := newTestService()
	author, post := primitive.NewObjectID(), primitive.NewObjectID()
	today := c.t

	view := func(daysAgo int) {
		c.t = today.AddDate(0, 0, -daysAgo)
		_, _ = s.RecordPostImpression(ctx, post, author, Member(primitive.NewObjectID()))
	}
	view(0)  // this week
	view(6)  // first day of this week
	view(7)  // last day of the week before
	view(13) // first day of the week before
	view(14) // older than both
	c.t = today

	sum, _ := s.Summary(ctx, author, 7)
	if sum.PostImpressions.Total != 2 || sum.PostImpressions.Previous != 2 {
		t.Errorf("total %d previous %d, want 2 and 2", sum.PostImpressions.Total, sum.PostImpressions.Previous)
	}
	if sum.PostImpressions.Series[0].Date != "2026-10-27" {
		t.Errorf("window starts %s, want 2026-10-27", sum.PostImpressions.Series[0].Date)
	}
}

func TestDaysFollowIndianTime(t *testing.T) {
	// 20:00 UTC on 1 November is 01:30 on 2 November in India
	at := time.Date(2026, 11, 1, 20, 0, 0, 0, time.UTC)
	if got := dayOf(at); got != "2026-11-02" {
		t.Errorf("dayOf = %s, want 2026-11-02", got)
	}
}
