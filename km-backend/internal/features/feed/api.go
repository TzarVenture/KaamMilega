package feed

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type FeedApi struct {
	controller *FeedController
	config     *config.Config
}

func NewFeedApi(controller *FeedController, config *config.Config) api.Route {
	return &FeedApi{
		controller: controller,
		config:     config,
	}
}

func (a *FeedApi) Setup(app *fiber.App) {
	jwtAuth := middleware.AuthMiddleware(a.config.JWTSecret)
	optAuth := middleware.OptionalAuthMiddleware(a.config.JWTSecret)

	// Feed group
	feedGroup := app.Group("/api/feed")

	// Public / Optional-auth routes
	feedGroup.Get("/", optAuth, a.controller.GetFeed)
	feedGroup.Get("/:id", optAuth, a.controller.GetPost)
	feedGroup.Get("/:id/comments", optAuth, a.controller.GetComments)

	// Protected routes (Login required)
	feedGroup.Post("/", jwtAuth, a.controller.CreatePost)
	feedGroup.Delete("/:id", jwtAuth, a.controller.DeletePost)
	feedGroup.Post("/:id/reactions", jwtAuth, a.controller.ReactToPost)
	feedGroup.Post("/:id/save", jwtAuth, a.controller.ToggleSavePost)
	feedGroup.Post("/:id/repost", jwtAuth, a.controller.ToggleRepostPost)
	feedGroup.Post("/:id/comments", jwtAuth, a.controller.AddComment)
	feedGroup.Delete("/:id/comments/:commentId", jwtAuth, a.controller.DeleteComment)
	feedGroup.Post("/:id/report", jwtAuth, a.controller.ReportPost)
}

