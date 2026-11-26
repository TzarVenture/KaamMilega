package adsales

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

	mine := app.Group("/api/recruiter-ads", auth, middleware.RequireRole(user.RoleRecruiter))
	mine.Get("/", a.controller.Overview)
	mine.Post("/", a.controller.Create)
	mine.Post("/verify-payment", a.controller.VerifyPayment)
	mine.Put("/:id", a.controller.Update)
	mine.Delete("/:id", a.controller.Delete)
	mine.Post("/:id/pay-with-wallet", a.controller.PayWithWallet)
	mine.Post("/:id/create-order", a.controller.CreateOrder)

	admin := app.Group("/api/admin", auth, middleware.RequireRole(user.RoleAdmin))
	admin.Get("/ad-packages", a.controller.AdminPackages)
	admin.Post("/ad-packages", a.controller.CreatePackage)
	admin.Put("/ad-packages/:id", a.controller.UpdatePackage)
	admin.Get("/recruiter-ads", a.controller.AdminAds)
	admin.Post("/recruiter-ads/:id/approve", a.controller.Approve)
	admin.Post("/recruiter-ads/:id/reject", a.controller.Reject)
	admin.Post("/recruiter-ads/:id/approve-change", a.controller.ApproveChange)
	admin.Post("/recruiter-ads/:id/reject-change", a.controller.RejectChange)
}
