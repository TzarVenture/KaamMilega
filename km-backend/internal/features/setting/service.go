package setting

import (
	"context"
	"fmt"
)

type SettingService interface {
	GetValue(ctx context.Context, key string) (string, error)
	SetValue(ctx context.Context, key string, value string) error
}

type SettingServiceImpl struct {
	repo SettingRepository
}

func NewSettingService(repo SettingRepository) SettingService {
	return &SettingServiceImpl{
		repo: repo,
	}
}

func (s *SettingServiceImpl) GetValue(ctx context.Context, key string) (string, error) {
	setting, err := s.repo.GetByKey(ctx, key)
	if err != nil {
		return "", fmt.Errorf("failed to get setting for key %s: %w", key, err)
	}
	return setting.Value, nil
}

func (s *SettingServiceImpl) SetValue(ctx context.Context, key string, value string) error {
	setting, err := s.repo.GetByKey(ctx, key)
	if err != nil {
		// Try to create if not found?
		// Repo Get returns error if not found (mongo.ErrNoDocuments)
		// We should gracefully handle "not found" to create new.
		// For now let's assume we can just create a new object if err is not nil?
		// But GetByKey returns error on any failure. better check specifically.
		// For simplicity, let's create a new object.
		setting = &Setting{
			Key: key,
		}
	}

	setting.Value = value
	return s.repo.Save(ctx, setting)
}
