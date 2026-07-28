package mentorship

import (
	"github.com/gofiber/fiber/v2"
	"km-backend/internal/config"
)

type MentorshipController struct {
	service MentorshipService
	config  *config.Config
}

func NewMentorshipController(service MentorshipService, config *config.Config) *MentorshipController {
	return &MentorshipController{service: service, config: config}
}

func (c *MentorshipController) CreateMentorship(ctx *fiber.Ctx) error {
	var req CreateMentorshipRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	expertID := ctx.Locals("user_id").(string)
	m, err := c.service.CreateMentorship(ctx.Context(), expertID, req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.Status(fiber.StatusCreated).JSON(m)
}

func (c *MentorshipController) ListMentorships(ctx *fiber.Ctx) error {
	category := ctx.Query("category")
	ms, err := c.service.ListMentorships(ctx.Context(), category)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(ms)
}

func (c *MentorshipController) GetMentorship(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	m, err := c.service.GetMentorship(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if m == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Mentorship not found"})
	}
	return ctx.JSON(m)
}

func (c *MentorshipController) GetMyMentorships(ctx *fiber.Ctx) error {
	expertID := ctx.Locals("user_id").(string)
	ms, err := c.service.GetMentorshipsByExpert(ctx.Context(), expertID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(ms)
}

func (c *MentorshipController) UpdateMentorship(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	var req CreateMentorshipRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	expertID := ctx.Locals("user_id").(string)
	m, err := c.service.UpdateMentorship(ctx.Context(), expertID, id, req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(m)
}

func (c *MentorshipController) DeleteMentorship(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	expertID := ctx.Locals("user_id").(string)
	if err := c.service.DeleteMentorship(ctx.Context(), expertID, id); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}

func (c *MentorshipController) BookSession(ctx *fiber.Ctx) error {
	var req BookMentorshipRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	userID := ctx.Locals("user_id").(string)
	booking, err := c.service.BookSession(ctx.Context(), userID, req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.Status(fiber.StatusCreated).JSON(booking)
}

func (c *MentorshipController) GetMyBookings(ctx *fiber.Ctx) error {
	userID := ctx.Locals("user_id").(string)
	bookings, err := c.service.GetUserBookings(ctx.Context(), userID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(bookings)
}

func (c *MentorshipController) GetExpertBookings(ctx *fiber.Ctx) error {
	expertID := ctx.Locals("user_id").(string)
	bookings, err := c.service.GetExpertBookings(ctx.Context(), expertID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(bookings)
}

func (c *MentorshipController) UpdateBookingStatus(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	status := ctx.Query("status")
	expertID := ctx.Locals("user_id").(string)
	if err := c.service.UpdateBookingStatus(ctx.Context(), expertID, id, status); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusOK)
}

func (c *MentorshipController) UpdateAvailability(ctx *fiber.Ctx) error {
	var req []AvailabilityRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	expertID := ctx.Locals("user_id").(string)
	if err := c.service.UpdateAvailability(ctx.Context(), expertID, req); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusOK)
}

func (c *MentorshipController) GetAvailability(ctx *fiber.Ctx) error {
	expertID := ctx.Params("expert_id")
	if expertID == "" {
		expertID = ctx.Locals("user_id").(string)
	}
	avails, err := c.service.GetAvailability(ctx.Context(), expertID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.JSON(avails)
}
