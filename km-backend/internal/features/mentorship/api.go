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
	mentorships := app.Group("/api/mentorships")
	
	// Public routes
	mentorships.Get("/", api.controller.ListMentorships)
	mentorships.Get("/expert/:expert_id/availability", api.controller.GetAvailability)

	// Protected routes
	protected := mentorships.Group("/", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	
	// Availability routes
	protected.Put("/availability", api.controller.UpdateAvailability)
	protected.Get("/availability", api.controller.GetAvailability)

	// Expert only routes
	protected.Post("/", api.controller.CreateMentorship)
	protected.Get("/expert/my", api.controller.GetMyMentorships)
	
	// Booking routes
	protected.Post("/book", api.controller.BookSession)
	protected.Get("/bookings/my", api.controller.GetMyBookings)
	protected.Get("/bookings/expert", api.controller.GetExpertBookings)
	protected.Patch("/bookings/:id/status", api.controller.UpdateBookingStatus)
	
	// Dynamic ID routes should be last to avoid catching sub-paths as IDs
	mentorships.Get("/:id", api.controller.GetMentorship)
	protected.Patch("/:id", api.controller.UpdateMentorship)
	protected.Delete("/:id", api.controller.DeleteMentorship)
}
