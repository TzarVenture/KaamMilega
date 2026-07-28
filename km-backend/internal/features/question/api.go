package question

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type QuestionApi struct {
	controller *QuestionController
	config     *config.Config
}

func NewQuestionApi(controller *QuestionController, config *config.Config) api.Route {
	return &QuestionApi{controller: controller, config: config}
}

func (api *QuestionApi) Setup(app *fiber.App) {
	app.Get("/api/admin/questions", api.controller.GetQuestions)

	protected := app.Group("/api/admin/questions", middleware.AuthMiddleware(api.config.JWTSecret))
	protected.Get("/:id", api.controller.GetQuestion)
	protected.Post("/", api.controller.CreateQuestion)
	protected.Patch("/:id", api.controller.UpdateQuestion)
	protected.Delete("/:id", api.controller.DeleteQuestion)
}
