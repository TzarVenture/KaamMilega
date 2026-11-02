package feed

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"km-backend/internal/features/analytics"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"
	"km-backend/internal/storage"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FeedService interface {
	CreatePost(ctx context.Context, userID primitive.ObjectID, req CreatePostRequest) (*PostResponse, error)
	UpdatePost(ctx context.Context, userID, postID primitive.ObjectID, req UpdatePostRequest) (*PostResponse, error)
	DeletePost(ctx context.Context, userID primitive.ObjectID, isAdmin bool, postID primitive.ObjectID) error
	GetPost(ctx context.Context, viewer *primitive.ObjectID, postID primitive.ObjectID) (*PostResponse, error)
	List(ctx context.Context, viewer *primitive.ObjectID, q ListQuery) (*ListResponse, error)
	ListSaved(ctx context.Context, userID primitive.ObjectID, before *primitive.ObjectID, limit int) (*ListResponse, error)

	React(ctx context.Context, userID, postID primitive.ObjectID, reaction string) (*ReactionResponse, error)
	Unreact(ctx context.Context, userID, postID primitive.ObjectID) (*ReactionResponse, error)
	Save(ctx context.Context, userID, postID primitive.ObjectID) error
	Unsave(ctx context.Context, userID, postID primitive.ObjectID) error

	AddComment(ctx context.Context, userID, postID primitive.ObjectID, req CommentRequest) (*CommentResponse, error)
	ListComments(ctx context.Context, viewer *primitive.ObjectID, postID primitive.ObjectID, before *primitive.ObjectID, limit int) (*CommentListResponse, error)
	DeleteComment(ctx context.Context, userID primitive.ObjectID, isAdmin bool, postID, commentID primitive.ObjectID) error

	Report(ctx context.Context, userID, postID primitive.ObjectID, req ReportRequest) error

	// RecordImpressions counts posts that were on a member's or guest's screen, once a day each
	RecordImpressions(ctx context.Context, viewer analytics.Viewer, postIDs []primitive.ObjectID) error
	Trending(ctx context.Context) (*TrendingResponse, error)
}

// authorLookup is the part of the user repository the feed needs
type authorLookup interface {
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}

type notifier interface {
	CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error)
}

// impressionRecorder is the part of analytics the feed needs
type impressionRecorder interface {
	RecordPostImpression(ctx context.Context, postID, authorID primitive.ObjectID, viewer analytics.Viewer) (bool, error)
}

type feedService struct {
	repo   FeedRepository
	users  authorLookup
	store  storage.Storage
	notify notifier
	stats  impressionRecorder
	now    func() time.Time

	trendingMu    sync.Mutex
	trending      *TrendingResponse
	trendingUntil time.Time
}

func NewFeedService(repo FeedRepository, userRepo user.UserRepository, store storage.Storage, notif notification.NotificationService, stats analytics.Service) FeedService {
	return newService(repo, userRepo, store, notif, stats)
}

func newService(repo FeedRepository, users authorLookup, store storage.Storage, notif notifier, stats impressionRecorder) *feedService {
	return &feedService{repo: repo, users: users, store: store, notify: notif, stats: stats, now: time.Now}
}

// ─── Posts ──────────────────────────────────────────────────────────────────────

