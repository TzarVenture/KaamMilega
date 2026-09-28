package instant_work

import (
	common_api "km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type InstantWorkApi struct {
	controller *InstantWorkController
	config     *config.Config
}

func NewInstantWorkApi(controller *InstantWorkController, config *config.Config) common_api.Route {
	return &InstantWorkApi{
		controller: controller,
		config:     config,
	}
}

func (api *InstantWorkApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(api.config.JWTSecret)

	group := app.Group("/api/instant-work", jwtAuth)

	// Candidate endpoints
	group.Get("/candidate/status", api.controller.GetCandidateStatus)
	group.Post("/availability", api.controller.ToggleAvailability)
	group.Post("/location", api.controller.UpdateLocation)
	group.Get("/candidate/feed", api.controller.GetCandidateJobsFeed)
	group.Post("/claim", api.controller.ClaimGig)
	group.Get("/candidate/active-job", api.controller.GetCandidateActiveJob)
	group.Put("/jobs/:id/complete", api.controller.CompleteJob)

	// Monetization pass endpoints (₹99 InstantPass)
	group.Post("/pass/pay-wallet", api.controller.PurchasePassWithWallet)
	group.Post("/pass/order", api.controller.CreatePassOrder)
	group.Post("/pass/verify", api.controller.VerifyPassPayment)

	// Recruiter endpoints
	group.Get("/recruiter/radar", api.controller.GetNearbyCandidates)
	group.Post("/dispatch", api.controller.CreateSpotJob)
	group.Get("/recruiter/active-job", api.controller.GetRecruiterActiveJob)
	group.Put("/jobs/:id/close", api.controller.CloseJob)
}
