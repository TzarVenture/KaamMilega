package policies

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// memRepo is an in-memory Repository with the same version check as the real one
type memRepo struct {
	live     map[string]*Policy
	versions []Version
}

func (m *memRepo) Get(_ context.Context, slug string) (*Policy, error) {
	if p, ok := m.live[slug]; ok {
		cp := *p
		return &cp, nil
	}
	return nil, nil
}
func (m *memRepo) All(_ context.Context) (map[string]*Policy, error) { return m.live, nil }
func (m *memRepo) Publish(_ context.Context, slug, title, content string, base int, by primitive.ObjectID, at time.Time) (*Policy, error) {
	cur := 0
	if p, ok := m.live[slug]; ok {
		cur = p.Version
	}
	if cur != base {
		return nil, errVersionConflict
	}
	p := &Policy{Slug: slug, Title: title, Content: content, Version: base + 1, PublishedAt: at, PublishedBy: by}
	m.live[slug] = p
	m.versions = append(m.versions, Version{Slug: slug, Version: p.Version, Title: title, Content: content, PublishedAt: at})
	return p, nil
}
func (m *memRepo) Versions(_ context.Context, slug string) ([]Version, error) {
	out := []Version{}
	for i := len(m.versions) - 1; i >= 0; i-- {
		if v := m.versions[i]; v.Slug == slug {
			v.Content = ""
			out = append(out, v)
		}
	}
	return out, nil
}
func (m *memRepo) Version(_ context.Context, slug string, n int) (*Version, error) {
	for _, v := range m.versions {
		if v.Slug == slug && v.Version == n {
			return &v, nil
		}
	}
	return nil, nil
}

func TestPublishAndRead(t *testing.T) {
	ctx := context.Background()
	repo := &memRepo{live: map[string]*Policy{}}
	svc := NewService(repo)
	admin := primitive.NewObjectID()

	if _, err := svc.Published(ctx, "privacy"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unpublished policy: %v", err)
	}
	if _, err := svc.Published(ctx, "cookies"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown policy: %v", err)
	}
	draft, err := svc.AdminGet(ctx, "privacy")
	if err != nil || draft.Title != "Privacy policy" || draft.Version != 0 {
		t.Fatalf("empty draft: %v %+v", err, draft)
	}

	p, err := svc.Publish(ctx, "privacy", PublishInput{Title: "  Privacy   policy ", Content: "## Data\r\nWe keep little.\r\n"}, admin)
	if err != nil {
		t.Fatal(err)
	}
	if p.Version != 1 || p.Title != "Privacy policy" || p.Content != "## Data\nWe keep little." {
		t.Fatalf("published: %+v", p)
	}
	if _, err := svc.Publish(ctx, "privacy", PublishInput{Title: "Privacy policy", Content: "## Data\nWe keep little.", BaseVersion: 1}, admin); !errors.Is(err, ErrUnchanged) {
		t.Fatalf("unchanged edit: %v", err)
	}
	// Someone editing the old version can't overwrite the newer one
	if _, err := svc.Publish(ctx, "privacy", PublishInput{Title: "Privacy", Content: "Old copy", BaseVersion: 0}, admin); !errors.Is(err, errVersionConflict) {
		t.Fatalf("stale edit: %v", err)
	}
	if _, err := svc.Publish(ctx, "privacy", PublishInput{Title: "Privacy policy", Content: "## Data\nWe keep less.", BaseVersion: 1}, admin); err != nil {
		t.Fatal(err)
	}

	live, _ := svc.Published(ctx, "privacy")
	if live.Version != 2 || live.Content != "## Data\nWe keep less." {
		t.Fatalf("live: %+v", live)
	}
	list, _ := svc.Versions(ctx, "privacy")
	if len(list) != 2 || list[0].Version != 2 || list[0].Content != "" {
		t.Fatalf("versions: %+v", list)
	}
	first, err := svc.Version(ctx, "privacy", 1)
	if err != nil || first.Content != "## Data\nWe keep little." {
		t.Fatalf("version 1: %v %+v", err, first)
	}
	all, _ := svc.AdminList(ctx)
	if len(all) != len(Kinds) {
		t.Fatalf("admin list has %d policies", len(all))
	}
	for _, a := range all {
		if a.Published != (a.Slug == "privacy") {
			t.Errorf("%s published = %v", a.Slug, a.Published)
		}
	}
}

func TestPublishValidation(t *testing.T) {
	svc := NewService(&memRepo{live: map[string]*Policy{}})
	cases := map[string]struct {
		in   PublishInput
		want error
	}{
		"no title":       {PublishInput{Content: "x"}, ErrTitleInvalid},
		"long title":     {PublishInput{Title: strings.Repeat("a", MaxTitleLength+1), Content: "x"}, ErrTitleInvalid},
		"no content":     {PublishInput{Title: "Terms", Content: " \n "}, ErrContentEmpty},
		"long content":   {PublishInput{Title: "Terms", Content: strings.Repeat("क", MaxContentLength+1)}, ErrContentTooLong},
		"unknown policy": {PublishInput{Title: "Cookies", Content: "x"}, ErrNotFound},
	}
	for name, c := range cases {
		slug := "terms"
		if name == "unknown policy" {
			slug = "cookies"
		}
		if _, err := svc.Publish(context.Background(), slug, c.in, primitive.NewObjectID()); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", name, err, c.want)
		}
	}
}
