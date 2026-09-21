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
	walletGroup := app.Group("/api/wallet", middleware.AuthMiddleware(api.config.JWTSecret))

	walletGroup.Get("/balance", api.controller.GetBalance)
	walletGroup.Get("/summary", api.controller.GetBalance)
	walletGroup.Get("/transactions", api.controller.GetTransactions)
	walletGroup.Post("/topup/create-order", api.controller.CreateTopupOrder)
	walletGroup.Post("/topup/verify", api.controller.VerifyTopupPayment)
}
