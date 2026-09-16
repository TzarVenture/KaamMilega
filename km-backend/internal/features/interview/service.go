package interview

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/smtp"
	"os"

	"km-backend/internal/features/application"
	"km-backend/internal/features/job"
	"km-backend/internal/features/user"
)


type InterviewService struct {
	repo     InterviewRepository
	appRepo  application.ApplicationRepository
	jobRepo  job.JobRepository
	userRepo user.UserRepository
}

func NewInterviewService(repo InterviewRepository, appRepo application.ApplicationRepository, jobRepo job.JobRepository, userRepo user.UserRepository) *InterviewService {
	return &InterviewService{repo: repo, appRepo: appRepo, jobRepo: jobRepo, userRepo: userRepo}
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

	// Verify Recruiter owns application
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

	// Optionally update application status to 'Interviewing'
	_, _ = s.appRepo.UpdateStatus(ctx, req.ApplicationID, "Interviewing")

	created, err := s.repo.Create(ctx, interview)
	if err != nil {
		return nil, err
	}

	// Notify candidate about the scheduled interview (respects their notification settings)
	if candidate, cerr := s.userRepo.FindUserByID(ctx, app.CandidateID.Hex()); cerr == nil && candidate != nil {
		if candidate.Settings.EmailApplicationUpdates && candidate.Email != "" {
			jobTitle := "your applied position"
			if a, aerr := s.appRepo.FindByID(ctx, req.ApplicationID); aerr == nil && a != nil {
				if j, jerr := s.jobRepo.FindByID(ctx, a.JobID.Hex()); jerr == nil && j != nil {
					jobTitle = j.Title
				}
			}
			scheduledAt := req.ScheduledAt.Format("Monday, 02 Jan 2006 at 03:04 PM")
			go func() {
				_ = sendInterviewScheduledEmail(candidate.Email, candidate.Name, jobTitle, req.Type, scheduledAt, req.Location)
			}()
		}
	}

	return created, nil
}

// sendInterviewScheduledEmail emails a candidate with details of their scheduled interview,
// reusing the same SES SMTP infrastructure as the rest of the backend.
func sendInterviewScheduledEmail(toEmail, candidateName, jobTitle, interviewType, scheduledAt, location string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	fromEmail := os.Getenv("SMTP_FROM_EMAIL")
	fromName := os.Getenv("SMTP_FROM_NAME")
	if fromName == "" {
		fromName = "KaamMilega"
	}
	if smtpHost == "" || smtpUser == "" || smtpPass == "" {
		return nil
	}

	name := candidateName
	if name == "" {
		name = "Candidate"
	}
	if location == "" {
		location = "To be communicated"
	}

	subject := "Interview Scheduled — " + jobTitle
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
          <p style="color:#64748b;font-size:13px;font-weight:600;margin:0;text-transform:uppercase;letter-spacing:1px;">Interview Scheduled</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;color:#334155;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi %s,</p>
          <p style="margin:0 0 24px;color:#475569;">Great news! Your interview for <strong>%s</strong> has been scheduled. Here are your details:</p>
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e9d5ff;">📅 <strong>Date &amp; Time:</strong> %s</td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e9d5ff;">🎯 <strong>Format:</strong> %s</td></tr>
            <tr><td style="padding:16px 20px;">📍 <strong>Location/Link:</strong> %s</td></tr>
          </table>
          <p style="margin:0;color:#94a3b8;font-size:13px;">Manage your notification preferences in <a href="https://kaammilega.com/settings" style="color:#5b2168;">Account Settings</a>.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:12px;">&copy; 2026 KaamMilega Platform. All rights reserved.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, name, jobTitle, scheduledAt, interviewType, location)

	return sendInterviewSMTPEmail(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName, toEmail, subject, body)
}

func sendInterviewSMTPEmail(smtpHost, smtpPort, username, password, fromEmail, fromName, toEmail, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
	auth := smtp.PlainAuth("", username, password, smtpHost)
	header := fmt.Sprintf(
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		fromName, fromEmail, toEmail, subject,
	)
	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()
	if err = client.StartTLS(&tls.Config{ServerName: smtpHost}); err != nil {
		return err
	}
	if err = client.Auth(auth); err != nil {
		return err
	}
	if err = client.Mail(fromEmail); err != nil {
		return err
	}
	if err = client.Rcpt(toEmail); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, _ = fmt.Fprint(w, header+body)
	if err = w.Close(); err != nil {
		return err
	}
	return client.Quit()
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
			detail.Candidate = &InterviewUserInfo{
				ID:    c.ID.Hex(),
				Name:  c.Name,
				Email: c.Email,
			}
		}

		// Fetch Recruiter Info
		r, _ := s.userRepo.FindUserByID(ctx, in.RecruiterID.Hex())
		if r != nil {
			detail.Recruiter = &InterviewUserInfo{
				ID:    r.ID.Hex(),
				Name:  r.Name,
				Email: r.Email,
			}
		}

		details = append(details, detail)
	}

	return details, nil
}

func (s *InterviewService) UpdateInterviewStatus(ctx context.Context, id string, status string) (*Interview, error) {
	return s.repo.UpdateStatus(ctx, id, status)
}
