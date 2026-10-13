package course

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"km-backend/internal/features/user"
)

var youtubeRegex = regexp.MustCompile(`(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})`)

type CourseServiceImpl struct {
	repo     CourseRepository
	userRepo user.UserRepository
}

func NewCourseService(repo CourseRepository, userRepo user.UserRepository) CourseService {
	return &CourseServiceImpl{
		repo:     repo,
		userRepo: userRepo,
	}
}

// ExtractYouTubeVideoID extracts the 11-character YouTube video ID
func ExtractYouTubeVideoID(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", errors.New("youtube URL cannot be empty")
	}

	matches := youtubeRegex.FindStringSubmatch(trimmed)
	if len(matches) > 1 && len(matches[1]) == 11 {
		return matches[1], nil
	}

	// Try query parameter fallback
	if parsed, err := url.Parse(trimmed); err == nil {
		if v := parsed.Query().Get("v"); len(v) == 11 {
			return v, nil
		}
	}

	return "", errors.New("invalid YouTube video URL. Please provide a valid YouTube video or shorts link")
}

func (s *CourseServiceImpl) CreateCourse(ctx context.Context, expertID string, req CreateCourseRequest) (*Course, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("course title is required")
	}
	if len(strings.Fields(title)) > 10 {
		return nil, errors.New("course title cannot exceed 10 words")
	}

	description := strings.TrimSpace(req.Description)
	if description != "" && len(strings.Fields(description)) > 50 {
		return nil, errors.New("course description cannot exceed 50 words")
	}

	if strings.TrimSpace(req.YouTubeURL) == "" {
		return nil, errors.New("youtube video URL is required")
	}

	videoID, err := ExtractYouTubeVideoID(req.YouTubeURL)
	if err != nil {
		return nil, err
	}

	objID, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return nil, errors.New("invalid expert ID")
	}

	// Lookup expert info
	expertName := "Expert"
	expertAvatar := ""
	u, err := s.userRepo.FindUserByID(ctx, expertID)
	if err == nil && u != nil {
		if u.Name != "" {
			expertName = u.Name
		} else if u.FirstName != "" {
			expertName = strings.TrimSpace(u.FirstName + " " + u.LastName)
		}
		expertAvatar = u.ProfileImage
	}

	duration := strings.TrimSpace(req.Duration)
	if duration == "" {
		duration = "30 Min"
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "General"
	}

	// Standard clean YouTube Watch URL
	cleanYouTubeURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)
	thumbnailURL := fmt.Sprintf("https://img.youtube.com/vi/%s/hqdefault.jpg", videoID)

	c := &Course{
		Title:          strings.TrimSpace(req.Title),
		Description:    strings.TrimSpace(req.Description),
		YouTubeURL:     cleanYouTubeURL,
		YouTubeVideoID: videoID,
		ThumbnailURL:   thumbnailURL,
		Duration:       duration,
		Category:       category,
		ExpertID:       objID,
		ExpertName:     expertName,
		ExpertAvatar:   expertAvatar,
		Views:          0,
		IsPublished:    true,
	}

	return s.repo.Create(ctx, c)
}

func (s *CourseServiceImpl) GetCourse(ctx context.Context, id string) (*Course, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid course ID")
	}

	c, err := s.repo.FindByID(ctx, objID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, errors.New("course not found")
	}

	if c.ExpertName == "" || c.ExpertName == "Expert" {
		if u, err := s.userRepo.FindUserByID(ctx, c.ExpertID.Hex()); err == nil && u != nil {
			if u.Name != "" {
				c.ExpertName = u.Name
			} else if u.FirstName != "" {
				c.ExpertName = strings.TrimSpace(u.FirstName + " " + u.LastName)
			}
			if c.ExpertAvatar == "" {
				c.ExpertAvatar = u.ProfileImage
			}
		}
	}

	return c, nil
}

