package application

import (
	"context"
	"regexp"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// The employer's applicant list: paged, filtered and searched in the database (one query with
// the candidate and job joined in), with how many applicants sit in each stage.

var (
	ErrTooMany     = apperr.New("TOO_MANY", "pick up to 100 applicants at a time")
	ErrInvalidNote = apperr.New("INVALID_REVIEW", "rating must be 0 to 5 and the note at most 2000 characters")
)

// StageEvent records one move between stages
type StageEvent struct {
	Status string    `bson:"status" json:"status"`
	At     time.Time `bson:"at" json:"at"`
}

// PipelineFilter narrows the employer's applicants
type PipelineFilter struct {
	RecruiterID primitive.ObjectID
	JobID       primitive.ObjectID // zero: every job
	Status      string             // a stage, or "" for all
	Search      string             // candidate name, headline, skills or city
	Sort        string             // "newest" (default), "oldest", "rating"
	Page, Limit int
}

// PipelinePage is one page of applicants
type PipelinePage struct {
	Items  []ApplicationDetail `json:"items"`
	Total  int64               `json:"total"`
	Page   int                 `json:"page"`
	Limit  int                 `json:"limit"`
	Stages map[string]int      `json:"stages"` // all stages, ignoring the status filter
}

type pipelineRow struct {
	Application `bson:",inline"`
	Cand        []struct {
		ID           primitive.ObjectID `bson:"_id"`
		Name         string             `bson:"name"`
		Username     string             `bson:"username"`
		Email        string             `bson:"email"`
		Mobile       string             `bson:"mobile"`
		ProfileImage string             `bson:"profile_image"`
		Headline     string             `bson:"headline"`
		City         string             `bson:"city"`
		Skills       []string           `bson:"skills"`
	} `bson:"cand"`
	JobDoc []struct {
		ID       primitive.ObjectID `bson:"_id"`
		Title    string             `bson:"title"`
		CityName string             `bson:"city_name"`
		Status   string             `bson:"status"`
	} `bson:"jobdoc"`
}

// Pipeline runs the employer's applicant query
func (r *ApplicationRepositoryImpl) Pipeline(ctx context.Context, f PipelineFilter) (*PipelinePage, error) {
	match := bson.M{"recruiter_id": f.RecruiterID}
	if !f.JobID.IsZero() {
		match["job_id"] = f.JobID
	}
	candLookup := bson.M{"$lookup": bson.M{
		"from": "users", "localField": "candidate_id", "foreignField": "_id", "as": "cand",
		"pipeline": bson.A{bson.M{"$project": bson.M{"name": 1, "username": 1, "email": 1, "mobile": 1, "profile_image": 1, "headline": 1, "city": 1, "skills": 1}}},
	}}
	stages := mongo.Pipeline{{{Key: "$match", Value: match}}}
	// Searching needs every candidate joined first; otherwise only the page shown is joined
	q := strings.TrimSpace(f.Search)
	if q != "" {
		stages = append(stages, bson.D{{Key: "$lookup", Value: candLookup["$lookup"]}})
		re := primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"}
		stages = append(stages, bson.D{{Key: "$match", Value: bson.M{"$or": bson.A{
			bson.M{"cand.name": re}, bson.M{"cand.headline": re}, bson.M{"cand.skills": re}, bson.M{"cand.city": re},
		}}}})
	}

	sort := bson.D{{Key: "created_at", Value: -1}}
	switch f.Sort {
	case "oldest":
		sort = bson.D{{Key: "created_at", Value: 1}}
	case "rating":
		sort = bson.D{{Key: "rating", Value: -1}, {Key: "created_at", Value: -1}}
	}
	listMatch := bson.M{}
	if f.Status != "" {
		listMatch["status"] = primitive.Regex{Pattern: "^" + regexp.QuoteMeta(f.Status) + "$", Options: "i"}
	} else {
		// "All" means everyone still in the running; withdrawn applicants have their own filter
		listMatch["status"] = bson.M{"$not": primitive.Regex{Pattern: "^" + StatusWithdrawn + "$", Options: "i"}}
	}
	items := bson.A{
		bson.M{"$match": listMatch},
		bson.M{"$sort": sort},
		bson.M{"$skip": int64((f.Page - 1) * f.Limit)},
		bson.M{"$limit": int64(f.Limit)},
	}
	if q == "" {
		items = append(items, candLookup)
	}
	stages = append(stages, bson.D{{Key: "$facet", Value: bson.M{
		"items": append(items,
			bson.M{"$lookup": bson.M{
				"from": "jobs", "localField": "job_id", "foreignField": "_id", "as": "jobdoc",
				"pipeline": bson.A{bson.M{"$project": bson.M{"title": 1, "city_name": 1, "status": 1}}},
			}},
		),
		"total":  bson.A{bson.M{"$match": listMatch}, bson.M{"$count": "n"}},
		"stages": bson.A{bson.M{"$group": bson.M{"_id": "$status", "n": bson.M{"$sum": 1}}}},
	}}})

	cur, err := r.appColl.Aggregate(ctx, stages, options.Aggregate().SetAllowDiskUse(true))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var out []struct {
		Items []pipelineRow `bson:"items"`
		Total []struct {
			N int64 `bson:"n"`
		} `bson:"total"`
		Stages []struct {
			Status string `bson:"_id"`
			N      int    `bson:"n"`
		} `bson:"stages"`
	}
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	page := &PipelinePage{Items: []ApplicationDetail{}, Page: f.Page, Limit: f.Limit, Stages: map[string]int{}}
	for _, s := range Statuses {
		page.Stages[s] = 0
	}
	page.Stages[StatusWithdrawn] = 0
	if len(out) == 0 {
		return page, nil
	}
	if len(out[0].Total) > 0 {
		page.Total = out[0].Total[0].N
	}
	for _, s := range out[0].Stages {
		if c := knownStatus(s.Status); c != "" {
			page.Stages[c] += s.N
		} else {
			page.Stages["Applied"] += s.N
		}
	}
	for _, row := range out[0].Items {
		d := detailOf(&row.Application)
		if len(row.Cand) > 0 {
			c := row.Cand[0]
			d.Candidate = &CandidateInfo{ID: c.ID.Hex(), Name: c.Name, Username: c.Username, Email: c.Email, Mobile: c.Mobile, ProfileImage: c.ProfileImage, Headline: c.Headline, City: c.City, Skills: c.Skills}
		}
		if len(row.JobDoc) > 0 {
			j := row.JobDoc[0]
			d.Job = &JobInfo{ID: j.ID.Hex(), Title: j.Title, CityName: j.CityName, Status: j.Status}
		}
		page.Items = append(page.Items, d)
	}
	return page, nil
}

// detailOf copies an application's own fields into its API shape
func detailOf(a *Application) ApplicationDetail {
	status := knownStatus(a.Status)
	if status == "" {
		status = "Applied"
	}
	return ApplicationDetail{
		ID: a.ID.Hex(), JobID: a.JobID.Hex(), RecruiterID: a.RecruiterID.Hex(), CandidateID: a.CandidateID.Hex(),
		Status: status, CoverLetter: a.CoverLetter, ResumeURL: a.ResumeURL, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt,
		Rating: a.Rating, Note: a.Note, History: a.History,
	}
}

// StageCountsByJobs counts applicants per stage for each job (job.StageCounter)
func (r *ApplicationRepositoryImpl) StageCountsByJobs(ctx context.Context, jobIDs []primitive.ObjectID) (map[primitive.ObjectID]map[string]int, error) {
	out := map[primitive.ObjectID]map[string]int{}
	if len(jobIDs) == 0 {
		return out, nil
	}
	cur, err := r.appColl.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"job_id": bson.M{"$in": jobIDs}}}},
		{{Key: "$group", Value: bson.M{"_id": bson.M{"job": "$job_id", "status": "$status"}, "n": bson.M{"$sum": 1}}}},
	})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var rows []struct {
		Key struct {
			Job    primitive.ObjectID `bson:"job"`
			Status string             `bson:"status"`
		} `bson:"_id"`
		N int `bson:"n"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		m := out[row.Key.Job]
		if m == nil {
			m = map[string]int{}
			out[row.Key.Job] = m
		}
		s := knownStatus(row.Key.Status)
		if s == "" {
			s = "Applied"
		}
		// Withdrawn applicants are not part of the job's funnel
		if s == StatusWithdrawn {
			continue
		}
		m[s] += row.N
	}
	return out, nil
}

// SetReview saves the employer's private rating and note on an application
func (r *ApplicationRepositoryImpl) SetReview(ctx context.Context, id primitive.ObjectID, rating *int, note *string) (*Application, error) {
	set := bson.M{"updated_at": time.Now()}
	if rating != nil {
		set["rating"] = *rating
	}
	if note != nil {
		set["note"] = *note
	}
	if _, err := r.appColl.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": set}); err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id.Hex())
}

// --- service ---

// reviewStore is the part of the repository the pipeline needs beyond ApplicationRepository
type reviewStore interface {
	Pipeline(ctx context.Context, f PipelineFilter) (*PipelinePage, error)
	SetReview(ctx context.Context, id primitive.ObjectID, rating *int, note *string) (*Application, error)
}

// Pipeline lists the employer's applicants (optionally for one of their jobs)
func (s *ApplicationService) Pipeline(ctx context.Context, userID string, f PipelineFilter, jobID string) (*PipelinePage, error) {
	store, ok := s.repo.(reviewStore)
	if !ok {
		return nil, ErrApplicationNotFound
	}
	rid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, ErrApplicationForbidden
	}
	f.RecruiterID = rid
	if jobID != "" {
		if err := s.ownsJob(ctx, jobID, userID, false); err != nil {
			return nil, err
		}
		f.JobID, _ = primitive.ObjectIDFromHex(jobID)
	}
	if f.Status != "" {
		if f.Status = knownStatus(f.Status); f.Status == "" {
			return nil, ErrInvalidStatus
		}
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 25
	}
	return store.Pipeline(ctx, f)
}

// ownApplication loads an application on one of the employer's jobs
func (s *ApplicationService) ownApplication(ctx context.Context, id, userID string, isAdmin bool) (*Application, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return nil, ErrApplicationNotFound
	}
	app, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if app == nil {
		return nil, ErrApplicationNotFound
	}
	if err := s.ownsJob(ctx, app.JobID.Hex(), userID, isAdmin); err != nil &&
		!(err == ErrJobNotFound && app.RecruiterID.Hex() == userID) {
		return nil, err
	}
	return app, nil
}

// Review sets the employer's private rating (0-5) and note
func (s *ApplicationService) Review(ctx context.Context, id, userID string, rating *int, note *string) (*Application, error) {
	if (rating != nil && (*rating < 0 || *rating > 5)) || (note != nil && len([]rune(*note)) > 2000) {
		return nil, ErrInvalidNote
	}
	app, err := s.ownApplication(ctx, id, userID, false)
	if err != nil {
		return nil, err
	}
	store, ok := s.repo.(reviewStore)
	if !ok {
		return nil, ErrApplicationNotFound
	}
	if note != nil {
		t := strings.TrimSpace(*note)
		note = &t
	}
	return store.SetReview(ctx, app.ID, rating, note)
}

// BulkResult says which applications moved
type BulkResult struct {
	Updated []string          `json:"updated"`
	Failed  map[string]string `json:"failed"`
}

// BulkStatus moves up to 100 of the employer's applications to one stage
func (s *ApplicationService) BulkStatus(ctx context.Context, ids []string, status, userID string, isAdmin bool) (*BulkResult, error) {
	if len(ids) == 0 || len(ids) > 100 {
		return nil, ErrTooMany
	}
	if CanonicalStatus(status) == "" {
		return nil, ErrInvalidStatus
	}
	res := &BulkResult{Updated: []string{}, Failed: map[string]string{}}
	for _, id := range ids {
		if _, err := s.UpdateApplicationStatus(ctx, id, status, userID, isAdmin); err != nil {
			code := apperr.CodeOf(err)
			if code == "" {
				code = "SERVER_ERROR"
			}
			res.Failed[id] = code
			continue
		}
		res.Updated = append(res.Updated, id)
	}
	return res, nil
}

// --- handlers ---

func (c *ApplicationController) Pipeline(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	page, err := c.service.Pipeline(ctx.Context(), userID, PipelineFilter{
		Status: ctx.Query("status"), Search: ctx.Query("search"), Sort: ctx.Query("sort"),
		Page: ctx.QueryInt("page", 1), Limit: ctx.QueryInt("limit", 25),
	}, ctx.Query("job_id"))
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.JSON(page)
}

func (c *ApplicationController) Review(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	var req struct {
		Rating *int    `json:"rating"`
		Note   *string `json:"note"`
	}
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	app, err := c.service.Review(ctx.Context(), ctx.Params("id"), userID, req.Rating, req.Note)
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.JSON(app)
}

func (c *ApplicationController) BulkStatus(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	var req struct {
		IDs    []string `json:"ids"`
		Status string   `json:"status"`
	}
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	res, err := c.service.BulkStatus(ctx.Context(), req.IDs, req.Status, userID, middleware.HasRole(ctx, "admin"))
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	return ctx.JSON(res)
}
