package question

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type QuestionController struct {
	service *QuestionService
}

func NewQuestionController(service *QuestionService) *QuestionController {
	return &QuestionController{service: service}
}

func (c *QuestionController) CreateQuestion(ctx *fiber.Ctx) error {
	var req CreateQuestionRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	question, err := c.service.CreateQuestion(ctx.Context(), req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.Status(fiber.StatusCreated).JSON(question)
}

func (c *QuestionController) GetQuestions(ctx *fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	limit, _ := strconv.Atoi(ctx.Query("limit", "10"))

	filter := QuestionFilter{
		Page:  page,
		Limit: limit,
	}

	questions, total, err := c.service.GetQuestions(ctx.Context(), filter)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return ctx.JSON(fiber.Map{
		"data":       questions,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}

func (c *QuestionController) GetQuestion(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	question, err := c.service.GetQuestion(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if question == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Question not found"})
	}
	return ctx.JSON(question)
}

func (c *QuestionController) UpdateQuestion(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	var req UpdateQuestionRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	question, err := c.service.UpdateQuestion(ctx.Context(), id, req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if question == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Question not found"})
	}
	return ctx.JSON(question)
}

func (c *QuestionController) DeleteQuestion(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	if err := c.service.DeleteQuestion(ctx.Context(), id); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}
