package city

import (
	"context"
	"errors"
)

type CityService struct {
	repo CityRepository
}

func NewCityService(repo CityRepository) *CityService {
	return &CityService{repo: repo}
}

func (s *CityService) CreateCity(ctx context.Context, req *CreateCityRequest) (*City, error) {
	city := &City{
		Name:    req.Name,
		State:   req.State,
		Country: req.Country,
		Active:  true,
	}
	return s.repo.Create(ctx, city)
}

func (s *CityService) GetCities(ctx context.Context, filter CityFilter) ([]City, int64, error) {
	return s.repo.FindCities(ctx, filter)
}

func (s *CityService) GetCity(ctx context.Context, id string) (*City, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *CityService) UpdateCity(ctx context.Context, id string, req *UpdateCityRequest) (*City, error) {
	city, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if city == nil {
		return nil, errors.New("city not found")
	}

	if req.Name != "" {
		city.Name = req.Name
	}
	if req.State != "" {
		city.State = req.State
	}
	if req.Country != "" {
		city.Country = req.Country
	}
	if req.Active != nil {
		city.Active = *req.Active
	}

	return s.repo.Update(ctx, id, city)
}

func (s *CityService) DeleteCity(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
