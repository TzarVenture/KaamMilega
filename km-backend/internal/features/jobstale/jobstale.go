// Package jobstale keeps job search clean. When a job has been open for 30 days, the employer is
// asked (in the app and by email) whether they are still hiring. If they don't tap "Keep it
// open" within 7 days, the job is paused and they are told. They can open it again any time,
// which starts a fresh 30 days.
package jobstale

import (
	"context"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/api"
	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/fx"
)

const (
	OpenDays    = 30
	GraceDays   = 7
	runInterval = 6 * time.Hour
	batch       = 300
	day         = 24 * time.Hour

	remindedField = "stale_reminded_at" // asked whether still hiring
	pausedField   = "stale_paused_at"   // paused for not answering
	renewedField  = "renewed_at"        // tapped Keep it open
)

var ErrJobNotFound = apperr.New("JOB_NOT_FOUND", "this job doesn't exist or isn't yours")

// openStatuses are the stored values that mean a job is open (older jobs may have none)
var openStatuses = []interface{}{"Open", "open", "Active", "active", "", nil}

type Service struct {
	jobs    *mongo.Collection
	users   *mongo.Collection
	mailer  notification.Mailer
	notify  notification.NotificationService
	siteURL string
	now     func() time.Time
}

func NewService(db *database.MongodbDB, mailer notification.Mailer, notify notification.NotificationService, cfg *config.Config) *Service {
	site := strings.TrimRight(strings.TrimSpace(cfg.FrontendURL), "/")
	if site == "" {
		site = "https://kaammilega.com"
	}
	return &Service{
		jobs: db.DB.Collection("jobs"), users: db.DB.Collection("users"),
		mailer: mailer, notify: notify, siteURL: site, now: time.Now,
	}
}

// openSince is true for a job last opened, renewed or reopened before cutoff
func openSince(cutoff time.Time) bson.M {
	return bson.M{"$and": []bson.M{
		{"status": bson.M{"$in": openStatuses}},
		{"hidden_by_account": bson.M{"$ne": true}},
		{"created_at": bson.M{"$lte": cutoff}},
		// Edited, paused or reopened recently: the employer is looking after it
		{"$or": []bson.M{{"updated_at": bson.M{"$exists": false}}, {"updated_at": bson.M{"$lte": cutoff}}}},
		{"$or": []bson.M{{renewedField: bson.M{"$exists": false}}, {renewedField: bson.M{"$lte": cutoff}}}},
		{"$or": []bson.M{{pausedField: bson.M{"$exists": false}}, {pausedField: bson.M{"$lte": cutoff}}}},
	}}
}

// remindQuery finds open jobs past 30 days whose employer hasn't been asked yet
func remindQuery(now time.Time) bson.M {
	q := openSince(now.Add(-OpenDays * day))
	q["$and"] = append(q["$and"].([]bson.M), bson.M{remindedField: bson.M{"$exists": false}})
	return q
}

// noActivitySinceReminder: the employer hasn't edited, paused or reopened the job since being asked
var noActivitySinceReminder = bson.M{"$expr": bson.M{"$lte": bson.A{"$updated_at", "$" + remindedField}}}

// pauseQuery finds open jobs whose reminder went unanswered for 7 days
func pauseQuery(now time.Time) bson.M {
	return bson.M{"$and": []bson.M{
		{"status": bson.M{"$in": openStatuses}},
		{remindedField: bson.M{"$lte": now.Add(-GraceDays * day)}},
		noActivitySinceReminder,
	}}
}

// answeredQuery finds reminded jobs the employer has touched since (edited, paused, reopened):
// that counts as an answer, so the reminder is cleared and a fresh 30 days starts
func answeredQuery() bson.M {
	return bson.M{remindedField: bson.M{"$exists": true}, "$expr": bson.M{"$gt": bson.A{"$updated_at", "$" + remindedField}}}
}

type staleJob struct {
	ID          primitive.ObjectID `bson:"_id"`
	RecruiterID primitive.ObjectID `bson:"recruiter_id"`
	Title       string             `bson:"title"`
	CreatedAt   time.Time          `bson:"created_at"`
	UpdatedAt   *time.Time         `bson:"updated_at"`
	RenewedAt   *time.Time         `bson:"renewed_at"`
	PausedAt    *time.Time         `bson:"stale_paused_at"`
}

// openedAt is when the job was last looked after: posted, edited, reopened or kept open.
// Used for "open for N days" in messages.
func (j staleJob) openedAt() time.Time {
	t := j.CreatedAt
	for _, p := range []*time.Time{j.UpdatedAt, j.RenewedAt, j.PausedAt} {
		if p != nil && p.After(t) {
			t = *p
		}
	}
	return t
}

// Run sends due reminders and pauses unanswered jobs; it returns how many of each
func (s *Service) Run(ctx context.Context) (reminded, paused int, err error) {
	now := s.now()
	proj := options.Find().SetLimit(batch).SetProjection(bson.M{"recruiter_id": 1, "title": 1, "created_at": 1, "updated_at": 1, renewedField: 1, pausedField: 1})

	// Reminders the employer answered by working on the job: clear them, restart the 30 days
	if _, err := s.jobs.UpdateMany(ctx, answeredQuery(), bson.A{
		bson.M{"$set": bson.M{renewedField: "$updated_at"}},
		bson.M{"$unset": remindedField},
	}); err != nil {
		return 0, 0, err
	}

	// Pause next, so a job is never reminded and paused in the same run
	list, err := s.find(ctx, pauseQuery(now), proj)
	if err != nil {
		return 0, 0, err
	}
	for _, j := range list {
		claim := pauseQuery(now)
		claim["_id"] = j.ID
		res, err := s.jobs.UpdateOne(ctx, claim,
			bson.M{"$set": bson.M{"status": "Paused", pausedField: now, "updated_at": now}, "$unset": bson.M{remindedField: ""}})
		if err != nil {
			return reminded, paused, err
		}
		if res.ModifiedCount == 1 {
			paused++
			s.tell(ctx, j, int(now.Sub(j.openedAt())/day), true)
		}
	}

	list, err = s.find(ctx, remindQuery(now), proj)
	if err != nil {
		return reminded, paused, err
	}
	for _, j := range list {
		// Claim it, so two servers never both send the reminder
		res, err := s.jobs.UpdateOne(ctx, bson.M{"_id": j.ID, remindedField: bson.M{"$exists": false}}, bson.M{"$set": bson.M{remindedField: now}})
		if err != nil {
			return reminded, paused, err
		}
		if res.ModifiedCount == 1 {
			reminded++
			s.tell(ctx, j, int(now.Sub(j.openedAt())/day), false)
		}
	}
	return reminded, paused, nil
}

