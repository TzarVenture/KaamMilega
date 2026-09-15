package skill

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SkillService interface {
	CreateSkill(ctx context.Context, req *CreateSkillRequest) (*Skill, error)
	GetSkills(ctx context.Context, query string, category string, limit int64) ([]Skill, error)
	GetCategories(ctx context.Context) ([]string, error)
	GetSkillByID(ctx context.Context, id string) (*Skill, error)
	UpdateSkill(ctx context.Context, id string, req *UpdateSkillRequest) (*Skill, error)
	DeleteSkill(ctx context.Context, id string) error
	SeedDefaultSkills(ctx context.Context) (int, error)
}

type SkillServiceImpl struct {
	repo SkillRepository
}

func NewSkillService(repo SkillRepository) SkillService {
	return &SkillServiceImpl{repo: repo}
}

func (s *SkillServiceImpl) CreateSkill(ctx context.Context, req *CreateSkillRequest) (*Skill, error) {
	if req.Name == "" {
		return nil, errors.New("skill name is required")
	}

	existing, err := s.repo.GetSkillByName(ctx, req.Name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("skill already exists")
	}

	skill := &Skill{
		Name:     req.Name,
		Category: req.Category,
	}
	return s.repo.CreateSkill(ctx, skill)
}

func (s *SkillServiceImpl) GetSkills(ctx context.Context, query string, category string, limit int64) ([]Skill, error) {
	return s.repo.GetSkills(ctx, query, category, limit)
}

func (s *SkillServiceImpl) GetCategories(ctx context.Context) ([]string, error) {
	return s.repo.GetCategories(ctx)
}

func (s *SkillServiceImpl) GetSkillByID(ctx context.Context, id string) (*Skill, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid skill ID format")
	}
	return s.repo.GetSkillByID(ctx, objID)
}

func (s *SkillServiceImpl) UpdateSkill(ctx context.Context, id string, req *UpdateSkillRequest) (*Skill, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid skill ID format")
	}
	return s.repo.UpdateSkill(ctx, objID, req)
}

func (s *SkillServiceImpl) DeleteSkill(ctx context.Context, id string) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid skill ID format")
	}
	return s.repo.DeleteSkill(ctx, objID)
}

func (s *SkillServiceImpl) SeedDefaultSkills(ctx context.Context) (int, error) {
	return s.repo.SeedDefaultSkills(ctx)
}
