package policecheck

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type Api struct {
	controller *Controller
	config     *config.Config
}

func NewApi(controller *Controller, cfg *config.Config) api.Route {
	return &Api{controller: controller, config: cfg}
}

func (a *Api) Setup(app *fiber.App) {
	auth := middleware.AuthMiddleware(a.config.JWTSecret)

	mine := app.Group("/api/police-verification", auth)
	mine.Get("/", a.controller.Mine)
	mine.Post("/", a.controller.Submit)

	admin := app.Group("/api/admin/police-verifications", auth, middleware.RequireRole(user.RoleAdmin))
	admin.Get("/", a.controller.Queue)
	admin.Post("/:id/review", a.controller.Review)
}
