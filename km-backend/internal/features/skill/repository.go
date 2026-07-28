package skill

import (
	"context"
	"errors"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"km-backend/internal/database"
)

type SkillRepository interface {
	CreateSkill(ctx context.Context, skill *Skill) (*Skill, error)
	GetSkills(ctx context.Context, query string, limit int64) ([]Skill, error)
	GetSkillByName(ctx context.Context, name string) (*Skill, error)
}

type SkillRepositoryImpl struct {
	db        *database.MongodbDB
	skillColl *mongo.Collection
}

func NewSkillRepository(db *database.MongodbDB) SkillRepository {
	coll := db.DB.Collection("skills")

	// Create unique index on name
	_, err := coll.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.M{"name": 1},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		log.Printf("Warning: Failed to create skill index: %v", err)
	}

	return &SkillRepositoryImpl{
		db:        db,
		skillColl: coll,
	}
}

func (r *SkillRepositoryImpl) CreateSkill(ctx context.Context, skill *Skill) (*Skill, error) {
	skill.CreatedAt = time.Now()
	skill.UpdatedAt = time.Now()
	res, err := r.skillColl.InsertOne(ctx, skill)
	if err != nil {
		return nil, err
	}
	skill.ID = res.InsertedID.(primitive.ObjectID)
	return skill, nil
}

func (r *SkillRepositoryImpl) GetSkills(ctx context.Context, query string, limit int64) ([]Skill, error) {
	filter := bson.M{}
	if query != "" {
		filter["name"] = bson.M{"$regex": query, "$options": "i"}
	}

	opts := options.Find().SetLimit(limit)
	cursor, err := r.skillColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var skills []Skill
	if err = cursor.All(ctx, &skills); err != nil {
		return nil, err
	}
	return skills, nil
}

func (r *SkillRepositoryImpl) GetSkillByName(ctx context.Context, name string) (*Skill, error) {
	var skill Skill
	err := r.skillColl.FindOne(ctx, bson.M{"name": name}).Decode(&skill)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &skill, nil
}
