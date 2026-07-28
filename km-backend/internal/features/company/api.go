package company

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

type CompanyApi struct {
	controller *CompanyController
	config     *config.Config
}

func NewCompanyApi(controller *CompanyController, config *config.Config) api.Route {
	return &CompanyApi{
		controller: controller,
		config:     config,
	}
}

func (api *CompanyApi) Setup(app *fiber.App) {
	// Protected routes (Admin only?)
	// Or maybe recruiters can see their own?
	// For /admin/companies, it should be admin only.

	// Group for admin company management
	adminRoutes := app.Group("/api/admin/companies", middleware.AuthMiddleware(api.config.JWTSecret)) // Add Admin role check if needed

	adminRoutes.Get("/", api.controller.GetCompanies)
	adminRoutes.Post("/", api.controller.CreateCompany) // Create new profile
	adminRoutes.Get("/:id", api.controller.GetCompany)
	adminRoutes.Patch("/:id", api.controller.UpdateCompany)
	adminRoutes.Delete("/:id", api.controller.DeleteCompany)
}
