package notification

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type notificationService struct {
	repo NotificationRepository
	hub  *NotificationHub
}

// NewNotificationService constructs the notification service with repository and WebSocket hub.
func NewNotificationService(repo NotificationRepository, hub *NotificationHub) NotificationService {
	return &notificationService{
		repo: repo,
		hub:  hub,
	}
}

func (s *notificationService) CreateOrDebounceChatNotification(ctx context.Context, req CreateNotificationRequest) (*Notification, error) {
	if req.UserID.IsZero() {
		return nil, errors.New("user_id is required")
	}

	// Check if an unread chat notification exists from the same actor within the last 15 minutes
	if req.ActorID != nil && !req.ActorID.IsZero() {
		since := time.Now().Add(-15 * time.Minute)
		existing, err := s.repo.FindRecentUnreadByActor(ctx, req.UserID, *req.ActorID, TypeChatMessage, since)
		if err == nil && existing != nil {
			count := 1
			if existing.Metadata != nil {
				if c, ok := existing.Metadata["message_count"].(int32); ok {
					count = int(c) + 1
				} else if c, ok := existing.Metadata["message_count"].(float64); ok {
					count = int(c) + 1
				} else if c, ok := existing.Metadata["message_count"].(int); ok {
					count = c + 1
				} else {
					count = 2
				}
			} else {
				count = 2
			}

			if req.Metadata == nil {
				req.Metadata = make(map[string]interface{})
			}
			req.Metadata["message_count"] = count

			collapsedMessage := req.Message
			if count > 1 {
				collapsedMessage = fmt.Sprintf("%s (and %d more)", req.Message, count-1)
			}

			_ = s.repo.UpdateMessage(ctx, existing.ID, collapsedMessage, req.Metadata)
			existing.Message = collapsedMessage
			existing.Metadata = req.Metadata
			existing.UpdatedAt = time.Now()
			existing.CreatedAt = time.Now()

			unreadCount, _ := s.repo.CountUnread(ctx, req.UserID)
			s.send(ctx, req.UserID.Hex(), map[string]interface{}{
				"type":         "NEW_NOTIFICATION",
				"notification": existing,
				"unread_count": unreadCount,
			})
			// Same push tag as the first message, so the device shows one updated alert
			dispatchPush(existing)

			return existing, nil
		}
	}

	if req.Metadata == nil {
		req.Metadata = make(map[string]interface{})
	}
	req.Metadata["message_count"] = 1
	return s.CreateNotification(ctx, req)
}

func (s *notificationService) CreateNotification(ctx context.Context, req CreateNotificationRequest) (*Notification, error) {
	if req.UserID.IsZero() {
		return nil, errors.New("user_id is required")
	}

	category := req.Category
	if category == "" {
		category = CategorySystem
	}

	n := &Notification{
		UserID:      req.UserID,
		ActorID:     req.ActorID,
		ActorName:   req.ActorName,
		ActorAvatar: req.ActorAvatar,
		Type:        req.Type,
		Category:    category,
		Title:       req.Title,
		Message:     req.Message,
		Link:        req.Link,
		Metadata:    req.Metadata,
		IsRead:      false,
	}

	created, err := s.repo.Create(ctx, n)
	if err != nil {
		return nil, err
	}

	unreadCount, countErr := s.repo.CountUnread(ctx, req.UserID)
	if countErr != nil {
		log.Printf("[NotificationService] Failed to count unread: %v", countErr)
	}

	// Dispatch real-time WebSocket event
	s.send(ctx, req.UserID.Hex(), map[string]interface{}{
		"type":         "NEW_NOTIFICATION",
		"notification": created,
		"unread_count": unreadCount,
	})

	// Browsers and phones (background; no-op until a push sender is installed)
	dispatchPush(created)

	return created, nil
}

// send delivers a live event with the current badge count added
func (s *notificationService) send(ctx context.Context, userHex string, payload map[string]interface{}) {
	if id, err := primitive.ObjectIDFromHex(userHex); err == nil {
		if n, err := s.repo.CountUnseen(ctx, id); err == nil {
			payload["unseen_count"] = n
		}
	}
	s.hub.Send(userHex, payload)
}

func (s *notificationService) GetUnseenCount(ctx context.Context, userID primitive.ObjectID) (int64, error) {
	return s.repo.CountUnseen(ctx, userID)
}

