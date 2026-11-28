package application

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/notification"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// A candidate can withdraw an application while it is still open (Applied, Shortlisted or
// Interviewing). Their upcoming interviews for it are cancelled, and the employer gets a
// notification and an email (unless they turned application emails off).

// upcomingInterviewCanceller is the part of the repository that cancels interviews
type upcomingInterviewCanceller interface {
	CancelUpcomingInterviews(ctx context.Context, applicationID primitive.ObjectID) (int64, error)
}

// CancelUpcomingInterviews cancels the application's interviews that haven't happened yet
func (r *ApplicationRepositoryImpl) CancelUpcomingInterviews(ctx context.Context, applicationID primitive.ObjectID) (int64, error) {
	now := time.Now()
	res, err := r.db.DB.Collection("interviews").UpdateMany(ctx,
		bson.M{"application_id": applicationID, "status": "Scheduled", "scheduled_at": bson.M{"$gt": now}},
		bson.M{"$set": bson.M{"status": "Cancelled", "updated_at": now}})
	if err != nil {
		return 0, err
	}
	return res.ModifiedCount, nil
}

// WithdrawApplication is the candidate taking back their application
func (s *ApplicationService) WithdrawApplication(ctx context.Context, id, candidateID string) (*Application, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return nil, ErrApplicationNotFound
	}
	app, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// Someone else's application looks the same as a missing one
	if app == nil || app.CandidateID.Hex() != candidateID {
		return nil, ErrApplicationNotFound
	}
	if knownStatus(app.Status) == StatusWithdrawn {
		return app, nil
	}
	if !CanWithdraw(app.Status) {
		return nil, ErrCannotWithdraw
	}
	updated, err := s.repo.UpdateStatus(ctx, id, StatusWithdrawn)
	if err != nil {
		return nil, err
	}
	if c, ok := s.repo.(upcomingInterviewCanceller); ok {
		if _, err := c.CancelUpcomingInterviews(ctx, updated.ID); err != nil {
			log.Printf("[Withdraw] cancelling interviews for %s: %v", id, err)
		}
	}
	go s.tellEmployerWithdrawn(updated)
	return updated, nil
}

// tellEmployerWithdrawn sends the employer a notification and an email
func (s *ApplicationService) tellEmployerWithdrawn(app *Application) {
	if app == nil || app.RecruiterID.IsZero() {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	jobTitle := "your job"
	if j, _ := s.jobRepo.FindByID(ctx, app.JobID.Hex()); j != nil && j.Title != "" {
		jobTitle = j.Title
	}
	candName, candAvatar := "A candidate", ""
	if c, _ := s.userRepo.FindUserByID(ctx, app.CandidateID.Hex()); c != nil {
		if n := strings.TrimSpace(c.Name); n != "" {
			candName = n
		} else if n := strings.TrimSpace(c.FirstName + " " + c.LastName); n != "" {
			candName = n
		}
		candAvatar = c.ProfileImage
	}
	link := fmt.Sprintf("/recruiter/applications?job_id=%s&status=%s&a=%s", app.JobID.Hex(), StatusWithdrawn, app.ID.Hex())

	if s.notifService != nil {
		cid := app.CandidateID
		_, _ = s.notifService.CreateNotification(ctx, notification.CreateNotificationRequest{
			UserID:      app.RecruiterID,
			ActorID:     &cid,
			ActorName:   candName,
			ActorAvatar: candAvatar,
			Type:        notification.TypeApplicationStatus,
			Category:    notification.CategoryJobs,
			Title:       "Application withdrawn",
			Message:     fmt.Sprintf("%s withdrew their application for %s", candName, jobTitle),
			Link:        link,
			Metadata: map[string]interface{}{
				"application_id": app.ID.Hex(),
				"job_id":         app.JobID.Hex(),
				"status":         StatusWithdrawn,
			},
		})
	}

	if s.mailer == nil {
		return
	}
	recruiter, _ := s.userRepo.FindUserByID(ctx, app.RecruiterID.Hex())
	if recruiter == nil || recruiter.Email == "" {
		return
	}
	if recruiter.Settings.ProfileVisibility != "" && !recruiter.Settings.EmailApplicationUpdates {
		return
	}
	if err := s.mailer.SendApplicationWithdrawn(notification.ApplicationWithdrawnParams{
		ToEmail: recruiter.Email, RecruiterName: strings.TrimSpace(recruiter.Name),
		CandidateName: candName, JobTitle: jobTitle, ActionURL: s.siteURL() + link,
	}); err != nil {
		log.Printf("[Withdraw] email to %s failed: %v", recruiter.Email, err)
	}
}

// Withdraw is POST /api/applications/:id/withdraw
func (c *ApplicationController) Withdraw(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("user_id").(string)
	if !ok {
		return apperr.Respond(ctx, ErrApplicationNotFound)
	}
	app, err := c.service.WithdrawApplication(ctx.Context(), ctx.Params("id"), userID)
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.JSON(app)
}
