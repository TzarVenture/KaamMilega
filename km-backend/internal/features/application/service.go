package application

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"km-backend/internal/features/job"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ApplicationService struct {
	repo         ApplicationRepository
	jobRepo      job.JobRepository
	userRepo     user.UserRepository
	mailer       notification.Mailer
	notifService notification.NotificationService
}

// NewApplicationService constructs the service with a Mailer and NotificationService injected by the DI container.
func NewApplicationService(
	repo ApplicationRepository,
	jobRepo job.JobRepository,
	userRepo user.UserRepository,
	mailer notification.Mailer,
	notifService notification.NotificationService,
) *ApplicationService {
	return &ApplicationService{
		repo:         repo,
		jobRepo:      jobRepo,
		userRepo:     userRepo,
		mailer:       mailer,
		notifService: notifService,
	}
}

func (s *ApplicationService) CreateApplication(ctx context.Context, req *CreateApplicationRequest, candidateID string) (*Application, error) {
	if req.JobID == "" {
		return nil, ErrInvalidJobID
	}

	jOID, err := primitive.ObjectIDFromHex(req.JobID)
	if err != nil {
		return nil, ErrInvalidJobID
	}

	cOID, err := primitive.ObjectIDFromHex(candidateID)
	if err != nil {
		return nil, ErrInvalidCandidate
	}

	// Check if job exists
	jobInfo, err := s.jobRepo.FindByID(ctx, req.JobID)
	if err != nil {
		return nil, err
	}
	if jobInfo == nil {
		return nil, ErrJobNotFound
	}

	// Check if job is closed, deleted, or on hold
	if strings.EqualFold(jobInfo.Status, "closed") || strings.EqualFold(jobInfo.Status, "deleted") || strings.EqualFold(jobInfo.Status, "on hold") || strings.EqualFold(jobInfo.Status, "onhold") || strings.EqualFold(jobInfo.Status, "paused") || jobInfo.HiddenByAccount {
		return nil, ErrJobClosed
	}

	// Recruiter cannot apply to their own job posting
	if !jobInfo.RecruiterID.IsZero() && jobInfo.RecruiterID == cOID {
		return nil, ErrCannotApplyOwn
	}

	// Check if already applied
	exists, err := s.repo.HasApplied(ctx, candidateID, req.JobID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrAlreadyApplied
	}

	// Applications unlock at the Professional tier; the apply form asks for what is missing
	candidate, err := s.userRepo.FindUserByID(ctx, candidateID)
	if err != nil {
		return nil, err
	}
	if !user.CanApplyForJobs(candidate) {
		return nil, ErrProfileIncomplete
	}

	// The recruiter gets access to the attached file, so it must be a resume this member uploaded
	req.ResumeURL = strings.TrimSpace(req.ResumeURL)
	if req.ResumeURL != "" {
		name, err := s.userRepo.ResumeFileName(ctx, cOID, req.ResumeURL)
		if err != nil {
			return nil, err
		}
		if name == "" {
			return nil, ErrResumeNotYours
		}
	}

	app := &Application{
		JobID:       jOID,
		RecruiterID: jobInfo.RecruiterID,
		CandidateID: cOID,
		Status:      "Applied",
		CoverLetter: req.CoverLetter,
		ResumeURL:   req.ResumeURL,
	}

	createdApp, err := s.repo.Create(ctx, app)
	if err != nil {
		return nil, err
	}

	if s.notifService != nil && !jobInfo.RecruiterID.IsZero() {
		go func() {
			candName := "A candidate"
			candAvatar := ""
			if candidateUser, _ := s.userRepo.FindUserByID(context.Background(), candidateID); candidateUser != nil {
				if candidateUser.Name != "" {
					candName = candidateUser.Name
				} else if candidateUser.FirstName != "" {
					candName = candidateUser.FirstName + " " + candidateUser.LastName
				}
				candAvatar = candidateUser.ProfileImage
			}

			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      jobInfo.RecruiterID,
				ActorID:     &cOID,
				ActorName:   candName,
				ActorAvatar: candAvatar,
				Type:        notification.TypeApplicationReceived,
				Category:    notification.CategoryJobs,
				Title:       "New Application Received",
				Message:     fmt.Sprintf("%s applied for %s", candName, jobInfo.Title),
				Link:        fmt.Sprintf("/recruiter/applications?job_id=%s&a=%s", jobInfo.ID.Hex(), createdApp.ID.Hex()),
				Metadata: map[string]interface{}{
					"application_id": createdApp.ID.Hex(),
					"job_id":         jobInfo.ID.Hex(),
					"candidate_id":   candidateID,
				},
			})

			// Email the employer too, unless they turned application emails off
			if s.mailer == nil {
				return
			}
			recruiter, _ := s.userRepo.FindUserByID(context.Background(), jobInfo.RecruiterID.Hex())
			if recruiter == nil || recruiter.Email == "" {
				return
			}
			if recruiter.Settings.ProfileVisibility != "" && !recruiter.Settings.EmailApplicationUpdates {
				return
			}
			p := notification.NewApplicationParams{
				ToEmail: recruiter.Email, RecruiterName: strings.TrimSpace(recruiter.Name),
				CandidateName: candName, JobTitle: jobInfo.Title,
				ActionURL: fmt.Sprintf("%s/recruiter/applications?job_id=%s&a=%s", s.siteURL(), jobInfo.ID.Hex(), createdApp.ID.Hex()),
			}
			if c, _ := s.userRepo.FindUserByID(context.Background(), candidateID); c != nil {
				p.Headline, p.City = c.Headline, c.City
			}
			if err := s.mailer.SendNewApplication(p); err != nil {
				log.Printf("[ApplicationNotification] New applicant email to %s failed: %v", recruiter.Email, err)
			}
		}()
	}

	return createdApp, nil
}

