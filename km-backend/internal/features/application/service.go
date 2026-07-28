package application

import (
	"context"
	"errors"

	"km-backend/internal/features/job"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ApplicationService struct {
	repo    ApplicationRepository
	jobRepo job.JobRepository
}

func NewApplicationService(repo ApplicationRepository, jobRepo job.JobRepository) *ApplicationService {
	return &ApplicationService{
		repo:    repo,
		jobRepo: jobRepo,
	}
}

func (s *ApplicationService) CreateApplication(ctx context.Context, req *CreateApplicationRequest, candidateID string) (*Application, error) {
	// Check if job exists
	jobInfo, err := s.jobRepo.FindByID(ctx, req.JobID)
	if err != nil {
		return nil, err
	}
	if jobInfo == nil {
		return nil, errors.New("job not found")
	}

	// Check if already applied
	exists, err := s.repo.HasApplied(ctx, candidateID, req.JobID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("already applied for this job")
	}

	cOID, err := primitive.ObjectIDFromHex(candidateID)
	if err != nil {
		return nil, err
	}

	jOID, err := primitive.ObjectIDFromHex(req.JobID)
	if err != nil {
		return nil, err
	}

	app := &Application{
		JobID:       jOID,
		RecruiterID: jobInfo.RecruiterID,
		CandidateID: cOID,
		Status:      "Applied",
		CoverLetter: req.CoverLetter,
		ResumeURL:   req.ResumeURL, // Ideally validate URL or upload if it's a file ID
	}

	return s.repo.Create(ctx, app)
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

func (s *ApplicationService) UpdateApplicationStatus(ctx context.Context, id string, status string) (*Application, error) {
	// Validate status transitions if needed
	return s.repo.UpdateStatus(ctx, id, status)
}
