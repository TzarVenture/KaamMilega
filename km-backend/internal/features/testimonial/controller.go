package testimonial

import (
	"github.com/gofiber/fiber/v2"
	"km-backend/internal/config"
)

type TestimonialController struct {
	service TestimonialService
	cfg     *config.Config
}

func NewTestimonialController(service TestimonialService, cfg *config.Config) *TestimonialController {
	return &TestimonialController{
		service: service,
		cfg:     cfg,
	}
}

// GetTestimonials returns all active testimonials for public display
func (ctrl *TestimonialController) GetTestimonials(c *fiber.Ctx) error {
	list, err := ctrl.service.GetActiveTestimonials(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch testimonials"})
	}
	return c.JSON(fiber.Map{
		"data":  list,
		"total": len(list),
	})
}

// GetAdminTestimonials returns all testimonials for admin management
func (ctrl *TestimonialController) GetAdminTestimonials(c *fiber.Ctx) error {
	list, err := ctrl.service.GetAllTestimonials(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch testimonials"})
	}
	return c.JSON(fiber.Map{
		"data":  list,
		"total": len(list),
	})
}

// CreateTestimonial creates a new candidate testimonial
func (ctrl *TestimonialController) CreateTestimonial(c *fiber.Ctx) error {
	var req CreateTestimonialRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	created, err := ctrl.service.CreateTestimonial(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(created)
}

// UpdateTestimonial updates an existing candidate testimonial
func (ctrl *TestimonialController) UpdateTestimonial(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Testimonial ID is required"})
	}

	var req UpdateTestimonialRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updated, err := ctrl.service.UpdateTestimonial(c.Context(), id, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(updated)
}

// DeleteTestimonial deletes a candidate testimonial
func (ctrl *TestimonialController) DeleteTestimonial(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Testimonial ID is required"})
	}

	if err := ctrl.service.DeleteTestimonial(c.Context(), id); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Testimonial deleted successfully"})
}
