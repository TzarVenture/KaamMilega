package story

import (
	"context"
	"errors"
	"log"
	"path"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/features/user"
	"km-backend/internal/storage"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Users is what stories need from accounts
type Users interface {
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}

type Service interface {
	Create(ctx context.Context, owner primitive.ObjectID, req CreateRequest) (*StoryResponse, error)
	// Bar is the stories the viewer can see, one group per member, their own first
	Bar(ctx context.Context, viewer primitive.ObjectID) ([]Group, error)
	View(ctx context.Context, viewer, id primitive.ObjectID) error
	Viewers(ctx context.Context, owner, id primitive.ObjectID) ([]ViewerResponse, error)
	Delete(ctx context.Context, owner, id primitive.ObjectID) error
	Report(ctx context.Context, reporter, id primitive.ObjectID, req ReportRequest) error
	// Quote checks the viewer may reply to the story and returns what the chat message keeps
	Quote(ctx context.Context, viewer, id primitive.ObjectID) (*Quote, error)

	Queue(ctx context.Context, page, limit int) ([]ModerationItem, int64, error)
	Decide(ctx context.Context, admin, id primitive.ObjectID, action string) error
	// Sweep deletes stories that have ended, files and all
	Sweep(ctx context.Context) error
}

type service struct {
	repo  Repository
	users Users
	store storage.Storage
	now   func() time.Time
}

func NewService(repo Repository, users user.UserRepository, store storage.Storage) Service {
	return &service{repo: repo, users: users, store: store, now: time.Now}
}

func (s *service) Create(ctx context.Context, owner primitive.ObjectID, req CreateRequest) (*StoryResponse, error) {
	if req.Media == nil || req.Media.FileID == "" {
		return nil, ErrMediaMissing
	}
	caption := cleanText(req.Caption)
	if utf8.RuneCountInString(caption) > MaxCaption {
		return nil, ErrCaptionTooLong
	}
	now := s.now()
	n, err := s.repo.CountSince(ctx, owner, now.Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}
	if n >= MaxPerDay {
		return nil, ErrDailyLimit
	}
	st := &Story{
		ID: primitive.NewObjectIDFromTimestamp(now), OwnerID: owner, Caption: caption, Status: StatusActive,
		CreatedAt: now, ExpiresAt: now.Add(Lifetime), PurgeAt: now.Add(Lifetime),
	}
	if st.Media, err = s.repo.ClaimMedia(ctx, owner, st.ID, *req.Media); err != nil {
		return nil, err
	}
	if err := s.repo.Insert(ctx, st); err != nil {
		// The files go back to being unattached, so they can be shared again or cleared later
		s.repo.Unclaim(context.Background(), st.ID, st.Media.fileIDs())
		return nil, err
	}
	// Counted for the daily limit even if it is deleted later
	if err := s.repo.LogShare(ctx, owner, now); err != nil {
		log.Printf("story: counting %s for the daily limit: %v", st.ID.Hex(), err)
	}
	zero := 0
	return &StoryResponse{ID: st.ID.Hex(), Media: st.Media, Caption: caption, CreatedAt: now, ExpiresAt: st.ExpiresAt, Seen: true, Views: &zero}, nil
}

// cleanText trims a caption and folds its lines into one
func cleanText(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func isRecruiter(u *user.User) bool {
	for _, r := range u.Roles {
		if r == user.RoleRecruiter {
			return true
		}
	}
	return false
}

func idSet(ids []primitive.ObjectID) map[primitive.ObjectID]bool {
	m := make(map[primitive.ObjectID]bool, len(ids))
	for _, id := range ids {
		m[id] = true
	}
	return m
}

func (s *service) Bar(ctx context.Context, viewer primitive.ObjectID) ([]Group, error) {
	conns, err := s.repo.Connections(ctx, viewer)
	if err != nil {
		return nil, err
	}
	followed, err := s.repo.FollowedCompanies(ctx, viewer)
	if err != nil {
		return nil, err
	}
	blocked, err := s.repo.BlockedEitherWay(ctx, viewer)
	if err != nil {
		return nil, err
	}
	isBlocked, isConn := idSet(blocked), idSet(conns)
	candidates := append(append([]primitive.ObjectID{viewer}, conns...), followed...)
	owners := make([]primitive.ObjectID, 0, len(candidates))
	seenOwner := map[primitive.ObjectID]bool{}
	for _, id := range candidates {
		if !seenOwner[id] && !isBlocked[id] {
			seenOwner[id] = true
			owners = append(owners, id)
		}
	}
	now := s.now()
	live, err := s.repo.Live(ctx, owners, now)
	if err != nil || len(live) == 0 {
		return []Group{}, err
	}
	withStories := make([]primitive.ObjectID, 0)
	storyIDs := make([]primitive.ObjectID, 0, len(live))
	for _, st := range live {
		storyIDs = append(storyIDs, st.ID)
		withStories = append(withStories, st.OwnerID)
	}
	users, err := s.users.FindUsersByIDs(ctx, withStories)
	if err != nil {
		return nil, err
	}
	seen, err := s.repo.SeenBy(ctx, viewer, storyIDs)
	if err != nil {
		return nil, err
	}

	groups := map[primitive.ObjectID]*Group{}
	order := []primitive.ObjectID{}
	latest := map[primitive.ObjectID]time.Time{}
	for _, st := range live {
		u := users[st.OwnerID]
		if u == nil || !user.IsActiveAccount(u.AccountStatus) {
			continue
		}
		own := st.OwnerID == viewer
		// A followed company's stories show only if it is a recruiter; connections always show
		if !own && !isConn[st.OwnerID] && !isRecruiter(u) {
			continue
		}
		g := groups[st.OwnerID]
		if g == nil {
			g = &Group{Owner: user.BylineOf(u), Stories: []StoryResponse{}, AllSeen: true, IsOwn: own}
			groups[st.OwnerID] = g
			order = append(order, st.OwnerID)
		}
		r := StoryResponse{ID: st.ID.Hex(), Media: st.Media, Caption: st.Caption, CreatedAt: st.CreatedAt, ExpiresAt: st.ExpiresAt, Seen: own || seen[st.ID]}
		if own {
			v := st.Views
			r.Views = &v
		}
		if !r.Seen {
			g.AllSeen = false
		}
		g.Stories = append(g.Stories, r)
		latest[st.OwnerID] = st.CreatedAt
	}
	out := make([]Group, 0, len(order))
	for _, id := range order {
		out = append(out, *groups[id])
	}
	// Your own first, then people with something new, newest first, then the rest
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.IsOwn != b.IsOwn {
			return a.IsOwn
		}
		if a.AllSeen != b.AllSeen {
			return !a.AllSeen
		}
		ai, _ := primitive.ObjectIDFromHex(a.Owner.ID)
		bi, _ := primitive.ObjectIDFromHex(b.Owner.ID)
		return latest[ai].After(latest[bi])
	})
	return out, nil
}

