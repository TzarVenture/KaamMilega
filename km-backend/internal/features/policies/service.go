package policies

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service interface {
	// Published is the live version of a policy; ErrNotFound if it has never been published
	Published(ctx context.Context, slug string) (*Policy, error)
	AdminList(ctx context.Context) ([]AdminPolicy, error)
	// AdminGet is the live version to edit, or an empty one with the default title
	AdminGet(ctx context.Context, slug string) (*Policy, error)
	Publish(ctx context.Context, slug string, in PublishInput, adminID primitive.ObjectID) (*Policy, error)
	// Version is one past or current version, with its text
	Version(ctx context.Context, slug string, version int) (*Version, error)
	Versions(ctx context.Context, slug string) ([]Version, error)
}

type service struct {
	repo Repository
	now  func() time.Time
}

func NewService(repo Repository) Service {
	return &service{repo: repo, now: time.Now}
}

func (s *service) Published(ctx context.Context, slug string) (*Policy, error) {
	if _, ok := kindOf(slug); !ok {
		return nil, ErrNotFound
	}
	p, err := s.repo.Get(ctx, slug)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrNotFound
	}
	return p, nil
}

func (s *service) AdminList(ctx context.Context) ([]AdminPolicy, error) {
	live, err := s.repo.All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AdminPolicy, 0, len(Kinds))
	for _, k := range Kinds {
		item := AdminPolicy{Kind: k}
		if p, ok := live[k.Slug]; ok {
			item.Title, item.Published, item.Version = p.Title, true, p.Version
			at := p.PublishedAt
			item.PublishedAt = &at
		}
		out = append(out, item)
	}
	return out, nil
}

func (s *service) AdminGet(ctx context.Context, slug string) (*Policy, error) {
	k, ok := kindOf(slug)
	if !ok {
		return nil, ErrNotFound
	}
	p, err := s.repo.Get(ctx, slug)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return &Policy{Slug: slug, Title: k.Title}, nil
	}
	return p, nil
}

func (s *service) Publish(ctx context.Context, slug string, in PublishInput, adminID primitive.ObjectID) (*Policy, error) {
	if _, ok := kindOf(slug); !ok {
		return nil, ErrNotFound
	}
	title, content, err := in.clean()
	if err != nil {
		return nil, err
	}
	current, err := s.repo.Get(ctx, slug)
	if err != nil {
		return nil, err
	}
	if current != nil && current.Version == in.BaseVersion && current.Title == title && current.Content == content {
		return nil, ErrUnchanged
	}
	return s.repo.Publish(ctx, slug, title, content, max(in.BaseVersion, 0), adminID, s.now())
}

func (s *service) Version(ctx context.Context, slug string, version int) (*Version, error) {
	if _, ok := kindOf(slug); !ok {
		return nil, ErrNotFound
	}
	v, err := s.repo.Version(ctx, slug, version)
	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, ErrNotFound
	}
	return v, nil
}

func (s *service) Versions(ctx context.Context, slug string) ([]Version, error) {
	if _, ok := kindOf(slug); !ok {
		return nil, ErrNotFound
	}
	return s.repo.Versions(ctx, slug)
}
