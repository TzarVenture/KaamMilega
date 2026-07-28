package question

import (
	"context"
	"errors"
)

type QuestionService struct {
	repo QuestionRepository
}

func NewQuestionService(repo QuestionRepository) *QuestionService {
	return &QuestionService{repo: repo}
}

func (s *QuestionService) CreateQuestion(ctx context.Context, req CreateQuestionRequest) (*Question, error) {
	question := &Question{
		Question: req.Question,
		Answer:   req.Answer,
	}
	return s.repo.Create(ctx, question)
}

func (s *QuestionService) GetQuestion(ctx context.Context, id string) (*Question, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *QuestionService) GetQuestions(ctx context.Context, filter QuestionFilter) ([]Question, int64, error) {
	return s.repo.FindAll(ctx, filter)
}

func (s *QuestionService) UpdateQuestion(ctx context.Context, id string, req UpdateQuestionRequest) (*Question, error) {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("question not found")
	}

	if req.Question != "" {
		existing.Question = req.Question
	}
	if req.Answer != "" {
		existing.Answer = req.Answer
	}

	return s.repo.Update(ctx, id, existing)
}

func (s *QuestionService) DeleteQuestion(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