func (s *feedService) CreatePost(ctx context.Context, userID primitive.ObjectID, req CreatePostRequest) (*PostResponse, error) {
	content := cleanText(req.Content)
	if content == "" && len(req.Media) == 0 {
		return nil, ErrPostEmpty
	}
	if utf8.RuneCountInString(content) > MaxPostLength {
		return nil, ErrPostTooLong
	}
	if len(req.Media) > MaxPostImages {
		return nil, ErrTooManyImages
	}
	category, err := parseCategory(req.Category)
	if err != nil {
		return nil, err
	}

	now := s.now()
	count, err := s.repo.CountPostsSince(ctx, userID, now.Add(-time.Hour))
	if err != nil {
		return nil, err
	}
	if count >= MaxPostsPerHour {
		return nil, ErrPostRateLimited
	}

	post := &Post{
		ID:        primitive.NewObjectIDFromTimestamp(now),
		AuthorID:  userID,
		Content:   content,
		Category:  category,
		Tags:      extractTags(content),
		Status:    PostActive,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if len(req.Media) > 0 {
		media, err := s.repo.ClaimMedia(ctx, userID, post.ID, req.Media)
		if err != nil {
			return nil, err
		}
		post.Media = media
	}
	if err := s.repo.CreatePost(ctx, post); err != nil {
		return nil, err
	}
	return s.single(ctx, &userID, post)
}

func (s *feedService) UpdatePost(ctx context.Context, userID, postID primitive.ObjectID, req UpdatePostRequest) (*PostResponse, error) {
	post, err := s.activePost(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.AuthorID != userID {
		return nil, ErrNotAllowed
	}
	content := cleanText(req.Content)
	if content == "" && len(post.Media) == 0 {
		return nil, ErrPostEmpty
	}
	if utf8.RuneCountInString(content) > MaxPostLength {
		return nil, ErrPostTooLong
	}
	category := post.Category
	if strings.TrimSpace(req.Category) != "" {
		if category, err = parseCategory(req.Category); err != nil {
			return nil, err
		}
	}
	// Saving without a change doesn't mark the post as edited
	if content == post.Content && category == post.Category {
		return s.single(ctx, &userID, post)
	}
	now := s.now()
	tags := extractTags(content)
	if err := s.repo.UpdatePost(ctx, postID, content, category, tags, now); err != nil {
		return nil, err
	}
	if !slices.Equal(tags, post.Tags) {
		s.forgetTrending()
	}
	post.Content, post.Category, post.Tags, post.EditedAt = content, category, tags, &now
	return s.single(ctx, &userID, post)
}

func (s *feedService) DeletePost(ctx context.Context, userID primitive.ObjectID, isAdmin bool, postID primitive.ObjectID) error {
	post, err := s.repo.FindPost(ctx, postID)
	if err != nil {
		return err
	}
	if post == nil {
		return ErrPostNotFound
	}
	if post.AuthorID != userID && !isAdmin {
		return ErrNotAllowed
	}
	if err := s.repo.DeletePost(ctx, postID); err != nil {
		return err
	}
	if len(post.Tags) > 0 {
		s.forgetTrending()
	}
	if len(post.Media) > 0 {
		ids := make([]primitive.ObjectID, 0, len(post.Media))
		for _, m := range post.Media {
			ids = append(ids, m.FileID)
		}
		keys, err := s.repo.ReleaseMedia(ctx, ids)
		if err != nil {
			log.Printf("feed: post %s deleted but its photo records were not: %v", postID.Hex(), err)
		}
		s.deleteObjects(keys)
	}
	return nil
}

// deleteObjects removes photos from storage after the response; a failure only leaves an
// unreachable object behind, so it is logged rather than returned
func (s *feedService) deleteObjects(keys []string) {
	if s.store == nil || len(keys) == 0 {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		for _, k := range keys {
			if err := s.store.Delete(ctx, storage.Public, k); err != nil {
				log.Printf("feed: could not delete photo %s: %v", k, err)
			}
		}
	}()
}

func (s *feedService) GetPost(ctx context.Context, viewer *primitive.ObjectID, postID primitive.ObjectID) (*PostResponse, error) {
	post, err := s.activePost(ctx, postID)
	if err != nil {
		return nil, err
	}
	if viewer != nil {
		blocked, err := s.repo.BlockedUserIDs(ctx, *viewer)
		if err != nil {
			return nil, err
		}
		if containsID(blocked, post.AuthorID) {
			return nil, ErrPostNotFound
		}
	}
	return s.single(ctx, viewer, post)
}

func (s *feedService) List(ctx context.Context, viewer *primitive.ObjectID, q ListQuery) (*ListResponse, error) {
	q.Limit = pageSize(q.Limit, DefaultPageSize, MaxPageSize)
	if q.Category != "" && q.Category != CategoryAll && !postCategories[q.Category] {
		return nil, ErrInvalidCategory
	}
	q.Tag = normaliseTag(q.Tag)

	var hideAuthors, hidePosts []primitive.ObjectID
	if viewer != nil {
		var err error
		if hideAuthors, err = s.repo.BlockedUserIDs(ctx, *viewer); err != nil {
			return nil, err
		}
		// Someone who reported a post stops seeing it
		if hidePosts, err = s.repo.ReportedPostIDs(ctx, *viewer); err != nil {
			return nil, err
		}
	}

	// One extra row tells whether another page exists
	want := q.Limit
	q.Limit = want + 1
	posts, err := s.repo.ListPosts(ctx, q, hideAuthors, hidePosts)
	if err != nil {
		return nil, err
	}
	next := ""
	if len(posts) > want {
		posts = posts[:want]
		next = posts[want-1].ID.Hex()
	}
	ptrs := make([]*Post, len(posts))
	for i := range posts {
		ptrs[i] = &posts[i]
	}
	out, err := s.responses(ctx, viewer, ptrs)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Posts: out, NextCursor: next}, nil
}

func (s *feedService) ListSaved(ctx context.Context, userID primitive.ObjectID, before *primitive.ObjectID, limit int) (*ListResponse, error) {
	want := pageSize(limit, DefaultPageSize, MaxPageSize)
	saves, err := s.repo.ListSaves(ctx, userID, before, want+1)
	if err != nil {
		return nil, err
	}
	next := ""
	if len(saves) > want {
		saves = saves[:want]
		next = saves[want-1].ID.Hex()
	}
	ids := make([]primitive.ObjectID, 0, len(saves))
	for _, sv := range saves {
		ids = append(ids, sv.PostID)
	}
	byID, err := s.repo.FindPostsByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	blocked, err := s.repo.BlockedUserIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	// Keep the order the posts were saved in; deleted posts drop out
	ptrs := make([]*Post, 0, len(saves))
	for _, sv := range saves {
		if p, ok := byID[sv.PostID]; ok && !containsID(blocked, p.AuthorID) {
			ptrs = append(ptrs, p)
		}
	}
	out, err := s.responses(ctx, &userID, ptrs)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Posts: out, NextCursor: next}, nil
}

