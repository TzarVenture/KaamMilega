package payment

import (
	"context"
	"errors"
	"regexp"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Repository stores payment orders. Every status change is conditional on the current status,
// which is what makes each order settle or refund only once.
type Repository interface {
	Insert(ctx context.Context, order *Order) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*Order, error)
	FindByRazorpayOrderID(ctx context.Context, razorpayOrderID string) (*Order, error)
	FindByRazorpayPaymentID(ctx context.Context, razorpayPaymentID string) (*Order, error)
	ClaimPaid(ctx context.Context, id primitive.ObjectID, paymentID string, now time.Time) (bool, error)
	MarkRefundDue(ctx context.Context, id primitive.ObjectID, from []Status, paymentID string, paise int64, reason string, now time.Time) (bool, error)
	MarkRefunded(ctx context.Context, id primitive.ObjectID, refundID string, now time.Time) (bool, error)
	ReopenRefund(ctx context.Context, id primitive.ObjectID, message string) error
	SetRefundError(ctx context.Context, id primitive.ObjectID, message string) error
	SetLastFailure(ctx context.Context, id primitive.ObjectID, message string) error
	ListCreatedBefore(ctx context.Context, before time.Time, limit int64) ([]Order, error)
	ListRefundDue(ctx context.Context, limit int64) ([]Order, error)
	MarkExpired(ctx context.Context, id primitive.ObjectID, now time.Time) error
	SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) (int64, error)
	AdminList(ctx context.Context, query AdminOrderQuery) ([]Order, int64, error)
}

type mongoRepository struct {
	orders *mongo.Collection
}

// NewRepository creates the payment order store and its indexes.
func NewRepository(db *database.MongodbDB) Repository {
	orders := db.DB.Collection("payment_orders")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		database.SyncIndexes(ctx, orders, []mongo.IndexModel{
			{Keys: bson.D{{Key: "razorpay_order_id", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "razorpay_payment_id", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: 1}}},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "purpose", Value: 1}, {Key: "paid_at", Value: -1}}},
		})
	}()

	return &mongoRepository{orders: orders}
}

func (r *mongoRepository) Insert(ctx context.Context, order *Order) error {
	res, err := r.orders.InsertOne(ctx, order)
	if err != nil {
		return err
	}
	if id, ok := res.InsertedID.(primitive.ObjectID); ok {
		order.ID = id
	}
	return nil
}

func (r *mongoRepository) findOne(ctx context.Context, filter bson.M) (*Order, error) {
	var order Order
	err := r.orders.FindOne(ctx, filter).Decode(&order)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *mongoRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*Order, error) {
	return r.findOne(ctx, bson.M{"_id": id})
}

func (r *mongoRepository) FindByRazorpayOrderID(ctx context.Context, razorpayOrderID string) (*Order, error) {
	return r.findOne(ctx, bson.M{"razorpay_order_id": razorpayOrderID})
}

func (r *mongoRepository) FindByRazorpayPaymentID(ctx context.Context, razorpayPaymentID string) (*Order, error) {
	return r.findOne(ctx, bson.M{"razorpay_payment_id": razorpayPaymentID})
}

// changed runs a conditional update and reports whether it applied.
func (r *mongoRepository) changed(ctx context.Context, filter, set bson.M) (bool, error) {
	res, err := r.orders.UpdateOne(ctx, filter, bson.M{"$set": set})
	if err != nil {
		return false, err
	}
	return res.ModifiedCount == 1, nil
}

// ClaimPaid accepts an expired order too: a late payment is still money received.
func (r *mongoRepository) ClaimPaid(ctx context.Context, id primitive.ObjectID, paymentID string, now time.Time) (bool, error) {
	return r.changed(ctx,
		bson.M{"_id": id, "status": bson.M{"$in": []Status{StatusCreated, StatusExpired}}},
		bson.M{"status": StatusPaid, "razorpay_payment_id": paymentID, "paid_at": now, "updated_at": now},
	)
}

