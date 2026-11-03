package policies

import (
	"errors"
	"log"
	"strconv"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Controller struct {
	svc Service
}

func NewController(svc Service) *Controller {
	return &Controller{svc: svc}
}

// fail: unknown or unpublished → 404, a clash between two editors → 409, any other coded error
// is a bad request, and the rest is logged and hidden behind a 500
func fail(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	case errors.Is(err, errVersionConflict):
		return c.Status(fiber.StatusConflict).JSON(apperr.Body(err))
	case apperr.CodeOf(err) != "":
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	log.Printf("policies: %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Something went wrong. Please try again."})
}

// Get godoc
// @Summary The published version of a policy
// @Tags policies
// @Param slug path string true "terms | employer-terms | privacy | community-guidelines"
// @Success 200 {object} Policy
// @Router /api/policies/{slug} [get]
func (ctrl *Controller) Get(c *fiber.Ctx) error {
	p, err := ctrl.svc.Published(c.UserContext(), c.Params("slug"))
	if err != nil {
		return fail(c, err)
	}
	// Policies change rarely; a short cache keeps the pages fast without serving old text for long
	c.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return c.JSON(p)
}

// AdminList godoc
// @Summary Every policy the site links to, published or not
// @Tags admin-policies
// @Success 200 {array} AdminPolicy
// @Router /api/admin/policies [get]
func (ctrl *Controller) AdminList(c *fiber.Ctx) error {
	list, err := ctrl.svc.AdminList(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(list)
}

// AdminGet godoc
// @Summary A policy to edit (its live version, or empty if never published)
// @Tags admin-policies
// @Param slug path string true "Policy slug"
// @Success 200 {object} Policy
// @Router /api/admin/policies/{slug} [get]
func (ctrl *Controller) AdminGet(c *fiber.Ctx) error {
	p, err := ctrl.svc.AdminGet(c.UserContext(), c.Params("slug"))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(p)
}

// AdminPublish godoc
// @Summary Publish a new version of a policy
// @Tags admin-policies
// @Accept json
// @Param slug path string true "Policy slug"
// @Param request body PublishInput true "Title, Markdown content and the version the edit started from"
// @Success 200 {object} Policy
// @Router /api/admin/policies/{slug} [put]
func (ctrl *Controller) AdminPublish(c *fiber.Ctx) error {
	s, _ := c.Locals("user_id").(string)
	adminID, err := primitive.ObjectIDFromHex(s)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Please sign in again."})
	}
	var in PublishInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	p, err := ctrl.svc.Publish(c.UserContext(), c.Params("slug"), in, adminID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(p)
}

// AdminVersions godoc
// @Summary Every published version of a policy, newest first, without the text
// @Tags admin-policies
// @Param slug path string true "Policy slug"
// @Success 200 {array} Version
// @Router /api/admin/policies/{slug}/versions [get]
func (ctrl *Controller) AdminVersions(c *fiber.Ctx) error {
	list, err := ctrl.svc.Versions(c.UserContext(), c.Params("slug"))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(list)
}

// AdminVersion godoc
// @Summary One published version of a policy, with its text
// @Tags admin-policies
// @Param slug path string true "Policy slug"
// @Param version path int true "Version number"
// @Success 200 {object} Version
// @Router /api/admin/policies/{slug}/versions/{version} [get]
func (ctrl *Controller) AdminVersion(c *fiber.Ctx) error {
	n, err := strconv.Atoi(c.Params("version"))
	if err != nil || n < 1 {
		return fail(c, ErrNotFound)
	}
	v, err := ctrl.svc.Version(c.UserContext(), c.Params("slug"), n)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(v)
}
