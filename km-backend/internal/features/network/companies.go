package network

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Following companies. A company is a recruiter's account (company id = the recruiter's user id),
// as everywhere else in the app. Follows live in MongoDB next to the users and jobs they join.

// CompanyFollowsCollection holds one row per follow. The job-alert digest reads it too.
const CompanyFollowsCollection = "company_follows"

var (
	ErrCompanyNotFound   = apperr.New("COMPANY_NOT_FOUND", "company not found")
	ErrFollowOwnCompany  = apperr.New("COMPANY_FOLLOW_SELF", "you can't follow your own company")
	errNotSignedIn       = apperr.New("UNAUTHORIZED", "unauthorized")
	companyAccountClosed = []string{"deactivated", "pending_deletion", "deleted", "suspended"}
)

type CompanyFollow struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	CompanyID primitive.ObjectID `bson:"company_id"`
	CreatedAt time.Time          `bson:"created_at"`
}

// CompanyProfile is a recruiter account seen as a company
type CompanyProfile struct {
	ID                 primitive.ObjectID `bson:"_id"`
	CompanyName        string             `bson:"company_name"`
	CompanyLogo        string             `bson:"company_logo"`
	CompanyWebsite     string             `bson:"company_website"`
	CompanyCover       string             `bson:"company_cover"`
	CompanyAbout       string             `bson:"company_about"`
	CompanyCity        string             `bson:"company_city"`
	CompanySize        string             `bson:"company_size"`
	Industry           string             `bson:"industry"`
	City               string             `bson:"city"`
	VerificationStatus string             `bson:"verification_status"`
}

// Location is where the company is based. Older accounts never set a company city, so the
// recruiter's own city stands in.
func (c CompanyProfile) Location() string {
	if v := strings.TrimSpace(c.CompanyCity); v != "" {
		return v
	}
	return strings.TrimSpace(c.City)
}

// SuggestedCompany is one "Companies to follow" entry. The fields match GET /companies/top, so
// the frontend shows both with the same card.
type SuggestedCompany struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Logo             string `json:"logo"`
	Website          string `json:"website,omitempty"`
	Category         string `json:"category,omitempty"`
	Location         string `json:"location,omitempty"`
	Verified         bool   `json:"verified"`
	JobCount         int    `json:"job_count"`
	ConnectionsCount int    `json:"connections_count"` // the viewer's connections who work there
	Reason           string `json:"reason,omitempty"`
	score            int
}

// --- Repository ---

// companyFilter is who counts as a company that can be followed or suggested
func companyFilter() bson.M {
	return bson.M{
		"roles":          user.RoleRecruiter,
		"is_registered":  true,
		"company_name":   bson.M{"$nin": []interface{}{"", nil}},
		"account_status": bson.M{"$nin": companyAccountClosed},
	}
}

func (r *MongoDBRepository) GetCompanies(ctx context.Context, where bson.M, limit int) ([]CompanyProfile, error) {
	filter := companyFilter()
	if len(where) > 0 {
		filter = bson.M{"$and": []bson.M{filter, where}}
	}
	cursor, err := r.usersColl.Find(ctx, filter, options.Find().
		SetSort(bson.M{"updated_at": -1}).SetLimit(int64(limit)).
		SetProjection(bson.M{"company_name": 1, "company_logo": 1, "company_website": 1, "company_cover": 1, "company_about": 1,
			"company_city": 1, "company_size": 1, "industry": 1, "city": 1, "verification_status": 1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var out []CompanyProfile
	err = cursor.All(ctx, &out)
	return out, err
}

func (r *MongoDBRepository) FollowCompany(ctx context.Context, userID, companyID primitive.ObjectID) error {
	_, err := r.followsColl.UpdateOne(ctx,
		bson.M{"user_id": userID, "company_id": companyID},
		bson.M{"$setOnInsert": bson.M{"created_at": time.Now()}},
		options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		return nil // followed twice at the same moment: still one follow
	}
	return err
}

func (r *MongoDBRepository) UnfollowCompany(ctx context.Context, userID, companyID primitive.ObjectID) error {
	_, err := r.followsColl.DeleteOne(ctx, bson.M{"user_id": userID, "company_id": companyID})
	return err
}

func (r *MongoDBRepository) FollowedCompanyIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cursor, err := r.followsColl.Find(ctx, bson.M{"user_id": userID}, options.Find().
		SetProjection(bson.M{"company_id": 1}).SetSort(bson.M{"created_at": -1}).SetLimit(1000))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []CompanyFollow
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.CompanyID)
	}
	return ids, nil
}

