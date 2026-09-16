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

	// Public job search listing (accessible to guests & candidates)
	app.Get("/api/jobs", api.controller.GetJobs)

	// Protected job management routes
	app.Post("/api/jobs", jwtAuth, api.controller.CreateJob)
	app.Get("/api/jobs/my", jwtAuth, api.controller.GetMyJobs) // /api/jobs/my must be defined before /api/jobs/:id
	app.Patch("/api/jobs/:id", jwtAuth, api.controller.UpdateJob)
	app.Delete("/api/jobs/:id", jwtAuth, api.controller.DeleteJob)

	// Public job detail view
	app.Get("/api/jobs/:id", api.controller.GetJob)

	// Admin Job Moderation Routes
	adminJobs := app.Group("/api/admin/jobs", jwtAuth)
	adminJobs.Patch("/:id/status", api.controller.AdminUpdateJobStatus)
	adminJobs.Delete("/:id", api.controller.AdminDeleteJob)
}
