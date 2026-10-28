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
	jwtAuth := middleware.AuthMiddleware(a.cfg.JWTSecret)

	// Public Routes
	app.Get("/api/events", a.ctrl.GetEvents)
	app.Get("/api/events/:id/attendees", a.ctrl.GetEventAttendees)

	// Protected user ticket routes (registered before /:id)
	// Login is checked per route, not on the group: Fiber runs group middleware for every
	// request under the prefix, which made the public detail route below require a login too.
	protected := app.Group("/api/events")
	protected.Get("/my/tickets", jwtAuth, a.ctrl.GetMyTickets)

	// Protected event creation & checkout routes
	protected.Post("/", jwtAuth, a.ctrl.CreateEvent)
	protected.Post("/:id/register", jwtAuth, a.ctrl.RegisterUser)
	protected.Post("/:id/create-order", jwtAuth, a.ctrl.CreateEventOrder)
	protected.Post("/:id/verify-payment", jwtAuth, a.ctrl.VerifyEventPayment)
	protected.Post("/:id/wallet-checkout", jwtAuth, a.ctrl.BookWithWallet)
	protected.Get("/:id/ticket", jwtAuth, a.ctrl.GetEventTicket)

	// Dynamic public event detail route
	app.Get("/api/events/:id", a.ctrl.GetEventByID)

	// Admin Superpower Routes (Strictly Authenticated & Admin-Only)
	adminEvents := app.Group("/api/admin/events", jwtAuth, middleware.RequireRole("admin"))
	adminEvents.Get("/", a.ctrl.AdminGetAllEvents)
	adminEvents.Post("/", a.ctrl.AdminCreateEvent)
	adminEvents.Get("/:id", a.ctrl.AdminGetEventDetail)
	adminEvents.Put("/:id", a.ctrl.AdminUpdateEvent)
	adminEvents.Delete("/:id", a.ctrl.AdminDeleteEvent)
}

