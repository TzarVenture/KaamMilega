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
	protected := app.Group("/api/jobs", jwtAuth)
	protected.Post("/", api.controller.CreateJob)
	protected.Get("/my", api.controller.GetMyJobs)
	protected.Patch("/:id", api.controller.UpdateJob)
	protected.Delete("/:id", api.controller.DeleteJob)

	// Public job detail view
	app.Get("/api/jobs/:id", api.controller.GetJob)

	// Admin Job Moderation Routes
	adminJobs := app.Group("/api/admin/jobs", jwtAuth)
	adminJobs.Get("/", api.controller.GetJobs)
	adminJobs.Patch("/:id/status", api.controller.AdminUpdateJobStatus)
	adminJobs.Delete("/:id", api.controller.AdminDeleteJob)
}
