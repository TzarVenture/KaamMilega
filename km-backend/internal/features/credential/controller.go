package credential

import (
	"errors"
	"slices"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Controller struct {
	service Service
}

func NewController(service Service) *Controller {
	return &Controller{service: service}
}

func fail(c *fiber.Ctx, err error) error {
	status := fiber.StatusInternalServerError
	switch {
	case errors.Is(err, ErrUserNotFound), errors.Is(err, ErrCertNotFound), errors.Is(err, ErrSkillNotListed):
		status = fiber.StatusNotFound
	case errors.Is(err, ErrNotConnected), errors.Is(err, ErrEndorseSelf):
		status = fiber.StatusForbidden
	case errors.Is(err, ErrEndorseLimit):
		status = fiber.StatusTooManyRequests
	case errors.Is(err, ErrReviewState):
		status = fiber.StatusConflict
	case errors.Is(err, ErrCertLimit), errors.Is(err, ErrCertName), errors.Is(err, ErrCertIssuer), errors.Is(err, ErrCertDate),
		errors.Is(err, ErrCertURL), errors.Is(err, ErrCertCredentialID), errors.Is(err, ErrCertFile), errors.Is(err, ErrCertSkills),
		errors.Is(err, ErrReviewDecision):
		status = fiber.StatusBadRequest
	}
	return c.Status(status).JSON(apperr.Body(err))
}

func viewer(c *fiber.Ctx) *primitive.ObjectID {
	s, _ := c.Locals("user_id").(string)
	id, err := primitive.ObjectIDFromHex(s)
	if err != nil {
		return nil
	}
	return &id
}

func isAdmin(c *fiber.Ctx) bool {
	switch roles := c.Locals("roles").(type) {
	case []string:
		return slices.Contains(roles, "admin")
	case []interface{}:
		for _, r := range roles {
			if s, ok := r.(string); ok && s == "admin" {
				return true
			}
		}
	}
	return false
}

func badBody(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
}

// Profile godoc
// @Summary A member's skills with endorsements, and their certificates
// @Tags credentials
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} ProfileCredentials
// @Router /api/credentials/users/{id} [get]
func (ctrl *Controller) Profile(c *fiber.Ctx) error {
	res, err := ctrl.service.Profile(c.UserContext(), viewer(c), isAdmin(c), c.Params("id"))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Endorsers godoc
// @Summary Everyone who endorsed one skill
// @Tags credentials
// @Produce json
// @Param id path string true "User ID"
// @Param skill query string true "Skill"
// @Success 200 {object} EndorserList
// @Router /api/credentials/users/{id}/endorsers [get]
func (ctrl *Controller) Endorsers(c *fiber.Ctx) error {
	res, err := ctrl.service.Endorsers(c.UserContext(), viewer(c), isAdmin(c), c.Params("id"), c.Query("skill"))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Endorse godoc
// @Summary Endorse a connection's skill
// @Tags credentials
// @Accept json
// @Param id path string true "User ID"
// @Param request body EndorseRequest true "Skill"
// @Success 204
// @Router /api/credentials/users/{id}/endorsements [post]
func (ctrl *Controller) Endorse(c *fiber.Ctx) error {
	me := viewer(c)
	if me == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	var req EndorseRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	if err := ctrl.service.Endorse(c.UserContext(), *me, c.Params("id"), req.Skill); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Unendorse godoc
// @Summary Take back an endorsement
// @Tags credentials
// @Param id path string true "User ID"
// @Param skill query string true "Skill"
// @Success 204
// @Router /api/credentials/users/{id}/endorsements [delete]
func (ctrl *Controller) Unendorse(c *fiber.Ctx) error {
	me := viewer(c)
	if me == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	if err := ctrl.service.Unendorse(c.UserContext(), *me, c.Params("id"), c.Query("skill")); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// AddCertification godoc
// @Summary Add a certificate to my profile
// @Tags credentials
// @Accept json
// @Produce json
// @Param request body CertificationRequest true "Certificate"
// @Success 201 {object} CertificationView
// @Router /api/credentials/certifications [post]
func (ctrl *Controller) AddCertification(c *fiber.Ctx) error {
	me := viewer(c)
	if me == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	var req CertificationRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.AddCertification(c.UserContext(), *me, req)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(res)
}

// UpdateCertification godoc
// @Summary Edit one of my certificates (changing its evidence sends it back for review)
// @Tags credentials
// @Accept json
// @Produce json
// @Param id path string true "Certificate ID"
// @Param request body CertificationRequest true "Certificate"
// @Success 200 {object} CertificationView
// @Router /api/credentials/certifications/{id} [patch]
func (ctrl *Controller) UpdateCertification(c *fiber.Ctx) error {
	me := viewer(c)
	if me == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	var req CertificationRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.UpdateCertification(c.UserContext(), *me, c.Params("id"), req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// DeleteCertification godoc
// @Summary Remove one of my certificates
// @Tags credentials
// @Param id path string true "Certificate ID"
// @Success 204
// @Router /api/credentials/certifications/{id} [delete]
func (ctrl *Controller) DeleteCertification(c *fiber.Ctx) error {
	me := viewer(c)
	if me == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	if err := ctrl.service.DeleteCertification(c.UserContext(), *me, c.Params("id")); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ReviewQueue godoc
// @Summary Certificates by review state (admins)
// @Tags credentials
// @Produce json
// @Param status query string false "pending (default), verified, rejected, unverified"
// @Success 200 {array} ReviewItem
// @Router /api/admin/certifications [get]
func (ctrl *Controller) ReviewQueue(c *fiber.Ctx) error {
	status := c.Query("status", StatusPending)
	if status == "all" {
		status = ""
	}
	res, err := ctrl.service.ReviewQueue(c.UserContext(), status)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"certifications": res})
}

// Review godoc
// @Summary Verify or reject a certificate (admins)
// @Tags credentials
// @Accept json
// @Produce json
// @Param id path string true "Certificate ID"
// @Param request body ReviewRequest true "Decision"
// @Success 200 {object} CertificationView
// @Router /api/admin/certifications/{id}/review [post]
func (ctrl *Controller) Review(c *fiber.Ctx) error {
	me := viewer(c)
	if me == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	var req ReviewRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.Review(c.UserContext(), *me, c.Params("id"), req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}
