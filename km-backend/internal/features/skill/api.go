package skill

import (
	"github.com/gofiber/fiber/v2"
)

type SkillApi struct {
	controller *SkillController
}

func NewSkillApi(controller *SkillController) *SkillApi {
	return &SkillApi{controller: controller}
}

func (api *SkillApi) Setup(app *fiber.App) {
	group := app.Group("/api/skills")

	group.Post("/", api.controller.CreateSkill)
	group.Get("/", api.controller.GetSkills)
}