func (s *ApplicationService) HasCandidateApplied(ctx context.Context, candidateID, jobID string) (bool, error) {
	if _, err := primitive.ObjectIDFromHex(candidateID); err != nil {
		return false, ErrInvalidCandidate
	}
	if _, err := primitive.ObjectIDFromHex(jobID); err != nil {
		return false, ErrInvalidJobID
	}
	return s.repo.HasApplied(ctx, candidateID, jobID)
}

func (s *ApplicationService) GetApplication(ctx context.Context, id string) (*Application, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *ApplicationService) GetApplicationsForJob(ctx context.Context, jobID string) ([]Application, error) {
	return s.repo.FindAll(ctx, ApplicationFilter{JobID: jobID})
}

func (s *ApplicationService) GetApplicationsByRecruiter(ctx context.Context, recruiterID string) ([]Application, error) {
	return s.repo.FindAll(ctx, ApplicationFilter{RecruiterID: recruiterID})
}

func (s *ApplicationService) GetApplicationsByCandidateDetailed(ctx context.Context, candidateID string) ([]ApplicationDetail, error) {
	apps, err := s.repo.FindAll(ctx, ApplicationFilter{CandidateID: candidateID})
	if err != nil {
		return nil, err
	}

	details := make([]ApplicationDetail, 0, len(apps))
	for _, app := range apps {
		jobInfo, _ := s.jobRepo.FindByID(ctx, app.JobID.Hex())

		detail := ApplicationDetail{
			ID:          app.ID.Hex(),
			JobID:       app.JobID.Hex(),
			RecruiterID: app.RecruiterID.Hex(),
			CandidateID: app.CandidateID.Hex(),
			Status:      app.Status,
			CoverLetter: app.CoverLetter,
			ResumeURL:   app.ResumeURL,
			CreatedAt:   app.CreatedAt,
			UpdatedAt:   app.UpdatedAt,
		}

		if jobInfo != nil {
			detail.Job = &JobInfo{
				ID:            jobInfo.ID.Hex(),
				Title:         jobInfo.Title,
				Company:       jobInfo.Company,
				Location:      jobInfo.Location,
				CityName:      jobInfo.CityName,
				SalaryMin:     jobInfo.SalaryMin,
				SalaryMax:     jobInfo.SalaryMax,
				JobType:       jobInfo.JobType,
				Status:        jobInfo.Status,
				ExperienceMin: jobInfo.ExperienceMin,
				ExperienceMax: jobInfo.ExperienceMax,
				Rating:        4.2,             // Mocked
				Reviews:       "4.4K+ Reviews", // Mocked
				StatusText:    "Resume viewed 7 week ago",
				LastActive:    "Recruiter last active 5w ago",
			}
		}

		details = append(details, detail)
	}

	return details, nil
}

