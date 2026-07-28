package network

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"km-backend/internal/database"
)

type MongoDBRepository struct {
	db         *database.MongodbDB
	collection *mongo.Collection
}

func NewNetworkRepository(db *database.MongodbDB) NetworkRepository {
	return &MongoDBRepository{
		db:         db,
		collection: db.DB.Collection("network_connections"),
	}
}

func (r *MongoDBRepository) CreateInvitation(ctx context.Context, invitation *ConnectionRequest) error {
	invitation.CreatedAt = time.Now()
	invitation.UpdatedAt = time.Now()
	_, err := r.collection.InsertOne(ctx, invitation)
	return err
}

func (r *MongoDBRepository) UpdateInvitationStatus(ctx context.Context, senderID, receiverID primitive.ObjectID, status ConnectionStatus) error {
	filter := bson.M{
		"sender_id":   senderID,
		"receiver_id": receiverID,
	}
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}

func (r *MongoDBRepository) GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error) {
	filter := bson.M{
		"receiver_id": userID,
		"status":      StatusPending,
	}
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var invitations []ConnectionRequest
	if err := cursor.All(ctx, &invitations); err != nil {
		return nil, err
	}
	return invitations, nil
}

func (r *MongoDBRepository) GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	filter := bson.M{
		"status": StatusAccepted,
		"$or": []bson.M{
			{"sender_id": userID},
			{"receiver_id": userID},
		},
	}
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var connections []ConnectionRequest
	if err := cursor.All(ctx, &connections); err != nil {
		return nil, err
	}

	res := make([]primitive.ObjectID, 0)
	for _, c := range connections {
		if c.SenderID == userID {
			res = append(res, c.ReceiverID)
		} else {
			res = append(res, c.SenderID)
		}
	}
	return res, nil
}

func (r *MongoDBRepository) GetConnectionStatus(ctx context.Context, userA, userB primitive.ObjectID) (ConnectionStatus, error) {
	filter := bson.M{
		"$or": []bson.M{
			{"sender_id": userA, "receiver_id": userB},
			{"sender_id": userB, "receiver_id": userA},
		},
	}
	var res ConnectionRequest
	err := r.collection.FindOne(ctx, filter).Decode(&res)
	if err == mongo.ErrNoDocuments {
		return "", nil // Not connected/No request
	}
	if err != nil {
		return "", err
	}
	return res.Status, nil
}

func (r *MongoDBRepository) DeleteInvitation(ctx context.Context, senderID, receiverID primitive.ObjectID) error {
	filter := bson.M{
		"sender_id":   senderID,
		"receiver_id": receiverID,
	}
	_, err := r.collection.DeleteOne(ctx, filter)
	return err
}

func (r *MongoDBRepository) DeleteConnection(ctx context.Context, userA, userB primitive.ObjectID) error {
	filter := bson.M{
		"$or": []bson.M{
			{"sender_id": userA, "receiver_id": userB},
			{"sender_id": userB, "receiver_id": userA},
		},
	}
	_, err := r.collection.DeleteOne(ctx, filter)
	return err
}
