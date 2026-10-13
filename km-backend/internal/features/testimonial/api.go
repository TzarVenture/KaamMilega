package testimonial

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type TestimonialApi struct {
	ctrl *TestimonialController
	cfg  *config.Config
}

func NewTestimonialApi(ctrl *TestimonialController, cfg *config.Config) api.Route {
	return &TestimonialApi{ctrl: ctrl, cfg: cfg}
}

func (a *TestimonialApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(a.cfg.JWTSecret)

	// Public Endpoint for Home Page
	app.Get("/api/testimonials", a.ctrl.GetTestimonials)

	// Admin Endpoints for Testimonial Management
	admin := app.Group("/api/admin/testimonials", jwtAuth)
	admin.Get("/", a.ctrl.GetAdminTestimonials)
	admin.Post("/", a.ctrl.CreateTestimonial)
	admin.Put("/:id", a.ctrl.UpdateTestimonial)
	admin.Delete("/:id", a.ctrl.DeleteTestimonial)
}
