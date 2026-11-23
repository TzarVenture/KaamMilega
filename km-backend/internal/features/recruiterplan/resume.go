package recruiterplan

import (
	"context"
	"errors"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/user"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var ErrResumeNotShared = apperr.New("RESUME_NOT_FOUND", "this candidate hasn't shared a resume")

// CandidateResume gives a recruiter a candidate's profile resume, if the candidate shares it.
// It counts once per candidate in each plan period; resumes of people who applied to the
// recruiter's jobs are free.
func (s *service) CandidateResume(ctx context.Context, recruiterID, candidateID string) (*user.ProfileResume, error) {
	rid, err := primitive.ObjectIDFromHex(recruiterID)
	if err != nil {
		return nil, apperr.New("UNAUTHORIZED", "sign in again")
	}
	cid, err := primitive.ObjectIDFromHex(candidateID)
	if err != nil || cid == rid {
		return nil, ErrResumeNotShared
	}
	c, err := s.users.FindUserByID(ctx, candidateID)
	if err != nil || c == nil || c.Resume == nil || !c.ResumeShared || c.AccountStatus == "deleted" {
		return nil, ErrResumeNotShared
	}

	applied, err := s.users.HasAppliedTo(ctx, cid, rid)
	if err != nil {
		return nil, err
	}
	release := noRelease
	if !applied {
		if release, err = s.Use(ctx, rid, KindResumeDownload, candidateID); err != nil {
			return nil, err
		}
	}
	if err := s.users.RecordResumeUnlock(ctx, rid, cid, c.Resume.URL); err != nil {
		release(ctx)
		return nil, err
	}
	return c.Resume, nil
}

// CandidateResume godoc
// @Summary Download a candidate's shared profile resume (recruiter); counts against the plan
// @Tags recruiter-plans
// @Produce json
// @Param id path string true "Candidate user ID"
// @Router /recruiter/candidates/{id}/resume [post]
func (ctrl *Controller) CandidateResume(c *fiber.Ctx) error {
	resume, err := ctrl.service.CandidateResume(c.UserContext(), userID(c), c.Params("id"))
	if errors.Is(err, ErrResumesUsedUp) {
		return c.Status(fiber.StatusPaymentRequired).JSON(apperr.Body(err))
	}
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"resume": resume})
}
