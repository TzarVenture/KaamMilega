package feed

import (
	"context"
	"errors"
	"sort"
	"strings"
	"testing"
	"time"

	"km-backend/internal/features/analytics"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// memRepo is an in-memory FeedRepository for service tests
type memRepo struct {
	posts     map[primitive.ObjectID]*Post
	comments  map[primitive.ObjectID]*Comment
	reactions map[[2]primitive.ObjectID]string
	saves     map[[2]primitive.ObjectID]time.Time
	reports   []Report
	blocks    map[primitive.ObjectID][]primitive.ObjectID
	files     map[primitive.ObjectID]primitive.ObjectID // file → uploader
}

func newMemRepo() *memRepo {
	return &memRepo{
		posts:     map[primitive.ObjectID]*Post{},
		comments:  map[primitive.ObjectID]*Comment{},
		reactions: map[[2]primitive.ObjectID]string{},
		saves:     map[[2]primitive.ObjectID]time.Time{},
		blocks:    map[primitive.ObjectID][]primitive.ObjectID{},
		files:     map[primitive.ObjectID]primitive.ObjectID{},
	}
}

func (m *memRepo) CreatePost(_ context.Context, p *Post) error { m.posts[p.ID] = p; return nil }
func (m *memRepo) FindPost(_ context.Context, id primitive.ObjectID) (*Post, error) {
	if p, ok := m.posts[id]; ok {
		cp := *p
		return &cp, nil
	}
	return nil, nil
}
func (m *memRepo) FindPostsByIDs(_ context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*Post, error) {
	out := map[primitive.ObjectID]*Post{}
	for _, id := range ids {
		if p, ok := m.posts[id]; ok && p.Status == PostActive {
			out[id] = p
		}
	}
	return out, nil
}
func (m *memRepo) IncrementImpressions(_ context.Context, id primitive.ObjectID) error {
	if p, ok := m.posts[id]; ok {
		p.Impressions++
	}
	return nil
}
func (m *memRepo) TrendingTags(_ context.Context, since time.Time, limit int) ([]TrendingTag, error) {
	counts := map[string]int{}
	for _, p := range m.posts {
		if p.Status == PostActive && !p.CreatedAt.Before(since) {
			for _, tag := range p.Tags {
				counts[tag]++
			}
		}
	}
	out := []TrendingTag{}
	for tag, n := range counts {
		out = append(out, TrendingTag{Tag: tag, Posts: n})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Posts != out[j].Posts {
			return out[i].Posts > out[j].Posts
		}
		return out[i].Tag < out[j].Tag
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// memStats stands in for analytics: one impression per viewer per post, authors never count
type memStats map[string]bool

func (m memStats) RecordPostImpression(_ context.Context, postID, authorID primitive.ObjectID, viewer analytics.Viewer) (bool, error) {
	k := postID.Hex() + "/" + viewer.MemberID.Hex() + "/" + viewer.GuestID
	if authorID == viewer.MemberID || m[k] {
		return false, nil
	}
	m[k] = true
	return true, nil
}

func (m *memRepo) ListPosts(_ context.Context, q ListQuery, hideAuthors, hidePosts []primitive.ObjectID) ([]Post, error) {
	var out []Post
	for _, p := range m.posts {
		if p.Status != PostActive || containsID(hideAuthors, p.AuthorID) || containsID(hidePosts, p.ID) {
			continue
		}
		if q.Before != nil && p.ID.Hex() >= q.Before.Hex() {
			continue
		}
		if q.Category != "" && q.Category != CategoryAll && p.Category != q.Category {
			continue
		}
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID.Hex() > out[j].ID.Hex() })
	if len(out) > q.Limit {
		out = out[:q.Limit]
	}
	return out, nil
}
func (m *memRepo) UpdatePost(_ context.Context, id primitive.ObjectID, content, category string, tags []string, at time.Time) error {
	p := m.posts[id]
	p.Content, p.Category, p.Tags, p.EditedAt = content, category, tags, &at
	return nil
}
func (m *memRepo) DeletePost(_ context.Context, id primitive.ObjectID) error {
	delete(m.posts, id)
	return nil
}
func (m *memRepo) CountPostsSince(_ context.Context, a primitive.ObjectID, since time.Time) (int64, error) {
	var n int64
	for _, p := range m.posts {
		if p.AuthorID == a && !p.CreatedAt.Before(since) {
			n++
		}
	}
	return n, nil
}
func (m *memRepo) ClaimMedia(_ context.Context, u, _ primitive.ObjectID, in []MediaInput) ([]Media, error) {
	var out []Media
	for _, x := range in {
		id, err := primitive.ObjectIDFromHex(x.FileID)
		if err != nil || m.files[id] != u {
			return nil, ErrInvalidMedia
		}
		out = append(out, Media{FileID: id, URL: "https://cdn.test/" + x.FileID})
	}
	return out, nil
}
func (m *memRepo) ReleaseMedia(context.Context, []primitive.ObjectID) ([]string, error) {
	return nil, nil
}
func (m *memRepo) SetReaction(_ context.Context, p, u primitive.ObjectID, r string) (string, error) {
	k := [2]primitive.ObjectID{p, u}
	old := m.reactions[k]
	m.reactions[k] = r
	post := m.posts[p]
	if post.ReactionCounts == nil {
		post.ReactionCounts = map[string]int{}
	}
	if old == "" {
		post.ReactionsTotal++
		post.ReactionCounts[r]++
	} else if old != r {
		post.ReactionCounts[r]++
		post.ReactionCounts[old]--
	}
	return old, nil
}
func (m *memRepo) RemoveReaction(_ context.Context, p, u primitive.ObjectID) (string, error) {
	k := [2]primitive.ObjectID{p, u}
	old, ok := m.reactions[k]
	if !ok {
		return "", nil
	}
	delete(m.reactions, k)
	m.posts[p].ReactionsTotal--
	m.posts[p].ReactionCounts[old]--
	return old, nil
}
func (m *memRepo) ViewerReactions(_ context.Context, u primitive.ObjectID, ids []primitive.ObjectID) (map[primitive.ObjectID]string, error) {
	out := map[primitive.ObjectID]string{}
	for _, id := range ids {
		if r, ok := m.reactions[[2]primitive.ObjectID{id, u}]; ok {
			out[id] = r
		}
	}
	return out, nil
}
func (m *memRepo) SavePost(_ context.Context, u, p primitive.ObjectID) error {
	m.saves[[2]primitive.ObjectID{u, p}] = time.Now()
	return nil
}
func (m *memRepo) UnsavePost(_ context.Context, u, p primitive.ObjectID) error {
	delete(m.saves, [2]primitive.ObjectID{u, p})
	return nil
}
func (m *memRepo) ViewerSaves(_ context.Context, u primitive.ObjectID, ids []primitive.ObjectID) (map[primitive.ObjectID]bool, error) {
	out := map[primitive.ObjectID]bool{}
	for _, id := range ids {
		if _, ok := m.saves[[2]primitive.ObjectID{u, id}]; ok {
			out[id] = true
		}
	}
	return out, nil
}
func (m *memRepo) ListSaves(context.Context, primitive.ObjectID, *primitive.ObjectID, int) ([]Save, error) {
	return nil, nil
}
func (m *memRepo) CreateComment(_ context.Context, c *Comment) error {
	m.comments[c.ID] = c
	m.posts[c.PostID].CommentsCount++
	return nil
}
func (m *memRepo) FindComment(_ context.Context, id primitive.ObjectID) (*Comment, error) {
	return m.comments[id], nil
}
func (m *memRepo) ListComments(context.Context, primitive.ObjectID, *primitive.ObjectID, int, []primitive.ObjectID) ([]Comment, error) {
	return nil, nil
}
func (m *memRepo) DeleteComment(_ context.Context, c *Comment) error {
	delete(m.comments, c.ID)
	m.posts[c.PostID].CommentsCount--
	return nil
}
func (m *memRepo) CountCommentsSince(_ context.Context, a primitive.ObjectID, since time.Time) (int64, error) {
	var n int64
	for _, c := range m.comments {
		if c.AuthorID == a && !c.CreatedAt.Before(since) {
			n++
		}
	}
	return n, nil
}
func (m *memRepo) CreateReport(_ context.Context, r *Report) error {
	m.reports = append(m.reports, *r)
	return nil
}
func (m *memRepo) ReportedPostIDs(_ context.Context, u primitive.ObjectID) ([]primitive.ObjectID, error) {
	var ids []primitive.ObjectID
	for _, r := range m.reports {
		if r.ReporterID == u {
			ids = append(ids, r.PostID)
		}
	}
	return ids, nil
}
func (m *memRepo) BlockedUserIDs(_ context.Context, u primitive.ObjectID) ([]primitive.ObjectID, error) {
	return m.blocks[u], nil
}

type memUsers map[primitive.ObjectID]*user.User

func (m memUsers) FindUsersByIDs(_ context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	out := map[primitive.ObjectID]*user.User{}
	for _, id := range ids {
		if u, ok := m[id]; ok {
			out[id] = u
		}
	}
	return out, nil
}

type fixture struct {
	svc   *feedService
	repo  *memRepo
	users memUsers
	stats memStats
	alice primitive.ObjectID
	bob   primitive.ObjectID
}

func newFixture() *fixture {
	f := &fixture{repo: newMemRepo(), users: memUsers{}, stats: memStats{}, alice: primitive.NewObjectID(), bob: primitive.NewObjectID()}
	f.users[f.alice] = &user.User{ID: f.alice, Name: "Alice", Roles: []string{"recruiter"}, CompanyName: "Acme", VerificationStatus: "verified"}
	f.users[f.bob] = &user.User{ID: f.bob, Name: "Bob"}
	f.svc = newService(f.repo, f.users, nil, nil, f.stats)
	return f
}

func TestCreatePostValidation(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	cases := []struct {
		name string
		req  CreatePostRequest
		want error
	}{
		{"empty", CreatePostRequest{Content: "  \n "}, ErrPostEmpty},
		{"too long", CreatePostRequest{Content: strings.Repeat("क", MaxPostLength+1)}, ErrPostTooLong},
		{"unknown category", CreatePostRequest{Content: "Hi", Category: "memes"}, ErrInvalidCategory},
		{"too many photos", CreatePostRequest{Content: "Hi", Media: make([]MediaInput, MaxPostImages+1)}, ErrTooManyImages},
		{"someone else's photo", CreatePostRequest{Media: []MediaInput{{FileID: primitive.NewObjectID().Hex()}}}, ErrInvalidMedia},
	}
	for _, c := range cases {
		if _, err := f.svc.CreatePost(ctx, f.alice, c.req); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, err, c.want)
		}
	}
}

