package notification

import (
	"context"
	"log"

	"km-backend/internal/config"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type NotificationController struct {
	service NotificationService
	config  *config.Config
	hub     *NotificationHub
}

// NewNotificationController constructs the HTTP & WebSocket controller.
func NewNotificationController(
	service NotificationService,
	cfg *config.Config,
	hub *NotificationHub,
) *NotificationController {
	return &NotificationController{
		service: service,
		config:  cfg,
		hub:     hub,
	}
}

// GetNotifications returns a paginated list of notifications for the authenticated user.
func (c *NotificationController) GetNotifications(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	filter := NotificationFilter{
		Category:   ctx.Query("category", CategoryAll),
		UnreadOnly: ctx.QueryBool("unread_only", false),
		Limit:      ctx.QueryInt("limit", 20),
		Offset:     ctx.QueryInt("offset", 0),
	}

	notifications, total, err := c.service.GetNotifications(ctx.Context(), userID, filter)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"notifications": notifications,
		"total":         total,
		"limit":         filter.Limit,
		"offset":        filter.Offset,
	})
}

// GetUnreadCount returns the current count of unread notifications for the user.
func (c *NotificationController) GetUnreadCount(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	count, err := c.service.GetUnreadCount(ctx.Context(), userID)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"unread_count": count,
	})
}

// MarkAsRead marks a single notification as read.
func (c *NotificationController) MarkAsRead(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	idStr := ctx.Params("id")
	notifID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid notification ID"})
	}

	if err := c.service.MarkAsRead(ctx.Context(), notifID, userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"message": "Notification marked as read"})
}

// MarkAllAsRead marks all unread notifications for the user as read.
func (c *NotificationController) MarkAllAsRead(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	if err := c.service.MarkAllAsRead(ctx.Context(), userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"message": "All notifications marked as read"})
}

// DeleteNotification deletes a single notification.
func (c *NotificationController) DeleteNotification(ctx *fiber.Ctx) error {
	userIDStr, ok := ctx.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	idStr := ctx.Params("id")
	notifID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid notification ID"})
	}

	if err := c.service.DeleteNotification(ctx.Context(), notifID, userID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"message": "Notification deleted"})
}

// WebSocketHandler manages persistent real-time connections for in-app notifications.
func (c *NotificationController) WebSocketHandler(conn *websocket.Conn) {
	tokenString := conn.Query("token")
	if tokenString == "" {
		tokenString = conn.Cookies("km_auth_token")
	}
	if tokenString == "" {
		conn.Close()
		return
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(c.config.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		conn.Close()
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		conn.Close()
		return
	}

	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		conn.Close()
		return
	}

	c.hub.Register(userID, conn)

	defer func() {
		c.hub.Unregister(userID, conn)
		conn.Close()
	}()

	// Send initial state with unread count
	if userOID, err := primitive.ObjectIDFromHex(userID); err == nil {
		unreadCount, _ := c.service.GetUnreadCount(context.Background(), userOID)
		_ = conn.WriteJSON(fiber.Map{
			"type":         "INIT",
			"unread_count": unreadCount,
		})
	}

	for {
		messageType, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Println("[NotificationWS] close error:", err)
			}
			break
		}
		if messageType == websocket.CloseMessage {
			break
		}
	}
}
