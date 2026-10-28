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
	app.Get("/api/mentorships/expert/:expert_id/reviews", api.controller.GetExpertReviews)
	app.Get("/api/mentorships/:id/reviews", api.controller.GetMentorshipReviews)

	// Protected routes (Must register specific sub-paths before dynamic /:id)
	// Login is checked per route, not on the group: Fiber runs group middleware for every
	// request under the prefix, which made the public detail route below require a login too.
	protected := app.Group("/api/mentorships")
	
	// Availability routes
	protected.Put("/availability", jwtAuth, api.controller.UpdateAvailability)
	protected.Get("/availability", jwtAuth, api.controller.GetAvailability)

	// Expert only routes
	protected.Post("/", jwtAuth, api.controller.CreateMentorship)
	protected.Get("/expert/my", jwtAuth, api.controller.GetMyMentorships)
	
	// Booking & Payment routes (F76)
	protected.Post("/book", jwtAuth, api.controller.BookSession)
	protected.Post("/book-wallet", jwtAuth, api.controller.BookWithWallet)
	protected.Post("/create-order", jwtAuth, api.controller.CreateBookingOrder)
	protected.Post("/verify-payment", jwtAuth, api.controller.VerifyBookingPayment)
	protected.Get("/bookings/my", jwtAuth, api.controller.GetMyBookings)
	protected.Get("/bookings/expert", jwtAuth, api.controller.GetExpertBookings)
	protected.Patch("/bookings/:id/status", jwtAuth, api.controller.UpdateBookingStatus)
	protected.Patch("/bookings/:id/meeting-link", jwtAuth, api.controller.UpdateMeetingLink)
	protected.Post("/bookings/:id/review", jwtAuth, api.controller.SubmitBookingReview)
	
	// Dynamic ID routes must be defined last
	app.Get("/api/mentorships/:id", api.controller.GetMentorship)
	protected.Patch("/:id", jwtAuth, api.controller.UpdateMentorship)
	protected.Delete("/:id", jwtAuth, api.controller.DeleteMentorship)
}
