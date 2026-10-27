package interview

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"km-backend/internal/features/application"
	"km-backend/internal/features/job"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
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

	// Promote application to 'Interviewing'
	_, _ = s.appRepo.UpdateStatus(ctx, req.ApplicationID, "Interviewing")

	created, err := s.repo.Create(ctx, interview)
	if err != nil {
		return nil, err
	}

	// Notify candidate via centralized mailer — fire-and-forget, non-fatal
	go func() {
		candidate, cerr := s.userRepo.FindUserByID(ctx, app.CandidateID.Hex())
		if cerr != nil || candidate == nil {
			return
		}
		emailUpdatesEnabled := true
		if candidate.Settings.ProfileVisibility != "" {
			emailUpdatesEnabled = candidate.Settings.EmailApplicationUpdates
		}
		if !emailUpdatesEnabled || candidate.Email == "" {
			return
		}

		jobTitle := "your applied position"
		company := ""
		if a, aerr := s.appRepo.FindByID(ctx, req.ApplicationID); aerr == nil && a != nil {
			if j, jerr := s.jobRepo.FindByID(ctx, a.JobID.Hex()); jerr == nil && j != nil {
				jobTitle = j.Title
				company = j.Company
			}
		}

		candidateName := strings.TrimSpace(candidate.Name)
		if candidateName == "" {
			candidateName = strings.TrimSpace(candidate.FirstName + " " + candidate.LastName)
		}
		if candidateName == "" {
			candidateName = "Candidate"
		}

		if s.mailer == nil {
			log.Printf("[InterviewNotification] Mailer is nil, skipping interview invite to %s", candidate.Email)
			return
		}

		merr := s.mailer.SendInterviewInvite(notification.InterviewInviteParams{
			ToEmail:       candidate.Email,
			CandidateName: candidateName,
			JobTitle:      jobTitle,
			CompanyName:   company,
			InterviewType: req.Type,
			ScheduledAt:   req.ScheduledAt,
			Location:      req.Location,
			Notes:         req.Notes,
		})
		if merr != nil {
			log.Printf("[InterviewNotification] Failed to send interview invite to %s: %v", candidate.Email, merr)
		} else {
			log.Printf("[InterviewNotification] Successfully sent interview invite to %s for '%s'", candidate.Email, jobTitle)
		}
	}()

	// Real-time in-app notification to candidate
	if s.notifService != nil {
		go func() {
			jobTitle := "your position"
			companyName := "Recruiter"
			if appInfo, err := s.appRepo.FindByID(context.Background(), created.ApplicationID.Hex()); err == nil && appInfo != nil {
				if j, err := s.jobRepo.FindByID(context.Background(), appInfo.JobID.Hex()); err == nil && j != nil {
					if j.Title != "" {
						jobTitle = j.Title
					}
					if j.Company != "" {
						companyName = j.Company
					}
				}
			}

			timeStr := created.ScheduledAt.Format("02 Jan, 3:04 PM")
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      created.CandidateID,
				ActorName:   companyName,
				Type:        notification.TypeInterviewScheduled,
				Category:    notification.CategoryJobs,
				Title:       "Interview Scheduled",
				Message:     fmt.Sprintf("Interview scheduled for %s on %s (%s)", jobTitle, timeStr, created.Type),
				Link:        "/interviews",
				Metadata: map[string]interface{}{
					"interview_id":   created.ID.Hex(),
					"application_id": created.ApplicationID.Hex(),
				},
			})
		}()
	}

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

func (s *InterviewService) UpdateInterviewStatus(ctx context.Context, id string, status string) (*Interview, error) {
	return s.repo.UpdateStatus(ctx, id, status)
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
		update["status"] = req.Status
	}

	if len(update) == 0 {
		return existing, nil
	}

	updated, err := s.repo.Update(ctx, id, update)
	if err != nil {
		return nil, err
	}

	if timeChanged && s.notifService != nil {
		go func() {
			jobTitle := "your position"
			if app, _ := s.appRepo.FindByID(context.Background(), existing.ApplicationID.Hex()); app != nil {
				if j, _ := s.jobRepo.FindByID(context.Background(), app.JobID.Hex()); j != nil && j.Title != "" {
					jobTitle = j.Title
				}
			}

			timeStr := updated.ScheduledAt.Format("02 Jan 2006 at 03:04 PM")
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:   existing.CandidateID,
				Type:     notification.TypeInterviewScheduled,
				Category: notification.CategoryJobs,
				Title:    "Interview Rescheduled",
				Message:  fmt.Sprintf("Your interview for %s has been rescheduled to %s", jobTitle, timeStr),
				Link:     "/interviews",
				Metadata: map[string]interface{}{
					"interview_id":   updated.ID.Hex(),
					"application_id": existing.ApplicationID.Hex(),
				},
			})
		}()
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

	return s.repo.Delete(ctx, id)
}
