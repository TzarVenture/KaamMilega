package skill

import (
	"context"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type SkillController struct {
	service SkillService
}

func NewSkillController(service SkillService) *SkillController {
	return &SkillController{service: service}
}

func (c *SkillController) CreateSkill(ctx *fiber.Ctx) error {
	var req CreateSkillRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skill, err := c.service.CreateSkill(context.Background(), &req)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(http.StatusCreated).JSON(skill)
}

func (c *SkillController) GetSkills(ctx *fiber.Ctx) error {
	query := ctx.Query("q")
	skills, err := c.service.GetSkills(context.Background(), query)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(http.StatusOK).JSON(skills)
}