func (s *ApplicationService) GetRecruiterApplicationsDetailed(ctx context.Context, filter ApplicationFilter) ([]ApplicationDetail, error) {
	apps, err := s.repo.FindAll(ctx, filter)
	if err != nil {
		return nil, err
	}

	details := make([]ApplicationDetail, 0, len(apps))
	for _, app := range apps {
		jobInfo, _ := s.jobRepo.FindByID(ctx, app.JobID.Hex())
		var candidateInfo *CandidateInfo
		if candidateUser, _ := s.userRepo.FindUserByID(ctx, app.CandidateID.Hex()); candidateUser != nil {
			candidateInfo = &CandidateInfo{
				ID:           candidateUser.ID.Hex(),
				Name:         candidateUser.Name,
				Email:        candidateUser.Email,
				Mobile:       candidateUser.Mobile,
				ProfileImage: candidateUser.ProfileImage,
				Headline:     candidateUser.Headline,
				City:         candidateUser.City,
				Skills:       candidateUser.Skills,
			}
		}

		detail := ApplicationDetail{
			ID:          app.ID.Hex(),
			JobID:       app.JobID.Hex(),
			RecruiterID: app.RecruiterID.Hex(),
			CandidateID: app.CandidateID.Hex(),
			Status:      app.Status,
			CoverLetter: app.CoverLetter,
			ResumeURL:   app.ResumeURL,
			CreatedAt:   app.CreatedAt,
			UpdatedAt:   app.UpdatedAt,
			Candidate:   candidateInfo,
		}

		if jobInfo != nil {
			detail.Job = &JobInfo{
				ID:            jobInfo.ID.Hex(),
				Title:         jobInfo.Title,
				Company:       jobInfo.Company,
				Location:      jobInfo.Location,
				CityName:      jobInfo.CityName,
				SalaryMin:     jobInfo.SalaryMin,
				SalaryMax:     jobInfo.SalaryMax,
				JobType:       jobInfo.JobType,
				Status:        jobInfo.Status,
				ExperienceMin: jobInfo.ExperienceMin,
				ExperienceMax: jobInfo.ExperienceMax,
			}
		}

		details = append(details, detail)
	}

	return details, nil
}

// ownsJob reports whether userID posted the job (admins may act on any job)
func (s *ApplicationService) ownsJob(ctx context.Context, jobID, userID string, isAdmin bool) error {
	if _, err := primitive.ObjectIDFromHex(jobID); err != nil {
		return ErrJobNotFound
	}
	j, err := s.jobRepo.FindByID(ctx, jobID)
	if err != nil {
		return err
	}
	if j == nil {
		return ErrJobNotFound
	}
	if !isAdmin && j.RecruiterID.Hex() != userID {
		return ErrApplicationForbidden
	}
	return nil
}

// GetJobApplicationsForOwner lists a job's applicants for the employer who posted it
func (s *ApplicationService) GetJobApplicationsForOwner(ctx context.Context, jobID, userID string, isAdmin bool) ([]ApplicationDetail, error) {
	if err := s.ownsJob(ctx, jobID, userID, isAdmin); err != nil {
		return nil, err
	}
	return s.GetRecruiterApplicationsDetailed(ctx, ApplicationFilter{JobID: jobID})
}