// ─── Reactions and saves ────────────────────────────────────────────────────────

func (s *feedService) React(ctx context.Context, userID, postID primitive.ObjectID, reaction string) (*ReactionResponse, error) {
	reaction = strings.ToLower(strings.TrimSpace(reaction))
	if !reactionTypes[reaction] {
		return nil, ErrInvalidReaction
	}
	if _, err := s.activePost(ctx, postID); err != nil {
		return nil, err
	}
	if _, err := s.repo.SetReaction(ctx, postID, userID, reaction); err != nil {
		return nil, err
	}
	return s.reactionState(ctx, postID, reaction)
}

func (s *feedService) Unreact(ctx context.Context, userID, postID primitive.ObjectID) (*ReactionResponse, error) {
	if _, err := s.activePost(ctx, postID); err != nil {
		return nil, err
	}
	if _, err := s.repo.RemoveReaction(ctx, postID, userID); err != nil {
		return nil, err
	}
	return s.reactionState(ctx, postID, "")
}

func (s *feedService) reactionState(ctx context.Context, postID primitive.ObjectID, mine string) (*ReactionResponse, error) {
	post, err := s.activePost(ctx, postID)
	if err != nil {
		return nil, err
	}
	return &ReactionResponse{ReactionCounts: positiveCounts(post.ReactionCounts), ReactionsTotal: max(post.ReactionsTotal, 0), UserReaction: mine}, nil
}

func (s *feedService) Save(ctx context.Context, userID, postID primitive.ObjectID) error {
	if _, err := s.activePost(ctx, postID); err != nil {
		return err
	}
	return s.repo.SavePost(ctx, userID, postID)
}

func (s *feedService) Unsave(ctx context.Context, userID, postID primitive.ObjectID) error {
	return s.repo.UnsavePost(ctx, userID, postID)
}

// ─── Comments ───────────────────────────────────────────────────────────────────