func (s *Service) find(ctx context.Context, q bson.M, opts *options.FindOptions) ([]staleJob, error) {
	cur, err := s.jobs.Find(ctx, q, opts)
	if err != nil {
		return nil, err
	}
	var out []staleJob
	err = cur.All(ctx, &out)
	return out, err
}

// tell sends the employer the in-app notice and, if they keep application emails on, the email
func (s *Service) tell(ctx context.Context, j staleJob, days int, paused bool) {
	link := "/recruiter/jobs/" + j.ID.Hex()
	title, msg := "Is this job still hiring?", j.Title+" has been open for a month. Keep it open, or it will be paused in 7 days."
	if paused {
		title, msg = "Job paused", j.Title+" was paused because it was open for a long time. You can open it again any time."
	}
	if s.notify != nil {
		if _, err := s.notify.CreateNotification(ctx, notification.CreateNotificationRequest{
			UserID: j.RecruiterID, Type: "job_stale", Category: "jobs", Title: title, Message: msg, Link: link,
			Metadata: map[string]interface{}{"job_id": j.ID.Hex()},
		}); err != nil {
			log.Printf("[jobstale] notify %s: %v", j.ID.Hex(), err)
		}
	}
	var u struct {
		Name     string `bson:"name"`
		Email    string `bson:"email"`
		Settings struct {
			Visibility string `bson:"profile_visibility"`
			EmailApps  bool   `bson:"email_application_updates"`
		} `bson:"settings"`
	}
	if err := s.users.FindOne(ctx, bson.M{"_id": j.RecruiterID}, options.FindOne().SetProjection(bson.M{"name": 1, "email": 1, "settings": 1})).Decode(&u); err != nil {
		return
	}
	// Application emails are on unless the employer saved settings with them off
	if u.Email == "" || (u.Settings.Visibility != "" && !u.Settings.EmailApps) {
		return
	}
	if err := s.mailer.SendStaleJob(notification.StaleJobParams{
		ToEmail: u.Email, RecruiterName: u.Name, JobTitle: j.Title, OpenDays: days,
		PauseInDays: GraceDays, Paused: paused, ActionURL: s.siteURL + link,
	}); err != nil {
		log.Printf("[jobstale] email %s: %v", j.ID.Hex(), err)
	}
}

// KeepOpen is the employer's answer: still hiring. A paused job is opened again too.
func (s *Service) KeepOpen(ctx context.Context, jobID, recruiterID primitive.ObjectID) error {
	now := s.now()
	res, err := s.jobs.UpdateOne(ctx,
		bson.M{"_id": jobID, "recruiter_id": recruiterID, "status": bson.M{"$in": append([]interface{}{"Paused", "paused"}, openStatuses...)}},
		bson.M{"$set": bson.M{renewedField: now, "status": "Open", "updated_at": now}, "$unset": bson.M{remindedField: ""}})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrJobNotFound
	}
	return nil
}

// Api: POST /api/jobs/:id/keep-open
type Api struct {
	svc *Service
	cfg *config.Config
}

func NewApi(svc *Service, cfg *config.Config) api.Route { return &Api{svc: svc, cfg: cfg} }

func (a *Api) Setup(app *fiber.App) {
	app.Post("/api/jobs/:id/keep-open", middleware.AuthMiddleware(a.cfg.JWTSecret), middleware.RequireRole("recruiter", "expert", "admin"), func(c *fiber.Ctx) error {
		jobID, err := primitive.ObjectIDFromHex(c.Params("id"))
		if err != nil {
			return apperr.Respond(c, ErrJobNotFound)
		}
		userID, _ := c.Locals("user_id").(string)
		me, _ := primitive.ObjectIDFromHex(userID)
		if err := a.svc.KeepOpen(c.Context(), jobID, me); err != nil {
			return apperr.Respond(c, err)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}

// RegisterWorker runs the check every 6 hours when JOB_STALE_ENABLED=true, starting a few minutes after the server starts
func RegisterWorker(lc fx.Lifecycle, svc *Service, cfg *config.Config) {
	if !cfg.JobStaleEnabled {
		log.Println("[jobstale] disabled (set JOB_STALE_ENABLED=true to ask employers about month-old jobs and pause unanswered ones)")
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(6 * time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						runCtx, stop := context.WithTimeout(ctx, 15*time.Minute)
						if r, p, err := svc.Run(runCtx); err != nil {
							log.Printf("[jobstale] run: %v", err)
						} else if r+p > 0 {
							log.Printf("[jobstale] asked about %d job(s), paused %d", r, p)
						}
						stop()
						timer.Reset(runInterval)
					}
				}
			}()
			return nil
		},
		OnStop: func(context.Context) error {
			cancel()
			<-done
			return nil
		},
	})
}
