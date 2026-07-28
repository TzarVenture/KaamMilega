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

	group.Get("/", api.controller.GetConversations)
	group.Post("/messages", api.controller.SendMessage)
	group.Get("/:id/messages", api.controller.GetMessages)

	app.Use("/api/ws/chats", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/api/ws/chats", websocket.New(api.controller.WebSocketHandler))
}
