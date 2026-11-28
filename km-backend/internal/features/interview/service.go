package interview

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/application"
	"km-backend/internal/features/job"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type InterviewService struct {
	repo         InterviewRepository
	appRepo      application.ApplicationRepository
	jobRepo      job.JobRepository
	userRepo     user.UserRepository
	mailer       notification.Mailer
	notifService notification.NotificationService
}

// NewInterviewService constructs the service with a Mailer and NotificationService injected by the DI container.
func NewInterviewService(
	repo InterviewRepository,
	appRepo application.ApplicationRepository,
	jobRepo job.JobRepository,
	userRepo user.UserRepository,
	mailer notification.Mailer,
	notifService notification.NotificationService,
) *InterviewService {
	return &InterviewService{
		repo:         repo,
		appRepo:      appRepo,
		jobRepo:      jobRepo,
		userRepo:     userRepo,
		mailer:       mailer,
		notifService: notifService,
	}
}

func (s *InterviewService) ScheduleInterview(ctx context.Context, req *ScheduleInterviewRequest, recruiterID string) (*Interview, error) {
	// Validate Application
	app, err := s.appRepo.FindByID(ctx, req.ApplicationID)
	if err != nil {
		return nil, err
	}
	if app == nil {
		return nil, errors.New("application not found")
	}

	// Verify recruiter owns the application
	if app.RecruiterID.Hex() != recruiterID {
		return nil, errors.New("unauthorized to schedule interview for this application")
	}

	interview := &Interview{
		ApplicationID: app.ID,
		RecruiterID:   app.RecruiterID,
		CandidateID:   app.CandidateID,
		ScheduledAt:   req.ScheduledAt,
		Type:          req.Type,
		Location:      req.Location,
		Notes:         req.Notes,
		Status:        "Scheduled",
	}

	// Promote an open application to 'Interviewing' (a Hired or Rejected one keeps its stage)
	if app.Status == "Applied" || app.Status == "Shortlisted" || app.Status == "" {
		_, _ = s.appRepo.UpdateStatus(ctx, req.ApplicationID, "Interviewing")
	}

	created, err := s.repo.Create(ctx, interview)
	if err != nil {
		return nil, err
	}

	go s.tellCandidate(created, notification.InterviewScheduled)

	return created, nil
}
	

func (s *InterviewService) GetMyInterviews(ctx context.Context, userID string) ([]InterviewDetail, error) {
	interviews, err := s.repo.FindByParticipant(ctx, userID)
	if err != nil {
		return nil, err
	}

	details := make([]InterviewDetail, 0, len(interviews))
	for _, in := range interviews {
		detail := InterviewDetail{
			ID:            in.ID.Hex(),
			ApplicationID: in.ApplicationID.Hex(),
			RecruiterID:   in.RecruiterID.Hex(),
			CandidateID:   in.CandidateID.Hex(),
			ScheduledAt:   in.ScheduledAt,
			Type:          in.Type,
			Location:      in.Location,
			Status:        in.Status,
			Notes:         in.Notes,
			CreatedAt:     in.CreatedAt,
			UpdatedAt:     in.UpdatedAt,
		}

		// Fetch Job Info
		app, _ := s.appRepo.FindByID(ctx, in.ApplicationID.Hex())
		if app != nil {
			j, _ := s.jobRepo.FindByID(ctx, app.JobID.Hex())
			if j != nil {
				detail.Job = &InterviewJobInfo{
					ID:      j.ID.Hex(),
					Title:   j.Title,
					Company: j.Company,
				}
			}
		}

		// Fetch Candidate Info
		c, _ := s.userRepo.FindUserByID(ctx, in.CandidateID.Hex())
		if c != nil {
			candName := c.Name
			if candName == "" {
				candName = strings.TrimSpace(c.FirstName + " " + c.LastName)
			}
			detail.Candidate = &InterviewUserInfo{
				ID:           c.ID.Hex(),
				Name:         candName,
				Email:        c.Email,
				Mobile:       c.Mobile,
				Headline:     c.Headline,
				ProfileImage: c.ProfileImage,
				Username:     c.Username,
			}
		}

		// Fetch Recruiter Info
		r, _ := s.userRepo.FindUserByID(ctx, in.RecruiterID.Hex())
		if r != nil {
			recName := r.Name
			if recName == "" {
				recName = strings.TrimSpace(r.FirstName + " " + r.LastName)
			}
			detail.Recruiter = &InterviewUserInfo{
				ID:           r.ID.Hex(),
				Name:         recName,
				Email:        r.Email,
				Mobile:       r.Mobile,
				Headline:     r.Headline,
				ProfileImage: r.ProfileImage,
				Username:     r.Username,
			}
		}

		details = append(details, detail)
	}

	return details, nil
}

