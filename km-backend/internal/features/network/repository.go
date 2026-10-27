package network

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"km-backend/internal/database"
)

type MongoDBRepository struct {
	db            *database.MongodbDB
	collection    *mongo.Collection
	usersColl     *mongo.Collection
	dismissedColl *mongo.Collection
	blocksColl    *mongo.Collection
}

func NewNetworkRepository(db *database.MongodbDB) NetworkRepository {
	return &MongoDBRepository{
		db:            db,
		collection:    db.DB.Collection("network_connections"),
		usersColl:     db.DB.Collection("users"),
		dismissedColl: db.DB.Collection("network_dismissed_suggestions"),
		blocksColl:    db.DB.Collection("user_blocks"),
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

func (r *MongoDBRepository) GetSentPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	filter := bson.M{
		"sender_id": userID,
		"status":    StatusPending,
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

	res := make([]primitive.ObjectID, 0, len(invitations))
	for _, inv := range invitations {
		res = append(res, inv.ReceiverID)
	}
	return res, nil
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

func (r *MongoDBRepository) GetExclusionIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	exclusions := map[primitive.ObjectID]bool{
		userID: true, // Exclude self
	}

	// 1. Existing connections and pending invitations (both directions)
	connFilter := bson.M{
		"$or": []bson.M{
			{"sender_id": userID},
			{"receiver_id": userID},
		},
	}
	cursor, err := r.collection.Find(ctx, connFilter)
	if err == nil {
		defer cursor.Close(ctx)
		var conns []ConnectionRequest
		if err := cursor.All(ctx, &conns); err == nil {
			for _, c := range conns {
				if c.SenderID == userID {
					exclusions[c.ReceiverID] = true
				} else {
					exclusions[c.SenderID] = true
				}
			}
		}
	}

	// 2. Blocked users (both directions)
	blockFilter := bson.M{
		"$or": []bson.M{
			{"user_id": userID},
			{"blocked_user_id": userID},
		},
	}
	bCursor, err := r.blocksColl.Find(ctx, blockFilter)
	if err == nil {
		defer bCursor.Close(ctx)
		var blocks []struct {
			UserID        primitive.ObjectID `bson:"user_id"`
			BlockedUserID primitive.ObjectID `bson:"blocked_user_id"`
		}
		if err := bCursor.All(ctx, &blocks); err == nil {
			for _, b := range blocks {
				if b.UserID == userID {
					exclusions[b.BlockedUserID] = true
				} else {
					exclusions[b.UserID] = true
				}
			}
		}
	}

	// 3. Dismissed suggestions
	dCursor, err := r.dismissedColl.Find(ctx, bson.M{"user_id": userID})
	if err == nil {
		defer dCursor.Close(ctx)
		var dismissed []DismissedSuggestion
		if err := dCursor.All(ctx, &dismissed); err == nil {
			for _, d := range dismissed {
				exclusions[d.DismissedUserID] = true
			}
		}
	}

	result := make([]primitive.ObjectID, 0, len(exclusions))
	for id := range exclusions {
		result = append(result, id)
	}
	return result, nil
}

func (r *MongoDBRepository) GetCandidateUsers(ctx context.Context, exclusionIDs []primitive.ObjectID, limit int) ([]CandidateUser, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	filter := bson.M{
		"_id":           bson.M{"$nin": exclusionIDs},
		"is_registered": true,
		"roles":         bson.M{"$nin": []string{"admin"}},
		// Never suggest private profiles, inactive accounts, or people who opted out of matching
		"settings.profile_visibility":        bson.M{"$ne": "private"},
		"settings.enable_ai_recommendations": bson.M{"$ne": false},
		"account_status":                     bson.M{"$nin": []string{"deactivated", "pending_deletion", "deleted"}},
	}

	opts := options.Find().
		SetSort(bson.M{"updated_at": -1}).
		SetLimit(int64(limit))

	cursor, err := r.usersColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var candidates []CandidateUser
	if err := cursor.All(ctx, &candidates); err != nil {
		return nil, err
	}
	return candidates, nil
}

func (r *MongoDBRepository) DismissSuggestion(ctx context.Context, userID, dismissedUserID primitive.ObjectID) error {
	item := DismissedSuggestion{
		ID:              primitive.NewObjectID(),
		UserID:          userID,
		DismissedUserID: dismissedUserID,
		CreatedAt:       time.Now(),
	}
	_, err := r.dismissedColl.InsertOne(ctx, item)
	return err
}

func (r *MongoDBRepository) GetMutualConnectionsCount(ctx context.Context, myConnections []primitive.ObjectID, candidateID primitive.ObjectID) (int, error) {
	if len(myConnections) == 0 {
		return 0, nil
	}
	filter := bson.M{
		"status": StatusAccepted,
		"$or": []bson.M{
			{
				"sender_id":   candidateID,
				"receiver_id": bson.M{"$in": myConnections},
			},
			{
				"receiver_id": candidateID,
				"sender_id":   bson.M{"$in": myConnections},
			},
		},
	}
	count, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

