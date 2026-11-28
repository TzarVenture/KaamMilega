package interview

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Interview feedback: after an interview the employer notes how it went (good, okay, no-show)
// with a short note. It is private to the employer: the candidate never sees it. Giving
// feedback marks the interview Completed.

// Feedback outcomes
const (
	OutcomeGood   = "good"
	OutcomeOkay   = "okay"
	OutcomePoor   = "poor"
	OutcomeNoShow = "no_show"
)

const feedbackNoteMaxChars = 500

var (
	ErrFeedbackInvalid   = apperr.New("FEEDBACK_INVALID", "pick how the interview went (good, okay, poor or no-show); the note can be up to 500 characters")
	ErrFeedbackTooSoon   = apperr.New("FEEDBACK_TOO_SOON", "you can give feedback once the interview time has passed")
	ErrFeedbackCancelled = apperr.New("FEEDBACK_CANCELLED", "this interview was cancelled")
)

// Feedback is the employer's private record of how the interview went
type Feedback struct {
	Outcome string    `bson:"outcome" json:"outcome"`
	Note    string    `bson:"note,omitempty" json:"note,omitempty"`
	At      time.Time `bson:"at" json:"at"`
}

type feedbackRequest struct {
	Outcome string `json:"outcome"`
	Note    string `json:"note"`
}

func validOutcome(o string) bool {
	switch o {
	case OutcomeGood, OutcomeOkay, OutcomePoor, OutcomeNoShow:
		return true
	}
	return false
}

// SaveFeedback records the employer's feedback and marks the interview Completed
func (s *InterviewService) SaveFeedback(ctx context.Context, id, userID, outcome, note string, now time.Time) (*Interview, error) {
	outcome = strings.ToLower(strings.TrimSpace(outcome))
	note = strings.TrimSpace(note)
	if !validOutcome(outcome) || utf8.RuneCountInString(note) > feedbackNoteMaxChars {
		return nil, ErrFeedbackInvalid
	}
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return nil, ErrInterviewNotFound
	}
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrInterviewNotFound
	}
	if existing.RecruiterID.Hex() != userID {
		// The candidate (or anyone else) is told it doesn't exist
		return nil, ErrInterviewNotFound
	}
	if existing.Status == "Cancelled" {
		return nil, ErrFeedbackCancelled
	}
	if now.Before(existing.ScheduledAt) {
		return nil, ErrFeedbackTooSoon
	}
	return s.repo.Update(ctx, id, bson.M{
		"status":   "Completed",
		"feedback": Feedback{Outcome: outcome, Note: note, At: now},
	})
}

// PATCH /api/interviews/:id/feedback
func (c *InterviewController) SaveFeedback(ctx *fiber.Ctx) error {
	var req feedbackRequest
	if err := ctx.BodyParser(&req); err != nil {
		return apperr.Respond(ctx, ErrFeedbackInvalid)
	}
	userID, _ := ctx.Locals("user_id").(string)
	iv, err := c.service.SaveFeedback(ctx.Context(), ctx.Params("id"), userID, req.Outcome, req.Note, time.Now())
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.JSON(iv)
}