func (s *feedService) AddComment(ctx context.Context, userID, postID primitive.ObjectID, req CommentRequest) (*CommentResponse, error) {
	content := cleanText(req.Content)
	if content == "" {
		return nil, ErrCommentEmpty
	}
	if utf8.RuneCountInString(content) > MaxCommentLength {
		return nil, ErrCommentTooLong
	}
	post, err := s.activePost(ctx, postID)
	if err != nil {
		return nil, err
	}
	blocked, err := s.repo.BlockedUserIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if containsID(blocked, post.AuthorID) {
		return nil, ErrPostNotFound
	}
	now := s.now()
	count, err := s.repo.CountCommentsSince(ctx, userID, now.Add(-time.Hour))
	if err != nil {
		return nil, err
	}
	if count >= MaxCommentsPerHour {
		return nil, ErrCommentRateLimit
	}

	c := &Comment{ID: primitive.NewObjectIDFromTimestamp(now), PostID: postID, AuthorID: userID, Content: content, CreatedAt: now}
	if err := s.repo.CreateComment(ctx, c); err != nil {
		return nil, err
	}
	authors, err := s.authors(ctx, []primitive.ObjectID{userID})
	if err != nil {
		return nil, err
	}
	author := authors[userID]
	if post.AuthorID != userID {
		s.notifyComment(post, userID, author, content)
	}
	return &CommentResponse{
		ID: c.ID.Hex(), PostID: postID.Hex(), Author: author, Content: c.Content, CanDelete: true, CreatedAt: c.CreatedAt,
	}, nil
}

// notifyComment tells the post's author about a new comment, after the response
func (s *feedService) notifyComment(post *Post, actorID primitive.ObjectID, actor AuthorResponse, content string) {
	if s.notify == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, err := s.notify.CreateNotification(ctx, notification.CreateNotificationRequest{
			UserID:      post.AuthorID,
			ActorID:     &actorID,
			ActorName:   actor.Name,
			ActorAvatar: actor.Avatar,
			Type:        notification.TypeFeedComment,
			Category:    notification.CategoryNetwork,
			Title:       "New comment on your post",
			Message:     fmt.Sprintf("%s commented: %s", actor.Name, snippet(content, 80)),
			Link:        "/feed/" + post.ID.Hex(),
			Metadata:    map[string]interface{}{"post_id": post.ID.Hex()},
		})
		if err != nil {
			log.Printf("feed: comment notification failed: %v", err)
		}
	}()
}

func (s *feedService) ListComments(ctx context.Context, viewer *primitive.ObjectID, postID primitive.ObjectID, before *primitive.ObjectID, limit int) (*CommentListResponse, error) {
	post, err := s.activePost(ctx, postID)
	if err != nil {
		return nil, err
	}
	var hide []primitive.ObjectID
	if viewer != nil {
		if hide, err = s.repo.BlockedUserIDs(ctx, *viewer); err != nil {
			return nil, err
		}
	}
	want := pageSize(limit, DefaultCommentPage, MaxCommentPage)
	comments, err := s.repo.ListComments(ctx, postID, before, want+1, hide)
	if err != nil {
		return nil, err
	}
	next := ""
	if len(comments) > want {
		comments = comments[:want]
		next = comments[want-1].ID.Hex()
	}
	ids := make([]primitive.ObjectID, 0, len(comments))
	for _, c := range comments {
		ids = append(ids, c.AuthorID)
	}
	authors, err := s.authors(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]CommentResponse, 0, len(comments))
	for _, c := range comments {
		a, ok := authors[c.AuthorID]
		if !ok {
			continue // the author's account is closed
		}
		out = append(out, CommentResponse{
			ID: c.ID.Hex(), PostID: postID.Hex(), Author: a, Content: c.Content, CreatedAt: c.CreatedAt,
			CanDelete: viewer != nil && (*viewer == c.AuthorID || *viewer == post.AuthorID),
		})
	}
	return &CommentListResponse{Comments: out, NextCursor: next}, nil
}

// DeleteComment: the comment's author, the post's author (it is their thread) or an admin
func (s *feedService) DeleteComment(ctx context.Context, userID primitive.ObjectID, isAdmin bool, postID, commentID primitive.ObjectID) error {
	c, err := s.repo.FindComment(ctx, commentID)
	if err != nil {
		return err
	}
	if c == nil || c.PostID != postID {
		return ErrCommentNotFound
	}
	if c.AuthorID != userID && !isAdmin {
		post, err := s.repo.FindPost(ctx, postID)
		if err != nil {
			return err
		}
		if post == nil || post.AuthorID != userID {
			return ErrNotAllowed
		}
	}
	return s.repo.DeleteComment(ctx, c)
}

