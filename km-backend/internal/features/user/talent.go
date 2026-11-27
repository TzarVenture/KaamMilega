package user

import (
	"context"
	"regexp"
	"strings"
	"time"

	"km-backend/internal/common/api"
	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Talent search for employers: job seekers only (no employer, admin or team accounts), never
// private or closed profiles, and no contact details (those come through a chat or a resume
// download, which the hiring plan counts).

// TalentFilter narrows the search
type TalentFilter struct {
	Search     string // name, headline, skills, job titles held
	City       string
	Skill      string
	OpenToWork bool
	HasResume  bool
	Page       int
	Limit      int
}

// TalentCard is one job seeker as an employer sees them in search
type TalentCard struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Username     string   `json:"username,omitempty"`
	Headline     string   `json:"headline,omitempty"`
	ProfileImage string   `json:"profile_image,omitempty"`
	City         string   `json:"city,omitempty"`
	Skills       []string `json:"skills,omitempty"`
	CurrentTitle string   `json:"current_title,omitempty"`
	CurrentAt    string   `json:"current_company,omitempty"`
	OpenToWork   bool     `json:"open_to_work"`
	WantedRoles  []string `json:"wanted_roles,omitempty"`
	ResumeShared bool     `json:"resume_shared"`
	Verified     bool     `json:"verified"`
}

// TalentPage is one page of results
type TalentPage struct {
	Items []TalentCard `json:"items"`
	Total int64        `json:"total"`
	Page  int          `json:"page"`
	Limit int          `json:"limit"`
}

type TalentApi struct {
	coll *mongo.Collection
	cfg  *config.Config
}

func NewTalentApi(db *database.MongodbDB, cfg *config.Config) api.Route {
	return &TalentApi{coll: db.DB.Collection("users"), cfg: cfg}
}

func (a *TalentApi) Setup(app *fiber.App) {
	app.Get("/api/recruiter/talent", middleware.AuthMiddleware(a.cfg.JWTSecret), middleware.RequireRole(RoleRecruiter, RoleAdmin), a.search)
}

// talentQuery builds the database filter (kept separate so tests can check it)
func talentQuery(f TalentFilter, searcher primitive.ObjectID) bson.M {
	and := []bson.M{
		{"roles": RoleUser},
		// Employers, the KaamMilega team and admins are not candidates
		{"roles": bson.M{"$nin": []string{RoleRecruiter, RoleAdmin, "staff", "support"}}},
		{"settings.profile_visibility": bson.M{"$ne": "private"}},
		{"account_status": bson.M{"$nin": InactiveAccountStatuses}},
		{"_id": bson.M{"$ne": searcher}},
		// An unfinished sign-up has no name to show
		{"name": bson.M{"$exists": true, "$ne": ""}},
	}
	re := func(s string) primitive.Regex { return primitive.Regex{Pattern: regexp.QuoteMeta(s), Options: "i"} }
	if q := strings.TrimSpace(f.Search); q != "" {
		and = append(and, bson.M{"$or": []bson.M{
			{"name": re(q)}, {"headline": re(q)}, {"skills": re(q)}, {"experience.title": re(q)},
			{"open_to_work.job_titles": re(q)}, {"job_categories": re(q)},
		}})
	}
	if c := strings.TrimSpace(f.City); c != "" {
		and = append(and, bson.M{"$or": []bson.M{{"city": re(c)}, {"open_to_work.locations": re(c)}}})
	}
	if s := strings.TrimSpace(f.Skill); s != "" {
		and = append(and, bson.M{"skills": re(s)})
	}
	if f.OpenToWork {
		and = append(and, bson.M{"open_to_work.is_open": true})
	}
	if f.HasResume {
		and = append(and, bson.M{"resume_shared": true})
	}
	return bson.M{"$and": and}
}

func (a *TalentApi) search(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)
	me, _ := primitive.ObjectIDFromHex(userID)
	f := TalentFilter{
		Search: c.Query("search"), City: c.Query("city"), Skill: c.Query("skill"),
		OpenToWork: c.QueryBool("open_to_work"), HasResume: c.QueryBool("has_resume"),
		Page: c.QueryInt("page", 1), Limit: c.QueryInt("limit", 20),
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 50 {
		f.Limit = 20
	}
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	page, err := a.find(ctx, f, me)
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(page)
}

func (a *TalentApi) find(ctx context.Context, f TalentFilter, me primitive.ObjectID) (*TalentPage, error) {
	filter := talentQuery(f, me)
	total, err := a.coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, err
	}
	opts := options.Find().
		// Open to work first, then the most recently active profiles
		SetSort(bson.D{{Key: "open_to_work.is_open", Value: -1}, {Key: "updated_at", Value: -1}}).
		SetSkip(int64((f.Page - 1) * f.Limit)).SetLimit(int64(f.Limit)).
		SetProjection(bson.M{
			"name": 1, "username": 1, "headline": 1, "profile_image": 1, "city": 1, "skills": 1,
			"experience": 1, "open_to_work": 1, "resume_shared": 1, "verification_status": 1,
		})
	cur, err := a.coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var users []User
	if err := cur.All(ctx, &users); err != nil {
		return nil, err
	}
	page := &TalentPage{Items: make([]TalentCard, 0, len(users)), Total: total, Page: f.Page, Limit: f.Limit}
	for i := range users {
		page.Items = append(page.Items, talentCard(&users[i]))
	}
	return page, nil
}

func talentCard(u *User) TalentCard {
	card := TalentCard{
		ID: u.ID.Hex(), Name: u.Name, Username: u.Username, Headline: u.Headline, ProfileImage: u.ProfileImage,
		City: u.City, ResumeShared: u.ResumeShared,
		Verified: strings.EqualFold(u.VerificationStatus, "verified"),
	}
	if len(u.Skills) > 8 {
		card.Skills = u.Skills[:8]
	} else {
		card.Skills = u.Skills
	}
	// The current job: one with no end date, else the first listed
	for _, e := range u.Experience {
		if strings.TrimSpace(e.EndDate) == "" || strings.EqualFold(e.EndDate, "present") {
			card.CurrentTitle, card.CurrentAt = e.Title, e.CompanyName
			break
		}
	}
	if card.CurrentTitle == "" && len(u.Experience) > 0 {
		card.CurrentTitle, card.CurrentAt = u.Experience[0].Title, u.Experience[0].CompanyName
	}
	if u.OpenToWork != nil && u.OpenToWork.IsOpen {
		card.OpenToWork = true
		card.WantedRoles = u.OpenToWork.JobTitles
	}
	return card
}
