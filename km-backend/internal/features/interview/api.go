package interview

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type InterviewApi struct {
	controller *InterviewController
}

func NewInterviewApi(controller *InterviewController) api.Route {
	return &InterviewApi{controller: controller}
}

func (api *InterviewApi) Setup(app *fiber.App) {
	protected := app.Group("/api/interviews", middleware.AuthMiddleware(api.controller.config.JWTSecret))

	protected.Post("/", api.controller.ScheduleInterview)
	protected.Get("/my", api.controller.GetMyInterviews)
	protected.Patch("/:id/status", api.controller.UpdateInterviewStatus)
}
