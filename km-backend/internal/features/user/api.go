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
	auth.Post("/password/forgot", api.controller.ForgotPassword)
	auth.Post("/password/reset", api.controller.ResetPassword)
	auth.Post("/logout", api.controller.Logout)
	auth.Get("/logout", api.controller.Logout)

	// Protected routes
	protected := app.Group("/api/user", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	protected.Get("/profile", api.controller.GetProfile)
	protected.Get("/profile-completion", api.controller.GetProfileCompletion)
	protected.Get("/search", api.controller.SearchUsers)
	protected.Post("/register", api.controller.Register)
	protected.Put("/password", api.controller.SetPassword)
	protected.Post("/sessions/revoke-others", api.controller.RevokeOtherSessions)
	protected.Post("/impressions", api.controller.RecordPostImpressions)
	protected.Patch("/username", api.controller.UpdateUsername)
	protected.Get("/username/check", api.controller.CheckUsernameAvailability)
	protected.Patch("/open-to-work", api.controller.UpdateOpenToWork)
	protected.Patch("/providing-services", api.controller.UpdateProvidingServices)
	protected.Get("/viewers", api.controller.GetProfileViewers)
	protected.Put("/location", api.controller.UpdateLocation)
	protected.Patch("/profile", api.controller.UpdateProfile)
	protected.Post("/education", api.controller.AddEducation)
	protected.Put("/education/:id", api.controller.UpdateEducation)
	protected.Delete("/education/:id", api.controller.DeleteEducation)
	protected.Post("/experience", api.controller.AddExperience)
	protected.Put("/experience/:id", api.controller.UpdateExperience)
	protected.Delete("/experience/:id", api.controller.DeleteExperience)
	protected.Post("/project", api.controller.AddProject)
	protected.Put("/project/:id", api.controller.UpdateProject)
	protected.Delete("/project/:id", api.controller.DeleteProject)
	protected.Post("/skill", api.controller.AddSkill)
	protected.Delete("/skill/:skillName", api.controller.DeleteSkill)
	protected.Post("/apply-expert", api.controller.ApplyForExpert)
	protected.Get("/expert-application", api.controller.GetExpertApplication)
	protected.Post("/bookmark/:jobId", api.controller.ToggleBookmark)
	protected.Post("/bookmarks/:jobId", api.controller.ToggleBookmark)
	protected.Get("/bookmarks", api.controller.GetBookmarkedJobs)
	protected.Get("/settings", api.controller.GetSettings)
	protected.Put("/settings", api.controller.UpdateSettings)
	protected.Post("/settings", api.controller.UpdateSettings)
	// Catch-all profile lookup must stay last: Fiber matches in registration order, so registered
	// earlier it swallowed GET /settings and GET /bookmarks ("settings" was read as a user ID)
	protected.Get("/:id", api.controller.GetOtherUserProfile)

	// Settings alias route group
	settings := app.Group("/api/settings", middleware.AuthMiddleware(api.controller.config.JWTSecret))
	settings.Get("/me", api.controller.GetSettings)
	settings.Put("/me", api.controller.UpdateSettings)
	settings.Post("/me", api.controller.UpdateSettings)

	// Admin routes
	admin := app.Group("/api/admin", middleware.AuthMiddleware(api.controller.config.JWTSecret), middleware.RequireRole(RoleAdmin))
	admin.Get("/users", api.controller.GetAllUsers)
	admin.Patch("/users/:id/roles", api.controller.UpdateUserRoles)
	admin.Patch("/users/:id", api.controller.AdminUpdateUserProfile)
	admin.Put("/experts/:id/approve", api.controller.ApproveExpert)
	admin.Get("/expert-requests", api.controller.GetExpertRequests)
	admin.Get("/reports/export/users", api.controller.ExportUsersCSV)
	admin.Get("/reports/export/jobs", api.controller.ExportJobsCSV)
	admin.Get("/reports/export/revenue", api.controller.ExportRevenueCSV)
	admin.Get("/global-search", api.controller.GlobalSearch)

	// Public user discovery & platform activity endpoints
	app.Get("/api/experts", api.controller.GetExperts)
	app.Get("/api/community/users", api.controller.GetCommunityUsers)
	app.Get("/api/platform/stats", api.controller.GetPlatformStats)
	app.Get("/api/platform/live-activity", api.controller.GetPlatformLiveActivity)
}
