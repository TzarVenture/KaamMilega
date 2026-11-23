package promo

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

	app.Post("/api/coupons/quote", auth, a.controller.Quote)

	admin := app.Group("/api/admin/coupons", auth, middleware.RequireRole(user.RoleAdmin))
	admin.Get("/", a.controller.AdminCoupons)
	admin.Post("/", a.controller.CreateCoupon)
	admin.Get("/redemptions", a.controller.AdminRedemptions)
	admin.Put("/:id", a.controller.UpdateCoupon)
}
