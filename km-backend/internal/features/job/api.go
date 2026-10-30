package job

import (
	"km-backend/internal/common/api"
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

	// Protected recruiter routes (/api/jobs/my must be defined before /api/jobs/:id)
	// Login is checked per route, not on the group: Fiber runs group middleware for every
	// request under the prefix, which made the public detail route below require a login too.
	protected := app.Group("/api/jobs")
	// Jobs are posted by recruiters (a saved company), Experts and the KaamMilega team
	protected.Post("/", jwtAuth, middleware.RequireRole("recruiter", "expert", "admin"), api.controller.CreateJob)
	protected.Get("/my", jwtAuth, api.controller.GetMyJobs)
	protected.Patch("/:id", jwtAuth, api.controller.UpdateJob)
	protected.Delete("/:id", jwtAuth, api.controller.DeleteJob)

	// Public job detail view
	app.Get("/api/jobs/:id", api.controller.GetJob)

	// Admin Job Moderation Routes
	adminJobs := app.Group("/api/admin/jobs", jwtAuth, middleware.RequireRole("admin"))
	adminJobs.Get("/", api.controller.GetJobs)
	adminJobs.Patch("/:id/status", api.controller.AdminUpdateJobStatus)
	adminJobs.Delete("/:id", api.controller.AdminDeleteJob)
}