// OpenJobCounts counts live listings per company, as /companies/top does: status Open and not
// hidden because the account is deactivated
func (r *MongoDBRepository) OpenJobCounts(ctx context.Context, companyIDs []primitive.ObjectID) (map[primitive.ObjectID]int, error) {
	out := map[primitive.ObjectID]int{}
	if len(companyIDs) == 0 {
		return out, nil
	}
	cursor, err := r.jobsColl.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{
			"recruiter_id":      bson.M{"$in": companyIDs},
			"status":            bson.M{"$in": []string{"Open", "open", "OPEN"}},
			"hidden_by_account": bson.M{"$ne": true},
		}}},
		{{Key: "$group", Value: bson.M{"_id": "$recruiter_id", "n": bson.M{"$sum": 1}}}},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		ID primitive.ObjectID `bson:"_id"`
		N  int                `bson:"n"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.ID] = row.N
	}
	return out, nil
}

func (r *MongoDBRepository) BlockedEitherWay(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cursor, err := r.blocksColl.Find(ctx, bson.M{"$or": []bson.M{{"user_id": userID}, {"blocked_user_id": userID}}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		UserID        primitive.ObjectID `bson:"user_id"`
		BlockedUserID primitive.ObjectID `bson:"blocked_user_id"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make([]primitive.ObjectID, 0, len(rows))
	for _, row := range rows {
		if row.UserID == userID {
			out = append(out, row.BlockedUserID)
		} else {
			out = append(out, row.UserID)
		}
	}
	return out, nil
}

// --- Service ---

// companyToFollow loads a company the user may follow, or ErrCompanyNotFound
func (s *NetworkServiceImpl) companyToFollow(ctx context.Context, userID primitive.ObjectID, companyID string) (primitive.ObjectID, error) {
	id, err := primitive.ObjectIDFromHex(companyID)
	if err != nil {
		return id, ErrCompanyNotFound
	}
	if id == userID {
		return id, ErrFollowOwnCompany
	}
	found, err := s.repo.GetCompanies(ctx, bson.M{"_id": id}, 1)
	if err != nil {
		return id, err
	}
	if len(found) == 0 {
		return id, ErrCompanyNotFound
	}
	blocked, err := s.repo.BlockedEitherWay(ctx, userID)
	if err != nil {
		return id, err
	}
	for _, b := range blocked {
		if b == id {
			return id, ErrCompanyNotFound
		}
	}
	return id, nil
}

func (s *NetworkServiceImpl) FollowCompany(ctx context.Context, userID primitive.ObjectID, companyID string) error {
	id, err := s.companyToFollow(ctx, userID, companyID)
	if err != nil {
		return err
	}
	return s.repo.FollowCompany(ctx, userID, id)
}

// UnfollowCompany works even if the company has since closed its account
func (s *NetworkServiceImpl) UnfollowCompany(ctx context.Context, userID primitive.ObjectID, companyID string) error {
	id, err := primitive.ObjectIDFromHex(companyID)
	if err != nil {
		return ErrCompanyNotFound
	}
	return s.repo.UnfollowCompany(ctx, userID, id)
}

func (s *NetworkServiceImpl) FollowedCompanies(ctx context.Context, userID primitive.ObjectID) ([]string, error) {
	ids, err := s.repo.FollowedCompanyIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, id.Hex())
	}
	return out, nil
}

const (
	companyPool        = 200 // companies scored per request
	connectionsChecked = 500 // connections whose workplaces are read
)

