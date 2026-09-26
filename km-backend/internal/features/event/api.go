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

	// Protected user ticket routes (registered before /:id)
	protected := app.Group("/api/events", jwtAuth)
	protected.Get("/my/tickets", a.ctrl.GetMyTickets)

	// Protected event creation & checkout routes
	protected.Post("/", a.ctrl.CreateEvent)
	protected.Post("/:id/register", a.ctrl.RegisterUser)
	protected.Post("/:id/create-order", a.ctrl.CreateEventOrder)
	protected.Post("/:id/verify-payment", a.ctrl.VerifyEventPayment)
	protected.Post("/:id/wallet-checkout", a.ctrl.BookWithWallet)
	protected.Get("/:id/ticket", a.ctrl.GetEventTicket)

	// Dynamic public event detail route
	app.Get("/api/events/:id", a.ctrl.GetEventByID)
}
