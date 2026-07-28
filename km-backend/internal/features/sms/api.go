package sms

import (
	"github.com/gofiber/fiber/v2"
)

type SMSApi struct {
	controller *SMSController
}

func NewSMSApi(controller *SMSController) *SMSApi {
	return &SMSApi{
		controller: controller,
	}
}

func (api *SMSApi) Setup(app *fiber.App) {
	app.Post("/api/sms/send", api.controller.SendSMS)
}
