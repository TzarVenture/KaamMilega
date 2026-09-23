package mentorship

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type MentorshipApi struct {
	controller *MentorshipController
}

func NewMentorshipApi(controller *MentorshipController) api.Route {
	return &MentorshipApi{controller: controller}
}

func (api *MentorshipApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(api.controller.config.JWTSecret)

	// Public routes
	app.Get("/api/mentorships", api.controller.ListMentorships)
	app.Get("/api/mentorships/expert/:expert_id/availability", api.controller.GetAvailability)

	// Protected routes (Must register specific sub-paths before dynamic /:id)
	protected := app.Group("/api/mentorships", jwtAuth)
	
	// Availability routes
	protected.Put("/availability", api.controller.UpdateAvailability)
	protected.Get("/availability", api.controller.GetAvailability)

	// Expert only routes
	protected.Post("/", api.controller.CreateMentorship)
	protected.Get("/expert/my", api.controller.GetMyMentorships)
	
	// Booking & Payment routes (F76)
	protected.Post("/book", api.controller.BookSession)
	protected.Post("/book-wallet", api.controller.BookWithWallet)
	protected.Post("/create-order", api.controller.CreateBookingOrder)
	protected.Post("/verify-payment", api.controller.VerifyBookingPayment)
	protected.Get("/bookings/my", api.controller.GetMyBookings)
	protected.Get("/bookings/expert", api.controller.GetExpertBookings)
	protected.Patch("/bookings/:id/status", api.controller.UpdateBookingStatus)
	
	// Dynamic ID routes must be defined last
	app.Get("/api/mentorships/:id", api.controller.GetMentorship)
	protected.Patch("/:id", api.controller.UpdateMentorship)
	protected.Delete("/:id", api.controller.DeleteMentorship)
}
