package file

// Videos are checked on the server once they are uploaded, before they can go on a post or a
// story. ffprobe reads the real length and format (the app's own figures are never trusted):
// anything over a minute or that can't be read is refused, and anything not every browser can
// play (an iPhone's HEVC video, a WebM, 10-bit colour) is converted to H.264 MP4 with ffmpeg.
//
//	upload complete  -> video.state "processing"   (the app polls GET /api/files/videos/:id)
//	checked          -> "ready", with the real duration (and a new url if it was converted)
//	refused / failed -> "failed", with error_code; the stored file is deleted
//
// Work is picked up from the database with a lease, so videos left mid-way by a restart are
// finished by the next run.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/fx"
)

const (
	VideoProcessing = "processing"
	VideoReady      = "ready"
	VideoFailed     = "failed"

	// MaxVideoSeconds is the longest video on a post or story; half a second over is let through
	// for the way phones round
	MaxVideoSeconds = 60
	// videoLease is how long one run may work on a video before another may take it over
	videoLease = 15 * time.Minute
	// videoAttempts: a video that stopped the server this many times is given up on
	videoAttempts = 3
	// longestSide of a converted video, in pixels (720p)
	longestSide = 1280
)

var (
	ErrVideoTooLong     = apperr.New("VIDEO_TOO_LONG", "Videos can be up to 60 seconds long. Please trim it and try again.")
	ErrVideoUnreadable  = apperr.New("VIDEO_UNREADABLE", "This video couldn't be read. Please try another one.")
	ErrVideoFailed      = apperr.New("VIDEO_PROCESSING_FAILED", "This video couldn't be prepared. Please try another one.")
	ErrVideoUnavailable = apperr.New("VIDEO_PROCESSING_UNAVAILABLE", "Videos can't be prepared right now. Please try again later.")
)

// VideoInfo is what the server found out about an uploaded video
type VideoInfo struct {
	State    string  `json:"state" bson:"state"`
	Duration float64 `json:"duration,omitempty" bson:"duration,omitempty"`
	Width    int     `json:"width,omitempty" bson:"width,omitempty"`
	Height   int     `json:"height,omitempty" bson:"height,omitempty"`
	// Converted: the upload was turned into H.264 MP4
	Converted  bool      `json:"-" bson:"converted,omitempty"`
	ErrorCode  string    `json:"error_code,omitempty" bson:"error_code,omitempty"`
	Error      string    `json:"error,omitempty" bson:"error,omitempty"`
	LeaseUntil time.Time `json:"-" bson:"lease_until,omitempty"`
	Attempts   int       `json:"-" bson:"attempts,omitempty"`
}

// Seconds is the length to show and store on a post or story: whole seconds, 1 to 60
func (v *VideoInfo) Seconds() int {
	s := int(math.Ceil(v.Duration - 0.5))
	return max(1, min(MaxVideoSeconds, s))
}

// VideoProcessor checks and converts uploaded videos in the background
type VideoProcessor struct {
	recs    *mongo.Collection
	store   storage.Storage
	ffmpeg  string
	ffprobe string
	workers int
	kick    chan struct{}
	now     func() time.Time
}

func NewVideoProcessor(db *database.MongodbDB, store storage.Storage, cfg *config.Config) *VideoProcessor {
	find := func(setting, name string) string {
		if setting == "" {
			setting = name
		}
		p, err := exec.LookPath(setting)
		if err != nil {
			log.Printf("[videos] WARNING: %s not found (%v). Uploaded videos can't be checked, so every video upload will fail until it is installed.", name, err)
			return ""
		}
		return p
	}
	workers := max(1, cfg.VideoWorkers)
	return &VideoProcessor{
		recs:    db.DB.Collection("files"),
		store:   store,
		ffmpeg:  find(cfg.FFmpegPath, "ffmpeg"),
		ffprobe: find(cfg.FFprobePath, "ffprobe"),
		workers: workers,
		kick:    make(chan struct{}, workers),
		now:     time.Now,
	}
}

