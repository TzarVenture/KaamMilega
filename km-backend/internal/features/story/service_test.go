package story

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/user"
	"km-backend/internal/storage"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// fakeUsers answers FindUsersByIDs from a map
type fakeUsers map[primitive.ObjectID]*user.User

func (f fakeUsers) FindUsersByIDs(_ context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	out := map[primitive.ObjectID]*user.User{}
	for _, id := range ids {
		if u, ok := f[id]; ok {
			out[id] = u
		}
	}
	return out, nil
}

// fakeStore records deleted keys; nothing else is called by this package
type fakeStore struct {
	storage.Storage
	deleted []string
	copied  []string
	down    bool // storage refuses every copy and delete
}

func (f *fakeStore) Copy(_ context.Context, _ storage.Visibility, from, to string) error {
	if f.down {
		return errors.New("storage unavailable")
	}
	f.copied = append(f.copied, from+">"+to)
	return nil
}

func (f *fakeStore) PublicURL(key string) string { return "https://cdn.test/" + key }

func (f *fakeStore) Delete(_ context.Context, _ storage.Visibility, key string) error {
	if f.down {
		return errors.New("storage unavailable")
	}
	f.deleted = append(f.deleted, key)
	return nil
}

type rig struct {
	t     *testing.T
	svc   *service
	repo  *repository
	db    *mongo.Database
	users fakeUsers
	store *fakeStore
	clock time.Time
}

func newRig(t *testing.T) *rig {
	t.Helper()
	uri := os.Getenv("WALLET_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("WALLET_TEST_MONGO_URI not set")
	}
	ctx := context.Background()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri).SetServerSelectionTimeout(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	db := client.Database("km_story_test")
	_ = db.Drop(ctx)
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: db}
	t.Cleanup(func() {
		_ = db.Drop(context.Background())
		_ = client.Disconnect(context.Background())
	})
	repo := NewRepository(mdb).(*repository)
	// The repository builds its indexes in the background; the unique ones matter here
	for _, c := range []*mongo.Collection{repo.views, repo.reports} {
		other := "viewer_id"
		if c == repo.reports {
			other = "reporter_id"
		}
		if _, err := c.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys: bson.D{{Key: "story_id", Value: 1}, {Key: other, Value: 1}}, Options: options.Index().SetUnique(true),
		}); err != nil && !strings.Contains(err.Error(), "already exists") {
			t.Fatal(err)
		}
	}
	r := &rig{t: t, repo: repo, db: db, users: fakeUsers{}, store: &fakeStore{}, clock: time.Now().UTC().Truncate(time.Millisecond)}
	r.svc = &service{repo: repo, users: r.users, store: r.store, now: func() time.Time { return r.clock }}
	return r
}

func (r *rig) member(name string, roles ...string) primitive.ObjectID {
	id := primitive.NewObjectID()
	r.users[id] = &user.User{ID: id, Name: name, Roles: roles, AccountStatus: user.AccountActive}
	return id
}

func (r *rig) insert(coll string, doc bson.M) {
	r.t.Helper()
	if _, err := r.db.Collection(coll).InsertOne(context.Background(), doc); err != nil {
		r.t.Fatal(err)
	}
}

func (r *rig) connect(a, b primitive.ObjectID) {
	r.insert("network_connections", bson.M{"sender_id": a, "receiver_id": b, "status": "accepted"})
}

func (r *rig) follow(u, company primitive.ObjectID) {
	r.insert("company_follows", bson.M{"user_id": u, "company_id": company})
}

func (r *rig) block(u, other primitive.ObjectID) {
	r.insert("user_blocks", bson.M{"user_id": u, "blocked_user_id": other})
}

// file adds an upload record of this kind and returns its id; video is the server's check of it
func (r *rig) file(owner primitive.ObjectID, kind string, video ...bson.M) string {
	id := primitive.NewObjectID()
	doc := bson.M{
		"_id": id, "uploaded_by": owner, "kind": kind, "visibility": "public",
		"url": "https://cdn.test/" + id.Hex(), "key": kind + "/" + id.Hex(),
	}
	if len(video) > 0 {
		doc["video"] = video[0]
	}
	r.insert("files", doc)
	return id.Hex()
}

