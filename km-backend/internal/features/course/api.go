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
	// Login is checked per route, not on the group: Fiber runs group middleware for every
	// request under the prefix, which made the public detail route below require a login too.
	protected := app.Group("/api/courses")
	protected.Get("/my", jwtAuth, a.ctrl.GetMyCourses)
	protected.Post("", jwtAuth, a.ctrl.CreateCourse)
	protected.Post("/", jwtAuth, a.ctrl.CreateCourse)
	protected.Put("/:id", jwtAuth, a.ctrl.UpdateCourse)
	protected.Delete("/:id", jwtAuth, a.ctrl.DeleteCourse)

	// Public Detail Route
	app.Get("/api/courses/:id", a.ctrl.GetCourse)

	// Admin alias routes
	admin := app.Group("/api/admin/courses", jwtAuth, middleware.RequireRole("admin"))
	admin.Get("", a.ctrl.GetCourses)
	admin.Get("/", a.ctrl.GetCourses)
	admin.Post("", a.ctrl.CreateCourse)
	admin.Post("/", a.ctrl.CreateCourse)
	admin.Put("/:id", a.ctrl.UpdateCourse)
	admin.Delete("/:id", a.ctrl.DeleteCourse)
}
