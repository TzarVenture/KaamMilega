package wallet

import (
	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

type WalletController struct {
	service WalletService
	config  *config.Config
}

func NewWalletController(service WalletService, config *config.Config) *WalletController {
	return &WalletController{
		service: service,
		config:  config,
	}
}

// GetBalance retrieves the authenticated user's real-time wallet ledger summary
func (ctrl *WalletController) GetBalance(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	summary, err := ctrl.service.GetWalletSummary(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(summary)
}
