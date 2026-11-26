package file

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/database"
	"km-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/fx"
)

// A video is too big for one request (the API takes 12 MB at most), so the app sends it in
// parts. Each part goes straight on to R2's multipart upload; the server checks the kind, the
// file type (from the first part), the size so far and the order of the parts, and only a
// completed upload becomes a file record. Unfinished uploads expire and are cleared.
//
//	POST   /api/files/multipart              {kind, filename, size}  -> {id, part_size, parts}
//	PUT    /api/files/multipart/:id/parts/:n  raw bytes of part n (1, 2, ...)
//	POST   /api/files/multipart/:id/complete -> the File, as /api/files/upload returns it
//	DELETE /api/files/multipart/:id           gives up on the upload

const (
	// PartSize is the size of every part but the last: above R2's 5 MiB minimum, below the body limit
	PartSize = 8 << 20
	// uploadTTL is how long an upload may take before it is cleared
	uploadTTL = time.Hour
	// partTimeout is the longest one part may take to store
	partTimeout = 2 * time.Minute
	// maxVideosPerDay stops one member using the CDN as free storage
	maxVideosPerDay = 20
	// unpostedTTL is how long a finished video may wait to be put on a post before it is deleted
	unpostedTTL = 24 * time.Hour
	// maxOpenUploads stops one member holding many unfinished uploads
	maxOpenUploads    = 3
	uploadsCollection = "upload_sessions"
)

var (
	errChunkedOnly    = apperr.New("UPLOAD_IN_PARTS", "Videos are uploaded in parts through /api/files/multipart.")
	errChunkedKind    = apperr.New("UPLOAD_KIND_NOT_CHUNKED", "This kind of file is uploaded in one go, not in parts.")
	errUploadNotFound = apperr.New("UPLOAD_NOT_FOUND", "This upload has ended or doesn't exist. Please start again.")
	errPartOrder      = apperr.New("UPLOAD_PART_OUT_OF_ORDER", "The parts of the file arrived out of order. Please try again.")
	errPartSize       = apperr.New("UPLOAD_PART_SIZE", "A part of the file has the wrong size. Please try again.")
	errUploadBusy     = apperr.New("UPLOAD_BUSY", "This part is already being uploaded.")
	errUploadShort    = apperr.New("UPLOAD_INCOMPLETE", "The whole file hasn't arrived yet.")
	errTooManyUploads = apperr.New("UPLOAD_TOO_MANY", "You have too many uploads in progress. Finish or cancel one first.")
	errDailyVideos    = apperr.New("UPLOAD_DAILY_LIMIT", "You have uploaded a lot of videos today. Please try again tomorrow.")
)

// UploadSession is an upload in progress
type UploadSession struct {
	ID          primitive.ObjectID `bson:"_id"`
	UserID      primitive.ObjectID `bson:"user_id"`
	Kind        string             `bson:"kind"`
	Key         string             `bson:"key"`
	UploadID    string             `bson:"upload_id"`
	Filename    string             `bson:"filename"`
	Ext         string             `bson:"ext"`
	ContentType string             `bson:"content_type"`
	Size        int64              `bson:"size"`
	Received    int64              `bson:"received"`
	Parts       []storage.Part     `bson:"parts"`
	// BusyUntil is set while a part is being stored, so two parts can't be stored at once. It is
	// a time, not a flag, so a server that stops mid-part doesn't lock the upload for good.
	BusyUntil time.Time `bson:"busy_until"`
	ExpiresAt time.Time `bson:"expires_at"`
	CreatedAt time.Time `bson:"created_at"`
}