// live returns the story if the viewer may see it now: it is showing (or theirs), and the
// owner is the viewer, a connection, or a recruiter whose company the viewer follows, with
// no block either way and an active account
func (s *service) live(ctx context.Context, viewer, id primitive.ObjectID) (*Story, error) {
	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if st.OwnerID == viewer {
		if st.Status == StatusRemoved || st.DeletedByOwner {
			return nil, ErrNotFound
		}
		return st, nil
	}
	if st.Status != StatusActive || !s.now().Before(st.ExpiresAt) {
		return nil, ErrNotFound
	}
	if err := s.canSee(ctx, viewer, st.OwnerID); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *service) canSee(ctx context.Context, viewer, owner primitive.ObjectID) error {
	blocked, err := s.repo.BlockedEitherWay(ctx, viewer)
	if err != nil {
		return err
	}
	if idSet(blocked)[owner] {
		return ErrNotFound
	}
	users, err := s.users.FindUsersByIDs(ctx, []primitive.ObjectID{owner})
	if err != nil {
		return err
	}
	u := users[owner]
	if u == nil || !user.IsActiveAccount(u.AccountStatus) {
		return ErrNotFound
	}
	connected, err := s.repo.IsConnected(ctx, viewer, owner)
	if err != nil {
		return err
	}
	if connected {
		return nil
	}
	if isRecruiter(u) {
		follows, err := s.repo.Follows(ctx, viewer, owner)
		if err != nil {
			return err
		}
		if follows {
			return nil
		}
	}
	return ErrNotFound
}

