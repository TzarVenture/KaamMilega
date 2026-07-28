package job

import (
	"context"
	"fmt"

	"km-backend/internal/features/city"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ApplicationCounter interface {
	CountByJob(ctx context.Context, jobID string) (int, error)
}

type JobService struct {
	repo     JobRepository
	cityRepo city.CityRepository
	appRepo  ApplicationCounter
}

func NewJobService(repo JobRepository, cityRepo city.CityRepository, appRepo ApplicationCounter) *JobService {
	return &JobService{
		repo:     repo,
		cityRepo: cityRepo,
		appRepo:  appRepo,
	}
}

func (s *JobService) CreateJob(ctx context.Context, req *CreateJobRequest, recruiterID string) (*Job, error) {
	rid, err := primitive.ObjectIDFromHex(recruiterID)
	if err != nil {
		return nil, err
	}

	// Validate City
	var cityID primitive.ObjectID
	var cityName string
	if req.CityID != "" {
		c, err := s.cityRepo.FindByID(ctx, req.CityID)
		if err != nil {
			return nil, fmt.Errorf("invalid city: %w", err)
		}
		if c == nil {
			return nil, fmt.Errorf("city not found")
		}
		cityID = c.ID
		cityName = c.Name
	}

	job := &Job{
		Title:       req.Title,
		Description: req.Description,
		Company:     req.Company,
		Location:    req.Location,
		CityID:      cityID,
		CityName:    cityName,
		SalaryMin:   req.SalaryMin,
		SalaryMax:   req.SalaryMax,

		SalaryRange:   fmt.Sprintf("%d-%d", req.SalaryMin, req.SalaryMax), // Legacy fill
		JobType:       req.JobType,                                        // Ensure this matches allowed values
		Gender:        req.Gender,
		Education:     req.Education,
		Requirements:  req.Requirements,
		WeOffer:       req.WeOffer,
		ExperienceMin: req.ExperienceMin,
		ExperienceMax: req.ExperienceMax,
		Experience:    fmt.Sprintf("%d-%d Years", req.ExperienceMin, req.ExperienceMax), // Legacy fill
		RecruiterID:   rid,
		Status:        "Open",
	}

	return s.repo.Create(ctx, job)
}

func (s *JobService) GetJob(ctx context.Context, id string) (*Job, error) {
	job, err := s.repo.FindByID(ctx, id)
	if err != nil || job == nil {
		return job, err
	}
	count, _ := s.appRepo.CountByJob(ctx, job.ID.Hex())
	job.ApplicantCount = count
	return job, nil
}

func (s *JobService) GetAllJobs(ctx context.Context, filter JobFilter) ([]Job, int64, error) {
	jobs, total, err := s.repo.FindAll(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	for i := range jobs {
		count, _ := s.appRepo.CountByJob(ctx, jobs[i].ID.Hex())
		jobs[i].ApplicantCount = count
	}

	return jobs, total, nil
}

func (s *JobService) GetJobsByRecruiter(ctx context.Context, recruiterID string) ([]Job, error) {
	jobs, err := s.repo.FindByRecruiter(ctx, recruiterID)
	if err != nil {
		return nil, err
	}

	for i := range jobs {
		count, _ := s.appRepo.CountByJob(ctx, jobs[i].ID.Hex())
		jobs[i].ApplicantCount = count
	}

	return jobs, nil
}

func (s *JobService) UpdateJob(ctx context.Context, id string, req *UpdateJobRequest) (*Job, error) {
	// fetching existing job ensuring it exists
	existingJob, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existingJob == nil {
		return nil, nil // Not found
	}

	// update fields if provided
	if req.Title != "" {
		existingJob.Title = req.Title
	}
	if req.Description != "" {
		existingJob.Description = req.Description
	}
	if req.Company != "" {
		existingJob.Company = req.Company
	}
	if req.Location != "" {
		existingJob.Location = req.Location
	}

	if req.CityID != "" {
		c, err := s.cityRepo.FindByID(ctx, req.CityID)
		if err != nil {
			// log error? or fail?
		} else if c != nil {
			existingJob.CityID = c.ID
			existingJob.CityName = c.Name
		}
	}

	if req.SalaryMin != nil {
		existingJob.SalaryMin = *req.SalaryMin
	}
	if req.SalaryMax != nil {
		existingJob.SalaryMax = *req.SalaryMax
	}
	// Update legacy string if both changed?
	existingJob.SalaryRange = fmt.Sprintf("%d-%d", existingJob.SalaryMin, existingJob.SalaryMax)

	if req.JobType != "" {
		existingJob.JobType = req.JobType
	}
	if req.Gender != nil {
		existingJob.Gender = *req.Gender
	}
	if req.Education != nil {
		existingJob.Education = *req.Education
	}
	if req.Status != "" {
		existingJob.Status = req.Status
	}
	if req.Requirements != nil {
		existingJob.Requirements = req.Requirements
	}
	if req.WeOffer != nil {
		existingJob.WeOffer = req.WeOffer
	}
	if req.ExperienceMin != nil {
		existingJob.ExperienceMin = *req.ExperienceMin
	}
	if req.ExperienceMax != nil {
		existingJob.ExperienceMax = *req.ExperienceMax
	}
	existingJob.Experience = fmt.Sprintf("%d-%d Years", existingJob.ExperienceMin, existingJob.ExperienceMax)

	return s.repo.Update(ctx, id, existingJob)
}

func (s *JobService) DeleteJob(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
