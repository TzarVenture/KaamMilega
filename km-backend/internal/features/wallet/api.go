package wallet

import (
	common_api "km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type WalletApi struct {
	controller *WalletController
	config     *config.Config
}

func NewWalletApi(controller *WalletController, config *config.Config) common_api.Route {
	return &WalletApi{
		controller: controller,
		config:     config,
	}
}

func (api *WalletApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(api.config.JWTSecret)
	walletGroup := app.Group("/api/wallet", jwtAuth)

	walletGroup.Get("/balance", api.controller.GetBalance)
	walletGroup.Get("/summary", api.controller.GetBalance)
	walletGroup.Get("/transactions", api.controller.GetTransactions)
	walletGroup.Post("/topup/create-order", api.controller.CreateTopupOrder)
	walletGroup.Post("/topup/verify", api.controller.VerifyTopupPayment)
	walletGroup.Post("/withdraw", api.controller.RequestWithdrawal)

	// User Dispute Routes (F73)
	walletGroup.Post("/disputes", api.controller.CreateDispute)
	walletGroup.Get("/my/disputes", api.controller.GetMyDisputes)

	// Admin Dispute Routes (F73)
	adminDisputes := app.Group("/api/admin/disputes", jwtAuth)
	adminDisputes.Get("/", api.controller.GetAdminDisputes)
	adminDisputes.Put("/:id/resolve", api.controller.ResolveAdminDispute)
}
