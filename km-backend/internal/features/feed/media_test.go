package feed

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func newMediaRepo(t *testing.T) *feedRepository {
	t.Helper()
	uri := os.Getenv("WALLET_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("WALLET_TEST_MONGO_URI not set")
	}
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri).SetServerSelectionTimeout(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("km_feed_media_test")}
	t.Cleanup(func() {
		_ = mdb.DB.Drop(context.Background())
		_ = client.Disconnect(context.Background())
	})
	return NewFeedRepository(mdb).(*feedRepository)
}

func addFile(t *testing.T, r *feedRepository, owner primitive.ObjectID, kind string, video ...bson.M) string {
	t.Helper()
	id := primitive.NewObjectID()
	doc := bson.M{"_id": id, "uploaded_by": owner, "kind": kind, "visibility": "public", "url": "https://cdn.test/" + id.Hex()}
	if len(video) > 0 {
		doc["video"] = video[0]
	}
	_, err := r.files.InsertOne(context.Background(), doc)
	if err != nil {
		t.Fatal(err)
	}
	return id.Hex()
}

func TestClaimMediaVideo(t *testing.T) {
	r := newMediaRepo(t)
	ctx := context.Background()
	me, other := primitive.NewObjectID(), primitive.NewObjectID()
	// Checked by the server: 41.6 seconds, upright
	video := addFile(t, r, me, "feed_video", bson.M{"state": "ready", "duration": 41.6, "width": 720, "height": 1280})
	waiting := addFile(t, r, me, "feed_video", bson.M{"state": "processing"})
	refusedVideo := addFile(t, r, me, "feed_video", bson.M{"state": "failed", "error_code": "VIDEO_TOO_LONG"})
	unchecked := addFile(t, r, me, "feed_video")
	poster := addFile(t, r, me, "feed_image")
	photo := addFile(t, r, me, "feed_image")
	theirs := addFile(t, r, other, "feed_image")
	post := primitive.NewObjectID()

	refused := []struct {
		name string
		in   []MediaInput
		want error
	}{
		{"video with a photo", []MediaInput{{FileID: video}, {FileID: photo}}, ErrVideoWithPhotos},
		{"photo then video", []MediaInput{{FileID: photo}, {FileID: video}}, ErrVideoWithPhotos},
		{"still being checked", []MediaInput{{FileID: waiting, Duration: 10}}, ErrVideoNotReady},
		{"never checked", []MediaInput{{FileID: unchecked, Duration: 10}}, ErrVideoNotReady},
		{"refused by the check", []MediaInput{{FileID: refusedVideo, Duration: 10}}, ErrInvalidMedia},
		{"someone else's poster", []MediaInput{{FileID: video, PosterFileID: theirs, Duration: 10}}, ErrInvalidMedia},
		{"a video as the poster", []MediaInput{{FileID: video, PosterFileID: video, Duration: 10}}, ErrInvalidMedia},
		{"a poster on a photo", []MediaInput{{FileID: photo, PosterFileID: poster}}, ErrInvalidMedia},
	}
	for _, c := range refused {
		if _, err := r.ClaimMedia(ctx, me, post, c.in); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, err, c.want)
		}
	}

	// The app's own length and size are ignored
	got, err := r.ClaimMedia(ctx, me, post, []MediaInput{{FileID: video, PosterFileID: poster, Duration: 5, Width: 9999, Height: 1}})
	if err != nil {
		t.Fatal(err)
	}
	m := got[0]
	if len(got) != 1 || m.Type != MediaVideo || m.Duration != 42 || m.PosterURL == "" || m.PosterFileID.Hex() != poster || m.Width != 720 || m.Height != 1280 {
		t.Fatalf("media = %+v", got)
	}
	if ids := fileIDs(got); len(ids) != 2 {
		t.Fatalf("file ids = %v, want the video and its poster", ids)
	}
	// Both files now belong to the post, so another post can't take them
	for _, id := range []string{video, poster} {
		oid, _ := primitive.ObjectIDFromHex(id)
		var f struct {
			RecordID string `bson:"record_id"`
		}
		_ = r.files.FindOne(ctx, bson.M{"_id": oid}).Decode(&f)
		if f.RecordID != post.Hex() {
			t.Fatalf("file %s record_id = %q", id, f.RecordID)
		}
	}
	if _, err := r.ClaimMedia(ctx, me, primitive.NewObjectID(), []MediaInput{{FileID: poster}}); !errors.Is(err, ErrInvalidMedia) {
		t.Fatalf("poster reused on another post: %v", err)
	}
	// The same video again on its own post is fine (a retry of the same post)
	if _, err := r.ClaimMedia(ctx, me, post, []MediaInput{{FileID: video, PosterFileID: poster, Duration: 42}}); err != nil {
		t.Fatalf("retry on the same post: %v", err)
	}

	// Photos still work and are typed
	photos, err := r.ClaimMedia(ctx, me, primitive.NewObjectID(), []MediaInput{{FileID: photo}})
	if err != nil || photos[0].Type != MediaImage {
		t.Fatalf("photo: %+v %v", photos, err)
	}
}

func TestMediaOutTypesOldPosts(t *testing.T) {
	out := mediaOut([]Media{{URL: "a"}, {URL: "b", Type: MediaVideo}})
	if out[0].Type != MediaImage || out[1].Type != MediaVideo {
		t.Fatalf("out = %+v", out)
	}
	if got := mediaOut(nil); got == nil || len(got) != 0 {
		t.Fatalf("nil media = %#v, want an empty list", got)
	}
}
