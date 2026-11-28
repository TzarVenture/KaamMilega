package job

import (
	"context"
	"strings"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// An employer moves a job between these. Admin moderation may store other values (e.g.
// lowercase "active"/"closed"); CanonicalStatus reads those too.
const (
	StatusOpen   = "Open"
	StatusPaused = "Paused"
	StatusClosed = "Closed"
)

var (
	ErrJobNotFound      = apperr.New("JOB_NOT_FOUND", "job not found")
	ErrJobForbidden     = apperr.New("JOB_FORBIDDEN", "only the employer who posted this job can change it")
	ErrInvalidJobStatus = apperr.New("INVALID_STATUS", "status must be Open, Paused or Closed")
)

// CanonicalStatus maps any stored or requested status to Open, Paused or Closed ("" if unknown)
func CanonicalStatus(s string) string {
	switch strings.ToLower(strings.ReplaceAll(strings.TrimSpace(s), " ", "")) {
	case "open", "active", "":
		return StatusOpen
	case "paused", "onhold", "hold":
		return StatusPaused
	case "closed", "expired", "filled":
		return StatusClosed
	}
	return ""
}

// StageCounter gives applicant counts per pipeline stage for each job, in one query
type StageCounter interface {
	StageCountsByJobs(ctx context.Context, jobIDs []primitive.ObjectID) (map[primitive.ObjectID]map[string]int, error)
}

// MyJobsPage is one page of an employer's own jobs, with how many jobs sit in each status
type MyJobsPage struct {
	Jobs   []Job          `json:"jobs"`
	Total  int64          `json:"total"`
	Page   int            `json:"page"`
	Limit  int            `json:"limit"`
	Counts map[string]int `json:"counts"` // all, open, paused, closed
}

// ListMyJobs pages through an employer's jobs, newest first, with per-stage applicant counts
func (s *JobService) ListMyJobs(ctx context.Context, recruiterID, search, status string, page, limit int) (*MyJobsPage, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	jobs, total, err := s.repo.FindAll(ctx, JobFilter{RecruiterID: recruiterID, Search: strings.TrimSpace(search), Status: status, Page: page, Limit: limit})
	if err != nil {
		return nil, err
	}
	counts, err := s.repo.CountByStatus(ctx, recruiterID)
	if err != nil {
		return nil, err
	}
	s.addStageCounts(ctx, jobs)
	return &MyJobsPage{Jobs: jobs, Total: total, Page: page, Limit: limit, Counts: counts}, nil
}

// addStageCounts fills ApplicantCount and StageCounts on each job
func (s *JobService) addStageCounts(ctx context.Context, jobs []Job) {
	sc, ok := s.appRepo.(StageCounter)
	if !ok || len(jobs) == 0 {
		return
	}
	ids := make([]primitive.ObjectID, len(jobs))
	for i := range jobs {
		ids[i] = jobs[i].ID
	}
	byJob, err := sc.StageCountsByJobs(ctx, ids)
	if err != nil {
		return
	}
	for i := range jobs {
		stages := byJob[jobs[i].ID]
		if stages == nil {
			stages = map[string]int{}
		}
		n := 0
		for _, c := range stages {
			n += c
		}
		jobs[i].StageCounts = stages
		jobs[i].ApplicantCount = n
	}
}

// ownJob loads a job the employer posted
func (s *JobService) ownJob(ctx context.Context, id, userID string) (*Job, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return nil, ErrJobNotFound
	}
	j, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if j == nil || j.Status == "Deleted" {
		return nil, ErrJobNotFound
	}
	if j.RecruiterID.Hex() != userID {
		return nil, ErrJobForbidden
	}
	return j, nil
}

// GetMyJob is one of the employer's jobs with its stage counts (the job's home in the portal)
func (s *JobService) GetMyJob(ctx context.Context, id, userID string) (*Job, error) {
	j, err := s.ownJob(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	one := []Job{*j}
	s.addStageCounts(ctx, one)
	return &one[0], nil
}

// SetStatus opens, pauses or closes one of the employer's jobs
func (s *JobService) SetStatus(ctx context.Context, id, userID, status string) (*Job, error) {
	canon := CanonicalStatus(status)
	if canon == "" || strings.TrimSpace(status) == "" {
		return nil, ErrInvalidJobStatus
	}
	if _, err := s.ownJob(ctx, id, userID); err != nil {
		return nil, err
	}
	return s.UpdateJob(ctx, id, &UpdateJobRequest{Status: canon})
}

// Duplicate posts a fresh copy of one of the employer's jobs (it counts against the plan like any post)
func (s *JobService) Duplicate(ctx context.Context, id, userID string) (*Job, error) {
	j, err := s.ownJob(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	req := &CreateJobRequest{
		Title: j.Title, Description: j.Description, Company: j.Company, Location: j.Location,
		SalaryMin: j.SalaryMin, SalaryMax: j.SalaryMax, JobType: j.JobType,
		Requirements: j.Requirements, WeOffer: j.WeOffer, Gender: j.Gender, Education: j.Education,
		ExperienceMin: j.ExperienceMin, ExperienceMax: j.ExperienceMax,
	}
	if !j.CityID.IsZero() {
		req.CityID = j.CityID.Hex()
	}
	return s.CreateJob(ctx, req, userID)
}

// --- handlers ---

func (c *JobController) ListMyJobs(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	page, err := c.service.ListMyJobs(ctx.Context(), userID, ctx.Query("search"), ctx.Query("status"), ctx.QueryInt("page", 1), ctx.QueryInt("limit", 20))
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	c.withViews(ctx.Context(), page.Jobs, false)
	return ctx.JSON(page)
}

func (c *JobController) GetMyJob(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	j, err := c.service.GetMyJob(ctx.Context(), ctx.Params("id"), userID)
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	one := []Job{*j}
	c.withViews(ctx.Context(), one, true)
	return ctx.JSON(one[0])
}

func (c *JobController) SetMyJobStatus(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	var req struct {
		Status string `json:"status"`
	}
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	j, err := c.service.SetStatus(ctx.Context(), ctx.Params("id"), userID, req.Status)
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.JSON(j)
}

func (c *JobController) DuplicateMyJob(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	j, err := c.service.Duplicate(ctx.Context(), ctx.Params("id"), userID)
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.Status(fiber.StatusCreated).JSON(j)
}
