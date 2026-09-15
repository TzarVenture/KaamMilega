package skill

import (
	"km-backend/internal/common/api"

	"github.com/gofiber/fiber/v2"
)

type SkillApi struct {
	controller *SkillController
}

func NewSkillApi(controller *SkillController) api.Route {
	return &SkillApi{controller: controller}
}

func (api *SkillApi) Setup(app *fiber.App) {
	group := app.Group("/api/skills")

	group.Get("/categories", api.controller.GetCategories)
	group.Post("/seed", api.controller.SeedSkills)
	group.Get("/:id", api.controller.GetSkill)
	group.Patch("/:id", api.controller.UpdateSkill)
	group.Delete("/:id", api.controller.DeleteSkill)
	group.Post("/", api.controller.CreateSkill)
	group.Get("/", api.controller.GetSkills)
}
