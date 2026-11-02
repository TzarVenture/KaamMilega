package storage

import (
	"context"
	"errors"
	"fmt"
	"mime"
	"strings"
	"time"

	"km-backend/internal/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type r2Storage struct {
	client        *s3.Client
	presign       *s3.PresignClient
	publicBucket  string
	privateBucket string
	publicBaseURL string
}

func newR2(cfg *config.Config) (*r2Storage, error) {
	missing := []string{}
	for name, v := range map[string]string{
		"R2_ACCOUNT_ID":        cfg.R2AccountID,
		"R2_ACCESS_KEY_ID":     cfg.R2AccessKeyID,
		"R2_SECRET_ACCESS_KEY": cfg.R2SecretAccessKey,
		"R2_PUBLIC_BUCKET":     cfg.R2PublicBucket,
		"R2_PRIVATE_BUCKET":    cfg.R2PrivateBucket,
		"R2_PUBLIC_BASE_URL":   cfg.R2PublicBaseURL,
	} {
		if strings.TrimSpace(v) == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("storage: STORAGE_DRIVER=r2 but %s not set", strings.Join(missing, ", "))
	}

	client := s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, ""),
	})
	return &r2Storage{
		client:        client,
		presign:       s3.NewPresignClient(client),
		publicBucket:  cfg.R2PublicBucket,
		privateBucket: cfg.R2PrivateBucket,
		publicBaseURL: strings.TrimRight(cfg.R2PublicBaseURL, "/"),
	}, nil
}

func (s *r2Storage) bucket(vis Visibility) string {
	if vis == Public {
		return s.publicBucket
	}
	return s.privateBucket
}

func (s *r2Storage) Put(ctx context.Context, vis Visibility, obj Object) error {
	in := &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket(vis)),
		Key:           aws.String(obj.Key),
		Body:          obj.Body,
		ContentLength: aws.Int64(obj.Size),
		ContentType:   aws.String(obj.ContentType),
	}
	if vis == Public {
		// Keys are random and never reused, so the CDN and browsers may cache them for good
		in.CacheControl = aws.String("public, max-age=31536000, immutable")
	}
	_, err := s.client.PutObject(ctx, in)
	return err
}

func (s *r2Storage) Delete(ctx context.Context, vis Visibility, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket(vis)), Key: aws.String(key)})
	var nf interface{ ErrorCode() string }
	if errors.As(err, &nf) && nf.ErrorCode() == "NoSuchKey" {
		return nil
	}
	return err
}

func (s *r2Storage) PublicURL(key string) string {
	return s.publicBaseURL + "/" + key
}

func (s *r2Storage) SignedURL(ctx context.Context, key, downloadName string, download bool, ttl time.Duration) (string, error) {
	in := &s3.GetObjectInput{Bucket: aws.String(s.privateBucket), Key: aws.String(key)}
	if downloadName != "" {
		// Opens in the browser (PDFs, images) and keeps the original name when saved
		in.ResponseContentDisposition = aws.String(mime.FormatMediaType(disposition(download), map[string]string{"filename": downloadName}))
	}
	req, err := s.presign.PresignGetObject(ctx, in, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *r2Storage) Driver() string { return "r2" }
