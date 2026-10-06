package chat

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"km-backend/internal/features/user"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)


type service struct {
	repo     ChatRepository
	userRepo user.UserRepository
	hub      *Hub
}

func NewService(repo ChatRepository, userRepo user.UserRepository, hub *Hub) ChatService {
	return &service{
		repo:     repo,
		userRepo: userRepo,
		hub:      hub,
	}
}

func (s *service) GetConversations(ctx context.Context, userID primitive.ObjectID) ([]ConversationResponse, error) {
	convs, err := s.repo.GetConversationsByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	responses := make([]ConversationResponse, 0, len(convs))
	for _, c := range convs {
		// LinkedIn rule: If the user cleared/deleted this conversation, check if any newer message arrived
		if c.ClearedAt != nil {
			if clearedTime, ok := c.ClearedAt[userID.Hex()]; ok {
				if !c.UpdatedAt.After(clearedTime) {
					// Conversation was deleted by this user and has no newer activity: skip from inbox!
					continue
				}
			}
		}

		var otherID primitive.ObjectID
		for _, p := range c.Participants {
			if p != userID {
				otherID = p
				break
			}
		}

		var otherUser *ParticipantInfo
		if !otherID.IsZero() && s.userRepo != nil {
			if u, err := s.userRepo.FindUserByID(ctx, otherID.Hex()); err == nil && u != nil {
				name := strings.TrimSpace(u.Name)
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				if name == "" {
					name = "User"
				}

				isOnline := false
				if s.hub != nil {
					isOnline = s.hub.IsOnline(otherID.Hex())
				}

				roles := u.Roles
				if len(roles) == 0 {
					roles = []string{"user"}
				}

				otherUser = &ParticipantInfo{
					ID:           otherID.Hex(),
					Name:         name,
					ProfileImage: u.ProfileImage,
					Headline:     u.Headline,
					Roles:        roles,
					IsOnline:     isOnline,
				}
			}
		}

		unreadCount, _ := s.repo.CountUnreadMessages(ctx, c.ID, userID)

		responses = append(responses, ConversationResponse{
			ID:            c.ID,
			Participants:  c.Participants,
			LastMessageID: c.LastMessageID,
			LastMessage:   c.LastMessage,
			UpdatedAt:     c.UpdatedAt,
			CreatedAt:     c.CreatedAt,
			OtherUser:     otherUser,
			UnreadCount:   unreadCount,
		})
	}

	return responses, nil
}

func (s *service) SendMessage(ctx context.Context, senderID primitive.ObjectID, req CreateMessageRequest) (*Message, error) {
	// Safety & Trust: Check if either party blocked the other
	blocked, err := s.repo.IsBlockedEitherWay(ctx, senderID, req.ReceiverID)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, errors.New("cannot send message: messaging is blocked between these users")
	}

	// 1. Find or create conversation
	participants := []primitive.ObjectID{senderID, req.ReceiverID}
	conv, err := s.repo.GetConversationByParticipants(ctx, participants)

	if err != nil {
		return nil, err
	}

	if conv == nil {
		conv, err = s.repo.CreateConversation(ctx, participants)
		if err != nil {
			return nil, err
		}
	}

	lastPreview := req.Content
	if lastPreview == "" && req.AttachmentName != "" {
		if req.AttachmentType == "image" {
			lastPreview = "📷 Photo"
		} else {
			lastPreview = "📎 " + req.AttachmentName
		}
	}

	// 2. Create message
	msg := &Message{
		ConversationID: conv.ID,
		SenderID:       senderID,
		Content:        req.Content,
		AttachmentURL:  req.AttachmentURL,
		AttachmentType: req.AttachmentType,
		AttachmentName: req.AttachmentName,
		AttachmentSize: req.AttachmentSize,
		IsRead:         false,
	}

	createdMsg, err := s.repo.CreateMessage(ctx, msg)
	if err != nil {
		return nil, err
	}

	// 3. Update conversation with last message
	_ = s.repo.UpdateLastMessage(ctx, conv.ID, createdMsg.ID, lastPreview)

	return createdMsg, nil
}

func (s *service) GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit int, beforeID *primitive.ObjectID) ([]Message, error) {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}

	isParticipant := false
	for _, p := range conv.Participants {
		if p == userID {
			isParticipant = true
			break
		}
	}

	if !isParticipant {
		return nil, nil
	}

	var since *time.Time
	if conv.ClearedAt != nil {
		if clearedTime, ok := conv.ClearedAt[userID.Hex()]; ok {
			since = &clearedTime
		}
	}

	return s.repo.GetMessagesByConversationID(ctx, conversationID, limit, beforeID, since)
}

