package company

import (
	"context"
	"errors"
	"testing"

	"km-backend/internal/features/network"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeNetwork struct {
	network.NetworkRepository
	company *network.CompanyProfile
}

func (f fakeNetwork) GetCompanies(ctx context.Context, where bson.M, limit int) ([]network.CompanyProfile, error) {
	if f.company != nil && where["_id"] == f.company.ID {
		return []network.CompanyProfile{*f.company}, nil
	}
	return nil, nil
}

func (f fakeNetwork) OpenJobCounts(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]int, error) {
	return map[primitive.ObjectID]int{f.company.ID: 4}, nil
}

func (f fakeNetwork) CountFollowers(ctx context.Context, id primitive.ObjectID) (int64, error) {
	return 12, nil
}

func TestPublicCompanyShowsOnlyPublicFields(t *testing.T) {
	c := &network.CompanyProfile{ID: primitive.NewObjectID(), CompanyName: " Zomato ", City: "Delhi", VerificationStatus: "verified"}
	svc := NewCompanyService(nil, nil, fakeNetwork{company: c})

	got, err := svc.GetPublicCompany(context.Background(), c.ID.Hex())
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Zomato" || got.Location != "Delhi" || !got.Verified || got.JobCount != 4 || got.FollowerCount != 12 {
		t.Fatalf("company = %+v", got)
	}
	// The company's own city, cover and description win over the recruiter's personal city
	c.CompanyCity, c.CompanyCover, c.CompanyAbout, c.CompanySize = "Gurugram", "https://cdn/x.jpg", "Food delivery", "1000+"
	got, err = svc.GetPublicCompany(context.Background(), c.ID.Hex())
	if err != nil {
		t.Fatal(err)
	}
	if got.Location != "Gurugram" || got.Cover != "https://cdn/x.jpg" || got.About != "Food delivery" || got.Size != "1000+" {
		t.Fatalf("company = %+v", got)
	}
	for _, id := range []string{primitive.NewObjectID().Hex(), "top"} {
		if _, err := svc.GetPublicCompany(context.Background(), id); !errors.Is(err, network.ErrCompanyNotFound) {
			t.Errorf("%s: err = %v, want not found", id, err)
		}
	}
}