func TestCreatePostDefaultsAndTags(t *testing.T) {
	f := newFixture()
	photo := primitive.NewObjectID()
	f.repo.files[photo] = f.alice
	res, err := f.svc.CreatePost(context.Background(), f.alice, CreatePostRequest{
		Content: "Hiring electricians in Pune\r\n\n\n\n#Hiring #पुणे #hiring",
		Media:   []MediaInput{{FileID: photo.Hex(), Width: 1200, Height: 800}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Category != CategoryGeneral {
		t.Errorf("category = %q, want general", res.Category)
	}
	if strings.Contains(res.Content, "\n\n\n") || strings.Contains(res.Content, "\r") {
		t.Errorf("content not cleaned: %q", res.Content)
	}
	stored := f.repo.posts[mustID(t, res.ID)]
	if got := strings.Join(stored.Tags, ","); got != "hiring,पुणे" {
		t.Errorf("tags = %q", got)
	}
	if !res.IsOwner || res.Author.Role != "recruiter" || !res.Author.IsVerified || res.Author.Headline != "Acme" {
		t.Errorf("author/owner wrong: %+v owner=%v", res.Author, res.IsOwner)
	}
	if len(res.Media) != 1 {
		t.Errorf("media = %d", len(res.Media))
	}
}

func TestPostRateLimit(t *testing.T) {
	f := newFixture()
	for i := 0; i < MaxPostsPerHour; i++ {
		if _, err := f.svc.CreatePost(context.Background(), f.bob, CreatePostRequest{Content: "post"}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := f.svc.CreatePost(context.Background(), f.bob, CreatePostRequest{Content: "one more"}); !errors.Is(err, ErrPostRateLimited) {
		t.Fatalf("got %v, want rate limit", err)
	}
}

func TestOnlyAuthorEdits(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	p, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "first"})
	id := mustID(t, p.ID)
	if _, err := f.svc.UpdatePost(ctx, f.bob, id, UpdatePostRequest{Content: "hacked"}); !errors.Is(err, ErrNotAllowed) {
		t.Fatalf("other member edited: %v", err)
	}
	same, _ := f.svc.UpdatePost(ctx, f.alice, id, UpdatePostRequest{Content: "first"})
	if same.EditedAt != nil {
		t.Error("an unchanged save marked the post edited")
	}
	edited, err := f.svc.UpdatePost(ctx, f.alice, id, UpdatePostRequest{Content: "second #new", Category: "jobs"})
	if err != nil || edited.EditedAt == nil || edited.Category != "jobs" {
		t.Fatalf("edit failed: %v %+v", err, edited)
	}
	if err := f.svc.DeletePost(ctx, f.bob, false, id); !errors.Is(err, ErrNotAllowed) {
		t.Fatalf("other member deleted: %v", err)
	}
	if err := f.svc.DeletePost(ctx, f.bob, true, id); err != nil {
		t.Fatalf("admin delete: %v", err)
	}
}

func TestReactions(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	p, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "news"})
	id := mustID(t, p.ID)

	if _, err := f.svc.React(ctx, f.bob, id, "love"); !errors.Is(err, ErrInvalidReaction) {
		t.Fatalf("unknown reaction accepted: %v", err)
	}
	r, _ := f.svc.React(ctx, f.bob, id, "like")
	r, _ = f.svc.React(ctx, f.bob, id, "like") // a repeat tap changes nothing
	if r.ReactionsTotal != 1 || r.ReactionCounts["like"] != 1 || r.UserReaction != "like" {
		t.Fatalf("after like: %+v", r)
	}
	r, _ = f.svc.React(ctx, f.bob, id, "celebrate")
	if r.ReactionsTotal != 1 || r.ReactionCounts["celebrate"] != 1 || r.ReactionCounts["like"] != 0 {
		t.Fatalf("after switch: %+v", r)
	}
	r, _ = f.svc.Unreact(ctx, f.bob, id)
	if r.ReactionsTotal != 0 || len(r.ReactionCounts) != 0 || r.UserReaction != "" {
		t.Fatalf("after remove: %+v", r)
	}
	if _, err := f.svc.React(ctx, f.bob, primitive.NewObjectID(), "like"); !errors.Is(err, ErrPostNotFound) {
		t.Fatalf("reacted to a missing post: %v", err)
	}
}

func TestCommentRules(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	p, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "news"})
	postID := mustID(t, p.ID)
	carol := primitive.NewObjectID()
	f.users[carol] = &user.User{ID: carol, Name: "Carol"}

	if _, err := f.svc.AddComment(ctx, f.bob, postID, CommentRequest{Content: " "}); !errors.Is(err, ErrCommentEmpty) {
		t.Fatalf("empty comment: %v", err)
	}
	c, err := f.svc.AddComment(ctx, f.bob, postID, CommentRequest{Content: "Congrats"})
	if err != nil {
		t.Fatal(err)
	}
	commentID := mustID(t, c.ID)
	if err := f.svc.DeleteComment(ctx, carol, false, postID, commentID); !errors.Is(err, ErrNotAllowed) {
		t.Fatalf("a stranger deleted a comment: %v", err)
	}
	if err := f.svc.DeleteComment(ctx, f.alice, false, primitive.NewObjectID(), commentID); !errors.Is(err, ErrCommentNotFound) {
		t.Fatalf("comment deleted through another post: %v", err)
	}
	// The post's author may clear comments from their own thread
	if err := f.svc.DeleteComment(ctx, f.alice, false, postID, commentID); err != nil {
		t.Fatalf("post author delete: %v", err)
	}
	if f.repo.posts[postID].CommentsCount != 0 {
		t.Errorf("comments_count = %d", f.repo.posts[postID].CommentsCount)
	}

	// Blocked members can't comment on each other's posts
	f.repo.blocks[carol] = []primitive.ObjectID{f.alice}
	if _, err := f.svc.AddComment(ctx, carol, postID, CommentRequest{Content: "hi"}); !errors.Is(err, ErrPostNotFound) {
		t.Fatalf("blocked member commented: %v", err)
	}
}

