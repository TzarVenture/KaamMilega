package company

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type CompanyController struct {
	service *CompanyService
}

func NewCompanyController(service *CompanyService) *CompanyController {
	return &CompanyController{service: service}
}

func (c *CompanyController) CreateCompany(ctx *fiber.Ctx) error {
	var req CreateCompanyRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	company, err := c.service.CreateCompany(ctx.Context(), req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusCreated).JSON(company)
}

func (c *CompanyController) GetCompany(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	company, err := c.service.GetCompany(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if company == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Company not found"})
	}

	return ctx.JSON(company)
}

func (c *CompanyController) GetCompanies(ctx *fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	limit, _ := strconv.Atoi(ctx.Query("limit", "10"))
	search := ctx.Query("search", "")
	status := ctx.Query("status", "")

	filter := CompanyFilter{
		Search: strings.TrimSpace(search),
		Status: strings.TrimSpace(status),
		Page:   page,
		Limit:  limit,
	}

	companies, total, err := c.service.GetCompanies(ctx.Context(), filter)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"data":  companies,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (c *CompanyController) UpdateCompany(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	var req UpdateCompanyRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	company, err := c.service.UpdateCompany(ctx.Context(), id, req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if company == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Company not found"})
	}

	return ctx.JSON(company)
}

func (c *CompanyController) DeleteCompany(ctx *fiber.Ctx) error {
	id := ctx.Params("id")
	if err := c.service.DeleteCompany(ctx.Context(), id); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}