// ─── Reports ────────────────────────────────────────────────────────────────────

func (s *feedService) Report(ctx context.Context, userID, postID primitive.ObjectID, req ReportRequest) error {
	reason := strings.ToLower(strings.TrimSpace(req.Reason))
	if !reportReasons[reason] {
		return ErrReportReason
	}
	details := cleanText(req.Details)
	if utf8.RuneCountInString(details) > MaxReportDetails {
		details = string([]rune(details)[:MaxReportDetails])
	}
	post, err := s.activePost(ctx, postID)
	if err != nil {
		return err
	}
	if post.AuthorID == userID {
		return ErrReportOwnPost
	}
	return s.repo.CreateReport(ctx, &Report{PostID: postID, AuthorID: post.AuthorID, ReporterID: userID, Reason: reason, Details: details})
}

// ─── Building responses ─────────────────────────────────────────────────────────

func (s *feedService) activePost(ctx context.Context, id primitive.ObjectID) (*Post, error) {
	post, err := s.repo.FindPost(ctx, id)
	if err != nil {
		return nil, err
	}
	if post == nil || post.Status != PostActive {
		return nil, ErrPostNotFound
	}
	return post, nil
}

func (s *feedService) single(ctx context.Context, viewer *primitive.ObjectID, post *Post) (*PostResponse, error) {
	out, err := s.responses(ctx, viewer, []*Post{post})
	if err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, ErrPostNotFound // the author's account is closed
	}
	return &out[0], nil
}

// responses fills in authors and the viewer's own reaction and save in three queries,
// whatever the page size. Posts by closed accounts are left out.
func (s *feedService) responses(ctx context.Context, viewer *primitive.ObjectID, posts []*Post) ([]PostResponse, error) {
	out := make([]PostResponse, 0, len(posts))
	if len(posts) == 0 {
		return out, nil
	}
	postIDs := make([]primitive.ObjectID, 0, len(posts))
	authorIDs := make([]primitive.ObjectID, 0, len(posts))
	for _, p := range posts {
		postIDs = append(postIDs, p.ID)
		authorIDs = append(authorIDs, p.AuthorID)
	}
	authors, err := s.authors(ctx, authorIDs)
	if err != nil {
		return nil, err
	}
	reactions := map[primitive.ObjectID]string{}
	saves := map[primitive.ObjectID]bool{}
	if viewer != nil {
		if reactions, err = s.repo.ViewerReactions(ctx, *viewer, postIDs); err != nil {
			return nil, err
		}
		if saves, err = s.repo.ViewerSaves(ctx, *viewer, postIDs); err != nil {
			return nil, err
		}
	}
	for _, p := range posts {
		a, ok := authors[p.AuthorID]
		if !ok {
			continue
		}
		media := p.Media
		if media == nil {
			media = []Media{}
		}
		owner := viewer != nil && *viewer == p.AuthorID
		var impressions *int
		if owner {
			n := max(p.Impressions, 0)
			impressions = &n
		}
		out = append(out, PostResponse{
			ID:             p.ID.Hex(),
			Author:         a,
			Content:        p.Content,
			Category:       p.Category,
			Media:          media,
			ReactionCounts: positiveCounts(p.ReactionCounts),
			ReactionsTotal: max(p.ReactionsTotal, 0),
			CommentsCount:  max(p.CommentsCount, 0),
			UserReaction:   reactions[p.ID],
			IsSaved:        saves[p.ID],
			IsOwner:        owner,
			Impressions:    impressions,
			CreatedAt:      p.CreatedAt,
			EditedAt:       p.EditedAt,
		})
	}
	return out, nil
}

