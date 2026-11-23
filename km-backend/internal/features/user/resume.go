package user

import (
	"context"
	"strings"
	"time"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// A member keeps one resume on their profile. Recruiters can download it only while the member
// shares it, and each download is counted against the recruiter's plan (see recruiterplan).

var (
	ErrResumeFileInvalid = apperr.New("RESUME_FILE_INVALID", "upload your resume as a PDF or Word file first")
	ErrResumeMissing     = apperr.New("RESUME_NOT_FOUND", "add a resume to your profile first")
)

// ResumeStatus is what the owner sees in their profile
type ResumeStatus struct {
	Resume *ProfileResume `json:"resume"`
	Shared bool           `json:"shared"`
}

// ResumeRepository is the storage part of profile resumes
type ResumeRepository interface {
	// ResumeFileName returns the original name of a resume file this member uploaded, or "" if
	// the URL isn't one of their resume uploads
	ResumeFileName(ctx context.Context, userID primitive.ObjectID, url string) (string, error)
	SetResume(ctx context.Context, userID primitive.ObjectID, resume *ProfileResume) error
	// SetResumeShared returns false when there is no resume to share
	SetResumeShared(ctx context.Context, userID primitive.ObjectID, shared bool) (bool, error)
	// HasAppliedTo says whether the candidate applied to any of the recruiter's jobs
	HasAppliedTo(ctx context.Context, candidateID, recruiterID primitive.ObjectID) (bool, error)
	// RecordResumeUnlock remembers that a recruiter downloaded this resume, so the file can be opened
	RecordResumeUnlock(ctx context.Context, recruiterID, candidateID primitive.ObjectID, url string) error
}

func (r *UserRepositoryImpl) ResumeFileName(ctx context.Context, userID primitive.ObjectID, url string) (string, error) {
	var f struct {
		OriginalFilename string `bson:"original_filename"`
	}
	err := r.db.DB.Collection("files").FindOne(ctx, bson.M{"url": url, "uploaded_by": userID, "kind": "resume"}).Decode(&f)
	if err != nil {
		if strings.Contains(err.Error(), "no documents") {
			return "", nil
		}
		return "", err
	}
	if f.OriginalFilename == "" {
		f.OriginalFilename = "Resume"
	}
	return f.OriginalFilename, nil
}

func (r *UserRepositoryImpl) SetResume(ctx context.Context, userID primitive.ObjectID, resume *ProfileResume) error {
	update := bson.M{"$set": bson.M{"resume": resume, "updated_at": time.Now()}}
	if resume == nil {
		update = bson.M{"$unset": bson.M{"resume": "", "resume_shared": ""}, "$set": bson.M{"updated_at": time.Now()}}
	}
	_, err := r.userColl.UpdateOne(ctx, bson.M{"_id": userID}, update)
	return err
}

func (r *UserRepositoryImpl) SetResumeShared(ctx context.Context, userID primitive.ObjectID, shared bool) (bool, error) {
	filter := bson.M{"_id": userID}
	update := bson.M{"$unset": bson.M{"resume_shared": ""}}
	if shared {
		filter["resume"] = bson.M{"$ne": nil}
		update = bson.M{"$set": bson.M{"resume_shared": true}}
	}
	res, err := r.userColl.UpdateOne(ctx, filter, update)
	if err != nil {
		return false, err
	}
	return res.MatchedCount > 0, nil
}

func (r *UserRepositoryImpl) HasAppliedTo(ctx context.Context, candidateID, recruiterID primitive.ObjectID) (bool, error) {
	n, err := r.db.DB.Collection("applications").CountDocuments(ctx,
		bson.M{"candidate_id": candidateID, "recruiter_id": recruiterID}, options.Count().SetLimit(1))
	return n > 0, err
}

func (r *UserRepositoryImpl) RecordResumeUnlock(ctx context.Context, recruiterID, candidateID primitive.ObjectID, url string) error {
	_, err := r.db.DB.Collection("resume_unlocks").UpdateOne(ctx,
		bson.M{"recruiter_id": recruiterID, "resume_url": url},
		bson.M{"$set": bson.M{"candidate_id": candidateID, "unlocked_at": time.Now()}},
		options.Update().SetUpsert(true))
	return err
}

// GetResume returns the member's own resume and whether they share it
func (s *UserServiceImpl) GetResume(ctx context.Context, userID string) (*ResumeStatus, error) {
	u, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || u == nil {
		return nil, ErrViewedProfileNotFound
	}
	return &ResumeStatus{Resume: u.Resume, Shared: u.Resume != nil && u.ResumeShared}, nil
}

// SaveResume sets the profile resume to a file the member uploaded as kind "resume"
func (s *UserServiceImpl) SaveResume(ctx context.Context, userID, url string) (*ResumeStatus, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrViewedProfileNotFound
	}
	url = strings.TrimSpace(url)
	if url == "" {
		return nil, ErrResumeFileInvalid
	}
	name, err := s.repo.ResumeFileName(ctx, uid, url)
	if err != nil {
		return nil, err
	}
	if name == "" {
		return nil, ErrResumeFileInvalid
	}
	if err := s.repo.SetResume(ctx, uid, &ProfileResume{URL: url, Name: name, UploadedAt: time.Now()}); err != nil {
		return nil, err
	}
	return s.GetResume(ctx, userID)
}

// DeleteResume removes the profile resume, which also stops sharing it
func (s *UserServiceImpl) DeleteResume(ctx context.Context, userID string) error {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return ErrViewedProfileNotFound
	}
	return s.repo.SetResume(ctx, uid, nil)
}

// ShareResume turns recruiter downloads on or off
func (s *UserServiceImpl) ShareResume(ctx context.Context, userID string, shared bool) (*ResumeStatus, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrViewedProfileNotFound
	}
	ok, err := s.repo.SetResumeShared(ctx, uid, shared)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrResumeMissing
	}
	return s.GetResume(ctx, userID)
}

func (ctrl *UserController) GetResume(c *fiber.Ctx) error {
	res, err := ctrl.service.GetResume(c.Context(), c.Locals("user_id").(string))
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(res)
}

func (ctrl *UserController) SaveResume(c *fiber.Ctx) error {
	var req struct {
		URL string `json:"url"`
	}
	if err := c.BodyParser(&req); err != nil {
		return apperr.Respond(c, ErrResumeFileInvalid)
	}
	res, err := ctrl.service.SaveResume(c.Context(), c.Locals("user_id").(string), req.URL)
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(res)
}

func (ctrl *UserController) DeleteResume(c *fiber.Ctx) error {
	if err := ctrl.service.DeleteResume(c.Context(), c.Locals("user_id").(string)); err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(ResumeStatus{})
}

func (ctrl *UserController) ShareResume(c *fiber.Ctx) error {
	var req struct {
		Shared bool `json:"shared"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}
	res, err := ctrl.service.ShareResume(c.Context(), c.Locals("user_id").(string), req.Shared)
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(res)
}