func (r *mongoRepository) MarkRefundDue(ctx context.Context, id primitive.ObjectID, from []Status, paymentID string, paise int64, reason string, now time.Time) (bool, error) {
	return r.changed(ctx,
		bson.M{"_id": id, "status": bson.M{"$in": from}},
		bson.M{"status": StatusRefundDue, "razorpay_payment_id": paymentID, "refund_paise": paise, "refund_reason": reason, "updated_at": now},
	)
}

func (r *mongoRepository) MarkRefunded(ctx context.Context, id primitive.ObjectID, refundID string, now time.Time) (bool, error) {
	set := bson.M{"status": StatusRefunded, "refunded_at": now, "updated_at": now, "refund_error": ""}
	if refundID != "" {
		set["refund_id"] = refundID
	}
	return r.changed(ctx, bson.M{"_id": id, "status": StatusRefundDue}, set)
}

func (r *mongoRepository) ReopenRefund(ctx context.Context, id primitive.ObjectID, message string) error {
	_, err := r.orders.UpdateOne(ctx, bson.M{"_id": id, "status": StatusRefunded}, bson.M{
		"$set":   bson.M{"status": StatusRefundDue, "refund_error": message, "updated_at": time.Now()},
		"$unset": bson.M{"refund_id": "", "refunded_at": ""},
	})
	return err
}

func (r *mongoRepository) SetRefundError(ctx context.Context, id primitive.ObjectID, message string) error {
	_, err := r.orders.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"refund_error": message, "updated_at": time.Now()}})
	return err
}

func (r *mongoRepository) SetLastFailure(ctx context.Context, id primitive.ObjectID, message string) error {
	_, err := r.orders.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"last_failure": message, "updated_at": time.Now()}})
	return err
}

func (r *mongoRepository) list(ctx context.Context, filter bson.M, opts *options.FindOptions) ([]Order, error) {
	cursor, err := r.orders.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	orders := []Order{}
	if err := cursor.All(ctx, &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

func (r *mongoRepository) ListCreatedBefore(ctx context.Context, before time.Time, limit int64) ([]Order, error) {
	return r.list(ctx,
		bson.M{"status": StatusCreated, "created_at": bson.M{"$lte": before}},
		options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}).SetLimit(limit),
	)
}

func (r *mongoRepository) ListRefundDue(ctx context.Context, limit int64) ([]Order, error) {
	return r.list(ctx,
		bson.M{"status": StatusRefundDue},
		options.Find().SetSort(bson.D{{Key: "updated_at", Value: 1}}).SetLimit(limit),
	)
}

func (r *mongoRepository) MarkExpired(ctx context.Context, id primitive.ObjectID, now time.Time) error {
	_, err := r.changed(ctx, bson.M{"_id": id, "status": StatusCreated}, bson.M{"status": StatusExpired, "updated_at": now})
	return err
}

// SumPaidSince adds up what a user has successfully paid for a purpose since a moment in time.
func (r *mongoRepository) SumPaidSince(ctx context.Context, userID primitive.ObjectID, purpose Purpose, since time.Time) (int64, error) {
	cursor, err := r.orders.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"user_id": userID, "purpose": purpose, "status": StatusPaid, "paid_at": bson.M{"$gte": since}}}},
		{{Key: "$group", Value: bson.M{"_id": nil, "total": bson.M{"$sum": "$amount_paise"}}}},
	})
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Total int64 `bson:"total"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Total, nil
}

func (r *mongoRepository) AdminList(ctx context.Context, query AdminOrderQuery) ([]Order, int64, error) {
	filter := bson.M{}
	if query.Status != "" {
		filter["status"] = query.Status
	}
	if query.Purpose != "" {
		filter["purpose"] = query.Purpose
	}
	if query.Search != "" {
		pattern := primitive.Regex{Pattern: "^" + regexp.QuoteMeta(query.Search), Options: ""}
		filter["$or"] = []bson.M{{"razorpay_order_id": pattern}, {"razorpay_payment_id": pattern}}
	}
	total, err := r.orders.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	orders, err := r.list(ctx, filter, options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((query.Page-1)*query.Limit)).
		SetLimit(int64(query.Limit)))
	if err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}