func TestListHidesBlockedReportedAndClosed(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	carol := primitive.NewObjectID()
	f.users[carol] = &user.User{ID: carol, Name: "Carol", AccountStatus: user.AccountDeactivated}

	a, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "alice"})
	f.repo.posts[primitive.NewObjectID()] = &Post{ID: primitive.NewObjectID(), AuthorID: carol, Content: "closed account", Category: CategoryGeneral, Status: PostActive}
	b, _ := f.svc.CreatePost(ctx, f.bob, CreatePostRequest{Content: "bob"})

	res, _ := f.svc.List(ctx, nil, ListQuery{})
	if len(res.Posts) != 2 {
		t.Fatalf("guest sees %d posts, want 2 (closed account hidden)", len(res.Posts))
	}

	viewer := primitive.NewObjectID()
	f.repo.blocks[viewer] = []primitive.ObjectID{f.bob}
	if err := f.svc.Report(ctx, viewer, mustID(t, a.ID), ReportRequest{Reason: "spam"}); err != nil {
		t.Fatal(err)
	}
	res, _ = f.svc.List(ctx, &viewer, ListQuery{})
	if len(res.Posts) != 0 {
		t.Fatalf("viewer still sees %d posts after blocking Bob and reporting Alice", len(res.Posts))
	}
	if _, err := f.svc.GetPost(ctx, &viewer, mustID(t, b.ID)); !errors.Is(err, ErrPostNotFound) {
		t.Fatalf("blocked author's post opened by link: %v", err)
	}
}

