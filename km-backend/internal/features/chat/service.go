package chat

import (
	"context"
	"errors"
	"strings"

	"km-backend/internal/features/user"

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

func (s *service) GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit, offset int) ([]Message, error) {
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

	return s.repo.GetMessagesByConversationID(ctx, conversationID, limit, offset)
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

	conv, err := s.repo.GetConversationByID(ctx, msg.ConversationID)
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

	if err := s.repo.DeleteMessage(ctx, messageID); err != nil {
		return err
	}

	if conv.LastMessageID == messageID {
		latest, _ := s.repo.GetLatestMessage(ctx, conv.ID)
		if latest != nil {
			_ = s.repo.UpdateLastMessage(ctx, conv.ID, latest.ID, latest.Content)
		} else {
			_ = s.repo.UpdateLastMessage(ctx, conv.ID, primitive.NilObjectID, "")
		}
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

	if err := s.repo.DeleteConversation(ctx, conversationID); err != nil {
		return err
	}

	for _, p := range conv.Participants {
		s.hub.Send(p.Hex(), map[string]interface{}{
			"type":            "CONVERSATION_DELETED",
			"conversation_id": conversationID.Hex(),
		})
	}

	return nil
}

func (s *service) ClearMessages(ctx context.Context, conversationID, userID primitive.ObjectID) error {
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

	if err := s.repo.DeleteMessagesByConversationID(ctx, conversationID); err != nil {
		return err
	}

	for _, p := range conv.Participants {
		s.hub.Send(p.Hex(), map[string]interface{}{
			"type":            "CHAT_CLEARED",
			"conversation_id": conversationID.Hex(),
		})
	}

	return nil
}
