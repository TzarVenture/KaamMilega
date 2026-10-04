package network

import (
	"context"
	"errors"
	"fmt"

	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type NetworkServiceImpl struct {
	repo         NetworkRepository
	notifService notification.NotificationService
	userRepo     user.UserRepository
}

func NewNetworkService(
	repo NetworkRepository,
	notifService notification.NotificationService,
	userRepo user.UserRepository,
) NetworkService {
	return &NetworkServiceImpl{
		repo:         repo,
		notifService: notifService,
		userRepo:     userRepo,
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
	if status == StatusPending || status == StatusAccepted {
		return errors.New("invitation already exists or already connected")
	}
	if status == StatusIgnored {
		_ = s.repo.DeleteInvitation(ctx, senderID, rOID)
	}

	invitation := &ConnectionRequest{
		SenderID:   senderID,
		ReceiverID: rOID,
		Status:     StatusPending,
	}

	if err := s.repo.CreateInvitation(ctx, invitation); err != nil {
		return err
	}

	// Real-time in-app notification to receiver
	if s.notifService != nil {
		go func() {
			senderName := "Someone"
			senderAvatar := ""
			if s.userRepo != nil {
				if sender, err := s.userRepo.FindUserByID(context.Background(), senderID.Hex()); err == nil && sender != nil {
					if sender.Name != "" {
						senderName = sender.Name
					} else if sender.FirstName != "" {
						senderName = sender.FirstName + " " + sender.LastName
					}
					senderAvatar = sender.ProfileImage
				}
			}

			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      rOID,
				ActorID:     &senderID,
				ActorName:   senderName,
				ActorAvatar: senderAvatar,
				Type:        notification.TypeConnectionRequest,
				Category:    notification.CategoryNetwork,
				Title:       "New Connection Request",
				Message:     fmt.Sprintf("%s sent you a connection request", senderName),
				Link:        "/network",
				Metadata: map[string]interface{}{
					"sender_id": senderID.Hex(),
				},
			})
		}()
	}

	return nil
}

func (s *NetworkServiceImpl) AcceptInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error {
	sOID, err := primitive.ObjectIDFromHex(senderID)
	if err != nil {
		return err
	}

	if err := s.repo.UpdateInvitationStatus(ctx, sOID, receiverID, StatusAccepted); err != nil {
		return err
	}

	// Real-time in-app notification to sender
	if s.notifService != nil {
		go func() {
			receiverName := "Someone"
			receiverAvatar := ""
			if s.userRepo != nil {
				if receiver, err := s.userRepo.FindUserByID(context.Background(), receiverID.Hex()); err == nil && receiver != nil {
					if receiver.Name != "" {
						receiverName = receiver.Name
					} else if receiver.FirstName != "" {
						receiverName = receiver.FirstName + " " + receiver.LastName
					}
					receiverAvatar = receiver.ProfileImage
				}
			}

			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      sOID,
				ActorID:     &receiverID,
				ActorName:   receiverName,
				ActorAvatar: receiverAvatar,
				Type:        notification.TypeConnectionAccepted,
				Category:    notification.CategoryNetwork,
				Title:       "Connection Accepted",
				Message:     fmt.Sprintf("%s accepted your connection request", receiverName),
				Link:        fmt.Sprintf("/profile/%s", receiverID.Hex()),
				Metadata: map[string]interface{}{
					"accepted_by": receiverID.Hex(),
				},
			})
		}()
	}

	return nil
}

func (s *NetworkServiceImpl) IgnoreInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error {
	sOID, err := primitive.ObjectIDFromHex(senderID)
	if err != nil {
		return err
	}

	// Deleting the invitation resets the status so the sender is no longer pending and can connect again later
	return s.repo.DeleteInvitation(ctx, sOID, receiverID)
}

func (s *NetworkServiceImpl) GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error) {
	return s.repo.GetPendingInvitations(ctx, userID)
}

func (s *NetworkServiceImpl) GetSentPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return s.repo.GetSentPendingInvitations(ctx, userID)
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
