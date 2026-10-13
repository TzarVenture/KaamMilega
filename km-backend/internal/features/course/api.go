package course

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type CourseApi struct {
	ctrl *CourseController
	cfg  *config.Config
}

func NewCourseApi(ctrl *CourseController, cfg *config.Config) api.Route {
	return &CourseApi{ctrl: ctrl, cfg: cfg}
}

func (a *CourseApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(a.cfg.JWTSecret)

	// Public Routes
	app.Get("/api/courses", a.ctrl.GetCourses)
	app.Post("/api/courses/:id/view", a.ctrl.RecordView)

	// Protected Routes (Registered before /:id)
	protected := app.Group("/api/courses", jwtAuth)
	protected.Get("/my", a.ctrl.GetMyCourses)
	protected.Post("/", a.ctrl.CreateCourse)
	protected.Put("/:id", a.ctrl.UpdateCourse)
	protected.Delete("/:id", a.ctrl.DeleteCourse)

	// Public Detail Route
	app.Get("/api/courses/:id", a.ctrl.GetCourse)
}
