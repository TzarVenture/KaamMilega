package city

import (
	"strconv"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

type CityController struct {
	service *CityService
	config  *config.Config
}

func NewCityController(service *CityService, config *config.Config) *CityController {
	return &CityController{service: service, config: config}
}

func (c *CityController) CreateCity(ctx *fiber.Ctx) error {
	var req CreateCityRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	city, err := c.service.CreateCity(ctx.Context(), &req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.Status(fiber.StatusCreated).JSON(city)
}

func (c *CityController) GetCities(ctx *fiber.Ctx) error {
	activeOnly := ctx.Query("active") == "true"
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	limit, _ := strconv.Atoi(ctx.Query("limit", "1000")) // Default to 1000 if not specified to simulate "all" but allow paginated access
	search := ctx.Query("search", "")

	filter := CityFilter{
		Search:     search,
		Page:       page,
		Limit:      limit,
		ActiveOnly: activeOnly,
	}

	cities, total, err := c.service.GetCities(ctx.Context(), filter)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// If pagination requested via non-default params, return structured response
	// But frontend expects array OR structured.
	// Let's standardise on returning array if no pagination params?
	// But admin page usually uses pagination.
	// The frontend `page.tsx` expects array (I fixed it to handle both).

	// Let's return structured data.
	return ctx.JSON(fiber.Map{
		"data":  cities,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (c *CityController) GetCity(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	city, err := c.service.GetCity(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if city == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "City not found"})
	}
	return ctx.JSON(city)
}

func (c *CityController) UpdateCity(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	var req UpdateCityRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	city, err := c.service.UpdateCity(ctx.Context(), id, &req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if city == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "City not found"})
	}
	return ctx.JSON(city)
}

func (c *CityController) DeleteCity(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	if err := c.service.DeleteCity(ctx.Context(), id); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}
