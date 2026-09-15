package skill

import (
	"context"
	"net/http"
	"strconv"
	"strings"

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

	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.TrimSpace(req.Category)

	if req.Name == "" {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Skill/profession name is required"})
	}

	skill, err := c.service.CreateSkill(context.Background(), &req)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return ctx.Status(http.StatusConflict).JSON(fiber.Map{"error": "Skill already exists in catalog"})
		}
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(http.StatusCreated).JSON(skill)
}

func (c *SkillController) GetSkills(ctx *fiber.Ctx) error {
	query := ctx.Query("q")
	category := ctx.Query("category")
	limitStr := ctx.Query("limit")

	var limit int64 = 0
	if limitStr != "" {
		if parsed, err := strconv.ParseInt(limitStr, 10, 64); err == nil && parsed > 0 {
			limit = parsed
		}
	} else if query != "" && category == "" {
		// Default autocomplete query limit to 20 for candidate profile search
		limit = 20
	}

	skills, err := c.service.GetSkills(context.Background(), query, category, limit)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(http.StatusOK).JSON(skills)
}

func (c *SkillController) GetCategories(ctx *fiber.Ctx) error {
	categories, err := c.service.GetCategories(context.Background())
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(http.StatusOK).JSON(categories)
}

func (c *SkillController) GetSkill(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	skill, err := c.service.GetSkillByID(context.Background(), id)
	if err != nil {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if skill == nil {
		return ctx.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Skill not found"})
	}

	return ctx.Status(http.StatusOK).JSON(skill)
}

func (c *SkillController) UpdateSkill(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	var req UpdateSkillRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.TrimSpace(req.Category)

	skill, err := c.service.UpdateSkill(context.Background(), id, &req)
	if err != nil {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if skill == nil {
		return ctx.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Skill not found"})
	}

	return ctx.Status(http.StatusOK).JSON(skill)
}

func (c *SkillController) DeleteSkill(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	if err := c.service.DeleteSkill(context.Background(), id); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid") {
			return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		if strings.Contains(strings.ToLower(err.Error()), "no documents") {
			return ctx.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Skill not found"})
		}
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.SendStatus(http.StatusNoContent)
}

func (c *SkillController) SeedSkills(ctx *fiber.Ctx) error {
	count, err := c.service.SeedDefaultSkills(context.Background())
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Default skill catalog seeded successfully",
		"count":   count,
	})
}
