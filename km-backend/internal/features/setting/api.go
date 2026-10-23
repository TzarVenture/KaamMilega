package setting

import (
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type SettingApi struct {
	controller *SettingController
	config     *config.Config
}

func NewSettingApi(controller *SettingController, cfg *config.Config) *SettingApi {
	return &SettingApi{
		controller: controller,
		config:     cfg,
	}
}

func (api *SettingApi) Setup(app *fiber.App) {
	app.Get("/api/settings/:key", api.controller.GetValue)
	// Platform-wide settings: writing them was previously open to anyone
	app.Post("/api/settings/:key",
		middleware.AuthMiddleware(api.config.JWTSecret),
		middleware.RequireRole("admin"),
		api.controller.SetValue,
	)
}
