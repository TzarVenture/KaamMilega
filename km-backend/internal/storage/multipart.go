package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// A large file (a video) is uploaded in parts, so no single request is bigger than the API's body
// limit. R2's rules apply to both drivers: every part except the last is the same size and at
// least 5 MiB, parts are numbered from 1, and the content type is fixed when the upload starts.

// MinPartSize is the smallest part R2 accepts (except the last)
const MinPartSize = 5 << 20

// Part is one uploaded part and the ETag that completes it
type Part struct {
	Number int32  `bson:"n"`
	ETag   string `bson:"etag"`
	Size   int64  `bson:"size"`
}

// Multipart uploads a file in parts
type Multipart interface {
	// StartUpload begins an upload and returns its upload ID
	StartUpload(ctx context.Context, vis Visibility, key, contentType string) (string, error)
	// PutPart stores one part and returns its ETag
	PutPart(ctx context.Context, vis Visibility, key, uploadID string, number int32, body io.Reader, size int64) (string, error)
	// CompleteUpload joins the parts into the file at key
	CompleteUpload(ctx context.Context, vis Visibility, key, uploadID string, parts []Part) error
	// AbortUpload drops an unfinished upload and its parts
	AbortUpload(ctx context.Context, vis Visibility, key, uploadID string) error
}

// ---------------------------------------------------------------------------------------------
// R2
// ---------------------------------------------------------------------------------------------

func (s *r2Storage) StartUpload(ctx context.Context, vis Visibility, key, contentType string) (string, error) {
	in := &s3.CreateMultipartUploadInput{Bucket: aws.String(s.bucket(vis)), Key: aws.String(key), ContentType: aws.String(contentType)}
	if vis == Public {
		in.CacheControl = aws.String("public, max-age=31536000, immutable")
	}
	out, err := s.client.CreateMultipartUpload(ctx, in)
	if err != nil {
		return "", err
	}
	return aws.ToString(out.UploadId), nil
}

func (s *r2Storage) PutPart(ctx context.Context, vis Visibility, key, uploadID string, number int32, body io.Reader, size int64) (string, error) {
	out, err := s.client.UploadPart(ctx, &s3.UploadPartInput{
		Bucket: aws.String(s.bucket(vis)), Key: aws.String(key), UploadId: aws.String(uploadID),
		PartNumber: aws.Int32(number), Body: body, ContentLength: aws.Int64(size),
	})
	if err != nil {
		return "", err
	}
	return aws.ToString(out.ETag), nil
}

func (s *r2Storage) CompleteUpload(ctx context.Context, vis Visibility, key, uploadID string, parts []Part) error {
	done := make([]types.CompletedPart, 0, len(parts))
	for _, p := range parts {
		done = append(done, types.CompletedPart{PartNumber: aws.Int32(p.Number), ETag: aws.String(p.ETag)})
	}
	_, err := s.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket: aws.String(s.bucket(vis)), Key: aws.String(key), UploadId: aws.String(uploadID),
		MultipartUpload: &types.CompletedMultipartUpload{Parts: done},
	})
	return err
}

func (s *r2Storage) AbortUpload(ctx context.Context, vis Visibility, key, uploadID string) error {
	_, err := s.client.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{
		Bucket: aws.String(s.bucket(vis)), Key: aws.String(key), UploadId: aws.String(uploadID),
	})
	var nf interface{ ErrorCode() string }
	if errors.As(err, &nf) && nf.ErrorCode() == "NoSuchUpload" {
		return nil
	}
	return err
}

// ---------------------------------------------------------------------------------------------
// Local disk (development): parts wait in a folder named after the upload, then are joined
// ---------------------------------------------------------------------------------------------

func (s *localStorage) partsDir(uploadID string) (string, error) {
	if uploadID == "" || filepath.Base(uploadID) != uploadID {
		return "", ErrNotFound
	}
	return filepath.Join(s.root, "uploads-in-progress", uploadID), nil
}

func (s *localStorage) StartUpload(_ context.Context, vis Visibility, key, _ string) (string, error) {
	if _, err := s.Path(vis, key); err != nil {
		return "", err
	}
	id := randomHex()
	dir, _ := s.partsDir(id)
	return id, os.MkdirAll(dir, 0o755)
}

func (s *localStorage) PutPart(_ context.Context, _ Visibility, _, uploadID string, number int32, body io.Reader, _ int64) (string, error) {
	dir, err := s.partsDir(uploadID)
	if err != nil {
		return "", err
	}
	f, err := os.Create(filepath.Join(dir, strconv.Itoa(int(number))))
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, body); err != nil {
		f.Close()
		return "", err
	}
	return fmt.Sprintf("local-%d", number), f.Close()
}

func (s *localStorage) CompleteUpload(ctx context.Context, vis Visibility, key, uploadID string, parts []Part) error {
	dir, err := s.partsDir(uploadID)
	if err != nil {
		return err
	}
	sorted := append([]Part(nil), parts...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Number < sorted[j].Number })
	readers := make([]io.Reader, 0, len(sorted))
	files := []*os.File{}
	defer func() {
		for _, f := range files {
			f.Close()
		}
	}()
	for _, p := range sorted {
		f, err := os.Open(filepath.Join(dir, strconv.Itoa(int(p.Number))))
		if err != nil {
			return err
		}
		files = append(files, f)
		readers = append(readers, f)
	}
	if err := s.Put(ctx, vis, Object{Key: key, Body: io.MultiReader(readers...)}); err != nil {
		return err
	}
	for _, f := range files {
		f.Close()
	}
	files = nil
	return os.RemoveAll(dir)
}

func (s *localStorage) AbortUpload(_ context.Context, _ Visibility, _, uploadID string) error {
	dir, err := s.partsDir(uploadID)
	if err != nil {
		return nil
	}
	return os.RemoveAll(dir)
}

func randomHex() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
