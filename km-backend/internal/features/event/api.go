package event

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type EventApi struct {
	ctrl *EventController
	cfg  *config.Config
}

func NewEventApi(ctrl *EventController, cfg *config.Config) api.Route {
	return &EventApi{ctrl: ctrl, cfg: cfg}
}

func (a *EventApi) Setup(app *fiber.App) {
	// Public Routes
	app.Get("/api/events", a.ctrl.GetEvents)
	app.Get("/api/events/:id", a.ctrl.GetEventByID)

	// Protected Routes
	group := app.Group("/api/events", middleware.AuthMiddleware(a.cfg.JWTSecret))
	group.Post("/", a.ctrl.CreateEvent)
	group.Post("/:id/register", a.ctrl.RegisterUser)
}
