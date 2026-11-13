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
	// Platform settings hold provider keys (the SMS API key), so reading and writing them is for
	// admins only. They live under /api/admin so they never catch the member routes at
	// /api/settings/me (user feature), which register after this one.
	admin := app.Group("/api/admin/settings", middleware.AuthMiddleware(api.config.JWTSecret), middleware.RequireRole("admin"))
	admin.Get("/:key", api.controller.GetValue)
	admin.Post("/:key", api.controller.SetValue)
}
