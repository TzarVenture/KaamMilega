package push

import (
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

// Register godoc
// @Summary Register this device for push notifications
// @Description Stores the Firebase Cloud Messaging token of the signed-in user's browser or phone. Call it whenever the app starts with push enabled; it is idempotent.
// @Tags push
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "FCM registration token and platform (web, android, ios)"
// @Success 200 {object} map[string]any
// @Failure 400 {object} map[string]any
// @Failure 401 {object} map[string]any
// @Router /api/push/tokens [post]
func (ctrl *Controller) Register(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := ctrl.service.Register(c.UserContext(), userID, req, c.Get(fiber.HeaderUserAgent)); err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"registered": true, "push_enabled": ctrl.service.Enabled()})
}

// Unregister godoc
// @Summary Remove this device from push notifications
// @Description Deletes the token when it belongs to the signed-in user (sign-out, or push switched off in this browser).
// @Tags push
// @Accept json
// @Produce json
// @Param request body UnregisterRequest true "FCM registration token"
// @Success 200 {object} map[string]any
// @Failure 400 {object} map[string]any
// @Failure 401 {object} map[string]any
// @Router /api/push/tokens [delete]
func (ctrl *Controller) Unregister(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var req UnregisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := ctrl.service.Unregister(c.UserContext(), userID, req); err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"unregistered": true})
}

func fail(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrInvalidToken), errors.Is(err, ErrInvalidPlatform):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, ErrUnknownUser):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	default:
		log.Printf("[push] %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not update push settings for this device"})
	}
}
