package interview

import (
	"context"
	"errors"

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

	return s.repo.Create(ctx, interview)
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
