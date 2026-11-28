package user

import (
	"context"
	"regexp"
	"strings"
	"time"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Suggested candidates: job seekers whose skills or wanted roles match one of the employer's
// jobs, people in the job's city first. Only people talent search could show are suggested, and
// people who already applied are left out.

const suggestedLimit = 12

var ErrSuggestJobNotFound = apperr.New("JOB_NOT_FOUND", "this job doesn't exist or isn't yours")

// Words in a job title that say nothing about the work
var titleStopWords = map[string]bool{
	"and": true, "the": true, "for": true, "with": true, "job": true, "jobs": true, "staff": true,
	"urgent": true, "hiring": true, "required": true, "need": true, "needed": true,
	"full": true, "part": true, "time": true, "male": true, "female": true, "fresher": true, "freshers": true,
}

type suggestJob struct {
	Title        string   `bson:"title"`
	CityName     string   `bson:"city_name"`
	Requirements []string `bson:"requirements"`
}

// matchTerms are the words and phrases a candidate's profile is matched on: the job title's
// meaningful words and the short requirement lines (long sentences match nothing useful)
func matchTerms(j suggestJob) []string {
	seen := map[string]bool{}
	var out []string
	add := func(s string) {
		s = strings.ToLower(strings.TrimSpace(s))
		if len([]rune(s)) < 3 || seen[s] || titleStopWords[s] {
			return
		}
		seen[s] = true
		out = append(out, s)
	}
	for _, w := range strings.FieldsFunc(j.Title, func(r rune) bool {
		return r == ' ' || r == '/' || r == ',' || r == '-' || r == '(' || r == ')' || r == '&'
	}) {
		add(w)
	}
	for _, r := range j.Requirements {
		if len(strings.Fields(r)) <= 3 {
			add(r)
		}
	}
	if len(out) > 12 {
		out = out[:12]
	}
	return out
}

// suggestQuery is talent search's filter plus the match on terms and, when given, the city
func suggestQuery(me primitive.ObjectID, terms []string, city string, exclude []primitive.ObjectID) bson.M {
	filter := talentQuery(TalentFilter{}, me)
	and := filter["$and"].([]bson.M)
	re := func(s string) primitive.Regex { return primitive.Regex{Pattern: regexp.QuoteMeta(s), Options: "i"} }
	var or []bson.M
	for _, t := range terms {
		or = append(or, bson.M{"skills": re(t)}, bson.M{"headline": re(t)},
			bson.M{"open_to_work.job_titles": re(t)}, bson.M{"experience.title": re(t)})
	}
	and = append(and, bson.M{"$or": or})
	if c := strings.TrimSpace(city); c != "" {
		and = append(and, bson.M{"$or": []bson.M{{"city": re(c)}, {"open_to_work.locations": re(c)}}})
	}
	if len(exclude) > 0 {
		and = append(and, bson.M{"_id": bson.M{"$nin": exclude}})
	}
	filter["$and"] = and
	return filter
}

// GET /api/recruiter/jobs/:id/suggested
func (a *TalentApi) suggested(c *fiber.Ctx) error {
	jobID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return apperr.Respond(c, ErrSuggestJobNotFound)
	}
	me := savedOwner(c)
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	var j suggestJob
	err = a.jobs.FindOne(ctx, bson.M{"_id": jobID, "recruiter_id": me, "status": bson.M{"$nin": []string{"Deleted", "deleted"}}}).Decode(&j)
	if err == mongo.ErrNoDocuments {
		return apperr.Respond(c, ErrSuggestJobNotFound)
	}
	if err != nil {
		return apperr.Respond(c, err)
	}
	terms := matchTerms(j)
	out := &TalentPage{Items: []TalentCard{}, Page: 1, Limit: suggestedLimit}
	if len(terms) == 0 {
		return c.JSON(out)
	}

	// People who already applied are in the applicant list, not suggestions
	applied, err := a.applications.Distinct(ctx, "candidate_id", bson.M{"job_id": jobID})
	if err != nil {
		return apperr.Respond(c, err)
	}
	exclude := make([]primitive.ObjectID, 0, len(applied))
	for _, v := range applied {
		if id, ok := v.(primitive.ObjectID); ok {
			exclude = append(exclude, id)
		}
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "open_to_work.is_open", Value: -1}, {Key: "updated_at", Value: -1}}).
		SetProjection(bson.M{
			"name": 1, "username": 1, "headline": 1, "profile_image": 1, "city": 1, "skills": 1,
			"experience": 1, "open_to_work": 1, "resume_shared": 1, "verification_status": 1,
		})
	// People in the job's city first, then anyone else who matches
	for _, city := range []string{j.CityName, ""} {
		if len(out.Items) >= suggestedLimit || (city == "" && j.CityName == "" && len(out.Items) > 0) {
			break
		}
		cur, err := a.coll.Find(ctx, suggestQuery(me, terms, city, exclude), opts.SetLimit(int64(suggestedLimit-len(out.Items))))
		if err != nil {
			return apperr.Respond(c, err)
		}
		var users []User
		if err := cur.All(ctx, &users); err != nil {
			return apperr.Respond(c, err)
		}
		for i := range users {
			out.Items = append(out.Items, talentCard(&users[i]))
			exclude = append(exclude, users[i].ID)
		}
		if j.CityName == "" {
			break
		}
	}
	out.Total = int64(len(out.Items))
	return c.JSON(out)
}
