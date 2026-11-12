package credential

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type Api struct {
	controller *Controller
	config     *config.Config
}

func NewApi(controller *Controller, cfg *config.Config) api.Route {
	return &Api{controller: controller, config: cfg}
}

func (a *Api) Setup(app *fiber.App) {
	auth := middleware.AuthMiddleware(a.config.JWTSecret)
	optional := middleware.OptionalAuthMiddleware(a.config.JWTSecret)

	g := app.Group("/api/credentials")
	// Anyone who may see the profile sees its skills and verified certificates
	g.Get("/users/:id", optional, a.controller.Profile)
	g.Get("/users/:id/endorsers", optional, a.controller.Endorsers)
	g.Post("/users/:id/endorsements", auth, a.controller.Endorse)
	g.Delete("/users/:id/endorsements", auth, a.controller.Unendorse)

	g.Post("/certifications", auth, a.controller.AddCertification)
	g.Patch("/certifications/:id", auth, a.controller.UpdateCertification)
	g.Delete("/certifications/:id", auth, a.controller.DeleteCertification)

	admin := app.Group("/api/admin/certifications", auth, middleware.RequireRole(user.RoleAdmin))
	admin.Get("/", a.controller.ReviewQueue)
	admin.Post("/:id/review", a.controller.Review)
}
