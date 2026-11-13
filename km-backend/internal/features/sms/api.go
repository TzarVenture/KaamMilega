package sms

import (
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type SMSApi struct {
	controller *SMSController
	cfg        *config.Config
}

func NewSMSApi(controller *SMSController, cfg *config.Config) *SMSApi {
	return &SMSApi{controller: controller, cfg: cfg}
}

func (api *SMSApi) Setup(app *fiber.App) {
	// Sends from our SMS account to any number, so only admins (it was open to anyone)
	app.Post("/api/sms/send", middleware.AuthMiddleware(api.cfg.JWTSecret), middleware.RequireRole("admin"), api.controller.SendSMS)
}