// CompanySuggestions ranks companies the user doesn't follow yet: where their connections work,
// companies in their field and city, and companies hiring now.
func (s *NetworkServiceImpl) CompanySuggestions(ctx context.Context, userID primitive.ObjectID, limit int) ([]SuggestedCompany, error) {
	if limit <= 0 || limit > 30 {
		limit = 6
	}
	me, err := s.userRepo.FindUserByID(ctx, userID.Hex())
	if err != nil {
		return nil, err
	}
	if me == nil {
		return nil, errNotSignedIn
	}

	followed, err := s.repo.FollowedCompanyIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	blocked, err := s.repo.BlockedEitherWay(ctx, userID)
	if err != nil {
		return nil, err
	}
	skip := append(append([]primitive.ObjectID{userID}, followed...), blocked...)

	// Names already followed (through any recruiter of that company) and the user's own company
	skipKeys := map[string]bool{}
	if key := orgKey(me.CompanyName); key != "" {
		skipKeys[key] = true
	}
	if len(followed) > 0 {
		mine, err := s.repo.GetCompanies(ctx, bson.M{"_id": bson.M{"$in": followed}}, len(followed))
		if err != nil {
			return nil, err
		}
		for _, c := range mine {
			skipKeys[orgKey(c.CompanyName)] = true
		}
	}

	companies, err := s.repo.GetCompanies(ctx, bson.M{"_id": bson.M{"$nin": skip}}, companyPool)
	if err != nil {
		return nil, err
	}

	// Where the user's connections work now
	connections, _ := s.repo.GetConnections(ctx, userID)
	isConnection := map[primitive.ObjectID]bool{}
	for _, id := range connections {
		isConnection[id] = true
	}
	worksAt := map[string]int{}
	if len(connections) > 0 {
		if len(connections) > connectionsChecked {
			connections = connections[:connectionsChecked]
		}
		people, err := s.repo.GetCandidateUsersWhere(ctx, []primitive.ObjectID{}, bson.M{"_id": bson.M{"$in": connections}}, connectionsChecked)
		if err != nil {
			return nil, err
		}
		for _, p := range people {
			for key, w := range orgsOf(p.CompanyName, p.Experience, nil).companies {
				if w.current {
					worksAt[key]++
				}
			}
		}
	}

	ids := make([]primitive.ObjectID, 0, len(companies))
	for _, c := range companies {
		ids = append(ids, c.ID)
	}
	jobs, err := s.repo.OpenJobCounts(ctx, ids)
	if err != nil {
		return nil, err
	}

	myFields := map[string]bool{}
	for _, f := range append(append([]string{}, me.JobCategories...), me.Industry) {
		if f = strings.ToLower(strings.TrimSpace(f)); f != "" {
			myFields[f] = true
		}
	}
	myCity := strings.TrimSpace(me.City)

	// One entry per company name, keeping its best-placed recruiter account
	best := map[string]SuggestedCompany{}
	for _, c := range companies {
		key := orgKey(c.CompanyName)
		if key == "" || skipKeys[key] {
			continue
		}
		sc := scoreCompany(c, worksAt[key], jobs[c.ID], myFields, myCity)
		if isConnection[c.ID] && sc.ConnectionsCount == 0 {
			// The recruiter is a connection, though their own profile has no workplace entry
			sc = scoreCompany(c, 1, jobs[c.ID], myFields, myCity)
		}
		if prev, ok := best[key]; !ok || sc.score > prev.score || (sc.score == prev.score && sc.JobCount > prev.JobCount) {
			best[key] = sc
		}
	}

	out := make([]SuggestedCompany, 0, len(best))
	for _, sc := range best {
		out = append(out, sc)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].score != out[j].score {
			return out[i].score > out[j].score
		}
		if out[i].JobCount != out[j].JobCount {
			return out[i].JobCount > out[j].JobCount
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func scoreCompany(c CompanyProfile, connectionsHere, openJobs int, myFields map[string]bool, myCity string) SuggestedCompany {
	industry := strings.TrimSpace(c.Industry)
	city := c.Location()
	sameField := industry != "" && myFields[strings.ToLower(industry)]
	sameCity := myCity != "" && strings.EqualFold(city, myCity)

	score := min(connectionsHere*30, 90)
	if sameField {
		score += 20
	}
	if sameCity {
		score += 15
	}
	if openJobs > 0 {
		score += 10 + min(openJobs, 5)*2
	}
	verified := c.VerificationStatus == "verified"
	if verified {
		score += 5
	}

	var reason string
	switch {
	case connectionsHere == 1:
		reason = "1 of your connections works here"
	case connectionsHere > 1:
		reason = fmt.Sprintf("%d of your connections work here", connectionsHere)
	case sameField && openJobs > 0:
		reason = fmt.Sprintf("Hiring in %s", industry)
	case sameCity && openJobs > 0:
		reason = fmt.Sprintf("Hiring in %s", city)
	case sameField:
		reason = fmt.Sprintf("In your field: %s", industry)
	case sameCity:
		reason = fmt.Sprintf("Based in %s", city)
	case openJobs > 0:
		reason = "Hiring now"
	}

	return SuggestedCompany{
		ID:               c.ID.Hex(),
		Name:             strings.TrimSpace(c.CompanyName),
		Logo:             c.CompanyLogo,
		Website:          c.CompanyWebsite,
		Category:         industry,
		Location:         city,
		Verified:         verified,
		JobCount:         openJobs,
		ConnectionsCount: connectionsHere,
		Reason:           reason,
		score:            score,
	}
}

func (r *MongoDBRepository) CountFollowers(ctx context.Context, companyID primitive.ObjectID) (int64, error) {
	return r.followsColl.CountDocuments(ctx, bson.M{"company_id": companyID})
}

// CompanyPerson is someone who works at a company, for the company page's People tab
type CompanyPerson struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Headline     string `json:"headline,omitempty"`
	Title        string `json:"title,omitempty"` // their role there
	ProfileImage string `json:"profile_image,omitempty"`
	City         string `json:"city,omitempty"`
	IsRecruiter  bool   `json:"is_recruiter"`
}

// CompanyPeople lists members who work at the company now: its recruiter, and people whose
// current job on their profile is at a company of the same name. Private profiles, people who
// turned off matching and anyone blocked either way are left out.
func (s *NetworkServiceImpl) CompanyPeople(ctx context.Context, viewerID primitive.ObjectID, companyID string, limit int) ([]CompanyPerson, error) {
	if limit <= 0 || limit > 50 {
		limit = 24
	}
	id, err := primitive.ObjectIDFromHex(companyID)
	if err != nil {
		return nil, ErrCompanyNotFound
	}
	found, err := s.repo.GetCompanies(ctx, bson.M{"_id": id}, 1)
	if err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, ErrCompanyNotFound
	}
	key := orgKey(found[0].CompanyName)
	if key == "" {
		return []CompanyPerson{}, nil
	}
	blocked, err := s.repo.BlockedEitherWay(ctx, viewerID)
	if err != nil {
		return nil, err
	}
	pattern := primitive.Regex{Pattern: orgPattern(key), Options: "i"}
	people, err := s.repo.GetCandidateUsersWhere(ctx, append([]primitive.ObjectID{}, blocked...), bson.M{"$or": []bson.M{
		{"_id": id},
		{"experience.company_name": pattern},
	}}, 100)
	if err != nil {
		return nil, err
	}

	out := []CompanyPerson{}
	for _, p := range people {
		person := CompanyPerson{
			ID:           p.ID.Hex(),
			Name:         displayName(p),
			Headline:     p.Headline,
			ProfileImage: p.ProfileImage,
			City:         p.City,
			IsRecruiter:  p.ID == id,
		}
		works := person.IsRecruiter
		for _, e := range p.Experience {
			if strings.TrimSpace(e.EndDate) == "" && orgKey(e.CompanyName) == key {
				works = true
				if person.Title == "" {
					person.Title = strings.TrimSpace(e.Title)
				}
			}
		}
		if works {
			out = append(out, person)
		}
	}
	// The recruiter first, then by name
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].IsRecruiter != out[j].IsRecruiter {
			return out[i].IsRecruiter
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func displayName(p CandidateUser) string {
	if n := strings.TrimSpace(p.Name); n != "" {
		return n
	}
	if n := strings.TrimSpace(p.FirstName + " " + p.LastName); n != "" {
		return n
	}
	return "Member"
}