func (s *service) View(ctx context.Context, viewer, id primitive.ObjectID) error {
	st, err := s.live(ctx, viewer, id)
	if err != nil {
		return err
	}
	if st.OwnerID == viewer {
		return nil
	}
	_, err = s.repo.AddView(ctx, st, viewer, s.now())
	return err
}

// maxViewers is the longest viewers list returned
const maxViewers = 500

func (s *service) Viewers(ctx context.Context, owner, id primitive.ObjectID) ([]ViewerResponse, error) {
	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if st.OwnerID != owner {
		return nil, ErrNotOwner
	}
	views, err := s.repo.Viewers(ctx, id, maxViewers)
	if err != nil {
		return nil, err
	}
	blocked, err := s.repo.BlockedEitherWay(ctx, owner)
	if err != nil {
		return nil, err
	}
	isBlocked := idSet(blocked)
	ids := make([]primitive.ObjectID, 0, len(views))
	for _, v := range views {
		ids = append(ids, v.ViewerID)
	}
	users, err := s.users.FindUsersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]ViewerResponse, 0, len(views))
	for _, v := range views {
		u := users[v.ViewerID]
		if u == nil || !user.IsActiveAccount(u.AccountStatus) || isBlocked[v.ViewerID] {
			continue
		}
		out = append(out, ViewerResponse{Viewer: user.BylineOf(u), ViewedAt: v.ViewedAt})
	}
	return out, nil
}

func (s *service) Delete(ctx context.Context, owner, id primitive.ObjectID) error {
	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	if st.OwnerID != owner {
		return ErrNotOwner
	}
	open, err := s.repo.CountPendingReports(ctx, id)
	if err != nil {
		return err
	}
	if open > 0 {
		// Reported: it disappears for everyone, and stays for the moderator to review
		wasShowing, err := s.repo.HideForReview(ctx, id)
		if err == nil && wasShowing {
			s.moveFiles(ctx, st)
		}
		return err
	}
	return s.remove(ctx, st, "")
}

// moveFiles gives a hidden story's photo or video (and still) a new address and deletes the old
// one, clearing it from the CDN. Anyone who kept the old link (an earlier viewer, a chat quote)
// can no longer open it; the moderator sees it at the new address. A failure leaves the file
// where it was: the story is hidden in the app either way.
func (s *service) moveFiles(ctx context.Context, st *Story) {
	if s.store == nil {
		return
	}
	urls := map[primitive.ObjectID]string{}
	var old []string
	for _, id := range st.Media.fileIDs() {
		key, err := s.repo.FileKey(ctx, id)
		if err != nil || key == "" {
			log.Printf("story: moving files of hidden story %s: %v", st.ID.Hex(), err)
			return
		}
		moved := path.Dir(key) + "/" + primitive.NewObjectID().Hex() + path.Ext(key)
		if err := s.store.Copy(ctx, storage.Public, key, moved); err != nil {
			log.Printf("story: moving files of hidden story %s: %v", st.ID.Hex(), err)
			return
		}
		url := s.store.PublicURL(moved)
		if err := s.repo.MoveFile(ctx, id, moved, url); err != nil {
			_ = s.store.Delete(ctx, storage.Public, moved)
			log.Printf("story: moving files of hidden story %s: %v", st.ID.Hex(), err)
			return
		}
		urls[id] = url
		old = append(old, key)
	}
	if err := s.repo.SetMediaURLs(ctx, st.ID, urls[st.Media.FileID], urls[st.Media.PosterFileID]); err != nil {
		log.Printf("story: moving files of hidden story %s: %v", st.ID.Hex(), err)
	}
	for _, key := range old {
		if err := s.store.Delete(ctx, storage.Public, key); err != nil {
			log.Printf("story: deleting old address of hidden story %s: %v", st.ID.Hex(), err)
		}
	}
}

