package recruiterplan

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

	mine := app.Group("/api/recruiter-plans", auth, middleware.RequireRole(user.RoleRecruiter))
	mine.Get("/", a.controller.Overview)
	mine.Post("/verify-payment", a.controller.VerifyPayment)
	mine.Post("/:id/buy-with-wallet", a.controller.BuyWithWallet)
	mine.Post("/:id/create-order", a.controller.CreateOrder)

	// Shared profile resumes, counted as resume downloads
	app.Post("/api/recruiter/candidates/:id/resume", auth, middleware.RequireRole(user.RoleRecruiter), a.controller.CandidateResume)

	admin := app.Group("/api/admin/recruiter-plans", auth, middleware.RequireRole(user.RoleAdmin))
	admin.Get("/", a.controller.AdminPlans)
	admin.Post("/", a.controller.CreatePlan)
	admin.Get("/settings", a.controller.GetSettings)
	admin.Put("/settings", a.controller.SaveSettings)
	admin.Get("/subscriptions", a.controller.AdminSubscriptions)
	admin.Put("/:id", a.controller.UpdatePlan)
}
