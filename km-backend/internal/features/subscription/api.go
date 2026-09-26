package subscription

import (
	common_api "km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type SubscriptionApi struct {
	controller *SubscriptionController
}

func NewSubscriptionApi(controller *SubscriptionController) common_api.Route {
	return &SubscriptionApi{controller: controller}
}

func (api *SubscriptionApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(api.controller.cfg.JWTSecret)

	// Public routes
	app.Get("/api/subscriptions/expert/plans", api.controller.GetPlans)

	// Protected routes
	protected := app.Group("/api/subscriptions/expert", jwtAuth)
	protected.Get("/my", api.controller.GetMySubscription)
	protected.Post("/create-order", api.controller.CreateOrder)
	protected.Post("/verify-payment", api.controller.VerifyPayment)
	protected.Post("/wallet-checkout", api.controller.SubscribeWithWallet)
}
