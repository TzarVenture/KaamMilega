package network

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type NetworkApi struct {
	ctrl *NetworkController
	cfg  *config.Config
}

func NewNetworkApi(ctrl *NetworkController, cfg *config.Config) api.Route {
	return &NetworkApi{ctrl: ctrl, cfg: cfg}
}

func (a *NetworkApi) Setup(app *fiber.App) {
	network := app.Group("/api/network", middleware.AuthMiddleware(a.cfg.JWTSecret))

	network.Post("/connect", a.ctrl.SendInvitation)
	network.Post("/accept", a.ctrl.AcceptInvitation)
	network.Post("/ignore", a.ctrl.IgnoreInvitation)
	network.Get("/pending", a.ctrl.GetPendingInvitations)
	network.Get("/connections", a.ctrl.GetConnections)
	network.Delete("/connections/:id", a.ctrl.DeleteConnection)
	network.Get("/status/:id", a.ctrl.GetStatus)
}
