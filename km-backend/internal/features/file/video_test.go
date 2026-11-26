package file

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"km-backend/internal/storage"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// makeVideo writes a test video with ffmpeg: seconds long, with the given extra arguments
// (codec and so on)
func makeVideo(t *testing.T, ffmpeg, to string, seconds int, args ...string) {
	t.Helper()
	full := append([]string{"-nostdin", "-hide_banner", "-loglevel", "error", "-y",
		"-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=" + strconv.Itoa(seconds),
		"-f", "lavfi", "-i", "sine=frequency=440:duration=" + strconv.Itoa(seconds)}, args...)
	full = append(full, to)
	if out, err := exec.Command(ffmpeg, full...).CombinedOutput(); err != nil {
		t.Skipf("this ffmpeg can't make the test video (%v): %s", err, out)
	}
}

// newProcessor works on the same database and storage as the uploads under test
func newProcessor(u *ChunkedUploads) *VideoProcessor {
	find := func(name string) string {
		p, _ := exec.LookPath(name)
		return p
	}
	return &VideoProcessor{recs: u.fileRecs, store: u.store, ffmpeg: find("ffmpeg"), ffprobe: find("ffprobe"), workers: 1, kick: make(chan struct{}, 1), now: time.Now}
}

func TestVideoProcessor(t *testing.T) {
	u, mediaDir := newChunked(t)
	p := newProcessor(u)
	if p.ffmpeg == "" || p.ffprobe == "" {
		t.Skip("ffmpeg/ffprobe not installed")
	}
	ctx := context.Background()
	me := primitive.NewObjectID()
	src := t.TempDir()

	// One stored upload per case, waiting to be checked
	add := func(name, kind string) (*File, string) {
		t.Helper()
		body, err := os.ReadFile(filepath.Join(src, name))
		if err != nil {
			t.Fatal(err)
		}
		key := kind + "/" + primitive.NewObjectID().Hex() + filepath.Ext(name)
		if err := u.store.Put(ctx, storage.Public, storage.Object{Key: key, Body: strings.NewReader(string(body)), Size: int64(len(body))}); err != nil {
			t.Fatal(err)
		}
		f := &File{ID: primitive.NewObjectID(), Kind: kind, Visibility: "public", Key: key, URL: u.store.PublicURL(key),
			MimeType: "video/mp4", Size: int64(len(body)), UploadedBy: me, CreatedAt: time.Now(), Video: &VideoInfo{State: VideoProcessing}}
		if _, err := u.fileRecs.InsertOne(ctx, f); err != nil {
			t.Fatal(err)
		}
		return f, filepath.Join(mediaDir, "public", filepath.FromSlash(key))
	}
	get := func(id primitive.ObjectID) File {
		var f File
		if err := u.fileRecs.FindOne(ctx, bson.M{"_id": id}).Decode(&f); err != nil {
			t.Fatal(err)
		}
		return f
	}
	exists := func(path string) bool {
		_, err := os.Stat(path)
		return err == nil
	}

	makeVideo(t, p.ffmpeg, filepath.Join(src, "plain.mp4"), 3, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest")
	makeVideo(t, p.ffmpeg, filepath.Join(src, "iphone.mov"), 3, "-c:v", "libx265", "-tag:v", "hvc1", "-c:a", "aac", "-shortest")
	makeVideo(t, p.ffmpeg, filepath.Join(src, "clip.webm"), 2, "-c:v", "libvpx-vp9", "-c:a", "libopus", "-shortest")
	makeVideo(t, p.ffmpeg, filepath.Join(src, "long.mp4"), 62, "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest")
	if err := os.WriteFile(filepath.Join(src, "fake.mp4"), mp4Bytes(4096), 0o644); err != nil {
		t.Fatal(err)
	}

	plain, plainPath := add("plain.mp4", "feed_video")
	iphone, iphonePath := add("iphone.mov", "story_video")
	webm, _ := add("clip.webm", "feed_video")
	long, longPath := add("long.mp4", "feed_video")
	fake, _ := add("fake.mp4", "feed_video")

	if err := p.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}

	// A browser-ready video is kept as it is, with its real length
	got := get(plain.ID)
	if got.Video.State != VideoReady || got.Video.Converted || got.Key != plain.Key || got.Video.Duration < 2.9 || got.Video.Duration > 3.1 ||
		got.Video.Width != 320 || got.Video.Height != 240 || !exists(plainPath) {
		t.Fatalf("plain: %+v %+v", got, got.Video)
	}
	if got.Video.Seconds() != 3 {
		t.Fatalf("plain seconds = %d", got.Video.Seconds())
	}

	// HEVC (an iPhone's) and WebM are converted to H.264 MP4 at a new address; the original goes
	for _, c := range []struct {
		name string
		f    *File
	}{{"iphone", iphone}, {"webm", webm}} {
		got := get(c.f.ID)
		if got.Video.State != VideoReady || !got.Video.Converted || got.Key == c.f.Key || !strings.HasSuffix(got.Key, ".mp4") ||
			got.MimeType != "video/mp4" || got.URL != u.store.PublicURL(got.Key) || got.Size <= 0 {
			t.Fatalf("%s: %+v %+v", c.name, got, got.Video)
		}
		info, err := p.probe(ctx, filepath.Join(mediaDir, "public", filepath.FromSlash(got.Key)))
		if err != nil || info.videoCodec != "h264" || info.audioCodec != "aac" || info.needsConverting() {
			t.Fatalf("%s converted file: %+v %v", c.name, info, err)
		}
	}
	if exists(iphonePath) {
		t.Fatal("the original HEVC upload was kept")
	}

	// Over a minute: refused and deleted, whatever the app said
	got = get(long.ID)
	if got.Video.State != VideoFailed || got.Video.ErrorCode != ErrVideoTooLong.Code || exists(longPath) {
		t.Fatalf("long: %+v", got.Video)
	}
	// Not a video at all
	if got := get(fake.ID); got.Video.State != VideoFailed || got.Video.ErrorCode != ErrVideoUnreadable.Code {
		t.Fatalf("fake: %+v", got.Video)
	}
}

func TestVideoProcessorTakesOverStaleWork(t *testing.T) {
	u, _ := newChunked(t)
	p := newProcessor(u)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Millisecond)
	p.now = func() time.Time { return now }

	held := primitive.NewObjectID()
	stale := primitive.NewObjectID()
	_, _ = u.fileRecs.InsertMany(ctx, []any{
		File{ID: held, Kind: "feed_video", CreatedAt: now, Video: &VideoInfo{State: VideoProcessing, LeaseUntil: now.Add(time.Minute)}},
		File{ID: stale, Kind: "feed_video", CreatedAt: now, Video: &VideoInfo{State: VideoProcessing, LeaseUntil: now.Add(-time.Minute)}},
	})
	f, err := p.next(ctx)
	if err != nil || f == nil || f.ID != stale || f.Video.Attempts != 1 {
		t.Fatalf("next = %+v, %v", f, err)
	}
	if f, _ := p.next(ctx); f != nil {
		t.Fatalf("took a video another run holds: %s", f.ID.Hex())
	}
}