// remove deletes the story, its views and its files (from storage and the CDN cache). Reports
// still open are closed with closeAs, so the moderation queue never points at nothing.
//
// Files go first and the story record last, so if storage fails the story is left taken down and
// due, and the sweeper tries again in a few minutes.
func (s *service) remove(ctx context.Context, st *Story, closeAs string) error {
	if closeAs != "" {
		if err := s.repo.ResolveReports(ctx, st.ID, primitive.NilObjectID, closeAs, s.now()); err != nil {
			return err
		}
	}
	retryLater := func(err error) error {
		log.Printf("story: removing %s, will retry: %v", st.ID.Hex(), err)
		if _, e := s.repo.SetStatus(ctx, st.ID, []string{StatusActive, StatusHidden}, StatusRemoved); e != nil {
			return err
		}
		if e := s.repo.SetPurgeAt(ctx, st.ID, s.now()); e != nil {
			return err
		}
		return nil
	}
	ids := st.Media.fileIDs()
	keys, err := s.repo.FileKeys(ctx, ids)
	if err != nil {
		return retryLater(err)
	}
	if s.store != nil {
		for _, k := range keys {
			if err := s.store.Delete(ctx, storage.Public, k); err != nil && !errors.Is(err, storage.ErrNotFound) {
				return retryLater(err)
			}
		}
	}
	if err := s.repo.DeleteFileRecords(ctx, ids); err != nil {
		return retryLater(err)
	}
	return s.repo.Delete(ctx, st.ID)
}

func (s *service) Report(ctx context.Context, reporter, id primitive.ObjectID, req ReportRequest) error {
	reason := strings.ToLower(strings.TrimSpace(req.Reason))
	if !reportReasons[reason] {
		return ErrReportReason
	}
	details := cleanText(req.Details)
	if utf8.RuneCountInString(details) > MaxReportDetails {
		details = string([]rune(details)[:MaxReportDetails])
	}
	st, err := s.live(ctx, reporter, id)
	if err != nil {
		return err
	}
	if st.OwnerID == reporter {
		return ErrReportOwn
	}
	now := s.now()
	if err := s.repo.CreateReport(ctx, &Report{
		StoryID: id, OwnerID: st.OwnerID, ReporterID: reporter, Reason: reason, Details: details, Status: ReportPending, CreatedAt: now,
	}); err != nil {
		return err
	}
	// A reported story is kept past its 24 hours so a moderator has something to look at
	if keep := st.ExpiresAt.Add(KeepReported); st.PurgeAt.Before(keep) {
		if err := s.repo.SetPurgeAt(ctx, id, keep); err != nil {
			log.Printf("story: keeping reported story %s: %v", id.Hex(), err)
		}
	}
	open, err := s.repo.CountPendingReports(ctx, id)
	if err != nil {
		log.Printf("story: counting reports on %s: %v", id.Hex(), err)
		return nil
	}
	if open >= AutoHideReports {
		hidden, err := s.repo.SetStatus(ctx, id, []string{StatusActive}, StatusHidden)
		if err != nil {
			log.Printf("story: hiding reported story %s: %v", id.Hex(), err)
		} else if hidden {
			s.moveFiles(ctx, st)
		}
	}
	return nil
}