func TestReportRules(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	p, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "news"})
	id := mustID(t, p.ID)
	if err := f.svc.Report(ctx, f.bob, id, ReportRequest{Reason: "because"}); !errors.Is(err, ErrReportReason) {
		t.Fatalf("free-text reason accepted: %v", err)
	}
	if err := f.svc.Report(ctx, f.alice, id, ReportRequest{Reason: "spam"}); !errors.Is(err, ErrReportOwnPost) {
		t.Fatalf("own post reported: %v", err)
	}
}

func TestListPagination(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		f.repo.posts[primitive.NewObjectID()] = &Post{ID: primitive.NewObjectID(), AuthorID: f.alice, Content: "p", Category: CategoryGeneral, Status: PostActive}
	}
	page1, _ := f.svc.List(ctx, nil, ListQuery{Limit: 3})
	if len(page1.Posts) != 3 || page1.NextCursor == "" {
		t.Fatalf("page 1: %d posts, cursor %q", len(page1.Posts), page1.NextCursor)
	}
	before := mustID(t, page1.NextCursor)
	page2, _ := f.svc.List(ctx, nil, ListQuery{Limit: 3, Before: &before})
	if len(page2.Posts) != 2 || page2.NextCursor != "" {
		t.Fatalf("page 2: %d posts, cursor %q", len(page2.Posts), page2.NextCursor)
	}
}

