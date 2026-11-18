// Package reminder sends the "coming up" notifications: an interview or mentorship session in the next hour,
// an event in the next day, and an InstantMilega pass about to run out. Each reminder goes out
// once (a sent-at field on the booking, ticket or pass records it). Interviews are in MongoDB;
// bookings, tickets and passes are in Postgres.
package reminder

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"km-backend/internal/database"
	"km-backend/internal/features/notification"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

const (
	interval     = 15 * time.Minute
	sessionAhead = time.Hour
	eventAhead   = 24 * time.Hour
	passAhead    = 3 * 24 * time.Hour
	sentField    = "reminder_sent_at"
)

// ist is India time, which event dates and times are written in
var ist = time.FixedZone("IST", 5*3600+1800)

type Service struct {
	pg         *gorm.DB
	interviews *mongo.Collection
	notify     notification.NotificationService
	now        func() time.Time
}

func NewService(db *database.MongodbDB, pg *database.PostgresDB, notify notification.NotificationService) *Service {
	return &Service{
		pg:         pg.DB,
		interviews: db.DB.Collection("interviews"),
		notify:     notify,
		now:        time.Now,
	}
}

// Run sends every reminder that is due and returns how many went out
func (s *Service) Run(ctx context.Context) (int, error) {
	total := 0
	for _, step := range []func(context.Context) (int, error){s.sessions, s.interviewsSoon, s.events, s.expiringPasses} {
		n, err := step(ctx)
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

// claim marks a MongoDB document as reminded; false when another run got there first
func claim(ctx context.Context, coll *mongo.Collection, id primitive.ObjectID, field string, now time.Time) bool {
	res, err := coll.UpdateOne(ctx, bson.M{"_id": id, field: bson.M{"$exists": false}}, bson.M{"$set": bson.M{field: now}})
	return err == nil && res.ModifiedCount == 1
}

func (s *Service) send(ctx context.Context, to primitive.ObjectID, title, msg, link string, meta map[string]interface{}) {
	if _, err := s.notify.CreateNotification(ctx, notification.CreateNotificationRequest{
		UserID: to, Type: notification.TypeReminder, Category: notification.CategorySystem,
		Title: title, Message: msg, Link: link, Metadata: meta,
	}); err != nil {
		log.Printf("[reminder] %s to %s: %v", title, to.Hex(), err)
	}
}

// sessions: confirmed mentorship sessions starting within the hour. The UPDATE claims and reads
// them in one statement, so two overlapping runs can't both send the same reminder.
func (s *Service) sessions(ctx context.Context) (int, error) {
	now := s.now()
	var rows []struct {
		ID          string
		UserID      string
		ExpertID    string
		ScheduledAt time.Time
		Title       string
	}
	err := s.pg.WithContext(ctx).Raw(`UPDATE mentorship_bookings b SET reminder_sent_at = @now
		FROM mentorships m
		WHERE m.id = b.mentorship_id AND b.status = 'confirmed' AND b.reminder_sent_at IS NULL
		  AND b.scheduled_at > @now AND b.scheduled_at <= @until
		RETURNING b.id, b.user_id, b.expert_id, b.scheduled_at, m.title`,
		sql.Named("now", now), sql.Named("until", now.Add(sessionAhead))).Scan(&rows).Error
	if err != nil {
		return 0, err
	}
	for _, b := range rows {
		when := b.ScheduledAt.In(ist).Format("3:04 PM")
		what := "Your mentorship session"
		if b.Title != "" {
			what = "Your session “" + b.Title + "”"
		}
		meta := map[string]interface{}{"booking_id": b.ID}
		s.send(ctx, database.OID(b.UserID), "Session starting soon", what+" starts at "+when+".", "/mentorship/my-sessions", meta)
		s.send(ctx, database.OID(b.ExpertID), "Session starting soon", what+" with your mentee starts at "+when+".", "/expert/mentorship", meta)
	}
	return len(rows), nil
}

func (s *Service) interviewsSoon(ctx context.Context) (int, error) {
	now := s.now()
	cur, err := s.interviews.Find(ctx, bson.M{
		"status":       bson.M{"$in": []string{"Scheduled", "scheduled"}},
		"scheduled_at": bson.M{"$gt": now, "$lte": now.Add(sessionAhead)},
		sentField:      bson.M{"$exists": false},
	})
	if err != nil {
		return 0, err
	}
	var rows []struct {
		ID          primitive.ObjectID `bson:"_id"`
		CandidateID primitive.ObjectID `bson:"candidate_id"`
		RecruiterID primitive.ObjectID `bson:"recruiter_id"`
		At          time.Time          `bson:"scheduled_at"`
		Type        string             `bson:"type"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return 0, err
	}
	n := 0
	for _, iv := range rows {
		if !claim(ctx, s.interviews, iv.ID, sentField, now) {
			continue
		}
		kind := "interview"
		if t := strings.ToLower(strings.TrimSpace(iv.Type)); t != "" {
			kind = t + " interview"
		}
		msg := "Your " + kind + " starts at " + iv.At.In(ist).Format("3:04 PM") + "."
		meta := map[string]interface{}{"interview_id": iv.ID.Hex()}
		s.send(ctx, iv.CandidateID, "Interview starting soon", msg, "/interviews", meta)
		s.send(ctx, iv.RecruiterID, "Interview starting soon", msg, "/recruiter/interviews", meta)
		n++
	}
	return n, nil
}

// events: confirmed tickets for events starting within a day. The date and time come from the
// event itself (not the copy on the ticket), so a rescheduled event is reminded at its new time.
func (s *Service) events(ctx context.Context) (int, error) {
	now := s.now()
	today := now.In(ist)
	days := []string{today.Format("2006-01-02"), today.AddDate(0, 0, 1).Format("2006-01-02")}
	var rows []struct {
		ID       string
		UserID   string
		EventID  string
		Title    string
		Date     string
		Time     string
		Location string
	}
	err := s.pg.WithContext(ctx).Raw(`SELECT t.id, t.user_id, t.event_id, e.title, e.date, e.time, e.location
		FROM event_tickets t JOIN events e ON e.id = t.event_id
		WHERE t.status = 'confirmed' AND t.reminder_sent_at IS NULL AND e.deleted_at IS NULL AND trim(e.date) IN ?`,
		days).Scan(&rows).Error
	if err != nil {
		return 0, err
	}
	n := 0
	for _, t := range rows {
		start, ok := EventStart(t.Date, t.Time)
		if !ok || !start.After(now) || start.Sub(now) > eventAhead {
			continue
		}
		// Claim the ticket; false when another run got there first
		res := s.pg.WithContext(ctx).Exec(`UPDATE event_tickets SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL`, now, t.ID)
		if res.Error != nil || res.RowsAffected != 1 {
			continue
		}
		day := "today"
		if start.In(ist).Format("2006-01-02") != today.Format("2006-01-02") {
			day = "tomorrow"
		}
		msg := fmt.Sprintf("%s is %s at %s", orDefault(t.Title, "Your event"), day, start.In(ist).Format("3:04 PM"))
		if t.Location != "" {
			msg += ", " + t.Location
		}
		s.send(ctx, database.OID(t.UserID), "Event coming up", msg+".", "/events/"+t.EventID, map[string]interface{}{"ticket_id": t.ID})
		n++
	}
	return n, nil
}

// expiringPasses: InstantMilega passes ending within three days, claimed and read in one statement
func (s *Service) expiringPasses(ctx context.Context) (int, error) {
	now := s.now()
	var rows []struct {
		ID             string
		UserID         string
		ExpiresAt      time.Time
		QuotaRemaining int
	}
	err := s.pg.WithContext(ctx).Raw(`UPDATE instant_passes SET expiry_reminder_sent_at = @now
		WHERE has_active_pass AND expiry_reminder_sent_at IS NULL AND expires_at > @now AND expires_at <= @until
		RETURNING id, user_id, expires_at, quota_remaining`,
		sql.Named("now", now), sql.Named("until", now.Add(passAhead))).Scan(&rows).Error
	if err != nil {
		return 0, err
	}
	for _, p := range rows {
		ends := p.ExpiresAt.In(ist).Format("2 Jan")
		msg := "Your InstantMilega pass ends on " + ends + "."
		if p.QuotaRemaining > 0 {
			msg = fmt.Sprintf("Your InstantMilega pass ends on %s with %d jobs left.", ends, p.QuotaRemaining)
		}
		s.send(ctx, database.OID(p.UserID), "Pass ending soon", msg, "/instant-milega", map[string]interface{}{"pass_id": p.ID})
	}
	return len(rows), nil
}

func orDefault(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

// EventStart reads an event's date ("2026-10-25") and time ("19:00" or "7:00 PM") as India
// time. Without a readable time it assumes 10 AM.
func EventStart(date, clock string) (time.Time, bool) {
	day, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(date), ist)
	if err != nil {
		return time.Time{}, false
	}
	clock = strings.ToUpper(strings.TrimSpace(clock))
	for _, layout := range []string{"15:04", "3:04 PM", "03:04 PM", "3:04PM", "3 PM", "3PM"} {
		if t, err := time.Parse(layout, clock); err == nil {
			return day.Add(time.Duration(t.Hour())*time.Hour + time.Duration(t.Minute())*time.Minute), true
		}
	}
	return day.Add(10 * time.Hour), true
}

// RegisterWorker checks for due reminders every 15 minutes
func RegisterWorker(lc fx.Lifecycle, svc *Service) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	run := func() {
		runCtx, stop := context.WithTimeout(ctx, 5*time.Minute)
		defer stop()
		if n, err := svc.Run(runCtx); err != nil {
			log.Printf("[reminder] worker: %v", err)
		} else if n > 0 {
			log.Printf("[reminder] worker: sent %d reminder(s)", n)
		}
	}
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(3 * time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						run()
						timer.Reset(interval)
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
