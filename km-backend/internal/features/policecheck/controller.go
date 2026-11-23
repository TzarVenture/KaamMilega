package policecheck

import (
	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service Service
}

func NewController(service Service) *Controller {
	return &Controller{service: service}
}

func fail(c *fiber.Ctx, err error) error {
	return c.Status(apperr.StatusOf(err)).JSON(apperr.Body(err))
}

func userID(c *fiber.Ctx) string {
	s, _ := c.Locals("user_id").(string)
	return s
}

// Mine godoc
// @Summary My police verification certificate and whether the badge shows
// @Tags police-verification
// @Produce json
// @Success 200 {object} MyStatus
// @Router /api/police-verification [get]
func (ctrl *Controller) Mine(c *fiber.Ctx) error {
	res, err := ctrl.service.Mine(c.UserContext(), userID(c))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Submit godoc
// @Summary Upload a police verification certificate for review
// @Description Upload the file first with POST /api/files/upload (kind=police_certificate), then send its id here.
// @Tags police-verification
// @Accept json
// @Produce json
// @Param body body SubmitRequest true "Certificate"
// @Success 200 {object} MyStatus
// @Router /api/police-verification [post]
func (ctrl *Controller) Submit(c *fiber.Ctx) error {
	var req SubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	res, err := ctrl.service.Submit(c.UserContext(), userID(c), req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Queue godoc
// @Summary Police certificates to review (admin)
// @Tags police-verification
// @Produce json
// @Param status query string false "pending (default), approved or rejected"
// @Param page query int false "Page"
// @Param limit query int false "Page size (max 50)"
// @Success 200 {object} QueuePage
// @Router /api/admin/police-verifications [get]
func (ctrl *Controller) Queue(c *fiber.Ctx) error {
	res, err := ctrl.service.Queue(c.UserContext(), c.Query("status"), c.QueryInt("page", 1), c.QueryInt("limit", defaultLimit))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Review godoc
// @Summary Approve or reject a member's police certificate (admin)
// @Tags police-verification
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param body body ReviewRequest true "Decision"
// @Router /api/admin/police-verifications/{id}/review [post]
func (ctrl *Controller) Review(c *fiber.Ctx) error {
	var req ReviewRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	res, err := ctrl.service.Review(c.UserContext(), userID(c), c.Params("id"), req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}