func TestCleanTextKeepsLineBreaks(t *testing.T) {
	got := cleanText("  Line one  \r\nLine two\x00\n\n\n\nLine three  ")
	if got != "Line one\nLine two\n\nLine three" {
		t.Fatalf("cleanText = %q", got)
	}
}

func mustID(t *testing.T, hex string) primitive.ObjectID {
	t.Helper()
	id, err := primitive.ObjectIDFromHex(hex)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestImpressionsCountOthersOnceAndOnlyShowToAuthor(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	p, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "hiring"})
	id := mustID(t, p.ID)
	unknown := primitive.NewObjectID()

	_ = f.svc.RecordImpressions(ctx, analytics.Member(f.bob), []primitive.ObjectID{id, id, unknown})
	_ = f.svc.RecordImpressions(ctx, analytics.Member(f.bob), []primitive.ObjectID{id})                             // scrolled past again
	_ = f.svc.RecordImpressions(ctx, analytics.Member(f.alice), []primitive.ObjectID{id})                           // the author
	_ = f.svc.RecordImpressions(ctx, analytics.Guest("0123456789abcdef0123456789abcdef"), []primitive.ObjectID{id}) // a signed-out visitor

	if got := f.repo.posts[id].Impressions; got != 2 {
		t.Fatalf("impressions = %d, want 2", got)
	}
	mine, _ := f.svc.GetPost(ctx, &f.alice, id)
	if mine.Impressions == nil || *mine.Impressions != 2 {
		t.Errorf("author sees %v, want 2", mine.Impressions)
	}
	theirs, _ := f.svc.GetPost(ctx, &f.bob, id)
	if theirs.Impressions != nil {
		t.Errorf("another member sees the author's impressions")
	}
}