func (s *notificationService) MarkAllSeen(ctx context.Context, userID primitive.ObjectID) error {
	if err := s.repo.MarkAllSeen(ctx, userID); err != nil {
		return err
	}
	// Every open tab and the app clear their badge
	s.send(ctx, userID.Hex(), map[string]interface{}{"type": "ALL_SEEN"})
	return nil
}

func (s *notificationService) CreateOrGroup(ctx context.Context, req CreateNotificationRequest, groupKey string) (*Notification, error) {
	if req.Metadata == nil {
		req.Metadata = map[string]interface{}{}
	}
	req.Metadata["group_key"] = groupKey
	existing, err := s.repo.FindUnreadGroup(ctx, req.UserID, groupKey)
	if err != nil || existing == nil {
		return s.CreateNotification(ctx, req)
	}
	existing.ActorID, existing.ActorName, existing.ActorAvatar = req.ActorID, req.ActorName, req.ActorAvatar
	existing.Title, existing.Message, existing.Metadata = req.Title, req.Message, req.Metadata
	if err := s.repo.Regroup(ctx, existing); err != nil {
		return nil, err
	}
	unreadCount, _ := s.repo.CountUnread(ctx, req.UserID)
	s.send(ctx, req.UserID.Hex(), map[string]interface{}{
		"type":         "NEW_NOTIFICATION",
		"notification": existing,
		"unread_count": unreadCount,
	})
	// Same notification ID, so the phone replaces its alert instead of adding another
	dispatchPush(existing)
	return existing, nil
}

func (s *notificationService) GetNotifications(ctx context.Context, userID primitive.ObjectID, filter NotificationFilter) ([]Notification, int64, error) {
	return s.repo.Find(ctx, userID, filter)
}

func (s *notificationService) GetUnreadCount(ctx context.Context, userID primitive.ObjectID) (int64, error) {
	return s.repo.CountUnread(ctx, userID)
}

func (s *notificationService) GetUnreadByCategory(ctx context.Context, userID primitive.ObjectID) (map[string]int64, error) {
	return s.repo.CountUnreadByCategory(ctx, userID)
}

func (s *notificationService) MarkAsRead(ctx context.Context, id, userID primitive.ObjectID) error {
	if err := s.repo.MarkAsRead(ctx, id, userID); err != nil {
		return err
	}

	unreadCount, countErr := s.repo.CountUnread(ctx, userID)
	if countErr != nil {
		log.Printf("[NotificationService] Failed to count unread: %v", countErr)
	}

	s.send(ctx, userID.Hex(), map[string]interface{}{
		"type":            "NOTIFICATION_READ",
		"notification_id": id.Hex(),
		"unread_count":    unreadCount,
	})

	return nil
}

func (s *notificationService) MarkAllAsRead(ctx context.Context, userID primitive.ObjectID) error {
	if err := s.repo.MarkAllAsRead(ctx, userID); err != nil {
		return err
	}

	s.send(ctx, userID.Hex(), map[string]interface{}{
		"type":         "ALL_READ",
		"unread_count": 0,
	})

	return nil
}

func (s *notificationService) MarkChatRead(ctx context.Context, userID primitive.ObjectID, conversationID string) error {
	ids, err := s.repo.MarkChatRead(ctx, userID, conversationID)
	if err != nil || len(ids) == 0 {
		return err
	}
	unreadCount, countErr := s.repo.CountUnread(ctx, userID)
	if countErr != nil {
		log.Printf("[NotificationService] Failed to count unread: %v", countErr)
	}
	// The same event as reading one by hand, so every open tab and the app update their badge
	for _, id := range ids {
		s.send(ctx, userID.Hex(), map[string]interface{}{
			"type":            "NOTIFICATION_READ",
			"notification_id": id.Hex(),
			"unread_count":    unreadCount,
		})
	}
	return nil
}

func (s *notificationService) DeleteNotification(ctx context.Context, id, userID primitive.ObjectID) error {
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return err
	}

	unreadCount, countErr := s.repo.CountUnread(ctx, userID)
	if countErr != nil {
		log.Printf("[NotificationService] Failed to count unread: %v", countErr)
	}

	s.send(ctx, userID.Hex(), map[string]interface{}{
		"type":            "NOTIFICATION_DELETED",
		"notification_id": id.Hex(),
		"unread_count":    unreadCount,
	})

	return nil
}