// Kick wakes the workers for a newly uploaded video
func (p *VideoProcessor) Kick() {
	if p == nil {
		return
	}
	select {
	case p.kick <- struct{}{}:
	default:
	}
}

// next takes the oldest video waiting, unless another run holds it
func (p *VideoProcessor) next(ctx context.Context) (*File, error) {
	now := p.now().Truncate(time.Millisecond)
	var f File
	err := p.recs.FindOneAndUpdate(ctx,
		bson.M{"video.state": VideoProcessing, "$or": bson.A{
			bson.M{"video.lease_until": bson.M{"$exists": false}},
			bson.M{"video.lease_until": bson.M{"$lte": now}},
		}},
		bson.M{"$set": bson.M{"video.lease_until": now.Add(videoLease)}, "$inc": bson.M{"video.attempts": 1}},
		options.FindOneAndUpdate().SetSort(bson.D{{Key: "created_at", Value: 1}}).SetReturnDocument(options.After),
	).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// RunOnce works through every video waiting (used by the workers, and by tests)
func (p *VideoProcessor) RunOnce(ctx context.Context) error {
	for ctx.Err() == nil {
		f, err := p.next(ctx)
		if err != nil || f == nil {
			return err
		}
		p.process(ctx, f)
	}
	return ctx.Err()
}

func (p *VideoProcessor) process(ctx context.Context, f *File) {
	if f.Video.Attempts > videoAttempts {
		p.fail(ctx, f, ErrVideoFailed, "gave up after %d attempts", f.Video.Attempts-1)
		return
	}
	if p.ffprobe == "" || p.ffmpeg == "" {
		p.fail(ctx, f, ErrVideoUnavailable, "ffmpeg/ffprobe not installed")
		return
	}
	work, err := os.MkdirTemp("", "km-video-")
	if err != nil {
		log.Printf("[videos] %s: temp folder: %v", f.ID.Hex(), err)
		return // tried again when the lease ends
	}
	defer os.RemoveAll(work)

	vis := storage.Visibility(f.Visibility)
	in := filepath.Join(work, "in"+strings.ToLower(path.Ext(f.Key)))
	if err := p.download(ctx, vis, f.Key, in); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			p.fail(ctx, f, ErrVideoUnreadable, "stored file missing")
			return
		}
		log.Printf("[videos] %s: download: %v", f.ID.Hex(), err)
		return
	}
	info, err := p.probe(ctx, in)
	if err != nil {
		p.fail(ctx, f, ErrVideoUnreadable, "probe: %v", err)
		return
	}
	if info.duration > MaxVideoSeconds+0.5 {
		p.fail(ctx, f, ErrVideoTooLong, "%.1fs", info.duration)
		return
	}
	v := VideoInfo{State: VideoReady, Duration: info.duration, Width: info.width, Height: info.height}
	set := bson.M{}
	var newKey string
	if info.needsConverting() {
		out := filepath.Join(work, "out.mp4")
		if err := p.convert(ctx, in, out); err != nil {
			if ctx.Err() != nil {
				return // shutting down; another run picks it up
			}
			p.fail(ctx, f, ErrVideoFailed, "convert: %v", err)
			return
		}
		conv, err := p.probe(ctx, out)
		if err != nil {
			p.fail(ctx, f, ErrVideoFailed, "probe converted: %v", err)
			return
		}
		newKey = path.Dir(f.Key) + "/" + primitive.NewObjectID().Hex() + ".mp4"
		size, err := p.upload(ctx, vis, out, newKey)
		if err != nil {
			log.Printf("[videos] %s: upload converted: %v", f.ID.Hex(), err)
			return
		}
		v.Duration, v.Width, v.Height, v.Converted = conv.duration, conv.width, conv.height, true
		set["key"], set["size"], set["mime_type"] = newKey, size, "video/mp4"
		if vis == storage.Public {
			set["url"] = p.store.PublicURL(newKey)
		}
	}
	set["video"] = v
	// Only while this run still holds the video
	res, err := p.recs.UpdateOne(ctx, bson.M{"_id": f.ID, "video.lease_until": f.Video.LeaseUntil}, bson.M{"$set": set})
	if err != nil || res.MatchedCount == 0 {
		if newKey != "" {
			_ = p.store.Delete(context.Background(), vis, newKey)
		}
		if err != nil {
			log.Printf("[videos] %s: save: %v", f.ID.Hex(), err)
		}
		return
	}
	if newKey != "" {
		if err := p.store.Delete(ctx, vis, f.Key); err != nil {
			log.Printf("[videos] %s: delete the original upload: %v", f.ID.Hex(), err)
		}
	}
}

