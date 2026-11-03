package ads

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/features/analytics"
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
	optional := middleware.OptionalAuthMiddleware(a.cfg.JWTSecret)
	// Signed-out visitors get the anonymous ID the frequency cap and counts go by
	visitor := analytics.VisitorCookieMiddleware(a.cfg.Environment == "production")

	public := app.Group("/api/ads")
	public.Get("/", optional, visitor, a.ctrl.Serve)
	public.Post("/:id/impression", optional, a.ctrl.Impression)
	public.Get("/:id/click", optional, a.ctrl.Click)

	admin := app.Group("/api/admin/ads", middleware.AuthMiddleware(a.cfg.JWTSecret), middleware.RequireRole("admin"))
	admin.Get("/", a.ctrl.AdminList)
	admin.Post("/", a.ctrl.AdminCreate)
	admin.Get("/:id", a.ctrl.AdminGet)
	admin.Put("/:id", a.ctrl.AdminUpdate)
	admin.Patch("/:id/status", a.ctrl.AdminSetStatus)
	admin.Delete("/:id", a.ctrl.AdminDelete)
	admin.Get("/:id/stats", a.ctrl.AdminStats)
}
