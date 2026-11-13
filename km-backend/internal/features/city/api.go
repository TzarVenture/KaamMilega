package city

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type CityApi struct {
	controller *CityController
}

func NewCityApi(controller *CityController) api.Route {
	return &CityApi{controller: controller}
}

func (api *CityApi) Setup(app *fiber.App) {
	// Public routes
	app.Get("/api/cities", api.controller.GetCities)
	app.Get("/api/cities/:id", api.controller.GetCity)

	// Changing the city list is for admins (these were open to anyone)
	admin := []fiber.Handler{middleware.AuthMiddleware(api.controller.config.JWTSecret), middleware.RequireRole("admin")}
	app.Post("/api/cities", append(admin, api.controller.CreateCity)...)
	app.Patch("/api/cities/:id", append(admin, api.controller.UpdateCity)...)
	app.Delete("/api/cities/:id", append(admin, api.controller.DeleteCity)...)
}
