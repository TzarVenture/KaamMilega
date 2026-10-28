package app_waitlist

import (
	"km-backend/internal/common/apperr"
	"log"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	repo Repository
}

func NewController(repo Repository) *Controller {
	return &Controller{repo: repo}
}

// Join records a mobile number to notify when the app launches. Public; the answer is the same
// for a new or an existing number so it cannot be used to check who signed up.
func (ctrl *Controller) Join(c *fiber.Ctx) error {
	var req JoinRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	entry, err := req.Normalize()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	if err := ctrl.repo.Upsert(c.Context(), entry); err != nil {
		log.Printf("[app_waitlist] upsert failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not save your number. Please try again."})
	}
	return c.JSON(fiber.Map{"success": true})
}

// List returns sign-ups for the team (newest first). ?interest=hire|work, ?limit (max 200), ?page.
func (ctrl *Controller) List(c *fiber.Ctx) error {
	interest := c.Query("interest")
	if interest != "" && interest != "hire" && interest != "work" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "interest must be hire or work"})
	}
	limit := int64(c.QueryInt("limit", 50))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	page := int64(c.QueryInt("page", 1))
	if page < 1 {
		page = 1
	}
	list, total, err := ctrl.repo.List(c.Context(), interest, limit, (page-1)*limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch sign-ups"})
	}
	return c.JSON(fiber.Map{"data": list, "total": total, "page": page, "limit": limit})
}
