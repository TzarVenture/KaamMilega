// Package jobalert sends the daily job-alert email: new jobs that match a candidate's city,
// skills and headline, for candidates with settings.email_job_alerts on and a verified email.
package jobalert

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
	"unicode"

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
	maxJobsPerEmail = 5
	usersPerRun     = 500
	// minGap keeps it to one digest a day even though the worker wakes hourly
	minGap = 20 * time.Hour
	// firstLookback bounds the jobs considered for someone's first digest
	firstLookback = 3 * 24 * time.Hour
	runInterval   = time.Hour
	// Emails go out between 08:00 and 21:00 IST only
	sendFromHour, sendUntilHour = 8, 21
)

type candidate struct {
	ID        primitive.ObjectID `bson:"_id"`
	Name      string             `bson:"name"`
	Email     string             `bson:"email"`
	City      string             `bson:"city"`
	Headline  string             `bson:"headline"`
	Skills    []string           `bson:"skills"`
	LastAlert *time.Time         `bson:"job_alerts_last_run_at"`
}

type jobDoc struct {
	ID           primitive.ObjectID `bson:"_id"`
	Title        string             `bson:"title"`
	Company      string             `bson:"company"`
	CityName     string             `bson:"city_name"`
	Location     string             `bson:"location"`
	SalaryMin    int                `bson:"salary_min"`
	SalaryMax    int                `bson:"salary_max"`
	Requirements []string           `bson:"requirements"`
	CreatedAt    time.Time          `bson:"created_at"`
}

type Service struct {
	users  *mongo.Collection
	jobs   *mongo.Collection
	mailer notification.Mailer
	now    func() time.Time
}

func NewService(db *database.MongodbDB, mailer notification.Mailer) *Service {
	return &Service{users: db.DB.Collection("users"), jobs: db.DB.Collection("jobs"), mailer: mailer, now: time.Now}
}

func ist() *time.Location {
	if loc, err := time.LoadLocation("Asia/Kolkata"); err == nil {
		return loc
	}
	return time.FixedZone("IST", 5*3600+1800)
}