// UpdateApplicationStatus moves an application to another stage. Only the job's employer (or an
// admin) may do it, only to a known stage, and a move to the stage it is already in changes nothing
// (so the candidate isn't emailed twice).
func (s *ApplicationService) UpdateApplicationStatus(ctx context.Context, id, status, userID string, isAdmin bool) (*Application, error) {
	status = CanonicalStatus(status)
	if status == "" {
		return nil, ErrInvalidStatus
	}
	// A removed job falls back to the employer stamped on the application
	existing, err := s.ownApplication(ctx, id, userID, isAdmin)
	if err != nil {
		return nil, err
	}
	if existing.Status == status {
		return existing, nil
	}
	if knownStatus(existing.Status) == StatusWithdrawn {
		return nil, ErrApplicationWithdrawn
	}

	// 1. Update the status
	updated, err := s.repo.UpdateStatus(ctx, id, status)
	if err != nil {
		return nil, err
	}

	// 2. Fetch candidate and check notification settings
	candidate, err := s.userRepo.FindUserByID(ctx, updated.CandidateID.Hex())
	if err != nil || candidate == nil {
		// Notification failure is non-fatal: return the updated application
		return updated, nil
	}

	// Transactional status notifications are enabled by default unless user explicitly opted out
	emailUpdatesEnabled := true
	if candidate.Settings.ProfileVisibility != "" {
		emailUpdatesEnabled = candidate.Settings.EmailApplicationUpdates
	}

	if emailUpdatesEnabled && candidate.Email != "" {
		jobTitle := "your applied position"
		company := ""
		if jobInfo, jerr := s.jobRepo.FindByID(ctx, updated.JobID.Hex()); jerr == nil && jobInfo != nil {
			jobTitle = jobInfo.Title
			company = jobInfo.Company
		}

		candidateName := strings.TrimSpace(candidate.Name)
		if candidateName == "" {
			candidateName = strings.TrimSpace(candidate.FirstName + " " + candidate.LastName)
		}
		if candidateName == "" {
			candidateName = "Candidate"
		}

		// Fire-and-forget via centralized mailer — non-fatal
		go func() {
			if s.mailer == nil {
				log.Printf("[ApplicationNotification] Mailer is nil, skipping status email to %s", candidate.Email)
				return
			}
			merr := s.mailer.SendApplicationUpdate(notification.ApplicationUpdateParams{
				ToEmail:       candidate.Email,
				CandidateName: candidateName,
				JobTitle:      jobTitle,
				CompanyName:   company,
				NewStatus:     status,
			})
			if merr != nil {
				log.Printf("[ApplicationNotification] Failed to send status email to %s: %v", candidate.Email, merr)
			} else {
				log.Printf("[ApplicationNotification] Status update email sent successfully to %s for '%s' -> %s", candidate.Email, jobTitle, status)
			}
		}()
	} else if candidate.Email == "" {
		log.Printf("[ApplicationNotification] Candidate %s has no email address, skipping email notification", candidate.ID.Hex())
	}

	// Real-time in-app notification to candidate
	if s.notifService != nil {
		go func() {
			jobTitle := "your applied position"
			companyName := "Recruiter"
			if j, err := s.jobRepo.FindByID(context.Background(), updated.JobID.Hex()); err == nil && j != nil {
				if j.Title != "" {
					jobTitle = j.Title
				}
				if j.Company != "" {
					companyName = j.Company
				}
			}

			// "Not selected" rather than "Rejected"
			statusLabel := notification.CandidateStatusLabel(status)

			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      updated.CandidateID,
				ActorName:   companyName,
				Type:        notification.TypeApplicationStatus,
				Category:    notification.CategoryJobs,
				Title:       "Application Status Updated",
				Message:     fmt.Sprintf("Your application for %s: %s", jobTitle, statusLabel),
				Link:        "/applications",
				Metadata: map[string]interface{}{
					"application_id": updated.ID.Hex(),
					"job_id":         updated.JobID.Hex(),
					"status":         status,
				},
			})
		}()
	}

	return updated, nil
}



// siteURL is the website origin for links in emails (FRONTEND_URL, kaammilega.com by default)
func (s *ApplicationService) siteURL() string {
	if u := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/"); u != "" {
		return u
	}
	return "https://kaammilega.com"
}
