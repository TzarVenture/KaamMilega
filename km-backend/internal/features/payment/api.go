package payment

import (
	"errors"
	"log"
	"strings"

	"km-backend/internal/common/api"
	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Controller struct {
	service Service
	config  *config.Config
}

func NewController(service Service, cfg *config.Config) *Controller {
	return &Controller{service: service, config: cfg}
}

type paymentApi struct {
	controller *Controller
}

func NewApi(controller *Controller) api.Route {
	return &paymentApi{controller: controller}
}

func (a *paymentApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(a.controller.config.JWTSecret)

	// Razorpay calls this; the signature check inside takes the place of a login
	app.Post("/api/webhooks/razorpay", a.controller.Webhook)

	app.Post("/api/payments/confirm", jwtAuth, a.controller.Confirm)
	app.Get("/api/payments/orders/:order_id", jwtAuth, a.controller.OrderStatus)

	admin := app.Group("/api/admin/payments", jwtAuth, middleware.RequireRole("admin"))
	admin.Get("/", a.controller.AdminList)
	admin.Post("/:id/refund", a.controller.AdminRefund)
}

func errorStatus(err error) int {
	switch {
	case errors.Is(err, ErrOrderNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrGateway), errors.Is(err, ErrNotConfigured):
		return fiber.StatusServiceUnavailable
	case apperr.CodeOf(err) != "":
		return fiber.StatusBadRequest
	default:
		return fiber.StatusInternalServerError
	}
}

func userID(c *fiber.Ctx) (primitive.ObjectID, bool) {
	raw, _ := c.Locals("user_id").(string)
	id, err := primitive.ObjectIDFromHex(raw)
	return id, err == nil
}

// failure answers with a coded error, and hides anything internal from the user.
func failure(c *fiber.Ctx, err error) error {
	status := errorStatus(err)
	if status == fiber.StatusInternalServerError {
		log.Printf("[payment] %s %s: %v", c.Method(), c.Path(), err)
		return c.Status(status).JSON(fiber.Map{"error": "something went wrong, please try again"})
	}
	return c.Status(status).JSON(apperr.Body(err))
}

// Webhook answers 2xx only once the event is applied; otherwise Razorpay sends it again.
func (ctrl *Controller) Webhook(c *fiber.Ctx) error {
	// c.Body() is reused by Fiber after the handler returns, and is only read during it
	err := ctrl.service.HandleWebhook(c.Context(), c.Body(), c.Get("X-Razorpay-Signature"))
	switch {
	case err == nil:
		return c.SendStatus(fiber.StatusOK)
	case errors.Is(err, ErrSignature):
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	default:
		log.Printf("[payment] webhook: %v", err)
		return c.SendStatus(fiber.StatusInternalServerError)
	}
}

// Confirm settles a checkout whatever it was for.
func (ctrl *Controller) Confirm(c *fiber.Ctx) error {
	id, ok := userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var input ConfirmInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	order, err := ctrl.service.ConfirmAny(c.Context(), id, input)
	if err != nil {
		return failure(c, err)
	}
	return c.JSON(OrderStatusResponse{
		OrderID:  order.RazorpayOrderID,
		Purpose:  order.Purpose,
		Status:   order.Status,
		Amount:   order.Amount(),
		TargetID: order.TargetID,
	})
}

// OrderStatus reports where a payment stands, for a screen recovering from a lost confirmation.
func (ctrl *Controller) OrderStatus(c *fiber.Ctx) error {
	id, ok := userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	status, err := ctrl.service.OrderStatus(c.Context(), id, c.Params("order_id"))
	if err != nil {
		return failure(c, err)
	}
	return c.JSON(status)
}

// AdminList returns payment orders, newest first.
func (ctrl *Controller) AdminList(c *fiber.Ctx) error {
	list, err := ctrl.service.AdminList(c.Context(), AdminOrderQuery{
		Page:    c.QueryInt("page", 1),
		Limit:   c.QueryInt("limit", 20),
		Status:  Status(c.Query("status")),
		Purpose: Purpose(c.Query("purpose")),
		Search:  strings.TrimSpace(c.Query("search")),
	})
	if err != nil {
		return failure(c, err)
	}
	return c.JSON(list)
}

// AdminRefund returns a payment to the customer's original method.
func (ctrl *Controller) AdminRefund(c *fiber.Ctx) error {
	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Reason) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "A reason is required"})
	}
	order, err := ctrl.service.AdminRefund(c.Context(), c.Params("id"), strings.TrimSpace(body.Reason))
	if err != nil {
		return failure(c, err)
	}
	return c.JSON(order)
}