// fail refuses the video: the stored file goes, the record says why (the app shows it)
func (p *VideoProcessor) fail(ctx context.Context, f *File, reason *apperr.Error, detail string, args ...any) {
	log.Printf("[videos] %s refused (%s): %s", f.ID.Hex(), reason.Code, fmt.Sprintf(detail, args...))
	if err := p.store.Delete(ctx, storage.Visibility(f.Visibility), f.Key); err != nil {
		log.Printf("[videos] %s: delete refused upload: %v", f.ID.Hex(), err)
	}
	_, err := p.recs.UpdateOne(ctx, bson.M{"_id": f.ID, "video.lease_until": f.Video.LeaseUntil}, bson.M{"$set": bson.M{
		"video": VideoInfo{State: VideoFailed, ErrorCode: reason.Code, Error: reason.Message},
	}})
	if err != nil {
		log.Printf("[videos] %s: save refusal: %v", f.ID.Hex(), err)
	}
}

func (p *VideoProcessor) download(ctx context.Context, vis storage.Visibility, key, to string) error {
	rc, err := p.store.Get(ctx, vis, key)
	if err != nil {
		return err
	}
	defer rc.Close()
	out, err := os.Create(to)
	if err != nil {
		return err
	}
	// A little over the largest upload, so a wrong record can't fill the disk
	_, err = io.Copy(out, io.LimitReader(rc, 60<<20))
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	return err
}

func (p *VideoProcessor) upload(ctx context.Context, vis storage.Visibility, from, key string) (int64, error) {
	f, err := os.Open(from)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return 0, err
	}
	return st.Size(), p.store.Put(ctx, vis, storage.Object{Key: key, Body: f, Size: st.Size(), ContentType: "video/mp4"})
}

// probed is what ffprobe says about a file
type probed struct {
	duration       float64
	width, height  int
	container      string
	videoCodec     string
	pixelFormat    string
	audioCodec     string
	hasAudio       bool
	rotated        bool
	videoStreamsOK bool
}

// needsConverting: anything but H.264 (8-bit 4:2:0) with AAC or no sound, in an MP4/MOV box
func (v probed) needsConverting() bool {
	if !strings.Contains(v.container, "mp4") || v.videoCodec != "h264" {
		return true
	}
	if v.pixelFormat != "yuv420p" && v.pixelFormat != "yuvj420p" {
		return true
	}
	return v.hasAudio && v.audioCodec != "aac"
}

