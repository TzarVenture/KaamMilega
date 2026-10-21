package account

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/user"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service *Service
	users   user.UserService
	config  *config.Config
}

func NewController(service *Service, users user.UserService, cfg *config.Config) *Controller {
	return &Controller{service: service, users: users, config: cfg}
}

// resumeSession issues this device a token for the new session version after a restore
// (reactivate / cancel deletion bump the version, which signs out every other device)
func (ctrl *Controller) resumeSession(c *fiber.Ctx, userID string) (string, error) {
	u, err := ctrl.users.GetProfile(c.Context(), userID)
	if err != nil {
		return "", err
	}
	token, err := ctrl.users.GenerateToken(u)
	if err != nil {
		return "", err
	}
	secure := ctrl.config.Environment == "production" || c.Protocol() == "https"
	c.Cookie(&fiber.Cookie{
		Name: "km_auth_token", Value: token, Path: "/", Expires: time.Now().Add(72 * time.Hour),
		MaxAge: 72 * 3600, HTTPOnly: true, Secure: secure, SameSite: "Lax",
	})
	return token, nil
}

func currentUser(c *fiber.Ctx) (string, error) {
	id, _ := c.Locals("user_id").(string)
	if id == "" {
		return "", c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	return id, nil
}

// fail maps service errors to HTTP responses
func fail(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, ErrCodeCooldown), errors.Is(err, ErrCodeLimit), errors.Is(err, ErrTooManyAttempts):
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, ErrInvalidState):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, ErrReauthRequired), errors.Is(err, ErrInvalidCode), errors.Is(err, ErrIncorrectPassword),
		errors.Is(err, ErrNoChannel), errors.Is(err, ErrConfirmPhrase), errors.Is(err, ErrAcknowledge):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Something went wrong. Please try again."})
	}
}

// endSession clears the auth cookies after the account leaves the active state
func (ctrl *Controller) endSession(c *fiber.Ctx) {
	secure := ctrl.config.Environment == "production" || c.Protocol() == "https"
	for _, name := range []string{"km_auth_token", "km_user_role"} {
		c.Cookie(&fiber.Cookie{
			Name: name, Value: "", Path: "/", Expires: time.Now().Add(-24 * time.Hour),
			MaxAge: -1, HTTPOnly: name == "km_auth_token", Secure: secure, SameSite: "Lax",
		})
	}
}

// Overview godoc
// @Summary Account status, deletion blockers and warnings
// @Tags Account
// @Security BearerAuth
// @Success 200 {object} Overview
// @Router /user/account/overview [get]
func (ctrl *Controller) Overview(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	overview, err := ctrl.service.Overview(c.Context(), userID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(overview)
}

// SendCode godoc
// @Summary Send a verification code for deactivation or deletion
// @Tags Account
// @Security BearerAuth
// @Success 200 {object} SendCodeResponse
// @Router /user/account/verification-code [post]
func (ctrl *Controller) SendCode(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	res, err := ctrl.service.SendCode(c.Context(), userID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Deactivate godoc
// @Summary Deactivate the account (reversible by signing in)
// @Tags Account
// @Security BearerAuth
// @Param request body DeactivateRequest true "Verification and optional reason"
// @Success 200 {object} map[string]string
// @Router /user/account/deactivate [post]
func (ctrl *Controller) Deactivate(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	var req DeactivateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := ctrl.service.Deactivate(c.Context(), userID, req); err != nil {
		return fail(c, err)
	}
	ctrl.endSession(c)
	return c.JSON(fiber.Map{"message": "Your account is deactivated. Sign in any time to reactivate it."})
}

// Reactivate godoc
// @Summary Reactivate a deactivated account
// @Tags Account
// @Security BearerAuth
// @Success 200 {object} map[string]string
// @Router /user/account/reactivate [post]
func (ctrl *Controller) Reactivate(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	if err := ctrl.service.Reactivate(c.Context(), userID); err != nil {
		return fail(c, err)
	}
	token, err := ctrl.resumeSession(c, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Account reactivated. Please sign in again."})
	}
	return c.JSON(fiber.Map{"message": "Welcome back! Your account is active again.", "token": token})
}

// RequestDeletion godoc
// @Summary Request permanent deletion (cancellable during the grace period)
// @Tags Account
// @Security BearerAuth
// @Param request body DeleteRequest true "Verification, confirmation and optional reason"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "Blockers must be resolved first"
// @Router /user/account/deletion [post]
func (ctrl *Controller) RequestDeletion(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	var req DeleteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	scheduled, blockers, err := ctrl.service.RequestDeletion(c.Context(), userID, req)
	if errors.Is(err, ErrBlocked) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "blockers": blockers})
	}
	if err != nil {
		return fail(c, err)
	}
	ctrl.endSession(c)
	return c.JSON(fiber.Map{
		"message":                "Your account is scheduled for deletion.",
		"deletion_scheduled_for": scheduled,
	})
}

// CancelDeletion godoc
// @Summary Cancel a pending deletion and restore the account
// @Tags Account
// @Security BearerAuth
// @Success 200 {object} map[string]string
// @Router /user/account/deletion [delete]
func (ctrl *Controller) CancelDeletion(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	if err := ctrl.service.CancelDeletion(c.Context(), userID); err != nil {
		return fail(c, err)
	}
	token, err := ctrl.resumeSession(c, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Deletion cancelled. Please sign in again."})
	}
	return c.JSON(fiber.Map{"message": "Deletion cancelled. Your account is active again.", "token": token})
}

// Export godoc
// @Summary Download a copy of your data (JSON)
// @Tags Account
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /user/account/export [get]
func (ctrl *Controller) Export(c *fiber.Ctx) error {
	userID, err := currentUser(c)
	if userID == "" {
		return err
	}
	data, err := ctrl.service.Export(c.Context(), userID)
	if err != nil {
		return fail(c, err)
	}
	body, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fail(c, err)
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSONCharsetUTF8)
	c.Set(fiber.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="kaammilega-data-%s.json"`, time.Now().Format("2006-01-02")))
	c.Set(fiber.HeaderCacheControl, "no-store")
	return c.Send(body)
}
