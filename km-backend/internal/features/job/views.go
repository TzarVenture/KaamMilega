package job

import (
	"context"
	"time"

	"km-backend/internal/database"
	"km-backend/internal/features/analytics"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Job views: each person (a member, or a guest by the anonymous visitor cookie) counts once a
// day per job, the employer's own visits and bots never count. The running total is kept on
// the job (view_count); the daily rows are kept for 120 days for the chart.

const (
	viewRetention = 120 * 24 * time.Hour
	viewDayLayout = "2006-01-02"
	// ViewChartDays is how many days the job page chart covers
	ViewChartDays = 14
)

var viewZone = time.FixedZone("IST", 5*3600+1800)

// JobViews is what the employer sees about a job's views
type JobViews struct {
	Total    int64      `json:"total"`
	LastWeek int64      `json:"last_7_days"`
	Daily    []DayViews `json:"daily,omitempty"`
}

// DayViews is one day of the chart (India time)
type DayViews struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type ViewStore struct {
	jobs  *mongo.Collection
	views *mongo.Collection
	now   func() time.Time
}

func NewViewStore(db *database.MongodbDB) *ViewStore {
	s := &ViewStore{jobs: db.DB.Collection("jobs"), views: db.DB.Collection("job_views"), now: time.Now}
	database.SyncIndexesInBackground(s.views, []mongo.IndexModel{
		{Keys: bson.D{{Key: "job_id", Value: 1}, {Key: "visitor", Value: 1}, {Key: "day", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "job_id", Value: 1}, {Key: "day", Value: 1}}},
		{Keys: bson.D{{Key: "at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(int32(viewRetention / time.Second))},
	})
	return s
}

// Record counts one view of a job; it reports whether this was the visitor's first today
func (s *ViewStore) Record(ctx context.Context, jobID primitive.ObjectID, visitor string) (bool, error) {
	if visitor == "" || jobID.IsZero() {
		return false, nil
	}
	var j struct {
		RecruiterID primitive.ObjectID `bson:"recruiter_id"`
		Status      string             `bson:"status"`
	}
	if err := s.jobs.FindOne(ctx, bson.M{"_id": jobID}, options.FindOne().SetProjection(bson.M{"recruiter_id": 1, "status": 1})).Decode(&j); err != nil {
		if err == mongo.ErrNoDocuments {
			return false, nil
		}
		return false, err
	}
	if j.Status == "Deleted" || j.RecruiterID.Hex() == visitor {
		return false, nil
	}
	now := s.now()
	res, err := s.views.UpdateOne(ctx,
		bson.M{"job_id": jobID, "visitor": visitor, "day": now.In(viewZone).Format(viewDayLayout)},
		bson.M{"$setOnInsert": bson.M{"at": now}}, options.Update().SetUpsert(true))
	if mongo.IsDuplicateKeyError(err) {
		return false, nil
	}
	if err != nil || res.UpsertedCount == 0 {
		return false, err
	}
	_, err = s.jobs.UpdateOne(ctx, bson.M{"_id": jobID}, bson.M{"$inc": bson.M{"view_count": 1}})
	return true, err
}

// Daily is views per day for the last ViewChartDays days, oldest first, today included
func (s *ViewStore) Daily(ctx context.Context, jobID primitive.ObjectID) ([]DayViews, error) {
	today := s.now().In(viewZone)
	days := make([]DayViews, ViewChartDays)
	index := map[string]int{}
	for i := range days {
		d := today.AddDate(0, 0, i-(ViewChartDays-1)).Format(viewDayLayout)
		days[i] = DayViews{Date: d}
		index[d] = i
	}
	cur, err := s.views.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"job_id": jobID, "day": bson.M{"$gte": days[0].Date}}}},
		{{Key: "$group", Value: bson.M{"_id": "$day", "n": bson.M{"$sum": 1}}}},
	})
	if err != nil {
		return nil, err
	}
	var rows []struct {
		Day string `bson:"_id"`
		N   int64  `bson:"n"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, r := range rows {
		if i, ok := index[r.Day]; ok {
			days[i].Count = r.N
		}
	}
	return days, nil
}

// viewerKey tells visitors apart: a member's ID, or "guest:" and the anonymous visitor ID
func viewerKey(c *fiber.Ctx) string {
	if id, _ := c.Locals("user_id").(string); id != "" {
		return id
	}
	if g := analytics.VisitorID(c); g != "" {
		return "guest:" + g
	}
	return ""
}

// RecordView is POST /api/jobs/:id/view, sent by the job page once it is on screen
func (c *JobController) RecordView(ctx *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(ctx.Params("id"))
	if err != nil || c.views == nil {
		return ctx.SendStatus(fiber.StatusNoContent)
	}
	if _, err := c.views.Record(ctx.Context(), id, viewerKey(ctx)); err != nil {
		// A view that isn't counted never stops anyone reading the job
		return ctx.SendStatus(fiber.StatusNoContent)
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}

// withViews adds the view numbers the employer sees (the chart only for a single job)
func (c *JobController) withViews(ctx context.Context, jobs []Job, chart bool) {
	if c.views == nil {
		return
	}
	for i := range jobs {
		v := &JobViews{Total: jobs[i].ViewCount}
		if chart {
			if daily, err := c.views.Daily(ctx, jobs[i].ID); err == nil {
				v.Daily = daily
				for _, d := range daily[len(daily)-7:] {
					v.LastWeek += d.Count
				}
			}
		}
		jobs[i].Views = v
	}
}
