package feed

import (
	"km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/features/analytics"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

type FeedApi struct {
	controller *FeedController
	config     *config.Config
}

func NewFeedApi(controller *FeedController, config *config.Config) api.Route {
	return &FeedApi{controller: controller, config: config}
}

func (a *FeedApi) Setup(app *fiber.App) {
	auth := middleware.AuthMiddleware(a.config.JWTSecret)
	optional := middleware.OptionalAuthMiddleware(a.config.JWTSecret)
	// Signed-out readers get an anonymous visitor ID, so their impressions can count once a day
	visitor := analytics.VisitorCookieMiddleware(a.config.Environment == "production")

	feed := app.Group("/api/feed")

	// Anyone can read the feed; a signed-in member also sees their own reactions and saves
	feed.Get("/", optional, visitor, a.controller.List)
	feed.Get("/saved", auth, a.controller.ListSaved)
	feed.Get("/trending", a.controller.Trending)
	feed.Post("/impressions", optional, a.controller.RecordImpressions)
	feed.Get("/:id", optional, visitor, a.controller.GetPost)
	feed.Get("/:id/comments", optional, a.controller.ListComments)
	feed.Get("/:id/comments/:commentId/replies", optional, a.controller.ListReplies)

	feed.Post("/", auth, a.controller.CreatePost)
	feed.Patch("/:id", auth, a.controller.UpdatePost)
	feed.Delete("/:id", auth, a.controller.DeletePost)
	feed.Put("/:id/reaction", auth, a.controller.React)
	feed.Delete("/:id/reaction", auth, a.controller.Unreact)
	feed.Put("/:id/save", auth, a.controller.Save)
	feed.Delete("/:id/save", auth, a.controller.Unsave)
	feed.Post("/:id/comments", auth, a.controller.AddComment)
	feed.Delete("/:id/comments/:commentId", auth, a.controller.DeleteComment)
	feed.Post("/:id/report", auth, a.controller.Report)

	// Moderators review reported posts
	admin := app.Group("/api/admin/feed", auth, middleware.RequireRole("admin"))
	admin.Get("/reports", a.controller.AdminReports)
	admin.Get("/reports/:id", a.controller.AdminReportDetail)
	admin.Post("/reports/:id/decision", a.controller.AdminModerate)
}
