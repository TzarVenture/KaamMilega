package job

import (
	"km-backend/internal/config"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type JobController struct {
	service *JobService
	config  *config.Config
}

func NewJobController(service *JobService, config *config.Config) *JobController {
	return &JobController{service: service, config: config}
}

func (c *JobController) CreateJob(ctx *fiber.Ctx) error {
	var req CreateJobRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	userID, ok := ctx.Locals("user_id").(string)
	if !ok {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	if _, err := primitive.ObjectIDFromHex(userID); err != nil {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user ID format in token"})
	}
	recruiterID := userID

	job, err := c.service.CreateJob(ctx.Context(), &req, recruiterID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusCreated).JSON(job)
}

func (c *JobController) GetJobs(ctx *fiber.Ctx) error {
	// Check if filtering by recruiter through query param
	recruiterID := ctx.Query("recruiter_id")
	if recruiterID != "" {
		if _, err := primitive.ObjectIDFromHex(recruiterID); err != nil {
			return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid recruiter ID format"})
		}
		jobs, err := c.service.GetJobsByRecruiter(ctx.Context(), recruiterID)
		if err != nil {
			return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		return ctx.JSON(jobs)
	}

	// Default filters
	page := ctx.QueryInt("page", 1)
	limit := ctx.QueryInt("limit", 10)

	// Helper functions
	getIntPtr := func(key string) *int {
		val := ctx.Query(key)
		if val == "" {
			return nil
		}
		if i, err := strconv.Atoi(val); err == nil {
			return &i
		}
		return nil
	}

	parseList := func(key string) []string {
		val := ctx.Query(key)
		if val == "" {
			return []string{}
		}
		return strings.Split(val, ",")
	}

	// Support both singular and plural keys
	cityIDs := parseList("city_ids")
	if len(cityIDs) == 0 {
		cityIDs = parseList("city_id")
	}

	jobTypes := parseList("job_types")
	if len(jobTypes) == 0 {
		jobTypes = parseList("job_type")
	}

	// Support both singular and plural keys
	genders := parseList("genders")
	if len(genders) == 0 {
		genders = parseList("gender")
	}

	education := parseList("education") // education usually singular but support plural convention too if needed
	if len(education) == 0 {
		education = parseList("educations")
	}

	filter := JobFilter{
		Search:        ctx.Query("search"),
		CityIDs:       cityIDs,
		JobTypes:      jobTypes,
		Genders:       genders,
		Education:     education,
		SalaryMin:     getIntPtr("salary_min"),
		SalaryMax:     getIntPtr("salary_max"),
		ExperienceMin: getIntPtr("experience_min"),
		ExperienceMax: getIntPtr("experience_max"),
		Page:          page,
		Limit:         limit,
	}

	jobs, total, err := c.service.GetAllJobs(ctx.Context(), filter)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(fiber.Map{
		"jobs":  jobs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (c *JobController) GetMyJobs(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("user_id").(string)
	if !ok {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	if _, err := primitive.ObjectIDFromHex(userID); err != nil {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user ID format in token", "received_id": userID})
	}

	jobs, err := c.service.GetJobsByRecruiter(ctx.Context(), userID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(jobs)
}

func (c *JobController) GetJob(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	job, err := c.service.GetJob(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if job == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Job not found"})
	}
	return ctx.JSON(job)
}

func (c *JobController) UpdateJob(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	var req UpdateJobRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	userID, ok := ctx.Locals("user_id").(string)
	if !ok {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	existingJob, err := c.service.GetJob(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if existingJob == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Job not found"})
	}

	if existingJob.RecruiterID.Hex() != userID {
		return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You rely don't own this job"})
	}

	job, err := c.service.UpdateJob(ctx.Context(), id, &req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(job)
}

func (c *JobController) DeleteJob(ctx *fiber.Ctx) error {
	id := ctx.Params("id")

	userID, ok := ctx.Locals("user_id").(string)
	if !ok {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	existingJob, err := c.service.GetJob(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if existingJob == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Job not found"})
	}

	if existingJob.RecruiterID.Hex() != userID {
		return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You don't own this job"})
	}

	if err := c.service.DeleteJob(ctx.Context(), id); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}