// share posts a photo story as owner
func (r *rig) share(owner primitive.ObjectID) primitive.ObjectID {
	r.t.Helper()
	res, err := r.svc.Create(context.Background(), owner, CreateRequest{Media: &MediaInput{FileID: r.file(owner, "story_image")}, Caption: "hello"})
	if err != nil {
		r.t.Fatal(err)
	}
	id, _ := primitive.ObjectIDFromHex(res.ID)
	return id
}

func (r *rig) story(id primitive.ObjectID) *Story {
	r.t.Helper()
	st, err := r.repo.Get(context.Background(), id)
	if err != nil {
		r.t.Fatalf("story %s: %v", id.Hex(), err)
	}
	return st
}

// fileKey is where a file record says its file is stored
func (r *rig) fileKey(oid primitive.ObjectID) string {
	r.t.Helper()
	var f struct {
		Key string `bson:"key"`
	}
	if err := r.db.Collection("files").FindOne(context.Background(), bson.M{"_id": oid}).Decode(&f); err != nil {
		r.t.Fatalf("file %s: %v", oid.Hex(), err)
	}
	return f.Key
}

func (r *rig) gone(id primitive.ObjectID) bool {
	_, err := r.repo.Get(context.Background(), id)
	return errors.Is(err, ErrNotFound)
}

func (r *rig) count(coll string, filter bson.M) int64 {
	n, err := r.db.Collection(coll).CountDocuments(context.Background(), filter)
	if err != nil {
		r.t.Fatal(err)
	}
	return n
}

// owners lists the bar's groups by owner name
func (r *rig) bar(viewer primitive.ObjectID) []string {
	r.t.Helper()
	groups, err := r.svc.Bar(context.Background(), viewer)
	if err != nil {
		r.t.Fatal(err)
	}
	out := []string{}
	for _, g := range groups {
		out = append(out, g.Owner.Name)
	}
	return out
}

func same(a []string, b ...string) bool {
	return strings.Join(a, ",") == strings.Join(b, ",")
}

func TestStoryAudience(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	asha := r.member("Asha", user.RoleUser)
	conn := r.member("Conn", user.RoleUser)
	stranger := r.member("Stranger", user.RoleUser)
	fan := r.member("Fan", user.RoleUser)
	rec := r.member("Rec", user.RoleRecruiter)
	blocked := r.member("Blocked", user.RoleUser)

	r.connect(asha, conn)
	r.connect(blocked, asha)
	r.block(asha, blocked)
	r.follow(fan, rec)
	r.follow(fan, asha) // following a non-recruiter shows nothing
	ashaStory := r.share(asha)
	recStory := r.share(rec)

	if got := r.bar(asha); !same(got, "Asha") {
		t.Fatalf("owner's bar = %v", got)
	}
	if got := r.bar(conn); !same(got, "Asha") {
		t.Fatalf("connection's bar = %v", got)
	}
	if got := r.bar(stranger); len(got) != 0 {
		t.Fatalf("stranger's bar = %v", got)
	}
	if got := r.bar(fan); !same(got, "Rec") {
		t.Fatalf("company follower's bar = %v", got)
	}
	if got := r.bar(blocked); len(got) != 0 {
		t.Fatalf("blocked connection's bar = %v", got)
	}

	// The same rules hold when opening one story directly
	for _, c := range []struct {
		viewer primitive.ObjectID
		story  primitive.ObjectID
		ok     bool
	}{
		{conn, ashaStory, true}, {stranger, ashaStory, false}, {fan, ashaStory, false},
		{blocked, ashaStory, false}, {fan, recStory, true}, {conn, recStory, false},
	} {
		err := r.svc.View(ctx, c.viewer, c.story)
		if c.ok != (err == nil) {
			t.Fatalf("%s viewing %s's story: %v", r.users[c.viewer].Name, r.users[r.story(c.story).OwnerID].Name, err)
		}
	}

	// A suspended owner's stories disappear
	r.users[asha].AccountStatus = user.AccountSuspended
	if got := r.bar(conn); len(got) != 0 {
		t.Fatalf("suspended owner still shown: %v", got)
	}
	if err := r.svc.View(ctx, conn, ashaStory); !errors.Is(err, ErrNotFound) {
		t.Fatalf("view of suspended owner's story = %v", err)
	}

	// An ended story is gone from the bar and can't be opened
	r.clock = r.clock.Add(Lifetime)
	if got := r.bar(fan); len(got) != 0 {
		t.Fatalf("ended story still shown: %v", got)
	}
	if err := r.svc.View(ctx, fan, recStory); !errors.Is(err, ErrNotFound) {
		t.Fatalf("view of ended story = %v", err)
	}
}

