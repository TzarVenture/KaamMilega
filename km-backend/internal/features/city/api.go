package city

import (
	"km-backend/internal/common/api"

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

	// Admin routes (should be protected in real app, keeping open for now as requested)
	app.Post("/api/cities", api.controller.CreateCity)
	app.Patch("/api/cities/:id", api.controller.UpdateCity)
	app.Delete("/api/cities/:id", api.controller.DeleteCity)
}