// authors returns display details for active accounts only; profile changes show on every
// post because nothing about the author is copied into the post
func (s *feedService) authors(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]AuthorResponse, error) {
	out := make(map[primitive.ObjectID]AuthorResponse, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	users, err := s.users.FindUsersByIDs(ctx, uniqueIDs(ids))
	if err != nil {
		return nil, err
	}
	for id, u := range users {
		if u == nil || !user.IsActiveAccount(u.AccountStatus) {
			continue
		}
		out[id] = user.BylineOf(u)
	}
	return out, nil
}

// ─── Impressions and trending ───────────────────────────────────────────────────

func (s *feedService) RecordImpressions(ctx context.Context, viewer analytics.Viewer, postIDs []primitive.ObjectID) error {
	ids := uniqueIDs(postIDs)
	if len(ids) > analytics.MaxImpressionsPerRequest {
		ids = ids[:analytics.MaxImpressionsPerRequest]
	}
	if len(ids) == 0 || s.stats == nil {
		return nil
	}
	// The author comes from the post, never from the browser, so nobody can add to someone
	// else's numbers by naming them
	posts, err := s.repo.FindPostsByIDs(ctx, ids)
	if err != nil {
		return err
	}
	var failed error
	for _, id := range ids {
		p, ok := posts[id]
		if !ok {
			continue
		}
		first, err := s.stats.RecordPostImpression(ctx, p.ID, p.AuthorID, viewer)
		if err == nil && first {
			err = s.repo.IncrementImpressions(ctx, p.ID)
		}
		if err != nil {
			failed = err
		}
	}
	return failed
}

func (s *feedService) Trending(ctx context.Context) (*TrendingResponse, error) {
	s.trendingMu.Lock()
	defer s.trendingMu.Unlock()
	now := s.now()
	if s.trending != nil && now.Before(s.trendingUntil) {
		return s.trending, nil
	}
	tags, err := s.repo.TrendingTags(ctx, now.Add(-TrendingWindow), TrendingLimit)
	if err != nil {
		return nil, err
	}
	s.trending = &TrendingResponse{Tags: tags}
	s.trendingUntil = now.Add(trendingCacheFor)
	return s.trending, nil
}

// forgetTrending drops the cached topics when a post's hashtags go away, so a deleted post
// never lingers in them. New posts simply show up at the next refresh.
func (s *feedService) forgetTrending() {
	s.trendingMu.Lock()
	s.trending = nil
	s.trendingMu.Unlock()
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

func parseCategory(raw string) (string, error) {
	c := strings.ToLower(strings.TrimSpace(raw))
	if c == "" || c == CategoryAll {
		return CategoryGeneral, nil
	}
	if !postCategories[c] {
		return "", ErrInvalidCategory
	}
	return c, nil
}

var (
	tagPattern       = regexp.MustCompile(`#([\p{L}\p{M}\p{N}_]+)`)
	extraBlankLines  = regexp.MustCompile(`\n{3,}`)
	trailingSpaceEOL = regexp.MustCompile(`[ \t]+\n`)
)

// cleanText trims the text, normalises line endings and drops control characters and runs of
// blank lines, keeping the line breaks people use to lay out a post
func cleanText(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return r
		}
		if r < 0x20 || r == 0x7f || r == utf8.RuneError {
			return -1
		}
		return r
	}, s)
	s = trailingSpaceEOL.ReplaceAllString(s, "\n")
	s = extraBlankLines.ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}

// extractTags reads hashtags from the text itself (the client's list is never trusted)
func extractTags(content string) []string {
	seen := map[string]bool{}
	tags := []string{}
	for _, m := range tagPattern.FindAllStringSubmatch(content, -1) {
		t := normaliseTag(m[1])
		if t == "" || seen[t] {
			continue
		}
		seen[t] = true
		tags = append(tags, t)
		if len(tags) == MaxTagsPerPost {
			break
		}
	}
	return tags
}

func normaliseTag(t string) string {
	t = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(t), "#"))
	if t == "" || utf8.RuneCountInString(t) > MaxTagLength {
		return ""
	}
	return t
}

func pageSize(n, def, maxN int) int {
	if n <= 0 {
		return def
	}
	return min(n, maxN)
}

func positiveCounts(in map[string]int) map[string]int {
	out := make(map[string]int, len(in))
	for k, v := range in {
		if v > 0 && reactionTypes[k] {
			out[k] = v
		}
	}
	return out
}

func containsID(ids []primitive.ObjectID, id primitive.ObjectID) bool {
	for _, x := range ids {
		if x == id {
			return true
		}
	}
	return false
}

func uniqueIDs(ids []primitive.ObjectID) []primitive.ObjectID {
	seen := make(map[primitive.ObjectID]bool, len(ids))
	out := make([]primitive.ObjectID, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

func snippet(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n]) + "…"
}