func TestStoryBarOrder(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	me := r.member("Me")
	names := []string{"X", "Y", "Z"}
	ids := map[string]primitive.ObjectID{}
	stories := map[string]primitive.ObjectID{}
	for _, n := range names {
		ids[n] = r.member(n)
		r.connect(me, ids[n])
		r.clock = r.clock.Add(time.Minute)
		stories[n] = r.share(ids[n])
	}
	r.clock = r.clock.Add(time.Minute)
	r.share(me)

	// Own first, then unseen newest first
	if got := r.bar(me); !same(got, "Me", "Z", "Y", "X") {
		t.Fatalf("bar = %v", got)
	}
	// Seen ones drop to the end
	if err := r.svc.View(ctx, me, stories["Z"]); err != nil {
		t.Fatal(err)
	}
	groups, err := r.svc.Bar(ctx, me)
	if err != nil {
		t.Fatal(err)
	}
	if got := r.bar(me); !same(got, "Me", "Y", "X", "Z") {
		t.Fatalf("bar after viewing Z = %v", got)
	}
	last := groups[len(groups)-1]
	if !last.AllSeen || !last.Stories[0].Seen || last.Stories[0].Views != nil {
		t.Fatalf("Z's group = %+v", last)
	}
	if own := groups[0]; !own.IsOwn || own.Stories[0].Views == nil {
		t.Fatalf("own group = %+v", own)
	}
}

func TestStoryViews(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	owner, a, b := r.member("Owner"), r.member("A"), r.member("B")
	r.connect(owner, a)
	r.connect(b, owner)
	id := r.share(owner)

	for _, v := range []primitive.ObjectID{a, a, owner, b} {
		r.clock = r.clock.Add(time.Second)
		if err := r.svc.View(ctx, v, id); err != nil {
			t.Fatal(err)
		}
	}
	if got := r.story(id).Views; got != 2 {
		t.Fatalf("views = %d, want 2 (repeat and own views don't count)", got)
	}
	list, err := r.svc.Viewers(ctx, owner, id)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].Viewer.Name != "B" || list[1].Viewer.Name != "A" {
		t.Fatalf("viewers = %+v", list)
	}
	if _, err := r.svc.Viewers(ctx, a, id); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("someone else's viewers = %v", err)
	}
	// Blocked later: dropped from the list
	r.block(owner, b)
	if list, _ := r.svc.Viewers(ctx, owner, id); len(list) != 1 {
		t.Fatalf("viewers after block = %+v", list)
	}
}

func TestStoryCreateRules(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	me, other := r.member("Me"), r.member("Other")
	create := func(in MediaInput, caption string) error {
		_, err := r.svc.Create(ctx, me, CreateRequest{Media: &in, Caption: caption})
		return err
	}
	video := func() string {
		return r.file(me, "story_video", bson.M{"state": "ready", "duration": 29.7, "width": 1080, "height": 1920})
	}

	refused := []struct {
		name    string
		in      MediaInput
		caption string
		want    error
	}{
		{"no media", MediaInput{}, "", ErrMediaMissing},
		{"long caption", MediaInput{FileID: r.file(me, "story_image")}, strings.Repeat("a", MaxCaption+1), ErrCaptionTooLong},
		{"someone else's photo", MediaInput{FileID: r.file(other, "story_image")}, "", ErrInvalidMedia},
		{"a feed photo", MediaInput{FileID: r.file(me, "feed_image")}, "", ErrInvalidMedia},
		{"video still being checked", MediaInput{FileID: r.file(me, "story_video", bson.M{"state": "processing"})}, "", ErrVideoNotReady},
		{"video never checked", MediaInput{FileID: r.file(me, "story_video")}, "", ErrVideoNotReady},
		{"video refused by the check", MediaInput{FileID: r.file(me, "story_video", bson.M{"state": "failed"})}, "", ErrInvalidMedia},
		{"poster on a photo", MediaInput{FileID: r.file(me, "story_image"), PosterFileID: r.file(me, "story_image")}, "", ErrInvalidMedia},
	}
	for _, c := range refused {
		if err := create(c.in, c.caption); !errors.Is(err, c.want) {
			t.Fatalf("%s: got %v, want %v", c.name, err, c.want)
		}
	}
	if n := r.count(StoriesCollection, bson.M{}); n != 0 {
		t.Fatalf("%d stories saved from refused requests", n)
	}

	// A video with its poster
	vid, poster := video(), r.file(me, "story_image")
	res, err := r.svc.Create(ctx, me, CreateRequest{Media: &MediaInput{FileID: vid, PosterFileID: poster, Duration: 5}, Caption: "  two\nlines  "})
	if err != nil {
		t.Fatal(err)
	}
	// Length and size come from the server's check, not the app (which said 5s)
	if res.Media.Type != MediaVideo || res.Media.PosterURL == "" || res.Caption != "two lines" ||
		res.Media.Duration != 30 || res.Media.Width != 1080 || res.Media.Height != 1920 {
		t.Fatalf("video story = %+v", res)
	}
	// Its files can't be used again
	if err := create(MediaInput{FileID: vid, Duration: 30}, ""); !errors.Is(err, ErrInvalidMedia) {
		t.Fatalf("reused video = %v", err)
	}
	if n := r.count("files", bson.M{"module_name": "story", "record_id": res.ID}); n != 2 {
		t.Fatalf("%d files tied to the story, want 2", n)
	}

	// Ten a day
	for i := 1; i < MaxPerDay; i++ {
		r.share(me)
	}
	if err := create(MediaInput{FileID: r.file(me, "story_image")}, ""); !errors.Is(err, ErrDailyLimit) {
		t.Fatalf("11th story = %v", err)
	}
	r.clock = r.clock.Add(24*time.Hour + time.Second)
	if err := create(MediaInput{FileID: r.file(me, "story_image")}, ""); err != nil {
		t.Fatalf("next day: %v", err)
	}
}

