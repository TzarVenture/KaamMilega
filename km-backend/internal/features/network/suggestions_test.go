package network

import (
	"context"
	"regexp"
	"testing"

	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestOrgKeyIgnoresCaseAndLegalEndings(t *testing.T) {
	cases := map[string]string{
		"Infosys":                            "infosys",
		"INFOSYS LIMITED":                    "infosys",
		"Infosys Ltd.":                       "infosys",
		"Tata Consultancy Services Pvt. Ltd": "tata consultancy services",
		"IIT-Bombay":                         "iit bombay",
		"Self employed":                      "",
		"  ":                                 "",
		"Ltd":                                "ltd", // a single word is kept, even if it's a legal ending
	}
	for in, want := range cases {
		if got := orgKey(in); got != want {
			t.Errorf("orgKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOrgPatternFindsTheSameCompanyOnly(t *testing.T) {
	re := regexp.MustCompile(`(?i)` + orgPattern("infosys"))
	for _, name := range []string{"Infosys", "infosys ltd.", " INFOSYS Private Limited", "Infosys, Inc"} {
		if !re.MatchString(name) {
			t.Errorf("%q should match", name)
		}
	}
	for _, name := range []string{"Infosys BPM", "Not Infosys", "Infosystems"} {
		if re.MatchString(name) {
			t.Errorf("%q should not match", name)
		}
	}
}

func TestSharedOrgsPrefersCurrentColleagues(t *testing.T) {
	me := orgsOf("", []experienceEntry{
		{CompanyName: "Wipro", EndDate: "2022-01"},
		{CompanyName: "Zomato"}, // current
	}, []educationEntry{{SchoolName: "Pune University"}})
	them := orgsOf("", []experienceEntry{
		{CompanyName: "WIPRO LIMITED", EndDate: "2021-05"},
		{CompanyName: "Zomato Ltd"}, // current
	}, []educationEntry{{SchoolName: "pune university"}})

	got := sharedOrgs(me, them)
	if got.company != "Zomato" || !got.colleagues || got.school != "Pune University" {
		t.Fatalf("shared = %+v", got)
	}

	// A recruiter's own company counts as where they work now
	recruiter := orgsOf("Wipro", nil, nil)
	if got := sharedOrgs(me, recruiter); got.company != "Wipro" || got.colleagues {
		t.Fatalf("shared with recruiter = %+v (I left Wipro, so not colleagues)", got)
	}
}

// fakeRepo answers the suggestion queries from fixed lists
type fakeRepo struct {
	NetworkRepository
	connections []primitive.ObjectID
	recent      []CandidateUser
	byID        map[primitive.ObjectID]CandidateUser
	fof         map[primitive.ObjectID]int
	orgMatches  []CandidateUser
}

func (r *fakeRepo) GetExclusionIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return []primitive.ObjectID{userID}, nil
}

func (r *fakeRepo) GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return r.connections, nil
}

func (r *fakeRepo) FriendsOfFriends(ctx context.Context, userID primitive.ObjectID, mine []primitive.ObjectID) (map[primitive.ObjectID]int, error) {
	return r.fof, nil
}

func (r *fakeRepo) GetCandidateUsers(ctx context.Context, exclusions []primitive.ObjectID, limit int) ([]CandidateUser, error) {
	return r.recent, nil
}

func (r *fakeRepo) GetCandidateUsersWhere(ctx context.Context, exclusions []primitive.ObjectID, where bson.M, limit int) ([]CandidateUser, error) {
	if in, ok := where["_id"].(bson.M); ok {
		var out []CandidateUser
		for _, id := range in["$in"].([]primitive.ObjectID) {
			if c, ok := r.byID[id]; ok {
				out = append(out, c)
			}
		}
		return out, nil
	}
	return r.orgMatches, nil
}

type fakeUsers struct {
	user.UserRepository
	me *user.User
}

func (u fakeUsers) FindUserByID(ctx context.Context, id string) (*user.User, error) { return u.me, nil }

func TestSuggestionsFindFriendsOfFriendsAndColleagues(t *testing.T) {
	me := &user.User{
		Skills:     []string{"Go"},
		Experience: []user.Experience{{CompanyName: "Zomato"}},
	}
	me.ID = primitive.NewObjectID()

	friendOfFriend := CandidateUser{ID: primitive.NewObjectID(), Name: "Asha", Skills: []string{"Cooking"}}
	colleague := CandidateUser{ID: primitive.NewObjectID(), Name: "Ravi", Skills: []string{"Sales"},
		Experience: []experienceEntry{{CompanyName: "Zomato Pvt Ltd"}}}
	stranger := CandidateUser{ID: primitive.NewObjectID(), Name: "Kiran", Skills: []string{"Welding"}}
	peer := CandidateUser{ID: primitive.NewObjectID(), Name: "Meera", Skills: []string{"go"}}

	repo := &fakeRepo{
		connections: []primitive.ObjectID{primitive.NewObjectID()},
		recent:      []CandidateUser{stranger, peer},
		byID:        map[primitive.ObjectID]CandidateUser{friendOfFriend.ID: friendOfFriend},
		fof:         map[primitive.ObjectID]int{friendOfFriend.ID: 3},
		orgMatches:  []CandidateUser{colleague, peer}, // peer again: listed once
	}
	svc := NewNetworkService(repo, nil, fakeUsers{me: me})

	res, err := svc.GetSuggestions(context.Background(), me.ID, SuggestionsFilter{Type: "all"})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]SuggestedConnection{}
	for _, s := range res.Suggestions {
		if _, dup := got[s.Name]; dup {
			t.Fatalf("%s suggested twice", s.Name)
		}
		got[s.Name] = s
	}
	if _, ok := got["Kiran"]; ok {
		t.Error("someone with nothing in common was suggested")
	}
	if s := got["Ravi"]; s.PrimaryMatchBadge != "Also works at Zomato" {
		t.Errorf("colleague badge = %q", s.PrimaryMatchBadge)
	}
	if s := got["Asha"]; s.MutualConnectionsCount != 3 || s.PrimaryMatchBadge != "3 mutual connections" {
		t.Errorf("friend of friend = %+v", s)
	}
	if _, ok := got["Meera"]; !ok {
		t.Error("the peer with a shared skill is missing")
	}

	for filter, want := range map[string]string{"company": "Ravi", "mutual": "Asha"} {
		res, err := svc.GetSuggestions(context.Background(), me.ID, SuggestionsFilter{Type: filter})
		if err != nil {
			t.Fatal(err)
		}
		if len(res.Suggestions) != 1 || res.Suggestions[0].Name != want {
			t.Errorf("%s filter gave %+v, want only %s", filter, res.Suggestions, want)
		}
	}
}
