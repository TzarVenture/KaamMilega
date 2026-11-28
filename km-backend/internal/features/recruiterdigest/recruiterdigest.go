// Package recruiterdigest sends employers a daily summary email: how many people applied to each
// of their jobs since the last summary, and the interviews they have today. It goes out once a
// day after 09:00 India time, only when there is something to tell, and only to employers who
// keep application emails on.
package recruiterdigest

import (
	"context"
	"log"
	"sort"
	"strings"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/fx"
)

const (
	runInterval     = time.Hour
	recruitersRun   = 500
	sendFromHour    = 9
	sendUntilHour   = 21
	maxLookback     = 3 * 24 * time.Hour
	defaultLookback = 24 * time.Hour
	dayLayout       = "2006-01-02"
	// Fields on the employer's user record
	dayField  = "recruiter_digest_day" // the India-time day of the last summary (claims the send)
	sentField = "recruiter_digest_at"  // when it went out (new applicants are counted from here)
)

var ist = time.FixedZone("IST", 5*3600+1800)

type Service struct {
	users        *mongo.Collection
	applications *mongo.Collection
	interviews   *mongo.Collection
	jobs         *mongo.Collection
	mailer       notification.Mailer
	siteURL      string
	now          func() time.Time
}

func NewService(db *database.MongodbDB, mailer notification.Mailer, cfg *config.Config) *Service {
	site := strings.TrimRight(strings.TrimSpace(cfg.FrontendURL), "/")
	if site == "" {
		site = "https://kaammilega.com"
	}
	return &Service{
		users:        db.DB.Collection("users"),
		applications: db.DB.Collection("applications"),
		interviews:   db.DB.Collection("interviews"),
		jobs:         db.DB.Collection("jobs"),
		mailer:       mailer,
		siteURL:      site,
		now:          time.Now,
	}
}

// dayOf is the India-time day and its start and end
func dayOf(t time.Time) (string, time.Time, time.Time) {
	local := t.In(ist)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, ist)
	return start.Format(dayLayout), start, start.AddDate(0, 0, 1)
}

// sendingHours reports whether summaries go out at this time (09:00 to 21:00 India time)
func sendingHours(t time.Time) bool {
	h := t.In(ist).Hour()
	return h >= sendFromHour && h < sendUntilHour
}

// since is where new applicants are counted from: the last summary, at most three days back
func since(now time.Time, last *time.Time) time.Time {
	from := now.Add(-defaultLookback)
	if last != nil && last.Before(now) {
		from = *last
	}
	if earliest := now.Add(-maxLookback); from.Before(earliest) {
		from = earliest
	}
	return from
}

type recruiter struct {
	ID       primitive.ObjectID `bson:"_id"`
	Name     string             `bson:"name"`
	Company  string             `bson:"company_name"`
	Email    string             `bson:"email"`
	LastSent *time.Time         `bson:"recruiter_digest_at"`
}

// Run sends the summaries that are due and returns how many went out
func (s *Service) Run(ctx context.Context) (int, error) {
	now := s.now()
	if !sendingHours(now) {
		return 0, nil
	}
	today, dayStart, dayEnd := dayOf(now)
	cur, err := s.users.Find(ctx, bson.M{
		"roles":          "recruiter",
		"email":          bson.M{"$exists": true, "$ne": ""},
		"account_status": bson.M{"$nin": []string{"deactivated", "pending_deletion", "deleted", "suspended"}},
		dayField:         bson.M{"$ne": today},
		// Application emails are on unless the employer saved settings with them off
		"$or": []bson.M{
			{"settings.profile_visibility": bson.M{"$in": []interface{}{nil, ""}}},
			{"settings.email_application_updates": true},
		},
	}, options.Find().SetLimit(recruitersRun).SetProjection(bson.M{"name": 1, "company_name": 1, "email": 1, sentField: 1}))
	if err != nil {
		return 0, err
	}
	var list []recruiter
	if err := cur.All(ctx, &list); err != nil {
		return 0, err
	}
	sent := 0
	for _, r := range list {
		// Claim today's summary first, so two servers never both send it
		res, err := s.users.UpdateOne(ctx, bson.M{"_id": r.ID, dayField: bson.M{"$ne": today}}, bson.M{"$set": bson.M{dayField: today}})
		if err != nil {
			return sent, err
		}
		if res.ModifiedCount == 0 {
			continue
		}
		p, err := s.summary(ctx, r, since(now, r.LastSent), dayStart, dayEnd)
		if err != nil {
			s.unclaim(ctx, r.ID)
			return sent, err
		}
		if len(p.NewByJob) > 0 || len(p.Interviews) > 0 {
			if err := s.mailer.SendRecruiterDigest(*p); err != nil {
				log.Printf("[recruiterdigest] send to %s: %v", r.ID.Hex(), err)
				s.unclaim(ctx, r.ID) // tried again next hour
				continue
			}
			sent++
		}
		// Counted from now next time, whether or not there was news today
		if _, err := s.users.UpdateOne(ctx, bson.M{"_id": r.ID}, bson.M{"$set": bson.M{sentField: now}}); err != nil {
			log.Printf("[recruiterdigest] mark %s: %v", r.ID.Hex(), err)
		}
	}
	return sent, nil
}

func (s *Service) unclaim(ctx context.Context, id primitive.ObjectID) {
	if _, err := s.users.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$unset": bson.M{dayField: ""}}); err != nil {
		log.Printf("[recruiterdigest] unclaim %s: %v", id.Hex(), err)
	}
}

