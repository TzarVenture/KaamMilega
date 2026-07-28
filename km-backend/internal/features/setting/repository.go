package setting

import (
	"context"
	"time"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type SettingRepository interface {
	GetByKey(ctx context.Context, key string) (*Setting, error)
	Save(ctx context.Context, setting *Setting) error
}

type SettingRepositoryImpl struct {
	db *database.MongodbDB
}

func NewSettingRepository(mongodb *database.MongodbDB) SettingRepository {
	return &SettingRepositoryImpl{
		db: mongodb,
	}
}

func (r *SettingRepositoryImpl) getCollection() *mongo.Collection {
	return r.db.DB.Collection("settings")
}

func (r *SettingRepositoryImpl) GetByKey(ctx context.Context, key string) (*Setting, error) {
	coll := r.getCollection()
	var setting Setting
	err := coll.FindOne(ctx, bson.M{"key": key}).Decode(&setting)
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *SettingRepositoryImpl) Save(ctx context.Context, setting *Setting) error {
	if setting.ID.IsZero() {
		return r.create(ctx, setting)
	}
	return r.update(ctx, setting)
}

func (r *SettingRepositoryImpl) create(ctx context.Context, setting *Setting) error {
	coll := r.getCollection()
	setting.ID = primitive.NewObjectID()
	setting.CreatedAt = time.Now()
	setting.UpdatedAt = time.Now()

	_, err := coll.InsertOne(ctx, setting)
	return err
}

func (r *SettingRepositoryImpl) update(ctx context.Context, setting *Setting) error {
	coll := r.getCollection()
	setting.UpdatedAt = time.Now()

	_, err := coll.ReplaceOne(ctx, bson.M{"_id": setting.ID}, setting)
	return err
}