func (p *VideoProcessor) probe(ctx context.Context, file string) (probed, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.ffprobe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	raw, err := cmd.Output()
	if err != nil {
		return probed{}, fmt.Errorf("%v: %s", err, strings.TrimSpace(stderr.String()))
	}
	var out struct {
		Format struct {
			Name     string `json:"format_name"`
			Duration string `json:"duration"`
		} `json:"format"`
		Streams []struct {
			Type     string            `json:"codec_type"`
			Codec    string            `json:"codec_name"`
			Width    int               `json:"width"`
			Height   int               `json:"height"`
			PixFmt   string            `json:"pix_fmt"`
			Duration string            `json:"duration"`
			Tags     map[string]string `json:"tags"`
			Side     []struct {
				Rotation float64 `json:"rotation"`
			} `json:"side_data_list"`
			Disposition struct {
				AttachedPic int `json:"attached_pic"`
			} `json:"disposition"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return probed{}, err
	}
	v := probed{container: out.Format.Name}
	v.duration, _ = strconv.ParseFloat(out.Format.Duration, 64)
	for _, s := range out.Streams {
		switch {
		case s.Type == "video" && s.Disposition.AttachedPic == 0 && !v.videoStreamsOK:
			v.videoStreamsOK = true
			v.videoCodec, v.pixelFormat, v.width, v.height = s.Codec, s.PixFmt, s.Width, s.Height
			if v.duration <= 0 {
				v.duration, _ = strconv.ParseFloat(s.Duration, 64)
			}
			// A phone held upright stores a sideways picture and a note to turn it
			deg, _ := strconv.Atoi(s.Tags["rotate"])
			for _, sd := range s.Side {
				if sd.Rotation != 0 {
					deg = int(sd.Rotation)
				}
			}
			if deg = ((deg % 360) + 360) % 360; deg == 90 || deg == 270 {
				v.rotated = true
				v.width, v.height = v.height, v.width
			}
		case s.Type == "audio" && !v.hasAudio:
			v.hasAudio, v.audioCodec = true, s.Codec
		}
	}
	if !v.videoStreamsOK || v.duration <= 0 || v.width <= 0 || v.height <= 0 {
		return probed{}, errors.New("no playable video in the file")
	}
	return v, nil
}

// convert makes an H.264/AAC MP4 at most 1280 pixels on its longer side, ready to stream
func (p *VideoProcessor) convert(ctx context.Context, in, out string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	scale := fmt.Sprintf("scale='if(gte(iw,ih),min(%d,iw),-2)':'if(gte(iw,ih),-2,min(%d,ih))'", longestSide, longestSide)
	cmd := exec.CommandContext(ctx, p.ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
		"-i", in,
		"-map", "0:v:0", "-map", "0:a:0?",
		"-vf", scale,
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "128k", "-ac", "2",
		"-movflags", "+faststart",
		"-t", strconv.Itoa(MaxVideoSeconds+1),
		"-threads", "2",
		out)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if len(msg) > 500 {
			msg = msg[len(msg)-500:]
		}
		return fmt.Errorf("%v: %s", err, msg)
	}
	return nil
}

// RegisterVideoProcessor starts the workers: they wake when a video is uploaded, and every
// minute to pick up videos a restart left behind
func RegisterVideoProcessor(lc fx.Lifecycle, p *VideoProcessor) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				finished := make(chan struct{}, p.workers)
				for i := 0; i < p.workers; i++ {
					go func() {
						defer func() { finished <- struct{}{} }()
						t := time.NewTicker(time.Minute)
						defer t.Stop()
						for {
							if err := p.RunOnce(ctx); err != nil && ctx.Err() == nil {
								log.Printf("[videos] %v", err)
							}
							select {
							case <-ctx.Done():
								return
							case <-p.kick:
							case <-t.C:
							}
						}
					}()
				}
				for i := 0; i < p.workers; i++ {
					<-finished
				}
			}()
			return nil
		},
		OnStop: func(stopCtx context.Context) error {
			cancel()
			select {
			case <-done:
			case <-stopCtx.Done():
			}
			return nil
		},
	})
}

// VideoStatusHandler godoc
// @Summary Whether an uploaded video is ready to post
// @Description After /api/files/multipart/{id}/complete, poll this every few seconds until video.state is "ready" (use the url returned here, it can change) or "failed" (video.error says why). Only the uploader can ask.
// @Tags files
// @Produce json
// @Param id path string true "File ID"
// @Success 200 {object} File
// @Router /api/files/videos/{id} [get]
func (u *ChunkedUploads) VideoStatusHandler(c *fiber.Ctx) error {
	uid, ok := uploader(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return uploadFail(c, errUploadNotFound)
	}
	var f File
	err = u.fileRecs.FindOne(c.UserContext(), bson.M{"_id": id, "uploaded_by": uid, "video": bson.M{"$exists": true}}).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return uploadFail(c, errUploadNotFound)
	}
	if err != nil {
		return uploadFail(c, err)
	}
	return c.JSON(f)
}
