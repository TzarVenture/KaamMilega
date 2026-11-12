package skill

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type SkillApi struct {
	controller *SkillController
	config     *config.Config
}

func NewSkillApi(controller *SkillController, cfg *config.Config) api.Route {
	return &SkillApi{controller: controller, config: cfg}
}

func (api *SkillApi) Setup(app *fiber.App) {
	group := app.Group("/api/skills")

	// Anyone can read the catalog (skill pickers, search)
	group.Get("/categories", api.controller.GetCategories)
	group.Get("/:id", api.controller.GetSkill)
	group.Get("/", api.controller.GetSkills)

	// Only admins change it (admin Professions page)
	admin := []fiber.Handler{middleware.AuthMiddleware(api.config.JWTSecret), middleware.RequireRole("admin")}
	group.Post("/seed", append(admin, api.controller.SeedSkills)...)
	group.Patch("/:id", append(admin, api.controller.UpdateSkill)...)
	group.Delete("/:id", append(admin, api.controller.DeleteSkill)...)
	group.Post("/", append(admin, api.controller.CreateSkill)...)
}
