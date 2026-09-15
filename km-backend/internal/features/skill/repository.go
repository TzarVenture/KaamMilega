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
	GetSkills(ctx context.Context, query string, category string, limit int64) ([]Skill, error)
	GetSkillByName(ctx context.Context, name string) (*Skill, error)
	GetSkillByID(ctx context.Context, id primitive.ObjectID) (*Skill, error)
	UpdateSkill(ctx context.Context, id primitive.ObjectID, req *UpdateSkillRequest) (*Skill, error)
	DeleteSkill(ctx context.Context, id primitive.ObjectID) error
	GetCategories(ctx context.Context) ([]string, error)
	SeedDefaultSkills(ctx context.Context) (int, error)
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

func (r *SkillRepositoryImpl) GetSkills(ctx context.Context, query string, category string, limit int64) ([]Skill, error) {
	filter := bson.M{}
	if query != "" {
		filter["name"] = bson.M{"$regex": query, "$options": "i"}
	}
	if category != "" && category != "All" {
		filter["category"] = category
	}

	opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}

	cursor, err := r.skillColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var skills []Skill
	if err = cursor.All(ctx, &skills); err != nil {
		return nil, err
	}
	if skills == nil {
		skills = []Skill{}
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

func (r *SkillRepositoryImpl) GetSkillByID(ctx context.Context, id primitive.ObjectID) (*Skill, error) {
	var skill Skill
	err := r.skillColl.FindOne(ctx, bson.M{"_id": id}).Decode(&skill)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &skill, nil
}

func (r *SkillRepositoryImpl) UpdateSkill(ctx context.Context, id primitive.ObjectID, req *UpdateSkillRequest) (*Skill, error) {
	updateFields := bson.M{"updated_at": time.Now()}
	if req.Name != "" {
		updateFields["name"] = req.Name
	}
	if req.Category != "" {
		updateFields["category"] = req.Category
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated Skill
	err := r.skillColl.FindOneAndUpdate(ctx, bson.M{"_id": id}, bson.M{"$set": updateFields}, opts).Decode(&updated)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &updated, nil
}

func (r *SkillRepositoryImpl) DeleteSkill(ctx context.Context, id primitive.ObjectID) error {
	res, err := r.skillColl.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (r *SkillRepositoryImpl) GetCategories(ctx context.Context) ([]string, error) {
	results, err := r.skillColl.Distinct(ctx, "category", bson.M{"category": bson.M{"$ne": ""}})
	if err != nil {
		return nil, err
	}
	var categories []string
	for _, res := range results {
		if str, ok := res.(string); ok && str != "" {
			categories = append(categories, str)
		}
	}
	if categories == nil {
		categories = []string{}
	}
	return categories, nil
}

func (r *SkillRepositoryImpl) SeedDefaultSkills(ctx context.Context) (int, error) {
	defaultSkills := []struct {
		Name     string
		Category string
	}{
		{"Delivery Executive", "Logistics & Delivery"},
		{"Bike Courier", "Logistics & Delivery"},
		{"Truck Driver", "Logistics & Delivery"},
		{"Commercial Vehicle Driver", "Logistics & Delivery"},
		{"Warehouse Associate", "Logistics & Delivery"},
		{"Forklift Operator", "Logistics & Delivery"},
		{"Inventory Clerk", "Logistics & Delivery"},
		{"Electrician", "Skilled Trades & Construction"},
		{"Plumber", "Skilled Trades & Construction"},
		{"Carpenter", "Skilled Trades & Construction"},
		{"Mason / Civil Construction", "Skilled Trades & Construction"},
		{"Welder & Fabricator", "Skilled Trades & Construction"},
		{"Painter & Decorator", "Skilled Trades & Construction"},
		{"AC & HVAC Technician", "Skilled Trades & Construction"},
		{"CCTV Technician", "Skilled Trades & Construction"},
		{"Security Guard", "Facility & Security"},
		{"Housekeeping Executive", "Facility & Security"},
		{"Office Peon / Helper", "Facility & Security"},
		{"Facility Supervisor", "Facility & Security"},
		{"Accountant", "Office & Administration"},
		{"Data Entry Operator", "Office & Administration"},
		{"Office Assistant", "Office & Administration"},
		{"Customer Support Executive", "Office & Administration"},
		{"Telecaller / BPO", "Office & Administration"},
		{"HR Assistant", "Office & Administration"},
		{"Frontend Developer (React / Next.js)", "Tech & Creative"},
		{"Backend Developer (Go / Node.js)", "Tech & Creative"},
		{"Graphic Designer", "Tech & Creative"},
		{"UI/UX Designer", "Tech & Creative"},
		{"Video Editor", "Tech & Creative"},
		{"Digital Marketing Executive", "Tech & Creative"},
		{"Chef / Cook", "Hospitality & Services"},
		{"Waiter / Service Staff", "Hospitality & Services"},
		{"Barista", "Hospitality & Services"},
		{"Beautician / Hair Stylist", "Hospitality & Services"},
	}

	insertedCount := 0
	for _, item := range defaultSkills {
		existing, err := r.GetSkillByName(ctx, item.Name)
		if err == nil && existing == nil {
			skill := &Skill{
				Name:      item.Name,
				Category:  item.Category,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			_, err = r.CreateSkill(ctx, skill)
			if err == nil {
				insertedCount++
			}
		}
	}
	return insertedCount, nil
}
