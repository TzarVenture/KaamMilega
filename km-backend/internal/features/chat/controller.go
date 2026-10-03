package chat

import (
	"context"
	"fmt"
	"log"
	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Controller struct {
	service      ChatService
	config       *config.Config
	hub          *Hub
	notifService notification.NotificationService
	userRepo     user.UserRepository
}

func NewController(
	service ChatService,
	config *config.Config,
	notifService notification.NotificationService,
	userRepo user.UserRepository,
) *Controller {
	return &Controller{
		service:      service,
		config:       config,
		hub:          NewHub(),
		notifService: notifService,
		userRepo:     userRepo,
	}
}

func (c *Controller) GetConversations(ctx *fiber.Ctx) error {
	userIDStr := ctx.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	conversations, err := c.service.GetConversations(ctx.Context(), userID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	// Return empty array instead of null
	if conversations == nil {
		conversations = []Conversation{}
	}
	return ctx.JSON(conversations)
}

func (c *Controller) SendMessage(ctx *fiber.Ctx) error {
	userIDStr := ctx.Locals("user_id").(string)
	senderID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	var req CreateMessageRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ReceiverID.IsZero() {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Receiver ID is required"})
	}

	if req.Content == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Message content is required"})
	}

	msg, err := c.service.SendMessage(ctx.Context(), senderID, req)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	wsPayload := fiber.Map{
		"type":    "NEW_MESSAGE",
		"message": msg,
	}

	c.hub.Send(req.ReceiverID.Hex(), wsPayload)
	c.hub.Send(senderID.Hex(), wsPayload)

	// Trigger real-time in-app notification for receiver
	if c.notifService != nil {
		go func() {
			senderName := "Someone"
			senderAvatar := ""
			if c.userRepo != nil {
				if sender, err := c.userRepo.FindUserByID(context.Background(), senderID.Hex()); err == nil && sender != nil {
					if sender.Name != "" {
						senderName = sender.Name
					} else if sender.FirstName != "" {
						senderName = sender.FirstName + " " + sender.LastName
					}
					senderAvatar = sender.ProfileImage
				}
			}

			preview := req.Content
			if len(preview) > 80 {
				preview = preview[:77] + "..."
			}

			_, _ = c.notifService.CreateOrDebounceChatNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      req.ReceiverID,
				ActorID:     &senderID,
				ActorName:   senderName,
				ActorAvatar: senderAvatar,
				Type:        notification.TypeChatMessage,
				Category:    notification.CategoryMessages,
				Title:       senderName,
				Message:     preview,
				Link:        fmt.Sprintf("/chat?user=%s", senderID.Hex()),
				Metadata: map[string]interface{}{
					"conversation_id": msg.ConversationID.Hex(),
					"sender_id":       senderID.Hex(),
				},
			})
		}()
	}

	return ctx.Status(fiber.StatusCreated).JSON(msg)
}

func (c *Controller) WebSocketHandler(ctx *websocket.Conn) {
	tokenString := ctx.Query("token")
	if tokenString == "" {
		tokenString = ctx.Cookies("km_auth_token")
	}
	if tokenString == "" {
		ctx.Close()
		return
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return []byte(c.config.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		ctx.Close()
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		ctx.Close()
		return
	}

	userID, ok := claims["sub"].(string)
	if !ok {
		ctx.Close()
		return
	}

	c.hub.Register(userID, ctx)

	defer func() {
		c.hub.Unregister(userID)
		ctx.Close()
	}()

	for {
		messageType, _, err := ctx.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Println("ws error:", err)
			}
			break
		}
		if messageType == websocket.CloseMessage {
			break
		}
	}
}

func (c *Controller) GetMessages(ctx *fiber.Ctx) error {
	userIDStr := ctx.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	conversationIDStr := ctx.Params("id")
	conversationID, err := primitive.ObjectIDFromHex(conversationIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Conversation ID"})
	}

	limit := ctx.QueryInt("limit", 50)
	offset := ctx.QueryInt("offset", 0)

	messages, err := c.service.GetMessages(ctx.Context(), conversationID, userID, limit, offset)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if messages == nil {
		messages = []Message{}
	}

	return ctx.JSON(messages)
}
