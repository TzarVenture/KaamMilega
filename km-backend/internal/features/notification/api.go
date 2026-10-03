package notification

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

type NotificationApi struct {
	controller *NotificationController
}

func NewNotificationApi(controller *NotificationController) api.Route {
	return &NotificationApi{controller: controller}
}

func (a *NotificationApi) Setup(app *fiber.App) {
	group := app.Group("/api/notifications", middleware.AuthMiddleware(a.controller.config.JWTSecret))

	group.Get("/", a.controller.GetNotifications)
	group.Get("/unread-count", a.controller.GetUnreadCount)
	group.Put("/read-all", a.controller.MarkAllAsRead)
	group.Put("/:id/read", a.controller.MarkAsRead)
	group.Delete("/:id", a.controller.DeleteNotification)

	app.Use("/api/ws/notifications", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/api/ws/notifications", websocket.New(a.controller.WebSocketHandler))
}