// words splits text into lowercase tokens of 3+ letters (skips "a", "of", "&")
func words(s string) []string {
	f := strings.FieldsFunc(strings.ToLower(s), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
	out := f[:0]
	for _, w := range f {
		if len([]rune(w)) >= 3 {
			out = append(out, w)
		}
	}
	return out
}

// score ranks a job for a candidate: 0 means not relevant. Same city counts as much as one
// matching skill, so local jobs surface but a strong skill match elsewhere still qualifies.
func score(c candidate, j jobDoc) int {
	jobText := " " + strings.Join(words(j.Title+" "+strings.Join(j.Requirements, " ")), " ") + " "
	s := 0
	for _, skill := range c.Skills {
		if t := strings.Join(words(skill), " "); t != "" && strings.Contains(jobText, " "+t+" ") {
			s += 2
		}
	}
	for _, w := range words(c.Headline) {
		if strings.Contains(jobText, " "+w+" ") {
			s++
		}
	}
	if s == 0 {
		return 0
	}
	if c.City != "" && strings.EqualFold(strings.TrimSpace(c.City), strings.TrimSpace(j.CityName)) {
		s += 2
	}
	return s
}

func salaryText(min, max int) string {
	inr := func(v int) string {
		s := fmt.Sprintf("%d", v)
		// Indian grouping: 1,20,000
		if len(s) <= 3 {
			return "₹" + s
		}
		head, tail := s[:len(s)-3], s[len(s)-3:]
		var parts []string
		for len(head) > 2 {
			parts = append([]string{head[len(head)-2:]}, parts...)
			head = head[:len(head)-2]
		}
		if head != "" {
			parts = append([]string{head}, parts...)
		}
		return "₹" + strings.Join(parts, ",") + "," + tail
	}
	switch {
	case min > 0 && max > min:
		return inr(min) + " – " + inr(max) + " / month"
	case min > 0:
		return inr(min) + " / month"
	case max > 0:
		return "Up to " + inr(max) + " / month"
	}
	return ""
}

// pick returns the best matching jobs, newest first among equal scores
func pick(c candidate, jobs []jobDoc) []jobDoc {
	type scored struct {
		j jobDoc
		s int
	}
	var list []scored
	for _, j := range jobs {
		if s := score(c, j); s > 0 {
			list = append(list, scored{j, s})
		}
	}
	sort.SliceStable(list, func(a, b int) bool {
		if list[a].s != list[b].s {
			return list[a].s > list[b].s
		}
		return list[a].j.CreatedAt.After(list[b].j.CreatedAt)
	})
	out := []jobDoc{}
	for i := 0; i < len(list) && i < maxJobsPerEmail; i++ {
		out = append(out, list[i].j)
	}
	return out
}

// Run sends due digests. It returns how many emails were sent.
func (s *Service) Run(ctx context.Context) (int, error) {
	now := s.now()
	if h := now.In(ist()).Hour(); h < sendFromHour || h >= sendUntilHour {
		return 0, nil
	}
	cutoff := now.Add(-minGap)
	cur, err := s.users.Find(ctx, bson.M{
		"roles":             "user",
		"is_registered":     true,
		"is_email_verified": true,
		"email":             bson.M{"$exists": true, "$ne": ""},
		// Alerts default to on (the Settings default); only an explicit "off" opts out
		"settings.email_job_alerts": bson.M{"$ne": false},
		"account_status":            bson.M{"$nin": []string{"deactivated", "pending_deletion", "deleted"}},
		"$or": []bson.M{
			{"job_alerts_last_run_at": bson.M{"$exists": false}},
			{"job_alerts_last_run_at": bson.M{"$lte": cutoff}},
		},
	}, options.Find().SetLimit(usersPerRun).SetProjection(bson.M{
		"name": 1, "email": 1, "city": 1, "headline": 1, "skills": 1, "job_alerts_last_run_at": 1,
	}))
	if err != nil {
		return 0, err
	}
	var candidates []candidate
	if err := cur.All(ctx, &candidates); err != nil {
		return 0, err
	}

	sent := 0
	for _, c := range candidates {
		since := now.Add(-firstLookback)
		if c.LastAlert != nil && c.LastAlert.After(since) {
			since = *c.LastAlert
		}
		jobs, err := s.recentJobs(ctx, since)
		if err != nil {
			return sent, err
		}
		matches := pick(c, jobs)
		if len(matches) > 0 {
			items := make([]notification.JobAlertItem, 0, len(matches))
			for _, j := range matches {
				loc := j.CityName
				if loc == "" {
					loc = j.Location
				}
				items = append(items, notification.JobAlertItem{
					Title: j.Title, Company: j.Company, Location: loc,
					Salary: salaryText(j.SalaryMin, j.SalaryMax),
					URL:    "https://kaammilega.com/jobs/" + j.ID.Hex(),
				})
			}
			if err := s.mailer.SendJobAlert(notification.JobAlertParams{ToEmail: c.Email, UserName: c.Name, Jobs: items}); err != nil {
				log.Printf("[jobalert] send to %s: %v", c.ID.Hex(), err)
				continue // retried next run
			}
			sent++
		}
		// Recorded even without matches so the next digest only looks at newer jobs
		if _, err := s.users.UpdateOne(ctx, bson.M{"_id": c.ID}, bson.M{"$set": bson.M{"job_alerts_last_run_at": now}}); err != nil {
			log.Printf("[jobalert] mark %s: %v", c.ID.Hex(), err)
		}
	}
	return sent, nil
}

func (s *Service) recentJobs(ctx context.Context, since time.Time) ([]jobDoc, error) {
	cur, err := s.jobs.Find(ctx, bson.M{
		"created_at":        bson.M{"$gt": since},
		"status":            bson.M{"$nin": []string{"Closed", "closed"}},
		"hidden_by_account": bson.M{"$ne": true},
	}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(300).SetProjection(bson.M{
		"title": 1, "company": 1, "city_name": 1, "location": 1, "salary_min": 1, "salary_max": 1, "requirements": 1, "created_at": 1,
	}))
	if err != nil {
		return nil, err
	}
	var jobs []jobDoc
	err = cur.All(ctx, &jobs)
	return jobs, err
}

// RegisterWorker runs the digest every hour for the app's lifetime, when JOB_ALERTS_ENABLED=true
func RegisterWorker(lc fx.Lifecycle, svc *Service, cfg *config.Config) {
	if !cfg.JobAlertsEnabled {
		log.Println("[jobalert] disabled (set JOB_ALERTS_ENABLED=true to send job-alert emails)")
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(2 * time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						runCtx, stop := context.WithTimeout(ctx, 15*time.Minute)
						if n, err := svc.Run(runCtx); err != nil {
							log.Printf("[jobalert] run: %v", err)
						} else if n > 0 {
							log.Printf("[jobalert] sent %d digest(s)", n)
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