func (s *service) Quote(ctx context.Context, viewer, id primitive.ObjectID) (*Quote, error) {
	st, err := s.live(ctx, viewer, id)
	if err != nil {
		return nil, err
	}
	if st.Status != StatusActive || !s.now().Before(st.ExpiresAt) {
		return nil, ErrNotFound
	}
	q := &Quote{ID: st.ID, OwnerID: st.OwnerID, MediaType: st.Media.Type, Caption: st.Caption, ExpiresAt: st.ExpiresAt}
	if st.Media.Type == MediaVideo {
		q.ThumbURL = st.Media.PosterURL
	} else {
		q.ThumbURL = st.Media.URL
	}
	return q, nil
}

// ─── Moderation ─────────────────────────────────────────────────────────────────

func (s *service) Queue(ctx context.Context, page, limit int) ([]ModerationItem, int64, error) {
	page = max(page, 1)
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	ids, total, err := s.repo.ReportedStoryIDs(ctx, (page-1)*limit, limit)
	if err != nil {
		return nil, 0, err
	}
	stories, err := s.repo.FindByIDs(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	owners := make([]primitive.ObjectID, 0, len(stories))
	for _, st := range stories {
		owners = append(owners, st.OwnerID)
	}
	users, err := s.users.FindUsersByIDs(ctx, owners)
	if err != nil {
		return nil, 0, err
	}
	out := make([]ModerationItem, 0, len(ids))
	for _, id := range ids {
		st := stories[id]
		if st == nil {
			continue
		}
		reps, err := s.repo.PendingReports(ctx, id)
		if err != nil {
			return nil, 0, err
		}
		item := ModerationItem{
			ID: id.Hex(), Media: st.Media, Caption: st.Caption, Status: st.Status, CreatedAt: st.CreatedAt,
			ExpiresAt: st.ExpiresAt, Views: st.Views, Reports: len(reps), Reasons: map[string]int{}, DeletedByOwner: st.DeletedByOwner,
		}
		if u := users[st.OwnerID]; u != nil {
			b := user.BylineOf(u)
			item.Owner = &b
		}
		for _, r := range reps {
			item.Reasons[r.Reason]++
			if r.Details != "" {
				item.Notes = append(item.Notes, r.Details)
			}
			if r.CreatedAt.After(item.LastReport) {
				item.LastReport = r.CreatedAt
			}
		}
		out = append(out, item)
	}
	return out, total, nil
}

func (s *service) Decide(ctx context.Context, admin, id primitive.ObjectID, action string) error {
	if action != DecisionKeep && action != DecisionRemove {
		return ErrDecision
	}
	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	now := s.now()
	if err := s.repo.ResolveReports(ctx, id, admin, action, now); err != nil {
		return err
	}
	// A story its owner deleted goes either way; keeping it only closes the reports
	if action == DecisionRemove || st.DeletedByOwner {
		if _, err := s.repo.SetStatus(ctx, id, []string{StatusActive, StatusHidden}, StatusRemoved); err != nil {
			return err
		}
		return s.remove(ctx, st, "")
	}
	// Kept: back on show if its time isn't up, and cleared as usual when it ends
	if _, err := s.repo.SetStatus(ctx, id, []string{StatusHidden}, StatusActive); err != nil {
		return err
	}
	return s.repo.SetPurgeAt(ctx, id, st.ExpiresAt)
}

// Sweep deletes up to a few hundred stories whose time is up
func (s *service) Sweep(ctx context.Context) error {
	due, err := s.repo.Due(ctx, s.now(), 200)
	if err != nil {
		return err
	}
	for i := range due {
		// Reports nobody got to within the week close as expired
		if err := s.remove(ctx, &due[i], "expired"); err != nil {
			log.Printf("story: clearing ended story %s: %v", due[i].ID.Hex(), err)
		}
	}
	// Reports that arrived as their story was being deleted
	return s.repo.CloseOrphanReports(ctx, s.now())
}
