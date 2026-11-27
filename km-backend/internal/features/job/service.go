package job

import (
	"context"
	"fmt"
	"strings"

	"km-backend/internal/features/city"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ApplicationCounter interface {
	CountByJob(ctx context.Context, jobID string) (int, error)
}

// Employer is what job seekers see about the account that posted a job
type Employer struct {
	Verified bool
	Logo     string
	Company  string // the company name on the employer's profile
}

// EmployerLookup reads the posting accounts for a set of jobs in one query
type EmployerLookup interface {
	Employers(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]Employer, error)
}

// PlanQuota counts a job post against the recruiter's plan (recruiterplan.Service). It errors
// only when limits are enforced and the plan's job posts are used up; the returned func gives the
// post back if the job then fails to save.
type PlanQuota interface {
	Use(ctx context.Context, userID primitive.ObjectID, kind, refID string) (func(context.Context), error)
}

// planKindJobPost is recruiterplan.KindJobPost
const planKindJobPost = "job_post"

type JobService struct {
	repo      JobRepository
	cityRepo  city.CityRepository
	appRepo   ApplicationCounter
	employers EmployerLookup
	quota     PlanQuota
}

func NewJobService(repo JobRepository, cityRepo city.CityRepository, appRepo ApplicationCounter, employers EmployerLookup, quota PlanQuota) *JobService {
	return &JobService{
		repo:      repo,
		cityRepo:  cityRepo,
		appRepo:   appRepo,
		employers: employers,
		quota:     quota,
	}
}

// addEmployers marks each job with its employer's verification and logo. A failed
// lookup only hides the badge, it never fails the listing.
func (s *JobService) addEmployers(ctx context.Context, jobs []Job) {
	if s.employers == nil || len(jobs) == 0 {
		return
	}
	ids := make([]primitive.ObjectID, 0, len(jobs))
	for i := range jobs {
		if !jobs[i].RecruiterID.IsZero() {
			ids = append(ids, jobs[i].RecruiterID)
		}
	}
	found, err := s.employers.Employers(ctx, ids)
	if err != nil {
		return
	}
	for i := range jobs {
		if e, ok := found[jobs[i].RecruiterID]; ok {
			jobs[i].EmployerVerified = e.Verified
			jobs[i].CompanyLogo = e.Logo
		}
	}
}

func (s *JobService) CreateJob(ctx context.Context, req *CreateJobRequest, recruiterID string) (*Job, error) {
	rid, err := primitive.ObjectIDFromHex(recruiterID)
	if err != nil {
		return nil, err
	}
	if err := validateCreate(req); err != nil {
		return nil, err
	}

	var cityID primitive.ObjectID
	var cityName string
	c, cerr := s.cityRepo.FindByID(ctx, req.CityID)
	if cerr != nil || c == nil {
		return nil, ErrCityInvalid
	}
	cityID, cityName = c.ID, c.Name

	// The job is posted under the company on the employer's profile, never a typed-in name
	if s.employers != nil {
		if found, err := s.employers.Employers(ctx, []primitive.ObjectID{rid}); err == nil {
			if e, ok := found[rid]; ok && strings.TrimSpace(e.Company) != "" {
				req.Company = strings.TrimSpace(e.Company)
			}
		}
	}

	job := &Job{
		ID:          primitive.NewObjectID(),
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

	// Counted before saving, so two posts at once can't both slip past the plan's limit
	release := func(context.Context) {}
	if s.quota != nil {
		if release, err = s.quota.Use(ctx, rid, planKindJobPost, job.ID.Hex()); err != nil {
			return nil, err
		}
	}
	created, err := s.repo.Create(ctx, job)
	if err != nil {
		release(context.Background())
		return nil, err
	}
	return created, nil
}

func (s *JobService) GetJob(ctx context.Context, id string) (*Job, error) {
	job, err := s.repo.FindByID(ctx, id)
	if err != nil || job == nil {
		return job, err
	}
	count, _ := s.appRepo.CountByJob(ctx, job.ID.Hex())
	job.ApplicantCount = count
	one := []Job{*job}
	s.addEmployers(ctx, one)
	return &one[0], nil
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
	s.addEmployers(ctx, jobs)

	return jobs, total, nil
}

func (s *JobService) GetJobsByRecruiter(ctx context.Context, recruiterID string) ([]Job, error) {
	jobs, err := s.repo.FindByRecruiter(ctx, recruiterID)
	if err != nil {
		return nil, err
	}

	s.addStageCounts(ctx, jobs)
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
	if err := validateUpdate(req); err != nil {
		return nil, err
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
		if err != nil || c == nil {
			return nil, ErrCityInvalid
		}
		existingJob.CityID = c.ID
		existingJob.CityName = c.Name
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
	if err := validateMerged(existingJob); err != nil {
		return nil, err
	}

	return s.repo.Update(ctx, id, existingJob)
}

func (s *JobService) DeleteJob(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