func TestStoryReportsAndModeration(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	owner := r.member("Owner")
	reporters := []primitive.ObjectID{r.member("R1"), r.member("R2"), r.member("R3"), r.member("R4")}
	admin := r.member("Admin")
	for _, rp := range reporters {
		r.connect(owner, rp)
	}
	id := r.share(owner)
	expires := r.story(id).ExpiresAt
	report := func(who primitive.ObjectID, reason string) error {
		return r.svc.Report(ctx, who, id, ReportRequest{Reason: reason, Details: "note from " + r.users[who].Name})
	}

	if err := report(owner, "spam"); !errors.Is(err, ErrReportOwn) {
		t.Fatalf("own report = %v", err)
	}
	if err := report(reporters[0], "nonsense"); !errors.Is(err, ErrReportReason) {
		t.Fatalf("bad reason = %v", err)
	}
	if err := report(r.member("Stranger"), "spam"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("stranger's report = %v", err)
	}
	// Two reports, one sent twice: still showing, kept a week past its end
	for _, rp := range []primitive.ObjectID{reporters[0], reporters[0], reporters[1]} {
		if err := report(rp, "spam"); err != nil {
			t.Fatal(err)
		}
	}
	st := r.story(id)
	if st.Status != StatusActive || !st.PurgeAt.Equal(expires.Add(KeepReported)) {
		t.Fatalf("after two reports: status %s, purge %v", st.Status, st.PurgeAt)
	}
	// The third hides it, and moves its photo to a new address: the old link stops working
	before := r.story(id).Media.URL
	oldKey := r.fileKey(r.story(id).Media.FileID)
	if err := report(reporters[2], "harassment"); err != nil {
		t.Fatal(err)
	}
	hidden := r.story(id)
	if hidden.Status != StatusHidden {
		t.Fatalf("after three reports: %s", hidden.Status)
	}
	newKey := r.fileKey(hidden.Media.FileID)
	if hidden.Media.URL == before || newKey == oldKey || hidden.Media.URL != r.store.PublicURL(newKey) ||
		len(r.store.copied) != 1 || len(r.store.deleted) != 1 || r.store.deleted[0] != oldKey {
		t.Fatalf("hidden story's file: url %s -> %s, key %s -> %s, copied %v, deleted %v", before, hidden.Media.URL, oldKey, newKey, r.store.copied, r.store.deleted)
	}
	if got := r.bar(reporters[3]); len(got) != 0 {
		t.Fatalf("hidden story still in bar: %v", got)
	}
	if items, _, _ := r.svc.Queue(ctx, 1, 20); len(items) != 1 || items[0].Media.URL != hidden.Media.URL {
		t.Fatalf("moderator sees %+v, want the new address", items)
	}

	items, total, err := r.svc.Queue(ctx, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 || len(items) != 1 || items[0].Reports != 3 || items[0].Reasons["spam"] != 2 || len(items[0].Notes) != 3 {
		t.Fatalf("queue = %d %+v", total, items)
	}
	if err := r.svc.Decide(ctx, admin, id, "maybe"); !errors.Is(err, ErrDecision) {
		t.Fatalf("bad decision = %v", err)
	}

	// Kept: back on show, cleared as usual when it ends
	if err := r.svc.Decide(ctx, admin, id, DecisionKeep); err != nil {
		t.Fatal(err)
	}
	st = r.story(id)
	if st.Status != StatusActive || !st.PurgeAt.Equal(expires) {
		t.Fatalf("kept: status %s, purge %v", st.Status, st.PurgeAt)
	}
	if _, total, _ := r.svc.Queue(ctx, 1, 20); total != 0 {
		t.Fatalf("queue after decision has %d", total)
	}

	// Reported again and removed: gone, files and all
	if err := report(reporters[3], "inappropriate"); err != nil {
		t.Fatal(err)
	}
	if err := r.svc.Decide(ctx, admin, id, DecisionRemove); err != nil {
		t.Fatal(err)
	}
	// The moved copy is deleted too, and it wasn't moved a second time
	if !r.gone(id) || len(r.store.deleted) != 2 || r.store.deleted[1] != newKey || len(r.store.copied) != 1 ||
		r.count("files", bson.M{"record_id": id.Hex()}) != 0 {
		t.Fatalf("removed story: gone %v, deleted %v, copied %v", r.gone(id), r.store.deleted, r.store.copied)
	}
	if n := r.count(ReportsCollection, bson.M{"story_id": id, "status": ReportPending}); n != 0 {
		t.Fatalf("%d reports left open", n)
	}
	if n := r.count(ReportsCollection, bson.M{"story_id": id, "decision": DecisionRemove, "resolved_by": admin}); n != 1 {
		t.Fatalf("%d reports closed as removed", n)
	}
}

func TestStoryOwnerDeletes(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	owner, friend, admin := r.member("Owner"), r.member("Friend"), r.member("Admin")
	r.connect(owner, friend)

	// Not reported: deleted at once
	plain := r.share(owner)
	if err := r.svc.Delete(ctx, friend, plain); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("someone else deleting = %v", err)
	}
	if err := r.svc.View(ctx, friend, plain); err != nil {
		t.Fatal(err)
	}
	if err := r.svc.Delete(ctx, owner, plain); err != nil {
		t.Fatal(err)
	}
	if !r.gone(plain) || len(r.store.deleted) != 1 || r.count(ViewsCollection, bson.M{"story_id": plain}) != 0 {
		t.Fatalf("plain delete: gone %v, deleted %v", r.gone(plain), r.store.deleted)
	}

	// Reported: hidden for the moderator, and a "keep" doesn't bring it back
	reported := r.share(owner)
	if err := r.svc.Report(ctx, friend, reported, ReportRequest{Reason: "spam"}); err != nil {
		t.Fatal(err)
	}
	if err := r.svc.Delete(ctx, owner, reported); err != nil {
		t.Fatal(err)
	}
	if st := r.story(reported); st.Status != StatusHidden || !st.DeletedByOwner {
		t.Fatalf("reported delete: %+v", st)
	}
	// Its photo moved to a new address, so a saved link to the old one stops working
	if len(r.store.copied) != 1 || len(r.store.deleted) != 2 {
		t.Fatalf("hidden on delete: copied %v, deleted %v", r.store.copied, r.store.deleted)
	}
	if got := r.bar(owner); len(got) != 0 {
		t.Fatalf("owner still sees deleted story: %v", got)
	}
	if err := r.svc.Decide(ctx, admin, reported, DecisionKeep); err != nil {
		t.Fatal(err)
	}
	if !r.gone(reported) || len(r.store.deleted) != 3 {
		t.Fatalf("kept after owner deleted: gone %v, deleted %v", r.gone(reported), r.store.deleted)
	}
}

