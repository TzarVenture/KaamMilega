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
	auth.Post("/login/password", api.controller.LoginWithPassword)
	auth.Post("/register/password", api.controller.RegisterWithPassword)
	auth.Post("/password/forgot", api.controller.ForgotPassword)
	auth.Post("/password/reset", api.controller.ResetPassword)

	// Protected routes
	protected := app.Group("/api/user", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	protected.Get("/profile", api.controller.GetProfile)
	protected.Get("/search", api.controller.SearchUsers)
	protected.Post("/register", api.controller.Register)
	protected.Put("/password", api.controller.SetPassword)
	protected.Get("/:id", api.controller.GetOtherUserProfile)
	protected.Patch("/profile", api.controller.UpdateProfile)
	protected.Post("/education", api.controller.AddEducation)
	protected.Post("/experience", api.controller.AddExperience)
	protected.Post("/project", api.controller.AddProject)
	protected.Put("/project/:id", api.controller.UpdateProject)
	protected.Delete("/project/:id", api.controller.DeleteProject)
	protected.Post("/skill", api.controller.AddSkill)
	protected.Post("/apply-expert", api.controller.ApplyForExpert)
	protected.Post("/bookmark/:jobId", api.controller.ToggleBookmark)
	protected.Post("/bookmarks/:jobId", api.controller.ToggleBookmark)
	protected.Get("/bookmarks", api.controller.GetBookmarkedJobs)
	protected.Get("/settings", api.controller.GetSettings)
	protected.Put("/settings", api.controller.UpdateSettings)
	protected.Post("/settings", api.controller.UpdateSettings)

	// Settings alias route group
	settings := app.Group("/api/settings", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	settings.Get("/me", api.controller.GetSettings)
	settings.Put("/me", api.controller.UpdateSettings)
	settings.Post("/me", api.controller.UpdateSettings)


	// Admin routes (should add role middleware later)
	admin := app.Group("/api/admin", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	admin.Get("/users", api.controller.GetAllUsers)
	admin.Patch("/users/:id/roles", api.controller.UpdateUserRoles)
	admin.Patch("/users/:id", api.controller.AdminUpdateUserProfile)
	admin.Put("/experts/:id/approve", api.controller.ApproveExpert)
	admin.Get("/expert-requests", api.controller.GetExpertRequests)

	// Public-ish user listing
	users := app.Group("/api/users", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	users.Get("/experts", api.controller.GetExperts)
}
