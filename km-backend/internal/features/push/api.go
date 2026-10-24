package push

import (
	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type Api struct {
	controller *Controller
	config     *config.Config
}

func NewApi(controller *Controller, cfg *config.Config) *Api {
	return &Api{controller: controller, config: cfg}
}

// Setup registers /api/push/*. The user always comes from the session, never the request body.
func (api *Api) Setup(app *fiber.App) {
	g := app.Group("/api/push", middleware.AuthMiddleware(api.config.JWTSecret))
	g.Post("/tokens", api.controller.Register)
	g.Delete("/tokens", api.controller.Unregister)
	g.Post("/test", api.controller.SendTest)
}

// Install makes every notification created by the notification service also go out as a push
// (invoked once at startup through fx).
func Install(s *Service) {
	notification.SetPushSender(s)
}
