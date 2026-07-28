package application

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type ApplicationApi struct {
	controller *ApplicationController
}

func NewApplicationApi(controller *ApplicationController) api.Route {
	return &ApplicationApi{controller: controller}
}

func (api *ApplicationApi) Setup(app *fiber.App) {
	protected := app.Group("/api/applications", middleware.AuthMiddleware(api.controller.config.JWTSecret))

	// Candidate applies for a job
	protected.Post("/", api.controller.CreateApplication)

	// Candidate sees their applications
	protected.Get("/my", api.controller.GetMyApplications)

	// Recruiter sees applications for a job (jobId query param or path param?)
	// Let's use /api/applications/job/:jobId
	protected.Get("/job/:jobId", api.controller.GetJobApplications)
	protected.Get("/recruiter/all", api.controller.GetRecruiterApplications) // New route

	// Recruiter updates application status
	protected.Patch("/:id/status", api.controller.UpdateApplicationStatus)
}
