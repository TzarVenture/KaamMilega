package network

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type NetworkServiceImpl struct {
	repo NetworkRepository
}

func NewNetworkService(repo NetworkRepository) NetworkService {
	return &NetworkServiceImpl{
		repo: repo,
	}
}

func (s *NetworkServiceImpl) SendInvitation(ctx context.Context, senderID primitive.ObjectID, receiverID string) error {
	rOID, err := primitive.ObjectIDFromHex(receiverID)
	if err != nil {
		return err
	}

	if senderID == rOID {
		return errors.New("cannot connect to yourself")
	}

	status, err := s.repo.GetConnectionStatus(ctx, senderID, rOID)
	if err != nil {
		return err
	}
	if status != "" {
		return errors.New("invitation already exists or already connected")
	}

	invitation := &ConnectionRequest{
		SenderID:   senderID,
		ReceiverID: rOID,
		Status:     StatusPending,
	}

	return s.repo.CreateInvitation(ctx, invitation)
}

func (s *NetworkServiceImpl) AcceptInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error {
	sOID, err := primitive.ObjectIDFromHex(senderID)
	if err != nil {
		return err
	}

	return s.repo.UpdateInvitationStatus(ctx, sOID, receiverID, StatusAccepted)
}

func (s *NetworkServiceImpl) IgnoreInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error {
	sOID, err := primitive.ObjectIDFromHex(senderID)
	if err != nil {
		return err
	}

	// We can either update status to "ignored" or just delete it
	// Let's delete it so they can try again later if they want, or just set to ignored
	return s.repo.UpdateInvitationStatus(ctx, sOID, receiverID, StatusIgnored)
}

func (s *NetworkServiceImpl) GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error) {
	return s.repo.GetPendingInvitations(ctx, userID)
}

func (s *NetworkServiceImpl) GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return s.repo.GetConnections(ctx, userID)
}

func (s *NetworkServiceImpl) GetConnectionStatus(ctx context.Context, userA, userB string) (string, error) {
	uaOID, err := primitive.ObjectIDFromHex(userA)
	if err != nil {
		return "", err
	}
	ubOID, err := primitive.ObjectIDFromHex(userB)
	if err != nil {
		return "", err
	}

	status, err := s.repo.GetConnectionStatus(ctx, uaOID, ubOID)
	if err != nil {
		return "", err
	}
	return string(status), nil
}

func (s *NetworkServiceImpl) DeleteConnection(ctx context.Context, userID primitive.ObjectID, otherID string) error {
	otherOID, err := primitive.ObjectIDFromHex(otherID)
	if err != nil {
		return err
	}
	return s.repo.DeleteConnection(ctx, userID, otherOID)
}