var (
	ErrInterviewNotFound  = apperr.New("INTERVIEW_NOT_FOUND", "interview not found")
	ErrInterviewForbidden = apperr.New("INTERVIEW_FORBIDDEN", "only the employer who scheduled this interview can change it")
	ErrInvalidStatus      = apperr.New("INVALID_STATUS", "status must be Scheduled, Completed or Cancelled")
)

// UpdateInterviewStatus lets the employer who scheduled the interview (or an admin) mark it
// Scheduled, Completed or Cancelled
func (s *InterviewService) UpdateInterviewStatus(ctx context.Context, id, status, userID string, isAdmin bool) (*Interview, error) {
	canonical := ""
	for _, st := range []string{"Scheduled", "Completed", "Cancelled"} {
		if strings.EqualFold(strings.TrimSpace(status), st) {
			canonical = st
		}
	}
	if canonical == "" {
		return nil, ErrInvalidStatus
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
	if !isAdmin && existing.RecruiterID.Hex() != userID {
		return nil, ErrInterviewForbidden
	}
	updated, err := s.repo.UpdateStatus(ctx, id, canonical)
	if err != nil {
		return nil, err
	}
	// Tell the candidate when a booked interview is called off
	if canonical == "Cancelled" && existing.Status != "Cancelled" && s.notifService != nil {
		go s.notifyCancelled(existing)
	}
	return updated, nil
}

// istZone is India time, for dates written into messages
var istZone = time.FixedZone("IST", 5*3600+1800)

func (s *InterviewService) notifyCancelled(iv *Interview) {
	s.tellCandidate(iv, notification.InterviewCancelled)
}

// tellCandidate emails the candidate (unless they turned application emails off) and sends
// an in-app notice, which also goes out as a push. Runs in the background, so it uses its
// own context: the request's context is gone by the time it runs.
func (s *InterviewService) tellCandidate(iv *Interview, kind string) {
	if iv == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	jobTitle, company := "your applied position", ""
	if app, _ := s.appRepo.FindByID(ctx, iv.ApplicationID.Hex()); app != nil {
		if j, _ := s.jobRepo.FindByID(ctx, app.JobID.Hex()); j != nil {
			if j.Title != "" {
				jobTitle = j.Title
			}
			company = j.Company
		}
	}
	when := iv.ScheduledAt.In(istZone).Format("02 Jan 2006 at 03:04 PM")

	if candidate, _ := s.userRepo.FindUserByID(ctx, iv.CandidateID.Hex()); candidate != nil && candidate.Email != "" && s.mailer != nil {
		emailOn := true
		if candidate.Settings.ProfileVisibility != "" {
			emailOn = candidate.Settings.EmailApplicationUpdates
		}
		if emailOn {
			name := strings.TrimSpace(candidate.Name)
			if name == "" {
				name = strings.TrimSpace(candidate.FirstName + " " + candidate.LastName)
			}
			if err := s.mailer.SendInterviewInvite(notification.InterviewInviteParams{
				ToEmail: candidate.Email, CandidateName: name, JobTitle: jobTitle, CompanyName: company,
				InterviewType: iv.Type, ScheduledAt: iv.ScheduledAt, Location: iv.Location, Notes: iv.Notes, Kind: kind,
				// A calendar invite; the send time as its version keeps every change newer than the last
				InterviewID: iv.ID.Hex(), Version: time.Now().Unix(),
			}); err != nil {
				log.Printf("[InterviewNotification] %s email to %s failed: %v", kind, candidate.Email, err)
			}
		}
	}

	if s.notifService == nil {
		return
	}
	title, msg := "Interview Scheduled", fmt.Sprintf("Interview for %s on %s (%s)", jobTitle, when, iv.Type)
	switch kind {
	case notification.InterviewRescheduled:
		title, msg = "Interview Updated", fmt.Sprintf("Your interview for %s is now on %s (%s)", jobTitle, when, iv.Type)
	case notification.InterviewCancelled:
		title, msg = "Interview Cancelled", fmt.Sprintf("Your interview for %s on %s was cancelled by the employer", jobTitle, when)
	}
	actor := company
	if actor == "" {
		actor = "Employer"
	}
	_, _ = s.notifService.CreateNotification(ctx, notification.CreateNotificationRequest{
		UserID: iv.CandidateID, ActorName: actor,
		Type: notification.TypeInterviewScheduled, Category: notification.CategoryJobs,
		Title: title, Message: msg, Link: "/interviews",
		Metadata: map[string]interface{}{"interview_id": iv.ID.Hex(), "application_id": iv.ApplicationID.Hex(), "kind": kind},
	})
}

func (s *InterviewService) UpdateInterview(ctx context.Context, id string, req *UpdateInterviewRequest, userID string) (*Interview, error) {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("interview not found")
	}

	if existing.RecruiterID.Hex() != userID {
		return nil, errors.New("unauthorized to update this interview")
	}

	update := bson.M{}
	timeChanged := false
	if req.ScheduledAt != nil && !req.ScheduledAt.IsZero() {
		update["scheduled_at"] = *req.ScheduledAt
		if !req.ScheduledAt.Equal(existing.ScheduledAt) {
			timeChanged = true
		}
	}
	if req.Type != "" {
		update["type"] = req.Type
	}
	if req.Location != "" {
		update["location"] = req.Location
	}
	if req.Notes != "" {
		update["notes"] = req.Notes
	}
	if req.Status != "" {
		// Same rules as the status endpoint: only Scheduled, Completed or Cancelled
		canon := ""
		for _, st := range []string{"Scheduled", "Completed", "Cancelled"} {
			if strings.EqualFold(strings.TrimSpace(req.Status), st) {
				canon = st
			}
		}
		if canon == "" {
			return nil, ErrInvalidStatus
		}
		if canon != existing.Status {
			update["status"] = canon
		}
	}
	detailsChanged := timeChanged ||
		(req.Type != "" && req.Type != existing.Type) ||
		(req.Location != "" && req.Location != existing.Location)

	if len(update) == 0 {
		return existing, nil
	}

	updated, err := s.repo.Update(ctx, id, update)
	if err != nil {
		return nil, err
	}

	switch {
	case update["status"] == "Cancelled" && existing.Status != "Cancelled":
		go s.tellCandidate(updated, notification.InterviewCancelled)
	case detailsChanged && updated.Status == "Scheduled":
		go s.tellCandidate(updated, notification.InterviewRescheduled)
	}

	return updated, nil
}

func (s *InterviewService) DeleteInterview(ctx context.Context, id string, userID string) error {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("interview not found")
	}

	if existing.RecruiterID.Hex() != userID {
		return errors.New("unauthorized to delete this interview")
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	if existing.Status == "Scheduled" && existing.ScheduledAt.After(time.Now()) {
		go s.tellCandidate(existing, notification.InterviewCancelled)
	}
	return nil
}