func (s *service) GetTotalUnreadCount(ctx context.Context, userID primitive.ObjectID) (int, error) {
	conversations, err := s.GetConversations(ctx, userID)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, conv := range conversations {
		total += conv.UnreadCount
	}
	return total, nil
}


func (s *service) MarkConversationAsRead(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	return s.repo.MarkMessagesAsRead(ctx, conversationID, userID)
}

func (s *service) DeleteMessage(ctx context.Context, messageID, userID primitive.ObjectID) error {
	msg, err := s.repo.GetMessageByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg == nil {
		return errors.New("message not found")
	}

	// STRICT LINKEDIN RULE: Only the sender can delete their own message!
	if msg.SenderID != userID {
		return errors.New("unauthorized: you can only delete your own messages")
	}

	conv, err := s.repo.GetConversationByID(ctx, msg.ConversationID)
	if err != nil || conv == nil {
		return errors.New("conversation not found")
	}

	// Mark as deleted (tombstone) rather than hard-deleting
	if err := s.repo.MarkMessageDeleted(ctx, messageID); err != nil {
		return err
	}

	if conv.LastMessageID == messageID {
		_ = s.repo.UpdateLastMessage(ctx, conv.ID, conv.LastMessageID, "This message was deleted")
	}

	for _, p := range conv.Participants {
		s.hub.Send(p.Hex(), map[string]interface{}{
			"type":            "MESSAGE_DELETED",
			"message_id":      messageID.Hex(),
			"conversation_id": conv.ID.Hex(),
		})
	}

	return nil
}

func (s *service) DeleteConversation(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil || conv == nil {
		return errors.New("conversation not found")
	}
	isParticipant := false
	for _, p := range conv.Participants {
		if p == userID {
			isParticipant = true
			break
		}
	}
	if !isParticipant {
		return errors.New("unauthorized")
	}

	// LinkedIn rule: Remove/hide conversation only for the requesting user
	if err := s.repo.ClearConversationForUser(ctx, conversationID, userID); err != nil {
		return err
	}

	// Notify only the requesting user's client to remove it from their inbox
	s.hub.Send(userID.Hex(), map[string]interface{}{
		"type":            "CONVERSATION_DELETED",
		"conversation_id": conversationID.Hex(),
	})

	return nil
}

func (s *service) ClearMessages(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	return s.DeleteConversation(ctx, conversationID, userID)
}

// Block & Safety service methods

func (s *service) BlockUser(ctx context.Context, userID, targetUserID primitive.ObjectID) error {
	if userID == targetUserID {
		return errors.New("cannot block yourself")
	}
	err := s.repo.BlockUser(ctx, userID, targetUserID)
	if err != nil {
		return err
	}

	// Notify both users in real-time over WebSocket so their chat UIs update instantly
	if s.hub != nil {
		s.hub.Send(userID.Hex(), fiber.Map{
			"type":            "USER_BLOCKED",
			"blocked_user_id": targetUserID.Hex(),
			"blocked_by_me":   true,
		})
		s.hub.Send(targetUserID.Hex(), fiber.Map{
			"type":            "USER_BLOCKED",
			"blocked_user_id": userID.Hex(),
			"blocked_by_me":   false,
		})
	}
	return nil
}

func (s *service) UnblockUser(ctx context.Context, userID, targetUserID primitive.ObjectID) error {
	err := s.repo.UnblockUser(ctx, userID, targetUserID)
	if err != nil {
		return err
	}

	if s.hub != nil {
		s.hub.Send(userID.Hex(), fiber.Map{
			"type":              "USER_UNBLOCKED",
			"unblocked_user_id": targetUserID.Hex(),
			"unblocked_by_me":   true,
		})
		s.hub.Send(targetUserID.Hex(), fiber.Map{
			"type":              "USER_UNBLOCKED",
			"unblocked_user_id": userID.Hex(),
			"unblocked_by_me":   false,
		})
	}
	return nil
}

func (s *service) GetBlockStatus(ctx context.Context, userID, otherUserID primitive.ObjectID) (*BlockStatusResponse, error) {
	byMe, byOther, err := s.repo.GetBlockStatus(ctx, userID, otherUserID)
	if err != nil {
		return nil, err
	}
	return &BlockStatusResponse{
		IsBlockedByMe:    byMe,
		IsBlockedByOther: byOther,
	}, nil
}

