package sms

import (
	"github.com/gofiber/fiber/v2"
)

type SMSController struct {
	service SMSService
}

func NewSMSController(service SMSService) *SMSController {
	return &SMSController{
		service: service,
	}
}

type SendSMSRequest struct {
	To           string   `json:"to" validate:"required"`
	TemplateName string   `json:"template_name" validate:"required"`
	Params       []string `json:"params"`
}

// SendSMS godoc
// @Summary Send SMS
// @Description Send an SMS using a template
// @Tags sms
// @Accept json
// @Produce json
// @Param request body SendSMSRequest true "SMS Request"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/sms/send [post]
func (c *SMSController) SendSMS(ctx *fiber.Ctx) error {
	var req SendSMSRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	result, err := c.service.SendSMS(ctx.UserContext(), req.To, req.TemplateName, req.Params)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.JSON(result)
}
