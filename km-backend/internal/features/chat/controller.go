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
	hub *Hub,
	notifService notification.NotificationService,
	userRepo user.UserRepository,
) *Controller {
	return &Controller{
		service:      service,
		config:       config,
		hub:          hub,
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
	if conversations == nil {
		conversations = []ConversationResponse{}
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

	if req.Content == "" && req.AttachmentURL == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Message content or attachment is required"})
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
			if preview == "" && req.AttachmentName != "" {
				if req.AttachmentType == "image" {
					preview = "📷 Photo"
				} else {
					preview = "📎 " + req.AttachmentName
				}
			}
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

func (c *Controller) MarkAsRead(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	conversationIDStr := ctx.Params("id")
	if conversationIDStr == "" || conversationIDStr == "read" {
		conversationIDStr = ctx.Query("conversation_id")
		if conversationIDStr == "" {
			conversationIDStr = ctx.Query("id")
		}
	}
	if conversationIDStr == "" {
		var body struct {
			ConversationID string `json:"conversation_id"`
			OtherID        string `json:"other_id"`
		}
		_ = ctx.BodyParser(&body)
		conversationIDStr = body.ConversationID
		if ctx.Query("other_id") == "" && body.OtherID != "" {
			ctx.Request().URI().QueryArgs().Add("other_id", body.OtherID)
		}
	}

	if conversationIDStr == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Conversation ID"})
	}

	conversationID, err := primitive.ObjectIDFromHex(conversationIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Conversation ID"})
	}

	if err := c.service.MarkConversationAsRead(ctx.Context(), conversationID, userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	otherIDStr := ctx.Query("other_id")
	if otherIDStr != "" {
		c.hub.Send(otherIDStr, fiber.Map{
			"type":            "MESSAGES_READ",
			"conversation_id": conversationID.Hex(),
			"reader_id":       userIDStr,
		})
	}

	return ctx.JSON(fiber.Map{"success": true})
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
		c.hub.Unregister(userID, ctx)
		ctx.Close()
	}()

	for {
		var incoming struct {
			Type           string `json:"type"`
			ConversationID string `json:"conversation_id"`
			ReceiverID     string `json:"receiver_id"`
			IsTyping       bool   `json:"is_typing"`
		}

		err := ctx.ReadJSON(&incoming)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Println("[ChatWS] ws error:", err)
			}
			break
		}

		if incoming.Type == "TYPING" && incoming.ReceiverID != "" {
			c.hub.Send(incoming.ReceiverID, fiber.Map{
				"type":            "USER_TYPING",
				"conversation_id": incoming.ConversationID,
				"sender_id":       userID,
				"is_typing":       incoming.IsTyping,
			})
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
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var beforeID *primitive.ObjectID
	if beforeStr := ctx.Query("before"); beforeStr != "" {
		if bid, err := primitive.ObjectIDFromHex(beforeStr); err == nil {
			beforeID = &bid
		}
	}

	messages, err := c.service.GetMessages(ctx.Context(), conversationID, userID, limit, beforeID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if messages == nil {
		messages = []Message{}
	}

	return ctx.JSON(messages)
}

func (c *Controller) GetTotalUnreadCount(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	count, err := c.service.GetTotalUnreadCount(ctx.Context(), userID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"unread_count": count})
}


func (c *Controller) DeleteMessage(ctx *fiber.Ctx) error {
	userIDStr := ctx.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	messageIDStr := ctx.Params("id")
	messageID, err := primitive.ObjectIDFromHex(messageIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Message ID"})
	}

	if err := c.service.DeleteMessage(ctx.Context(), messageID, userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"message": "Message deleted successfully"})
}

func (c *Controller) DeleteConversation(ctx *fiber.Ctx) error {
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

	if err := c.service.DeleteConversation(ctx.Context(), conversationID, userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"message": "Conversation deleted successfully"})
}

func (c *Controller) ClearMessages(ctx *fiber.Ctx) error {
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

	if err := c.service.ClearMessages(ctx.Context(), conversationID, userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"message": "Chat cleared successfully"})
}

// Block & Safety handlers

func (c *Controller) BlockUser(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	targetIDStr := ctx.Params("id")
	if targetIDStr == "" {
		var req struct {
			TargetUserID string `json:"target_user_id"`
		}
		_ = ctx.BodyParser(&req)
		targetIDStr = req.TargetUserID
	}
	if targetIDStr == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Target user ID is required"})
	}

	targetUserID, err := primitive.ObjectIDFromHex(targetIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid target user ID"})
	}

	if err := c.service.BlockUser(ctx.Context(), userID, targetUserID); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"success": true,
		"message": "User blocked successfully",
	})
}

func (c *Controller) UnblockUser(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	targetIDStr := ctx.Params("id")
	if targetIDStr == "" {
		var req struct {
			TargetUserID string `json:"target_user_id"`
		}
		_ = ctx.BodyParser(&req)
		targetIDStr = req.TargetUserID
	}
	if targetIDStr == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Target user ID is required"})
	}

	targetUserID, err := primitive.ObjectIDFromHex(targetIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid target user ID"})
	}

	if err := c.service.UnblockUser(ctx.Context(), userID, targetUserID); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"success": true,
		"message": "User unblocked successfully",
	})
}

func (c *Controller) GetBlockStatus(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	targetIDStr := ctx.Params("id")
	if targetIDStr == "" {
		targetIDStr = ctx.Query("user_id")
	}
	if targetIDStr == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	targetUserID, err := primitive.ObjectIDFromHex(targetIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	status, err := c.service.GetBlockStatus(ctx.Context(), userID, targetUserID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(status)
}

func (c *Controller) CreateReport(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	reporterID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid User ID"})
	}

	conversationIDStr := ctx.Params("id")
	if conversationIDStr == "" {
		conversationIDStr = ctx.Query("conversation_id")
	}
	conversationID, err := primitive.ObjectIDFromHex(conversationIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Conversation ID"})
	}

	var req CreateReportRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Reason == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Reason is required"})
	}

	report, err := c.service.CreateChatReport(ctx.Context(), reporterID, conversationID, req)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusCreated).JSON(report)
}

// Admin Chat Report Handlers

func (c *Controller) GetAdminChatReports(ctx *fiber.Ctx) error {
	status := ctx.Query("status", "")
	page := ctx.QueryInt("page", 1)
	limit := ctx.QueryInt("limit", 15)

	res, err := c.service.GetAdminChatReports(ctx.Context(), status, page, limit)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(res)
}

func (c *Controller) GetAdminChatReportByID(ctx *fiber.Ctx) error {
	idStr := ctx.Params("id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid report ID"})
	}

	report, err := c.service.GetAdminChatReportByID(ctx.Context(), id)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if report == nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Report not found"})
	}

	return ctx.JSON(report)
}

func (c *Controller) ResolveAdminChatReport(ctx *fiber.Ctx) error {
	adminIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || adminIDStr == "" {
		adminIDStr = "000000000000000000000000"
	}
	adminID, _ := primitive.ObjectIDFromHex(adminIDStr)

	adminName := "Admin"
	if email, ok := ctx.Locals("email").(string); ok && email != "" {
		adminName = email
	}

	idStr := ctx.Params("id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid report ID"})
	}

	var req ResolveReportRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Status == "" {
		req.Status = "resolved"
	}

	if err := c.service.ResolveAdminChatReport(ctx.Context(), id, adminID, adminName, req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"success": true, "message": "Report resolved successfully"})
}

