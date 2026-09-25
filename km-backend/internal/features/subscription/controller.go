package subscription

import (
	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

type SubscriptionController struct {
	service SubscriptionService
	cfg     *config.Config
}

func NewSubscriptionController(service SubscriptionService, cfg *config.Config) *SubscriptionController {
	return &SubscriptionController{
		service: service,
		cfg:     cfg,
	}
}

// GetPlans godoc
// @Summary Get available expert pro subscription plans
// @Tags Subscriptions
// @Produce json
// @Success 200 {array} PlanDetails
// @Router /api/subscriptions/expert/plans [get]
func (c *SubscriptionController) GetPlans(ctx *fiber.Ctx) error {
	plans := c.service.GetPlans(ctx.Context())
	return ctx.JSON(plans)
}

// GetMySubscription godoc
// @Summary Get current user's active expert subscription status
// @Tags Subscriptions
// @Produce json
// @Security BearerAuth
// @Success 200 {object} SubscriptionStatusResponse
// @Router /api/subscriptions/expert/my [get]
func (c *SubscriptionController) GetMySubscription(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("user_id").(string)
	if !ok || userID == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	res, err := c.service.GetMySubscription(ctx.Context(), userID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(res)
}

// CreateOrder godoc
// @Summary Create Razorpay order for expert subscription
// @Tags Subscriptions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateSubscriptionOrderRequest true "Order details"
// @Success 200 {object} CreateSubscriptionOrderResponse
// @Router /api/subscriptions/expert/create-order [post]
func (c *SubscriptionController) CreateOrder(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("user_id").(string)
	if !ok || userID == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateSubscriptionOrderRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	order, err := c.service.CreateOrder(ctx.Context(), userID, req)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(order)
}

// VerifyPayment godoc
// @Summary Verify Razorpay payment and activate expert pro subscription
// @Tags Subscriptions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body VerifySubscriptionPaymentRequest true "Payment details"
// @Success 200 {object} map[string]interface{}
// @Router /api/subscriptions/expert/verify-payment [post]
func (c *SubscriptionController) VerifyPayment(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("user_id").(string)
	if !ok || userID == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req VerifySubscriptionPaymentRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	sub, err := c.service.VerifyPayment(ctx.Context(), userID, req)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"message":      "Expert Pro Subscription activated successfully!",
		"subscription": sub,
	})
}

// SubscribeWithWallet godoc
// @Summary Subscribe to expert pro tier using KaamMilega Wallet
// @Tags Subscriptions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body SubscribeWithWalletRequest true "Wallet subscription details"
// @Success 200 {object} map[string]interface{}
// @Router /api/subscriptions/expert/wallet-checkout [post]
func (c *SubscriptionController) SubscribeWithWallet(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("user_id").(string)
	if !ok || userID == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req SubscribeWithWalletRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	sub, updatedWallet, err := c.service.SubscribeWithWallet(ctx.Context(), userID, req)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"message":        "Expert Pro Subscription activated successfully via Wallet!",
		"subscription":   sub,
		"wallet_summary": updatedWallet,
	})
}
