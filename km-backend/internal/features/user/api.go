package user

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type UserApi struct {
	controller *UserController
}

func NewUserApi(controller *UserController) api.Route {
	return &UserApi{controller: controller}
}

func (api *UserApi) Setup(app *fiber.App) {
	auth := app.Group("/api/auth")

	auth.Post("/otp/send", api.controller.SendOTP)
	auth.Post("/otp/verify", api.controller.VerifyOTP)
	auth.Post("/otp/email/send", api.controller.SendEmailOTP)
	auth.Post("/otp/email/verify", api.controller.VerifyEmailOTP)

	// Protected routes
	protected := app.Group("/api/user", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	protected.Get("/profile", api.controller.GetProfile)
	protected.Get("/search", api.controller.SearchUsers)
	protected.Post("/register", api.controller.Register)
	protected.Get("/:id", api.controller.GetOtherUserProfile)
	protected.Patch("/profile", api.controller.UpdateProfile)
	protected.Post("/education", api.controller.AddEducation)
	protected.Post("/experience", api.controller.AddExperience)
	protected.Post("/skill", api.controller.AddSkill)
	protected.Post("/apply-expert", api.controller.ApplyForExpert)

	// Admin routes (should add role middleware later)
	admin := app.Group("/api/admin", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	admin.Get("/users", api.controller.GetAllUsers)
	admin.Put("/experts/:id/approve", api.controller.ApproveExpert)
	admin.Get("/expert-requests", api.controller.GetExpertRequests)

	// Public-ish user listing
	users := app.Group("/api/users", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	users.Get("/experts", api.controller.GetExperts)
}
