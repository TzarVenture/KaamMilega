package chat

import (
	"context"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type service struct {
	repo ChatRepository
}

func NewService(repo ChatRepository) ChatService {
	return &service{repo: repo}
}

func (s *service) GetConversations(ctx context.Context, userID primitive.ObjectID) ([]Conversation, error) {
	return s.repo.GetConversationsByUserID(ctx, userID)
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

	// 2. Create message
	msg := &Message{
		ConversationID: conv.ID,
		SenderID:       senderID,
		Content:        req.Content,
		IsRead:         false,
	}

	createdMsg, err := s.repo.CreateMessage(ctx, msg)
	if err != nil {
		return nil, err
	}

	// 3. Update conversation with last message
	err = s.repo.UpdateLastMessage(ctx, conv.ID, createdMsg.ID, req.Content)
	if err != nil {
		// Log error but don't fail the request as message is sent
	}

	return createdMsg, nil
}

func (s *service) GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit, offset int) ([]Message, error) {
	// Verify user is participant
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
		// Return empty or error? Error is better for security.
		// For now returning empty to avoid leaking existence? No, error is fine.
		return nil, nil
	}

	return s.repo.GetMessagesByConversationID(ctx, conversationID, limit, offset)
}