// Report & Moderation service methods

func (s *service) CreateChatReport(ctx context.Context, reporterID, conversationID primitive.ObjectID, req CreateReportRequest) (*ChatReport, error) {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if conv == nil {
		return nil, errors.New("conversation not found")
	}

	var targetUserID primitive.ObjectID
	for _, p := range conv.Participants {
		if p != reporterID {
			targetUserID = p
			break
		}
	}
	if targetUserID.IsZero() {
		return nil, errors.New("cannot identify reported user in this conversation")
	}

	reporterName := "User"
	reporterRole := "user"
	if s.userRepo != nil {
		if u, err := s.userRepo.FindUserByID(ctx, reporterID.Hex()); err == nil && u != nil {
			if u.Name != "" {
				reporterName = u.Name
			} else if u.FirstName != "" {
				reporterName = strings.TrimSpace(u.FirstName + " " + u.LastName)
			}
			if len(u.Roles) > 0 {
				reporterRole = u.Roles[0]
			}
		}
	}

	targetUserName := "User"
	targetUserRole := "user"
	if s.userRepo != nil {
		if u, err := s.userRepo.FindUserByID(ctx, targetUserID.Hex()); err == nil && u != nil {
			if u.Name != "" {
				targetUserName = u.Name
			} else if u.FirstName != "" {
				targetUserName = strings.TrimSpace(u.FirstName + " " + u.LastName)
			}
			if len(u.Roles) > 0 {
				targetUserRole = u.Roles[0]
			}
		}
	}

	// Capture recent conversation messages as evidence snapshot
	evidenceMessages, _ := s.repo.GetMessagesByConversationID(ctx, conversationID, 25, nil, nil)
	evidence := make([]ReportedMessageSnapshot, 0, len(evidenceMessages))
	for _, m := range evidenceMessages {
		senderName := targetUserName
		if m.SenderID == reporterID {
			senderName = reporterName
		}
		evidence = append(evidence, ReportedMessageSnapshot{
			ID:            m.ID,
			SenderID:      m.SenderID,
			SenderName:    senderName,
			Content:       m.Content,
			AttachmentURL: m.AttachmentURL,
			CreatedAt:     m.CreatedAt,
		})
	}

	report := &ChatReport{
		ReporterID:       reporterID,
		ReporterName:     reporterName,
		ReporterRole:     reporterRole,
		ReportedUserID:   targetUserID,
		ReportedUserName: targetUserName,
		ReportedUserRole: targetUserRole,
		ConversationID:   conversationID,
		Reason:           req.Reason,
		Description:      req.Description,
		Evidence:         evidence,
		Status:           "pending",
	}

	createdReport, err := s.repo.CreateChatReport(ctx, report)
	if err != nil {
		return nil, err
	}

	// If user also opted to block this user simultaneously
	if req.BlockUser {
		_ = s.BlockUser(ctx, reporterID, targetUserID)
	}

	return createdReport, nil
}

func (s *service) GetAdminChatReports(ctx context.Context, status string, page, limit int) (*ChatReportListResponse, error) {
	reports, total, err := s.repo.GetChatReports(ctx, status, page, limit)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 15
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	return &ChatReportListResponse{
		Reports:    reports,
		Total:      total,
		Page:       page,
		TotalPages: totalPages,
	}, nil
}

func (s *service) GetAdminChatReportByID(ctx context.Context, id primitive.ObjectID) (*ChatReport, error) {
	return s.repo.GetChatReportByID(ctx, id)
}

func (s *service) ResolveAdminChatReport(ctx context.Context, id, adminID primitive.ObjectID, adminName string, req ResolveReportRequest) error {
	report, err := s.repo.GetChatReportByID(ctx, id)
	if err != nil {
		return err
	}
	if report == nil {
		return errors.New("report not found")
	}

	err = s.repo.ResolveChatReport(ctx, id, req.Status, req.ActionTaken, req.AdminNotes, &adminID, adminName)
	if err != nil {
		return err
	}

	// If admin action is to suspend the user, update their verification status
	if req.ActionTaken == "user_suspended" && s.userRepo != nil {
		if accusedUser, err := s.userRepo.FindUserByID(ctx, report.ReportedUserID.Hex()); err == nil && accusedUser != nil {
			accusedUser.VerificationStatus = "suspended"
			_, _ = s.userRepo.UpdateUser(ctx, accusedUser)
		}
	}

	return nil
}