func TestStorySweep(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	owner, friend := r.member("Owner"), r.member("Friend")
	r.connect(owner, friend)
	plain := r.share(owner)
	reported := r.share(owner)
	if err := r.svc.View(ctx, friend, plain); err != nil {
		t.Fatal(err)
	}
	if err := r.svc.Report(ctx, friend, reported, ReportRequest{Reason: "spam"}); err != nil {
		t.Fatal(err)
	}

	// Still showing: nothing to do
	if err := r.svc.Sweep(ctx); err != nil || r.gone(plain) {
		t.Fatalf("early sweep: %v, plain gone %v", err, r.gone(plain))
	}
	// Ended: the plain one goes with its views and file; the reported one waits
	r.clock = r.clock.Add(Lifetime)
	if err := r.svc.Sweep(ctx); err != nil {
		t.Fatal(err)
	}
	if !r.gone(plain) || r.gone(reported) || len(r.store.deleted) != 1 || r.count(ViewsCollection, bson.M{}) != 0 {
		t.Fatalf("after end: plain gone %v, reported gone %v, deleted %v", r.gone(plain), r.gone(reported), r.store.deleted)
	}
	// A week on, nobody decided: it goes and the report closes as expired
	r.clock = r.clock.Add(KeepReported)
	if err := r.svc.Sweep(ctx); err != nil {
		t.Fatal(err)
	}
	if !r.gone(reported) || len(r.store.deleted) != 2 {
		t.Fatalf("after a week: gone %v, deleted %v", r.gone(reported), r.store.deleted)
	}
	if n := r.count(ReportsCollection, bson.M{"story_id": reported, "status": ReportResolved, "decision": "expired"}); n != 1 {
		t.Fatalf("%d reports closed as expired", n)
	}
}