func (s *CourseServiceImpl) GetCourses(ctx context.Context, filter CourseFilter) (*CourseListResponse, error) {
	courses, total, err := s.repo.Find(ctx, filter)
	if err != nil {
		return nil, err
	}

	for i := range courses {
		if courses[i].ExpertName == "" || courses[i].ExpertName == "Expert" {
			if u, err := s.userRepo.FindUserByID(ctx, courses[i].ExpertID.Hex()); err == nil && u != nil {
				if u.Name != "" {
					courses[i].ExpertName = u.Name
				} else if u.FirstName != "" {
					courses[i].ExpertName = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				if courses[i].ExpertAvatar == "" {
					courses[i].ExpertAvatar = u.ProfileImage
				}
			}
		}
	}

	totalPages := int64(0)
	if filter.Limit > 0 {
		totalPages = (total + int64(filter.Limit) - 1) / int64(filter.Limit)
	}

	return &CourseListResponse{
		Data:       courses,
		Total:      total,
		Page:       filter.Page,
		Limit:      filter.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *CourseServiceImpl) GetMyCourses(ctx context.Context, expertID string, page, limit int) (*CourseListResponse, error) {
	objID, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return nil, errors.New("invalid expert ID")
	}

	courses, total, err := s.repo.FindByExpertID(ctx, objID, page, limit)
	if err != nil {
		return nil, err
	}

	for i := range courses {
		if courses[i].ExpertName == "" || courses[i].ExpertName == "Expert" {
			if u, err := s.userRepo.FindUserByID(ctx, courses[i].ExpertID.Hex()); err == nil && u != nil {
				if u.Name != "" {
					courses[i].ExpertName = u.Name
				} else if u.FirstName != "" {
					courses[i].ExpertName = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				if courses[i].ExpertAvatar == "" {
					courses[i].ExpertAvatar = u.ProfileImage
				}
			}
		}
	}

	totalPages := int64(0)
	if limit > 0 {
		totalPages = (total + int64(limit) - 1) / int64(limit)
	}

	return &CourseListResponse{
		Data:       courses,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *CourseServiceImpl) RecordView(ctx context.Context, id string, viewerID string) (int64, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return 0, errors.New("invalid course ID")
	}

	course, err := s.repo.FindByID(ctx, objID)
	if err != nil {
		return 0, err
	}
	if course == nil {
		return 0, errors.New("course not found")
	}

	// RULE: If viewer is the uploader (the expert who created this course), DO NOT INCREMENT!
	if viewerID != "" && course.ExpertID.Hex() == viewerID {
		return course.Views, nil
	}

	// Increment view count for any other viewer or guest
	return s.repo.IncrementViews(ctx, objID)
}

func (s *CourseServiceImpl) UpdateCourse(ctx context.Context, id string, expertID string, req UpdateCourseRequest) (*Course, error) {
	courseObjID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid course ID")
	}

	course, err := s.repo.FindByID(ctx, courseObjID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}

	if course.ExpertID.Hex() != expertID {
		return nil, errors.New("unauthorized: you can only update your own courses")
	}

	if strings.TrimSpace(req.Title) != "" {
		trimmedTitle := strings.TrimSpace(req.Title)
		if len(strings.Fields(trimmedTitle)) > 10 {
			return nil, errors.New("course title cannot exceed 10 words")
		}
		course.Title = trimmedTitle
	}
	if strings.TrimSpace(req.Duration) != "" {
		course.Duration = strings.TrimSpace(req.Duration)
	}
	if strings.TrimSpace(req.Category) != "" {
		course.Category = strings.TrimSpace(req.Category)
	}
	trimmedDesc := strings.TrimSpace(req.Description)
	if trimmedDesc != "" && len(strings.Fields(trimmedDesc)) > 50 {
		return nil, errors.New("course description cannot exceed 50 words")
	}
	course.Description = trimmedDesc

	if strings.TrimSpace(req.YouTubeURL) != "" && req.YouTubeURL != course.YouTubeURL {
		videoID, err := ExtractYouTubeVideoID(req.YouTubeURL)
		if err == nil && videoID != "" {
			course.YouTubeVideoID = videoID
			course.YouTubeURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)
			course.ThumbnailURL = fmt.Sprintf("https://img.youtube.com/vi/%s/hqdefault.jpg", videoID)
		}
	}

	if err := s.repo.Update(ctx, course); err != nil {
		return nil, err
	}
	return course, nil
}

func (s *CourseServiceImpl) DeleteCourse(ctx context.Context, id string, expertID string) error {
	courseObjID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid course ID")
	}

	expertObjID, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return errors.New("invalid expert ID")
	}

	return s.repo.Delete(ctx, courseObjID, expertObjID)
}