// StartUploadRequest begins an upload in parts
type StartUploadRequest struct {
	Kind     string `json:"kind"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

// StartUploadResponse says how to cut the file
type StartUploadResponse struct {
	ID       string `json:"id"`
	PartSize int64  `json:"part_size"`
	Parts    int    `json:"parts"`
}

// ChunkedUploads handles uploads in parts
type ChunkedUploads struct {
	coll  *mongo.Collection
	store storage.Storage
	files FileService
	// fileRecs is the files collection, to count a member's videos and clear unposted ones
	fileRecs *mongo.Collection
	videos   *VideoProcessor
	now      func() time.Time
}

func NewChunkedUploads(db *database.MongodbDB, store storage.Storage, files FileService, videos *VideoProcessor) *ChunkedUploads {
	coll := db.DB.Collection(uploadsCollection)
	database.SyncIndexesInBackground(coll, []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "expires_at", Value: 1}}},
		{Keys: bson.D{{Key: "expires_at", Value: 1}}},
	})
	return &ChunkedUploads{coll: coll, store: store, files: files, fileRecs: db.DB.Collection("files"), videos: videos, now: time.Now}
}

// videoExts are the video files taken in parts. A .mov from an iPhone is the same ISO media
// format as .mp4, and is stored and served as video/mp4 so browsers on every system play it.
var videoTypes = map[string]string{
	".mp4":  "video/mp4",
	".mov":  "video/mp4",
	".m4v":  "video/mp4",
	".webm": "video/webm",
}

// videoBrands are the ISO media brands of the videos phones and editors make. "qt  " is an
// iPhone .mov.
var videoBrands = map[string]bool{
	"isom": true, "iso2": true, "iso3": true, "iso4": true, "iso5": true, "iso6": true,
	"mp41": true, "mp42": true, "avc1": true, "M4V ": true, "M4VH": true, "M4VP": true,
	"qt  ": true, "3gp4": true, "3gp5": true, "3gp6": true, "3g2a": true, "mmp4": true, "MSNV": true, "dash": true,
}

// videoHeadMatches checks the first bytes: an ISO media "ftyp" box with a video brand, or
// WebM's EBML header
func videoHeadMatches(ext string, head []byte) bool {
	switch ext {
	case ".mp4", ".mov", ".m4v":
		return len(head) >= 12 && bytes.Equal(head[4:8], []byte("ftyp")) && videoBrands[string(head[8:12])]
	case ".webm":
		return bytes.HasPrefix(head, []byte{0x1A, 0x45, 0xDF, 0xA3})
	}
	return false
}

func (u *ChunkedUploads) Start(ctx context.Context, userID primitive.ObjectID, isAdmin bool, req StartUploadRequest) (*StartUploadResponse, error) {
	kind, err := kindFor(req.Kind, "", "")
	if err != nil || req.Kind == "" {
		return nil, errUnknownKind
	}
	if !kind.Chunked {
		return nil, errChunkedKind
	}
	if kind.AdminOnly && !isAdmin {
		return nil, errKindAdminOnly
	}
	ext := strings.ToLower(filepath.Ext(req.Filename))
	contentType, ok := videoTypes[ext]
	if !ok {
		return nil, errKindFileType
	}
	if req.Size <= 0 {
		return nil, errFileEmpty
	}
	if err := kind.check(ext, req.Size); err != nil {
		return nil, err
	}
	now := u.now()
	open, err := u.coll.CountDocuments(ctx, bson.M{"user_id": userID, "expires_at": bson.M{"$gt": now}})
	if err != nil {
		return nil, err
	}
	if open >= maxOpenUploads {
		return nil, errTooManyUploads
	}
	done, err := u.fileRecs.CountDocuments(ctx, bson.M{"uploaded_by": userID, "kind": kind.Name, "created_at": bson.M{"$gte": now.Add(-24 * time.Hour)}})
	if err != nil {
		return nil, err
	}
	if done >= maxVideosPerDay {
		return nil, errDailyVideos
	}

	key := fmt.Sprintf("%s/%s/%s/%s%s", kind.Name, userID.Hex(), now.Format("2006/01"), randomID(), ext)
	uploadID, err := u.store.StartUpload(ctx, kind.Visibility, key, contentType)
	if err != nil {
		return nil, errStoreFailed
	}
	s := &UploadSession{
		ID: primitive.NewObjectID(), UserID: userID, Kind: kind.Name, Key: key, UploadID: uploadID,
		Filename: filepath.Base(req.Filename), Ext: ext, ContentType: contentType, Size: req.Size,
		Parts: []storage.Part{}, BusyUntil: time.Time{}, ExpiresAt: now.Add(uploadTTL), CreatedAt: now,
	}
	if _, err := u.coll.InsertOne(ctx, s); err != nil {
		_ = u.store.AbortUpload(ctx, kind.Visibility, key, uploadID)
		return nil, err
	}
	return &StartUploadResponse{ID: s.ID.Hex(), PartSize: PartSize, Parts: partsFor(req.Size)}, nil
}

func partsFor(size int64) int {
	return int((size + PartSize - 1) / PartSize)
}

// claim locks the upload for one step. The lock is the time it runs out, which only this step
// knows, so a step that outlived its lock can't release or update the upload another step holds.
func (u *ChunkedUploads) claim(ctx context.Context, userID, oid primitive.ObjectID) (*UploadSession, error) {
	now := u.now()
	until := now.Add(partTimeout).Truncate(time.Millisecond)
	var s UploadSession
	err := u.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": oid, "user_id": userID, "expires_at": bson.M{"$gt": now}, "busy_until": bson.M{"$lte": now}},
		bson.M{"$set": bson.M{"busy_until": until}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&s)
	if errors.Is(err, mongo.ErrNoDocuments) {
		if held, _ := u.coll.CountDocuments(ctx, bson.M{"_id": oid, "user_id": userID, "expires_at": bson.M{"$gt": now}}); held > 0 {
			return nil, errUploadBusy
		}
		return nil, errUploadNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (u *ChunkedUploads) release(s *UploadSession) {
	_, _ = u.coll.UpdateOne(context.Background(), bson.M{"_id": s.ID, "busy_until": s.BusyUntil}, bson.M{"$set": bson.M{"busy_until": time.Time{}}})
}

// PutPart stores part number n. Parts go in order; every part but the last is PartSize.
func (u *ChunkedUploads) PutPart(ctx context.Context, userID primitive.ObjectID, id string, n int, body []byte) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errUploadNotFound
	}
	s, err := u.claim(ctx, userID, oid)
	if err != nil {
		return err
	}
	size := int64(len(body))
	last := s.Received+size == s.Size
	switch {
	case n != len(s.Parts)+1:
		u.release(s)
		return errPartOrder
	case size == 0 || s.Received+size > s.Size || (!last && size != PartSize):
		u.release(s)
		return errPartSize
	}
	if n == 1 && !videoHeadMatches(s.Ext, body) {
		// Not the file it claims to be: the upload ends here
		u.abort(ctx, s)
		return errFileMismatch
	}
	kind, _ := kindFor(s.Kind, "", "")
	// The part must be stored before the lock runs out, or a retry could store it at the same time
	storeCtx, cancel := context.WithTimeout(ctx, partTimeout-15*time.Second)
	defer cancel()
	etag, err := u.store.PutPart(storeCtx, kind.Visibility, s.Key, s.UploadID, int32(n), bytes.NewReader(body), size)
	if err != nil {
		u.release(s)
		return errStoreFailed
	}
	res, err := u.coll.UpdateOne(ctx, bson.M{"_id": oid, "busy_until": s.BusyUntil, "parts": bson.M{"$size": n - 1}}, bson.M{
		"$push": bson.M{"parts": storage.Part{Number: int32(n), ETag: etag, Size: size}},
		"$inc":  bson.M{"received": size},
		"$set":  bson.M{"busy_until": time.Time{}},
	})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errUploadNotFound
	}
	return nil
}

// Complete joins the parts and records the file
func (u *ChunkedUploads) Complete(ctx context.Context, userID primitive.ObjectID, id string) (*File, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errUploadNotFound
	}
	s, err := u.claim(ctx, userID, oid)
	if err != nil {
		return nil, err
	}
	if s.Received != s.Size || len(s.Parts) != partsFor(s.Size) {
		u.release(s)
		return nil, errUploadShort
	}
	kind, _ := kindFor(s.Kind, "", "")
	if err := u.store.CompleteUpload(ctx, kind.Visibility, s.Key, s.UploadID, s.Parts); err != nil {
		u.release(s)
		return nil, errStoreFailed
	}
	f := &File{
		ID: primitive.NewObjectID(), OriginalFilename: s.Filename, Kind: kind.Name, Visibility: string(kind.Visibility),
		Key: s.Key, Size: s.Size, MimeType: s.ContentType, UploadedBy: userID, CreatedAt: u.now(),
		// Checked (and converted if need be) before it can be posted
		Video: &VideoInfo{State: VideoProcessing},
	}
	if kind.Visibility == storage.Public {
		f.URL = u.store.PublicURL(s.Key)
	} else {
		f.URL = PrivateRef(f.ID)
	}
	if err := u.files.SaveFile(ctx, f); err != nil {
		_ = u.store.Delete(context.Background(), kind.Visibility, s.Key)
		_, _ = u.coll.DeleteOne(context.Background(), bson.M{"_id": oid})
		return nil, err
	}
	_, _ = u.coll.DeleteOne(ctx, bson.M{"_id": oid})
	u.videos.Kick()
	return f, nil
}

// Cancel gives up on an upload
func (u *ChunkedUploads) Cancel(ctx context.Context, userID primitive.ObjectID, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errUploadNotFound
	}
	s, err := u.claim(ctx, userID, oid)
	if errors.Is(err, errUploadBusy) {
		// A part is still being stored; the upload is cleared when it expires
		return nil
	}
	if err != nil {
		return err
	}
	u.abort(ctx, s)
	return nil
}

func (u *ChunkedUploads) abort(ctx context.Context, s *UploadSession) {
	kind, _ := kindFor(s.Kind, "", "")
	if err := u.store.AbortUpload(ctx, kind.Visibility, s.Key, s.UploadID); err != nil {
		log.Printf("[files] abort upload %s: %v", s.ID.Hex(), err)
		// Tried again later, behind the others waiting to be cleared
		_, _ = u.coll.UpdateByID(context.Background(), s.ID, bson.M{"$set": bson.M{"expires_at": u.now().Add(uploadTTL), "busy_until": time.Time{}}})
		return
	}
	_, _ = u.coll.DeleteOne(ctx, bson.M{"_id": s.ID})
}

// ClearExpired drops uploads that were never finished, parts and all, and finished videos that
// were never put on a post
func (u *ChunkedUploads) ClearExpired(ctx context.Context) error {
	if err := u.clearUnposted(ctx); err != nil {
		log.Printf("[files] clearing unposted videos: %v", err)
	}
	cur, err := u.coll.Find(ctx, bson.M{"expires_at": bson.M{"$lte": u.now()}},
		options.Find().SetSort(bson.D{{Key: "expires_at", Value: 1}}).SetLimit(200))
	if err != nil {
		return err
	}
	var expired []UploadSession
	if err := cur.All(ctx, &expired); err != nil {
		return err
	}
	for i := range expired {
		u.abort(ctx, &expired[i])
	}
	return nil
}

// clearUnposted deletes chunked uploads (videos) still on no post a day after they finished
func (u *ChunkedUploads) clearUnposted(ctx context.Context) error {
	var names []string
	for name, k := range kinds {
		if k.Chunked || k.ClearUnused {
			names = append(names, name)
		}
	}
	cur, err := u.fileRecs.Find(ctx, bson.M{
		"kind":       bson.M{"$in": names},
		"record_id":  bson.M{"$in": bson.A{nil, ""}},
		"created_at": bson.M{"$lte": u.now().Add(-unpostedTTL)},
	}, options.Find().SetLimit(200))
	if err != nil {
		return err
	}
	var recs []File
	if err := cur.All(ctx, &recs); err != nil {
		return err
	}
	for _, f := range recs {
		if err := u.store.Delete(ctx, storage.Visibility(f.Visibility), f.Key); err != nil && !errors.Is(err, storage.ErrNotFound) {
			log.Printf("[files] delete unused upload %s: %v", f.ID.Hex(), err)
			continue
		}
		// Only if it is still on no post
		_, _ = u.fileRecs.DeleteOne(ctx, bson.M{"_id": f.ID, "record_id": bson.M{"$in": bson.A{nil, ""}}})
	}
	return nil
}

// RegisterUploadSweeper clears unfinished uploads every 15 minutes
func RegisterUploadSweeper(lc fx.Lifecycle, u *ChunkedUploads) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				t := time.NewTicker(15 * time.Minute)
				defer t.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-t.C:
						runCtx, stop := context.WithTimeout(ctx, 5*time.Minute)
						if err := u.ClearExpired(runCtx); err != nil {
							log.Printf("[files] clearing unfinished uploads: %v", err)
						}
						stop()
					}
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

// ---------------------------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------------------------

func uploadStatus(err error) int {
	switch err {
	case errUploadNotFound:
		return fiber.StatusNotFound
	case errKindTooLarge:
		return fiber.StatusRequestEntityTooLarge
	case errKindFileType, errFileMismatch:
		return fiber.StatusUnsupportedMediaType
	case errKindAdminOnly:
		return fiber.StatusForbidden
	case errDailyVideos:
		return fiber.StatusTooManyRequests
	case errUploadBusy, errTooManyUploads:
		return fiber.StatusConflict
	case errStoreFailed:
		return fiber.StatusBadGateway
	}
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return fiber.StatusBadRequest
	}
	return fiber.StatusInternalServerError
}

func uploadFail(c *fiber.Ctx, err error) error {
	status := uploadStatus(err)
	if status == fiber.StatusInternalServerError {
		log.Printf("[files] upload: %v", err)
		return c.Status(status).JSON(apperr.Body(errStoreFailed))
	}
	return c.Status(status).JSON(apperr.Body(err))
}

func uploader(c *fiber.Ctx) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(fmt.Sprint(c.Locals("user_id")))
	return id, err == nil
}

// StartUpload godoc
// @Summary Start uploading a large file (a video) in parts
// @Description Kinds: feed_video, story_video. Cut the file into parts of part_size bytes (the last one smaller) and PUT them in order. Requires sign-in.
// @Tags files
// @Accept json
// @Produce json
// @Param body body StartUploadRequest true "Kind, file name and size in bytes"
// @Success 201 {object} StartUploadResponse
// @Router /api/files/multipart [post]
func (u *ChunkedUploads) StartHandler(c *fiber.Ctx) error {
	uid, ok := uploader(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var req StartUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	res, err := u.Start(c.UserContext(), uid, hasRole(c, "admin"), req)
	if err != nil {
		return uploadFail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(res)
}

// PutPartHandler godoc
// @Summary Upload one part of a file
// @Description The body is the raw bytes of part n (from 1). Parts go in order; every part but the last is part_size bytes.
// @Tags files
// @Accept application/octet-stream
// @Param id path string true "Upload ID"
// @Param n path int true "Part number, from 1"
// @Success 204
// @Router /api/files/multipart/{id}/parts/{n} [put]
func (u *ChunkedUploads) PutPartHandler(c *fiber.Ctx) error {
	uid, ok := uploader(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	n, err := strconv.Atoi(c.Params("n"))
	if err != nil || n < 1 {
		return uploadFail(c, errPartOrder)
	}
	if err := u.PutPart(c.UserContext(), uid, c.Params("id"), n, c.Body()); err != nil {
		return uploadFail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// CompleteHandler godoc
// @Summary Finish an upload in parts
// @Description Returns the file, as /api/files/upload does, with video.state "processing": poll GET /api/files/videos/{file id} until it is ready.
// @Tags files
// @Produce json
// @Param id path string true "Upload ID"
// @Success 201 {object} File
// @Router /api/files/multipart/{id}/complete [post]
func (u *ChunkedUploads) CompleteHandler(c *fiber.Ctx) error {
	uid, ok := uploader(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	f, err := u.Complete(c.UserContext(), uid, c.Params("id"))
	if err != nil {
		return uploadFail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(f)
}

// CancelHandler godoc
// @Summary Cancel an upload in parts
// @Tags files
// @Param id path string true "Upload ID"
// @Success 204
// @Router /api/files/multipart/{id} [delete]
func (u *ChunkedUploads) CancelHandler(c *fiber.Ctx) error {
	uid, ok := uploader(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	if err := u.Cancel(c.UserContext(), uid, c.Params("id")); err != nil {
		return uploadFail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
