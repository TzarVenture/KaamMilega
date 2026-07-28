package setting

import (
	"github.com/gofiber/fiber/v2"
)

type SettingApi struct {
	controller *SettingController
}

func NewSettingApi(controller *SettingController) *SettingApi {
	return &SettingApi{
		controller: controller,
	}
}

func (api *SettingApi) Setup(app *fiber.App) {
	app.Get("/api/settings/:key", api.controller.GetValue)
	app.Post("/api/settings/:key", api.controller.SetValue)
}
