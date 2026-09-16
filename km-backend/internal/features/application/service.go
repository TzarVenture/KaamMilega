package application

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"os"

	"km-backend/internal/features/job"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)


type ApplicationService struct {
	repo     ApplicationRepository
	jobRepo  job.JobRepository
	userRepo user.UserRepository
}

func NewApplicationService(repo ApplicationRepository, jobRepo job.JobRepository, userRepo user.UserRepository) *ApplicationService {
	return &ApplicationService{
		repo:     repo,
		jobRepo:  jobRepo,
		userRepo: userRepo,
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

	// Check if job is closed
	if jobInfo.Status == "Closed" || jobInfo.Status == "closed" {
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

	app := &Application{
		JobID:       jOID,
		RecruiterID: jobInfo.RecruiterID,
		CandidateID: cOID,
		Status:      "Applied",
		CoverLetter: req.CoverLetter,
		ResumeURL:   req.ResumeURL,
	}

	return s.repo.Create(ctx, app)
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
				ExperienceMin: jobInfo.ExperienceMin,
				ExperienceMax: jobInfo.ExperienceMax,
			}
		}

		details = append(details, detail)
	}

	return details, nil
}

func (s *ApplicationService) UpdateApplicationStatus(ctx context.Context, id string, status string) (*Application, error) {
	// 1. Update the status
	updated, err := s.repo.UpdateStatus(ctx, id, status)
	if err != nil {
		return nil, err
	}

	// 2. Fetch candidate and check their notification settings
	candidate, err := s.userRepo.FindUserByID(ctx, updated.CandidateID.Hex())
	if err != nil || candidate == nil {
		// Notification failure is non-fatal: return the updated application
		return updated, nil
	}

	if candidate.Settings.EmailApplicationUpdates && candidate.Email != "" {
		// Fetch job title for a meaningful notification
		jobTitle := "your applied position"
		if jobInfo, jerr := s.jobRepo.FindByID(ctx, updated.JobID.Hex()); jerr == nil && jobInfo != nil {
			jobTitle = jobInfo.Title
		}

		// Fire-and-forget: log on error but don't fail the status update
		go func() {
			_ = sendApplicationUpdateEmail(candidate.Email, candidate.Name, jobTitle, status)
		}()
	}

	return updated, nil
}

// sendApplicationUpdateEmail dispatches a transactional email to a candidate informing
// them that their application status has changed. It uses the same SES SMTP relay as
// the rest of the platform. If SMTP is not configured, the call is silently a no-op.
func sendApplicationUpdateEmail(toEmail, candidateName, jobTitle, newStatus string) error {
	smtpHost := getenv("SMTP_HOST")
	smtpPort := getenv("SMTP_PORT")
	smtpUser := getenv("SMTP_USERNAME")
	smtpPass := getenv("SMTP_PASSWORD")
	fromEmail := getenv("SMTP_FROM_EMAIL")
	fromName := getenvDefault("SMTP_FROM_NAME", "KaamMilega")

	if smtpHost == "" || smtpUser == "" || smtpPass == "" {
		return nil // SMTP not configured — skip silently
	}

	name := candidateName
	if name == "" {
		name = "Candidate"
	}

	subject := "Application Update — " + jobTitle
	body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 10px 25px -5px rgba(91,33,104,.08);">
        <tr><td style="background:#5b2168;height:6px;"></td></tr>
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <div style="display:inline-block;background:#5b2168;color:#fff;font-size:18px;font-weight:900;width:44px;height:44px;line-height:44px;border-radius:12px;text-align:center;">KM</div>
          <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:16px 0 4px;letter-spacing:-.5px;">KaamMilega</h1>
          <p style="color:#64748b;font-size:13px;font-weight:600;margin:0;text-transform:uppercase;letter-spacing:1px;">Application Status Update</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;color:#334155;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi %s,</p>
          <p style="margin:0 0 24px;color:#475569;">Your application for <strong>%s</strong> has been updated. Your current status is:</p>
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
            <tr><td align="center" style="background:#faf5ff;border:2px dashed #d8b4fe;border-radius:16px;padding:20px;">
              <div style="font-size:22px;font-weight:900;color:#5b2168;letter-spacing:2px;">%s</div>
            </td></tr>
          </table>
          <p style="margin:0;color:#94a3b8;font-size:13px;">If you have questions, please contact the recruiter directly through the platform. You can manage your notification preferences in <a href="https://kaammilega.com/settings" style="color:#5b2168;">Account Settings</a>.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:12px;">&copy; 2026 KaamMilega Platform. All rights reserved.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, name, jobTitle, newStatus)

	return sendAppSMTPEmail(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName, toEmail, subject, body)
}

// getenv is a local helper to read an OS environment variable.
func getenv(key string) string {
	return os.Getenv(key)
}

func getenvDefault(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

// sendAppSMTPEmail sends an HTML email via SES-compatible SMTP (mirrors user/service.go sendSESEmail).
func sendAppSMTPEmail(smtpHost, smtpPort, username, password, fromEmail, fromName, toEmail, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
	auth := smtp.PlainAuth("", username, password, smtpHost)

	header := fmt.Sprintf(
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		fromName, fromEmail, toEmail, subject,
	)

	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer client.Close()

	tlsCfg := &tls.Config{ServerName: smtpHost}
	if err = client.StartTLS(tlsCfg); err != nil {
		return fmt.Errorf("starttls: %w", err)
	}
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err = client.Mail(fromEmail); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err = client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	_, err = fmt.Fprint(w, header+body)
	if err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("smtp close: %w", err)
	}
	return client.Quit()
}

