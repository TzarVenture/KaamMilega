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

	// The ₹499 / ₹4,499 Pro Expert plans are retired: per the client, an Expert applies with
	// KYC and the one ₹99 pass, and our team approves them (POST /api/user/apply-expert).
	// Buying a plan also skipped that review. Only the status of existing plans stays readable.
	protected := app.Group("/api/subscriptions/expert", jwtAuth)
	protected.Get("/my", api.controller.GetMySubscription)
}
