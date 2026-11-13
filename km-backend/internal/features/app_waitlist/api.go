package app_waitlist

import (
	"time"

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
	jwtAuth := middleware.AuthMiddleware(a.cfg.JWTSecret)

	// Public "notify me when the app launches" form (InstantMilega landing page, download dialog)
	app.Post("/api/app-waitlist", middleware.Limit(5, 10*time.Minute, middleware.ByIP), a.ctrl.Join)

	admin := app.Group("/api/admin/app-waitlist", jwtAuth, middleware.RequireRole("admin"))
	admin.Get("/", a.ctrl.List)
}
