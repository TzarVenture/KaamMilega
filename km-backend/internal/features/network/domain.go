package network

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ConnectionStatus string

const (
	StatusPending  ConnectionStatus = "pending"
	StatusAccepted ConnectionStatus = "accepted"
	StatusIgnored  ConnectionStatus = "ignored"
)

type ConnectionRequest struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SenderID   primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	ReceiverID primitive.ObjectID `bson:"receiver_id" json:"receiver_id"`
	Status     ConnectionStatus   `bson:"status" json:"status"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}

type ConnectRequest struct {
	ReceiverID string `json:"receiver_id"`
}

type AcceptRequest struct {
	SenderID string `json:"sender_id"`
}

type NetworkRepository interface {
	CreateInvitation(ctx context.Context, invitation *ConnectionRequest) error
	UpdateInvitationStatus(ctx context.Context, senderID, receiverID primitive.ObjectID, status ConnectionStatus) error
	GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error)
	GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetConnectionStatus(ctx context.Context, userA, userB primitive.ObjectID) (ConnectionStatus, error)
	DeleteInvitation(ctx context.Context, senderID, receiverID primitive.ObjectID) error
	DeleteConnection(ctx context.Context, userA, userB primitive.ObjectID) error
}

type NetworkService interface {
	SendInvitation(ctx context.Context, senderID primitive.ObjectID, receiverID string) error
	AcceptInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error
	IgnoreInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error
	GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error)
	GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetConnectionStatus(ctx context.Context, userA, userB string) (string, error)
	DeleteConnection(ctx context.Context, userID primitive.ObjectID, otherID string) error
}
