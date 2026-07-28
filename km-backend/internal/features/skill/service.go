package skill

import (
	"context"
	"errors"
)

type SkillService interface {
	CreateSkill(ctx context.Context, req *CreateSkillRequest) (*Skill, error)
	GetSkills(ctx context.Context, query string) ([]Skill, error)
}

type SkillServiceImpl struct {
	repo SkillRepository
}

func NewSkillService(repo SkillRepository) SkillService {
	return &SkillServiceImpl{repo: repo}
}

func (s *SkillServiceImpl) CreateSkill(ctx context.Context, req *CreateSkillRequest) (*Skill, error) {
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

func (s *SkillServiceImpl) GetSkills(ctx context.Context, query string) ([]Skill, error) {
	return s.repo.GetSkills(ctx, query, 20) // Limit to 20 results
}
