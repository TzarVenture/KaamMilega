package storage

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Objects reads and copies stored files on the server itself (videos being checked and
// converted, story files moved to a new address)
type Objects interface {
	// Get opens a stored file for reading; ErrNotFound if there is none
	Get(ctx context.Context, vis Visibility, key string) (io.ReadCloser, error)
	// Copy makes a second copy of a file under another key, in the same bucket
	Copy(ctx context.Context, vis Visibility, from, to string) error
}

func (s *r2Storage) Get(ctx context.Context, vis Visibility, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket(vis)), Key: aws.String(key)})
	var nf *types.NoSuchKey
	if errors.As(err, &nf) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}

func (s *r2Storage) Copy(ctx context.Context, vis Visibility, from, to string) error {
	bucket := s.bucket(vis)
	// The copy keeps the original's type and caching headers
	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(to),
		// Keys are made by the server (folder/random name), so they need no escaping
		CopySource: aws.String(bucket + "/" + from),
	})
	return err
}

func (s *localStorage) Get(_ context.Context, vis Visibility, key string) (io.ReadCloser, error) {
	p, err := s.Path(vis, key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	return f, err
}

func (s *localStorage) Copy(_ context.Context, vis Visibility, from, to string) error {
	src, err := s.Path(vis, from)
	if err != nil {
		return err
	}
	dst, err := s.Path(vis, to)
	if err != nil {
		return err
	}
	in, err := os.Open(src)
	if errors.Is(err, os.ErrNotExist) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(dst)
		return err
	}
	return out.Close()
}
