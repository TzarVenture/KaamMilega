package job

import (
	"km-backend/internal/common/api"
	"km-backend/internal/features/analytics"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type JobApi struct {
	controller *JobController
}

func NewJobApi(controller *JobController) api.Route {
	return &JobApi{controller: controller}
}

func (api *JobApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(api.controller.config.JWTSecret)

	// Public job search listing
	app.Get("/api/jobs", api.controller.GetJobs)
	// Open-job counts for the home page cards; registered before /api/jobs/:id so "counts" is not read as an ID
	app.Get("/api/jobs/counts", api.controller.GetJobCounts)

	// Protected recruiter routes (/api/jobs/my must be defined before /api/jobs/:id)
	// Login is checked per route, not on the group: Fiber runs group middleware for every
	// request under the prefix, which made the public detail route below require a login too.
	protected := app.Group("/api/jobs")
	// Jobs are posted by recruiters (a saved company), Experts and the KaamMilega team
	protected.Post("/", jwtAuth, middleware.RequireRole("recruiter", "expert", "admin"), api.controller.CreateJob)
	protected.Get("/my", jwtAuth, api.controller.GetMyJobs)
	// The employer portal: paged own jobs with stage counts, one job's home, status and copy
	protected.Get("/mine", jwtAuth, api.controller.ListMyJobs)
	protected.Get("/mine/:id", jwtAuth, api.controller.GetMyJob)
	protected.Patch("/:id/status", jwtAuth, api.controller.SetMyJobStatus)
	protected.Post("/:id/duplicate", jwtAuth, middleware.RequireRole("recruiter", "expert", "admin"), api.controller.DuplicateMyJob)
	protected.Patch("/:id", jwtAuth, api.controller.UpdateJob)
	protected.Delete("/:id", jwtAuth, api.controller.DeleteJob)
	// The job page reports a view once it is on screen (members and cookie-holding guests count once a day)
	protected.Post("/:id/view", middleware.OptionalAuthMiddleware(api.controller.config.JWTSecret),
		analytics.VisitorCookieMiddleware(api.controller.config.Environment == "production"), api.controller.RecordView)

	// Public job detail view
	app.Get("/api/jobs/:id", api.controller.GetJob)

	// Admin Job Moderation Routes
	adminJobs := app.Group("/api/admin/jobs", jwtAuth, middleware.RequireRole("admin"))
	adminJobs.Get("/", api.controller.GetJobs)
	adminJobs.Patch("/:id/status", api.controller.AdminUpdateJobStatus)
	adminJobs.Delete("/:id", api.controller.AdminDeleteJob)
}
