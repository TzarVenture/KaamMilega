package setting

import (
	"github.com/gofiber/fiber/v2"
)

type SettingController struct {
	service SettingService
}

func NewSettingController(service SettingService) *SettingController {
	return &SettingController{
		service: service,
	}
}

type SetSettingRequest struct {
	Value string `json:"value" validate:"required"`
}

// GetValue godoc
// @Summary Get Setting Value
// @Description Get a setting value by key
// @Tags settings
// @Param key path string true "Setting Key"
// @Success 200 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/settings/{key} [get]
func (c *SettingController) GetValue(ctx *fiber.Ctx) error {
	key := ctx.Params("key")
	value, err := c.service.GetValue(ctx.UserContext(), key)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Setting not found",
		})
	}
	return ctx.JSON(fiber.Map{
		"key":   key,
		"value": value,
	})
}

// SetValue godoc
// @Summary Set Setting Value
// @Description Set or update a setting value by key
// @Tags settings
// @Accept json
// @Produce json
// @Param key path string true "Setting Key"
// @Param request body SetSettingRequest true "Setting Value"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/settings/{key} [post]
func (c *SettingController) SetValue(ctx *fiber.Ctx) error {
	key := ctx.Params("key")
	var req SetSettingRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := c.service.SetValue(ctx.UserContext(), key, req.Value); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "Setting updated successfully",
		"key":     key,
		"value":   req.Value,
	})
}