func TestTrendingCountsRecentTagsAndCaches(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	start := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)
	f.svc.now = func() time.Time { return start }
	_, _ = f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "#hiring #pune"})
	_, _ = f.svc.CreatePost(ctx, f.bob, CreatePostRequest{Content: "#hiring"})

	res, err := f.svc.Trending(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Tags) != 2 || res.Tags[0].Tag != "hiring" || res.Tags[0].Posts != 2 {
		t.Fatalf("trending = %+v", res.Tags)
	}

	// A new post shows up once the cached answer expires
	_, _ = f.svc.CreatePost(ctx, f.bob, CreatePostRequest{Content: "#electrician"})
	if again, _ := f.svc.Trending(ctx); len(again.Tags) != 2 {
		t.Errorf("cache not used: %+v", again.Tags)
	}
	f.svc.now = func() time.Time { return start.Add(trendingCacheFor + time.Second) }
	if later, _ := f.svc.Trending(ctx); len(later.Tags) != 3 {
		t.Errorf("cache not refreshed: %+v", later.Tags)
	}
}

func TestTrendingForgetsDeletedAndRetaggedPosts(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.svc.now = func() time.Time { return time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC) }
	solar, _ := f.svc.CreatePost(ctx, f.alice, CreatePostRequest{Content: "#solar"})
	pune, _ := f.svc.CreatePost(ctx, f.bob, CreatePostRequest{Content: "#pune"})
	if res, _ := f.svc.Trending(ctx); len(res.Tags) != 2 {
		t.Fatalf("trending = %+v", res.Tags)
	}

	if err := f.svc.DeletePost(ctx, f.alice, false, mustID(t, solar.ID)); err != nil {
		t.Fatal(err)
	}
	if res, _ := f.svc.Trending(ctx); len(res.Tags) != 1 || res.Tags[0].Tag != "pune" {
		t.Errorf("deleted post still trending: %+v", res.Tags)
	}

	if _, err := f.svc.UpdatePost(ctx, f.bob, mustID(t, pune.ID), UpdatePostRequest{Content: "no tags now"}); err != nil {
		t.Fatal(err)
	}
	if res, _ := f.svc.Trending(ctx); len(res.Tags) != 0 {
		t.Errorf("removed tag still trending: %+v", res.Tags)
	}
}
