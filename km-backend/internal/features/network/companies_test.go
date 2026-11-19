package network

import (
	"context"
	"errors"
	"testing"

	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// companyRepo answers the company queries from fixed lists
type companyRepo struct {
	NetworkRepository
	companies   []CompanyProfile
	followed    []primitive.ObjectID
	connections []CandidateUser
	jobs        map[primitive.ObjectID]int
	blocked     []primitive.ObjectID
	follows     []primitive.ObjectID
}

func (r *companyRepo) GetCompanies(ctx context.Context, where bson.M, limit int) ([]CompanyProfile, error) {
	in := func(id primitive.ObjectID, list []primitive.ObjectID) bool {
		for _, x := range list {
			if x == id {
				return true
			}
		}
		return false
	}
	var out []CompanyProfile
	for _, c := range r.companies {
		switch cond := where["_id"].(type) {
		case primitive.ObjectID:
			if c.ID != cond {
				continue
			}
		case bson.M:
			if ids, ok := cond["$in"].([]primitive.ObjectID); ok && !in(c.ID, ids) {
				continue
			}
			if ids, ok := cond["$nin"].([]primitive.ObjectID); ok && in(c.ID, ids) {
				continue
			}
		}
		out = append(out, c)
	}
	return out, nil
}

func (r *companyRepo) FollowedCompanyIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return r.followed, nil
}

func (r *companyRepo) BlockedEitherWay(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return r.blocked, nil
}

func (r *companyRepo) GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	ids := make([]primitive.ObjectID, 0, len(r.connections))
	for _, c := range r.connections {
		ids = append(ids, c.ID)
	}
	return ids, nil
}

func (r *companyRepo) GetCandidateUsersWhere(ctx context.Context, exclusions []primitive.ObjectID, where bson.M, limit int) ([]CandidateUser, error) {
	return r.connections, nil
}

func (r *companyRepo) OpenJobCounts(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]int, error) {
	return r.jobs, nil
}

func (r *companyRepo) FollowCompany(ctx context.Context, userID, companyID primitive.ObjectID) error {
	r.follows = append(r.follows, companyID)
	return nil
}

func TestCompanySuggestions(t *testing.T) {
	me := &user.User{City: "Pune", JobCategories: []string{"Logistics"}}
	me.ID = primitive.NewObjectID()

	zomato := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Zomato", City: "Delhi"}
	zomatoAgain := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "ZOMATO LTD", City: "Delhi"} // a second recruiter
	delhivery := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Delhivery", Industry: "logistics", City: "Pune"}
	followedCo := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Swiggy"}
	swiggyAgain := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Swiggy Pvt Ltd"}
	quiet := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Quiet Co"}

	repo := &companyRepo{
		companies: []CompanyProfile{zomato, zomatoAgain, delhivery, followedCo, swiggyAgain, quiet},
		followed:  []primitive.ObjectID{followedCo.ID},
		connections: []CandidateUser{
			{ID: primitive.NewObjectID(), Experience: []experienceEntry{{CompanyName: "Zomato"}}},
			{ID: primitive.NewObjectID(), Experience: []experienceEntry{{CompanyName: "zomato"}}},
			{ID: primitive.NewObjectID(), Experience: []experienceEntry{{CompanyName: "Quiet Co", EndDate: "2020-01"}}}, // left
		},
		jobs: map[primitive.ObjectID]int{delhivery.ID: 3},
	}
	svc := NewNetworkService(repo, nil, fakeUsers{me: me})

	got, err := svc.CompanySuggestions(context.Background(), me.ID, 10)
	if err != nil {
		t.Fatal(err)
	}
	names := []string{}
	for _, c := range got {
		names = append(names, c.Name)
	}
	if len(got) != 3 || got[0].Name != "Zomato" || got[1].Name != "Delhivery" || got[2].Name != "Quiet Co" {
		t.Fatalf("suggestions = %v; want Zomato (2 connections), Delhivery (field, city, hiring), Quiet Co", names)
	}
	if got[0].ConnectionsCount != 2 || got[0].Reason != "2 of your connections work here" {
		t.Errorf("Zomato = %+v", got[0])
	}
	if got[1].Reason != "Hiring in logistics" || got[1].JobCount != 3 {
		t.Errorf("Delhivery = %+v", got[1])
	}
}

func TestFollowCompanyRules(t *testing.T) {
	me := &user.User{}
	me.ID = primitive.NewObjectID()
	company := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Zomato"}
	blockedCo := CompanyProfile{ID: primitive.NewObjectID(), CompanyName: "Blocked Co"}
	repo := &companyRepo{companies: []CompanyProfile{company, blockedCo}, blocked: []primitive.ObjectID{blockedCo.ID}}
	svc := NewNetworkService(repo, nil, fakeUsers{me: me})
	ctx := context.Background()

	if err := svc.FollowCompany(ctx, me.ID, company.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if len(repo.follows) != 1 || repo.follows[0] != company.ID {
		t.Fatalf("follows = %v", repo.follows)
	}
	for name, c := range map[string]struct {
		id   string
		want error
	}{
		"own account":        {me.ID.Hex(), ErrFollowOwnCompany},
		"not a company":      {primitive.NewObjectID().Hex(), ErrCompanyNotFound},
		"bad id":             {"nope", ErrCompanyNotFound},
		"blocked either way": {blockedCo.ID.Hex(), ErrCompanyNotFound},
	} {
		if err := svc.FollowCompany(ctx, me.ID, c.id); !errors.Is(err, c.want) {
			t.Errorf("%s: err = %v, want %v", name, err, c.want)
		}
	}
}