func TestStoryQuote(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	owner, friend, stranger := r.member("Owner"), r.member("Friend"), r.member("Stranger")
	r.connect(owner, friend)
	id := r.share(owner)

	q, err := r.svc.Quote(ctx, friend, id)
	if err != nil {
		t.Fatal(err)
	}
	if q.ID != id || q.OwnerID != owner || q.MediaType != MediaImage || q.ThumbURL == "" || q.Caption != "hello" {
		t.Fatalf("quote = %+v", q)
	}
	if _, err := r.svc.Quote(ctx, stranger, id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("stranger's quote = %v", err)
	}
	r.clock = r.clock.Add(Lifetime)
	if _, err := r.svc.Quote(ctx, friend, id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("quote of ended story = %v", err)
	}
}

func TestStoryDeleteAndRepostStillCounts(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	me := r.member("Me")
	for i := 0; i < MaxPerDay; i++ {
		id := r.share(me)
		if err := r.svc.Delete(ctx, me, id); err != nil {
			t.Fatal(err)
		}
	}
	_, err := r.svc.Create(ctx, me, CreateRequest{Media: &MediaInput{FileID: r.file(me, "story_image")}})
	if !errors.Is(err, ErrDailyLimit) {
		t.Fatalf("11th story after deleting 10 = %v", err)
	}
}

func TestStoryStorageFailureRetries(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	me := r.member("Me")
	id := r.share(me)

	// Storage down: the delete still succeeds for the owner, the story is taken down and due
	r.store.down = true
	if err := r.svc.Delete(ctx, me, id); err != nil {
		t.Fatal(err)
	}
	st := r.story(id)
	if st.Status != StatusRemoved || st.PurgeAt.After(r.clock) {
		t.Fatalf("after failed delete: %+v", st)
	}
	if r.count("files", bson.M{"record_id": id.Hex()}) != 1 {
		t.Fatal("file record lost while its file is still stored")
	}
	if got := r.bar(me); len(got) != 0 {
		t.Fatalf("taken-down story still shown: %v", got)
	}
	// Storage back: the sweeper finishes the job
	r.store.down = false
	if err := r.svc.Sweep(ctx); err != nil {
		t.Fatal(err)
	}
	if !r.gone(id) || len(r.store.deleted) != 1 || r.count("files", bson.M{"record_id": id.Hex()}) != 0 {
		t.Fatalf("after retry: gone %v, deleted %v", r.gone(id), r.store.deleted)
	}
}

func TestStoryOrphanReportsClose(t *testing.T) {
	r := newRig(t)
	ctx := context.Background()
	gone := primitive.NewObjectID()
	r.insert(ReportsCollection, bson.M{"story_id": gone, "reporter_id": primitive.NewObjectID(), "status": ReportPending, "reason": "spam", "created_at": r.clock})
	if err := r.svc.Sweep(ctx); err != nil {
		t.Fatal(err)
	}
	if n := r.count(ReportsCollection, bson.M{"status": ReportPending}); n != 0 {
		t.Fatalf("%d orphan reports still open", n)
	}
	if _, total, _ := r.svc.Queue(ctx, 1, 20); total != 0 {
		t.Fatalf("queue total %d", total)
	}
}
