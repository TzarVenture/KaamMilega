package chat

import (
	"km-backend/internal/common/api"
	"km-backend/internal/middleware"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

type ChatApi struct {
	controller *Controller
}

func NewChatApi(controller *Controller) api.Route {
	return &ChatApi{controller: controller}
}

func (api *ChatApi) Setup(app *fiber.App) {
	group := app.Group("/api/chats", middleware.AuthMiddleware(api.controller.config.JWTSecret))

	// Flexible conversation fetching
	group.Get("", api.controller.GetConversations)
	group.Get("/", api.controller.GetConversations)

	// Flexible message sending (supports /messages and root /)
	group.Post("", api.controller.SendMessage)
	group.Post("/", api.controller.SendMessage)
	group.Post("/messages", api.controller.SendMessage)

	// Message fetching
	group.Get("/:id/messages", api.controller.GetMessages)

	// Flexible read receipts (supports PUT, POST, PATCH on /:id/read and /read)
	group.Put("/:id/read", api.controller.MarkAsRead)
	group.Post("/:id/read", api.controller.MarkAsRead)
	group.Patch("/:id/read", api.controller.MarkAsRead)
	group.Put("/read", api.controller.MarkAsRead)
	group.Post("/read", api.controller.MarkAsRead)

	// Message and conversation deletion (WhatsApp / LinkedIn style)
	group.Delete("/messages/:id", api.controller.DeleteMessage)
	group.Delete("/:id/messages", api.controller.ClearMessages)
	group.Delete("/:id", api.controller.DeleteConversation)

	app.Use("/api/ws/chats", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/api/ws/chats", websocket.New(api.controller.WebSocketHandler))
}
