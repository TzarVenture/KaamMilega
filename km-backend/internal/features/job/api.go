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
	// Protected routes
	protected := app.Group("/api/jobs", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	protected.Post("/", api.controller.CreateJob)
	protected.Get("/my", api.controller.GetMyJobs) // /api/jobs/my must be defined before /api/jobs/:id
	protected.Patch("/:id", api.controller.UpdateJob)
	protected.Delete("/:id", api.controller.DeleteJob)

	// Public routes (if any)
	app.Get("/api/jobs", api.controller.GetJobs)
	app.Get("/api/jobs/:id", api.controller.GetJob)

}
