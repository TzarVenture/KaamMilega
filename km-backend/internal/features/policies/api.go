package policies

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type Api struct {
	ctrl *Controller
	cfg  *config.Config
}

func NewApi(ctrl *Controller, cfg *config.Config) api.Route {
	return &Api{ctrl: ctrl, cfg: cfg}
}

func (a *Api) Setup(app *fiber.App) {
	app.Get("/api/policies/:slug", a.ctrl.Get)

	admin := app.Group("/api/admin/policies", middleware.AuthMiddleware(a.cfg.JWTSecret), middleware.RequireRole("admin"))
	admin.Get("/", a.ctrl.AdminList)
	admin.Get("/:slug", a.ctrl.AdminGet)
	admin.Put("/:slug", a.ctrl.AdminPublish)
	admin.Get("/:slug/versions", a.ctrl.AdminVersions)
	admin.Get("/:slug/versions/:version", a.ctrl.AdminVersion)
}
