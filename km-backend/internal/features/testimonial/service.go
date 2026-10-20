package testimonial

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var youtubeRegex = regexp.MustCompile(`(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})`)

type TestimonialServiceImpl struct {
	repo TestimonialRepository
}

func NewTestimonialService(repo TestimonialRepository) TestimonialService {
	return &TestimonialServiceImpl{repo: repo}
}

func ExtractYouTubeVideoID(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", errors.New("youtube URL cannot be empty")
	}

	// 1. Regex check
	matches := youtubeRegex.FindStringSubmatch(trimmed)
	if len(matches) > 1 && len(matches[1]) == 11 {
		return matches[1], nil
	}

	// 2. Query param check
	if parsed, err := url.Parse(trimmed); err == nil {
		if v := parsed.Query().Get("v"); len(v) == 11 {
			return v, nil
		}
	}

	// 3. Fallback: If 11 chars directly passed
	if len(trimmed) == 11 && !strings.Contains(trimmed, "/") && !strings.Contains(trimmed, " ") {
		return trimmed, nil
	}

	return "", errors.New("invalid YouTube video link. Please provide a valid YouTube video or embed URL")
}

func (s *TestimonialServiceImpl) GetActiveTestimonials(ctx context.Context) ([]*Testimonial, error) {
	return s.repo.GetActive(ctx)
}

func (s *TestimonialServiceImpl) GetAllTestimonials(ctx context.Context) ([]*Testimonial, error) {
	return s.repo.GetAll(ctx)
}

func (s *TestimonialServiceImpl) GetTestimonialByID(ctx context.Context, id string) (*Testimonial, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid testimonial ID format")
	}
	return s.repo.GetByID(ctx, objID)
}

func (s *TestimonialServiceImpl) CreateTestimonial(ctx context.Context, req CreateTestimonialRequest) (*Testimonial, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("candidate name is required")
	}

	role := strings.TrimSpace(req.Role)
	if role == "" {
		return nil, errors.New("candidate role is required")
	}

	company := strings.TrimSpace(req.Company)
	if company == "" {
		return nil, errors.New("company name is required")
	}

	city := strings.TrimSpace(req.City)
	tradeTag := strings.TrimSpace(req.TradeTag)

	videoID, err := ExtractYouTubeVideoID(req.YouTubeURL)
	if err != nil {
		return nil, err
	}

	rating := req.Rating
	if rating < 1 || rating > 5 {
		rating = 5
	}

	thumbnail := strings.TrimSpace(req.ThumbnailURL)
	if thumbnail == "" {
		thumbnail = fmt.Sprintf("https://img.youtube.com/vi/%s/hqdefault.jpg", videoID)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	review := strings.TrimSpace(req.Review)
	if len([]rune(review)) > 100 {
		review = string([]rune(review)[:100])
	}

	t := &Testimonial{
		Name:           name,
		Role:           role,
		Company:        company,
		City:           city,
		TradeTag:       tradeTag,
		Rating:         rating,
		Review:         review,
		YouTubeURL:     req.YouTubeURL,
		YouTubeVideoID: videoID,
		ThumbnailURL:   thumbnail,
		IsActive:       isActive,
		Order:          req.Order,
	}

	return s.repo.Create(ctx, t)
}

func (s *TestimonialServiceImpl) UpdateTestimonial(ctx context.Context, id string, req UpdateTestimonialRequest) (*Testimonial, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid testimonial ID format")
	}

	existing, err := s.repo.GetByID(ctx, objID)
	if err != nil {
		return nil, errors.New("testimonial not found")
	}

	if req.Name != "" {
		existing.Name = strings.TrimSpace(req.Name)
	}
	if req.Role != "" {
		existing.Role = strings.TrimSpace(req.Role)
	}
	if req.Company != "" {
		existing.Company = strings.TrimSpace(req.Company)
	}
	if req.City != "" {
		existing.City = strings.TrimSpace(req.City)
	}
	if req.TradeTag != "" {
		existing.TradeTag = strings.TrimSpace(req.TradeTag)
	}
	if req.Rating > 0 && req.Rating <= 5 {
		existing.Rating = req.Rating
	}
	if req.Review != "" {
		rev := strings.TrimSpace(req.Review)
		if len([]rune(rev)) > 100 {
			rev = string([]rune(rev)[:100])
		}
		existing.Review = rev
	}
	if req.YouTubeURL != "" {
		videoID, err := ExtractYouTubeVideoID(req.YouTubeURL)
		if err != nil {
			return nil, err
		}
		existing.YouTubeURL = req.YouTubeURL
		existing.YouTubeVideoID = videoID
		if req.ThumbnailURL == "" && (existing.ThumbnailURL == "" || strings.Contains(existing.ThumbnailURL, "img.youtube.com")) {
			existing.ThumbnailURL = fmt.Sprintf("https://img.youtube.com/vi/%s/hqdefault.jpg", videoID)
		}
	}
	if req.ThumbnailURL != "" {
		existing.ThumbnailURL = strings.TrimSpace(req.ThumbnailURL)
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}
	if req.Order != nil {
		existing.Order = *req.Order
	}

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

func (s *TestimonialServiceImpl) DeleteTestimonial(ctx context.Context, id string) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid testimonial ID format")
	}
	return s.repo.Delete(ctx, objID)
}