// summary gathers one employer's news
func (s *Service) summary(ctx context.Context, r recruiter, from, dayStart, dayEnd time.Time) (*notification.RecruiterDigestParams, error) {
	name := strings.TrimSpace(r.Name)
	if name == "" {
		name = strings.TrimSpace(r.Company)
	}
	p := &notification.RecruiterDigestParams{ToEmail: r.Email, RecruiterName: name, ActionURL: s.siteURL + "/recruiter"}

	// New applicants per job (withdrawn ones left out)
	cur, err := s.applications.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"recruiter_id": r.ID, "created_at": bson.M{"$gte": from}, "status": bson.M{"$ne": "Withdrawn"}}}},
		{{Key: "$group", Value: bson.M{"_id": "$job_id", "n": bson.M{"$sum": 1}}}},
	})
	if err != nil {
		return nil, err
	}
	var perJob []struct {
		JobID primitive.ObjectID `bson:"_id"`
		N     int                `bson:"n"`
	}
	if err := cur.All(ctx, &perJob); err != nil {
		return nil, err
	}

	// Today's interviews
	icur, err := s.interviews.Find(ctx, bson.M{
		"recruiter_id": r.ID, "status": "Scheduled",
		"scheduled_at": bson.M{"$gte": dayStart, "$lt": dayEnd},
	}, options.Find().SetSort(bson.D{{Key: "scheduled_at", Value: 1}}).SetLimit(20))
	if err != nil {
		return nil, err
	}
	var ivs []struct {
		ApplicationID primitive.ObjectID `bson:"application_id"`
		CandidateID   primitive.ObjectID `bson:"candidate_id"`
		ScheduledAt   time.Time          `bson:"scheduled_at"`
	}
	if err := icur.All(ctx, &ivs); err != nil {
		return nil, err
	}

	// Job titles and candidate names in two lookups
	jobIDs := make([]primitive.ObjectID, 0, len(perJob))
	for _, j := range perJob {
		jobIDs = append(jobIDs, j.JobID)
	}
	appIDs := make([]primitive.ObjectID, 0, len(ivs))
	candIDs := make([]primitive.ObjectID, 0, len(ivs))
	for _, iv := range ivs {
		appIDs = append(appIDs, iv.ApplicationID)
		candIDs = append(candIDs, iv.CandidateID)
	}
	appJob := map[primitive.ObjectID]primitive.ObjectID{}
	if len(appIDs) > 0 {
		var apps []struct {
			ID    primitive.ObjectID `bson:"_id"`
			JobID primitive.ObjectID `bson:"job_id"`
		}
		acur, err := s.applications.Find(ctx, bson.M{"_id": bson.M{"$in": appIDs}}, options.Find().SetProjection(bson.M{"job_id": 1}))
		if err != nil {
			return nil, err
		}
		if err := acur.All(ctx, &apps); err != nil {
			return nil, err
		}
		for _, a := range apps {
			appJob[a.ID] = a.JobID
			jobIDs = append(jobIDs, a.JobID)
		}
	}
	titles, err := s.names(ctx, s.jobs, jobIDs, "title")
	if err != nil {
		return nil, err
	}
	people, err := s.names(ctx, s.users, candIDs, "name")
	if err != nil {
		return nil, err
	}

	for _, j := range perJob {
		title := titles[j.JobID]
		if title == "" {
			title = "A job"
		}
		p.NewByJob = append(p.NewByJob, notification.DigestJob{Title: title, Count: j.N})
	}
	sort.SliceStable(p.NewByJob, func(a, b int) bool {
		if p.NewByJob[a].Count != p.NewByJob[b].Count {
			return p.NewByJob[a].Count > p.NewByJob[b].Count
		}
		return p.NewByJob[a].Title < p.NewByJob[b].Title
	})
	if len(p.NewByJob) > 10 {
		p.NewByJob = p.NewByJob[:10]
	}
	for _, iv := range ivs {
		who := people[iv.CandidateID]
		if who == "" {
			who = "A candidate"
		}
		p.Interviews = append(p.Interviews, notification.DigestInterview{At: iv.ScheduledAt, CandidateName: who, JobTitle: titles[appJob[iv.ApplicationID]]})
	}
	return p, nil
}

// names reads one text field for a set of IDs
func (s *Service) names(ctx context.Context, coll *mongo.Collection, ids []primitive.ObjectID, field string) (map[primitive.ObjectID]string, error) {
	out := map[primitive.ObjectID]string{}
	if len(ids) == 0 {
		return out, nil
	}
	cur, err := coll.Find(ctx, bson.M{"_id": bson.M{"$in": ids}}, options.Find().SetProjection(bson.M{field: 1}))
	if err != nil {
		return nil, err
	}
	var rows []bson.M
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		id, _ := row["_id"].(primitive.ObjectID)
		v, _ := row[field].(string)
		out[id] = strings.TrimSpace(v)
	}
	return out, nil
}

// RegisterWorker runs the summary every hour when RECRUITER_DIGEST_ENABLED=true
func RegisterWorker(lc fx.Lifecycle, svc *Service, cfg *config.Config) {
	if !cfg.RecruiterDigestEnabled {
		log.Println("[recruiterdigest] disabled (set RECRUITER_DIGEST_ENABLED=true to send employers' daily summary)")
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(4 * time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						runCtx, stop := context.WithTimeout(ctx, 15*time.Minute)
						if n, err := svc.Run(runCtx); err != nil {
							log.Printf("[recruiterdigest] run: %v", err)
						} else if n > 0 {
							log.Printf("[recruiterdigest] sent %d summary email(s)", n)
						}
						stop()
						timer.Reset(runInterval)
					}
				}
			}()
			return nil
		},
		OnStop: func(stopCtx context.Context) error {
			cancel()
			select {
			case <-done:
			case <-stopCtx.Done():
			}
			return nil
		},
	})
}
