package account

import (
	"km-backend/internal/config"
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

// Setup registers /api/user/account/*. These routes stay reachable for deactivated and
// pending-deletion accounts (see middleware.inactiveAllowedPrefixes) so they can be restored.
func (api *Api) Setup(app *fiber.App) {
	g := app.Group("/api/user/account", middleware.AuthMiddleware(api.config.JWTSecret))
	// Not "/": GET /api/user/account would be swallowed by the user module's /api/user/:id
	g.Get("/overview", api.controller.Overview)
	g.Post("/verification-code", api.controller.SendCode)
	g.Post("/deactivate", api.controller.Deactivate)
	g.Post("/reactivate", api.controller.Reactivate)
	g.Post("/deletion", api.controller.RequestDeletion)
	g.Delete("/deletion", api.controller.CancelDeletion)
	g.Get("/export", api.controller.Export)
}
