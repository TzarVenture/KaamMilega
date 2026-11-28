package file

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/storage"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// newChunked runs against a throwaway Mongo database and the local disk driver in a temp folder
func newChunked(t *testing.T) (*ChunkedUploads, string) {
	t.Helper()
	uri := os.Getenv("WALLET_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("WALLET_TEST_MONGO_URI not set")
	}
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri).SetServerSelectionTimeout(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("km_file_chunked_test")}
	t.Cleanup(func() {
		_ = mdb.DB.Drop(context.Background())
		_ = client.Disconnect(context.Background())
	})
	dir := t.TempDir()
	store, err := storage.New(&config.Config{FSPath: filepath.Join(dir, "uploads"), Host: "http://test"})
	if err != nil {
		t.Fatal(err)
	}
	return NewChunkedUploads(mdb, store, NewFileService(NewFileRepository(mdb))), filepath.Join(dir, "media")
}

// mp4Bytes is a file of n bytes that starts like an MP4
func mp4Bytes(n int) []byte {
	b := bytes.Repeat([]byte{7}, n)
	copy(b, []byte{0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'})
	return b
}

func start(t *testing.T, u *ChunkedUploads, user primitive.ObjectID, name string, size int64) string {
	t.Helper()
	res, err := u.Start(context.Background(), user, false, StartUploadRequest{Kind: "feed_video", Filename: name, Size: size})
	if err != nil {
		t.Fatal(err)
	}
	if res.PartSize != PartSize || res.Parts != partsFor(size) {
		t.Fatalf("start = %+v", res)
	}
	return res.ID
}

func TestChunkedUploadWhole(t *testing.T) {
	u, media := newChunked(t)
	ctx := context.Background()
	user := primitive.NewObjectID()
	data := mp4Bytes(PartSize + 1234)
	id := start(t, u, user, "clip.MOV", int64(len(data)))

	// Out of order, a short middle part and another member are all refused
	if err := u.PutPart(ctx, user, id, 2, data[PartSize:]); !errors.Is(err, errPartOrder) {
		t.Fatalf("part 2 first: %v", err)
	}
	if err := u.PutPart(ctx, user, id, 1, data[:PartSize-1]); !errors.Is(err, errPartSize) {
		t.Fatalf("short first part: %v", err)
	}
	if err := u.PutPart(ctx, primitive.NewObjectID(), id, 1, data[:PartSize]); !errors.Is(err, errUploadNotFound) {
		t.Fatalf("someone else's upload: %v", err)
	}
	if err := u.PutPart(ctx, user, id, 1, data[:PartSize]); err != nil {
		t.Fatal(err)
	}
	if _, err := u.Complete(ctx, user, id); !errors.Is(err, errUploadShort) {
		t.Fatalf("complete early: %v", err)
	}
	// More than was declared
	if err := u.PutPart(ctx, user, id, 2, append(data[PartSize:], 1)); !errors.Is(err, errPartSize) {
		t.Fatalf("too long: %v", err)
	}
	if err := u.PutPart(ctx, user, id, 2, data[PartSize:]); err != nil {
		t.Fatal(err)
	}
	f, err := u.Complete(ctx, user, id)
	if err != nil {
		t.Fatal(err)
	}
	if f.Kind != "feed_video" || f.MimeType != "video/mp4" || f.Size != int64(len(data)) || f.UploadedBy != user || f.URL == "" {
		t.Fatalf("file = %+v", f)
	}
	got, err := os.ReadFile(filepath.Join(media, "public", filepath.FromSlash(f.Key)))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, data) {
		t.Fatal("the joined file differs from what was sent")
	}
	if n, _ := u.coll.CountDocuments(ctx, bson.M{}); n != 0 {
		t.Fatalf("%d uploads left after completing", n)
	}
	if _, err := os.Stat(filepath.Join(media, "uploads-in-progress")); err == nil {
		entries, _ := os.ReadDir(filepath.Join(media, "uploads-in-progress"))
		if len(entries) != 0 {
			t.Fatal("parts left on disk")
		}
	}
}

func TestChunkedUploadRefusals(t *testing.T) {
	u, _ := newChunked(t)
	ctx := context.Background()
	user := primitive.NewObjectID()
	cases := []struct {
		req  StartUploadRequest
		want error
	}{
		{StartUploadRequest{Kind: "feed_image", Filename: "a.jpg", Size: 10}, errChunkedKind},
		{StartUploadRequest{Kind: "", Filename: "a.mp4", Size: 10}, errUnknownKind},
		{StartUploadRequest{Kind: "feed_video", Filename: "a.avi", Size: 10}, errKindFileType},
		{StartUploadRequest{Kind: "feed_video", Filename: "a.mp4", Size: 0}, errFileEmpty},
		{StartUploadRequest{Kind: "feed_video", Filename: "a.mp4", Size: 50<<20 + 1}, errKindTooLarge},
	}
	for _, c := range cases {
		if _, err := u.Start(ctx, user, false, c.req); !errors.Is(err, c.want) {
			t.Errorf("%+v: got %v, want %v", c.req, err, c.want)
		}
	}

	// A file that isn't a video ends the upload at its first part
	id := start(t, u, user, "a.mp4", 100)
	if err := u.PutPart(ctx, user, id, 1, bytes.Repeat([]byte("<html>"), 20)[:100]); !errors.Is(err, errFileMismatch) {
		t.Fatalf("not a video: %v", err)
	}
	if err := u.PutPart(ctx, user, id, 1, mp4Bytes(100)); !errors.Is(err, errUploadNotFound) {
		t.Fatalf("after mismatch: %v", err)
	}

	// A WebM must start with its EBML header
	webm := append([]byte{0x1A, 0x45, 0xDF, 0xA3}, make([]byte, 60)...)
	id = start(t, u, user, "b.webm", int64(len(webm)))
	if err := u.PutPart(ctx, user, id, 1, webm); err != nil {
		t.Fatal(err)
	}
	if err := u.Cancel(ctx, user, id); err != nil {
		t.Fatal(err)
	}

	// No more than three open at once
	for i := 0; i < maxOpenUploads; i++ {
		start(t, u, user, "c.mp4", 100)
	}
	if _, err := u.Start(ctx, user, false, StartUploadRequest{Kind: "feed_video", Filename: "d.mp4", Size: 100}); !errors.Is(err, errTooManyUploads) {
		t.Fatalf("fourth upload: %v", err)
	}
}

func TestChunkedUploadBusyAndExpiry(t *testing.T) {
	u, _ := newChunked(t)
	ctx := context.Background()
	user := primitive.NewObjectID()
	id := start(t, u, user, "a.mp4", 100)
	oid, _ := primitive.ObjectIDFromHex(id)

	// A part already being stored holds the upload until it ends or times out
	if _, err := u.claim(ctx, user, oid); err != nil {
		t.Fatal(err)
	}
	if err := u.PutPart(ctx, user, id, 1, mp4Bytes(100)); !errors.Is(err, errUploadBusy) {
		t.Fatalf("while busy: %v", err)
	}
	later := time.Now().Add(partTimeout + time.Second)
	u.now = func() time.Time { return later }
	if err := u.PutPart(ctx, user, id, 1, mp4Bytes(100)); err != nil {
		t.Fatalf("after the part timed out: %v", err)
	}

	// An upload never finished is cleared once it expires
	u.now = func() time.Time { return later.Add(uploadTTL) }
	if err := u.ClearExpired(ctx); err != nil {
		t.Fatal(err)
	}
	if n, _ := u.coll.CountDocuments(ctx, bson.M{}); n != 0 {
		t.Fatalf("%d uploads left after expiry", n)
	}
}

func TestChunkedUploadLimitsAndCleanup(t *testing.T) {
	u, media := newChunked(t)
	ctx := context.Background()
	user := primitive.NewObjectID()

	// An ISO file that isn't a video brand is refused
	fake := mp4Bytes(100)
	copy(fake[8:12], "abcd")
	id := start(t, u, user, "a.mp4", 100)
	if err := u.PutPart(ctx, user, id, 1, fake); !errors.Is(err, errFileMismatch) {
		t.Fatalf("unknown brand: %v", err)
	}
	// An iPhone .mov is taken
	mov := mp4Bytes(100)
	copy(mov[8:12], "qt  ")
	id = start(t, u, user, "b.mov", 100)
	if err := u.PutPart(ctx, user, id, 1, mov); err != nil {
		t.Fatal(err)
	}
	f, err := u.Complete(ctx, user, id)
	if err != nil {
		t.Fatal(err)
	}

	// A finished video on no post is deleted after a day; one on a post stays
	onPost := primitive.NewObjectID()
	_, _ = u.fileRecs.InsertOne(ctx, bson.M{"_id": onPost, "kind": "feed_video", "record_id": "post1", "created_at": time.Now().Add(-48 * time.Hour)})
	u.now = func() time.Time { return time.Now().Add(unpostedTTL + time.Minute) }
	if err := u.ClearExpired(ctx); err != nil {
		t.Fatal(err)
	}
	if n, _ := u.fileRecs.CountDocuments(ctx, bson.M{"_id": f.ID}); n != 0 {
		t.Fatal("unposted video record kept")
	}
	if _, err := os.Stat(filepath.Join(media, "public", filepath.FromSlash(f.Key))); !os.IsNotExist(err) {
		t.Fatalf("unposted video file kept: %v", err)
	}
	if n, _ := u.fileRecs.CountDocuments(ctx, bson.M{"_id": onPost}); n != 1 {
		t.Fatal("a video on a post was deleted")
	}
	u.now = time.Now

	// No more than maxVideosPerDay finished videos a day
	docs := make([]interface{}, maxVideosPerDay)
	for i := range docs {
		docs[i] = bson.M{"_id": primitive.NewObjectID(), "uploaded_by": user, "kind": "feed_video", "created_at": time.Now()}
	}
	if _, err := u.fileRecs.InsertMany(ctx, docs); err != nil {
		t.Fatal(err)
	}
	if _, err := u.Start(ctx, user, false, StartUploadRequest{Kind: "feed_video", Filename: "c.mp4", Size: 100}); !errors.Is(err, errDailyVideos) {
		t.Fatalf("over the daily limit: %v", err)
	}
}
