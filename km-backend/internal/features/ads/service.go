package ads

import (
	"context"
	"math/rand"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service interface {
	// Pick chooses up to n different campaigns for the slot, or none
	Pick(ctx context.Context, placement, viewer string, who Audience, n int) ([]*Campaign, error)
	// Impression counts a viewable impression; viewer "" (no way to tell people apart) is ignored
	Impression(ctx context.Context, id primitive.ObjectID, viewer string) error
	// Click counts the click and returns where the ad leads
	Click(ctx context.Context, id primitive.ObjectID, viewer string) (string, error)

	Create(ctx context.Context, in *CampaignInput, adminID primitive.ObjectID) (*Campaign, error)
	Update(ctx context.Context, id primitive.ObjectID, in *CampaignInput) (*Campaign, error)
	SetStatus(ctx context.Context, id primitive.ObjectID, status string) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	Get(ctx context.Context, id primitive.ObjectID) (*Campaign, error)
	List(ctx context.Context, search string) ([]*Campaign, error)
	// Daily is the campaign's last n days, oldest first, with empty days filled in
	Daily(ctx context.Context, id primitive.ObjectID, n int) ([]DayStats, error)
	UserCity(ctx context.Context, userID primitive.ObjectID) (string, error)
}

type service struct {
	repo Repository
	now  func() time.Time
	rand *rand.Rand
}

func NewService(repo Repository) Service {
	return &service{repo: repo, now: time.Now, rand: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

func (s *service) Pick(ctx context.Context, placement, viewer string, who Audience, n int) ([]*Campaign, error) {
	now := s.now()
	all, err := s.repo.Candidates(ctx, placement, now)
	if err != nil {
		return nil, err
	}
	fit := make([]*Campaign, 0, len(all))
	for _, c := range all {
		if c.Fits(placement, who, now) {
			fit = append(fit, c)
		}
	}
	if viewer != "" && len(fit) > 0 {
		ids := make([]primitive.ObjectID, len(fit))
		for i, c := range fit {
			ids[i] = c.ID
		}
		shown, err := s.repo.ShownToday(ctx, viewer, dayOf(now), ids)
		if err != nil {
			return nil, err
		}
		fit = underCap(fit, shown)
	}
	return weightedDraw(fit, n, s.rand), nil
}

// underCap drops campaigns the person has already seen as often as their daily cap allows
func underCap(list []*Campaign, shown map[primitive.ObjectID]int) []*Campaign {
	out := list[:0:0]
	for _, c := range list {
		if c.FreqCap > 0 && shown[c.ID] >= c.FreqCap {
			continue
		}
		out = append(out, c)
	}
	return out
}

// weightedDraw takes up to n campaigns without repeats, each draw weighted by priority
func weightedDraw(list []*Campaign, n int, r *rand.Rand) []*Campaign {
	pool := append([]*Campaign(nil), list...)
	out := []*Campaign{}
	for len(out) < n && len(pool) > 0 {
		total := 0
		for _, c := range pool {
			total += weight(c)
		}
		x := r.Intn(total)
		for i, c := range pool {
			x -= weight(c)
			if x < 0 {
				out = append(out, c)
				pool = append(pool[:i], pool[i+1:]...)
				break
			}
		}
	}
	return out
}

func weight(c *Campaign) int {
	if c.Priority < 1 {
		return 1
	}
	return c.Priority
}

func (s *service) Impression(ctx context.Context, id primitive.ObjectID, viewer string) error {
	if viewer == "" {
		return nil
	}
	c, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	now := s.now()
	if c.State(now) != StatusActive {
		return nil
	}
	return s.repo.RecordImpression(ctx, id, viewer, dayOf(now), c.countedPerDay())
}

func (s *service) Click(ctx context.Context, id primitive.ObjectID, viewer string) (string, error) {
	c, err := s.repo.Get(ctx, id)
	if err != nil {
		return "", err
	}
	if viewer != "" {
		// The person still gets to the advertiser if counting fails
		_ = s.repo.RecordClick(ctx, id, viewer, dayOf(s.now()))
	}
	return c.LinkURL, nil
}

func (s *service) Create(ctx context.Context, in *CampaignInput, adminID primitive.ObjectID) (*Campaign, error) {
	now := s.now()
	c, err := in.Campaign(now)
	if err != nil {
		return nil, err
	}
	c.CreatedBy = adminID
	c.CreatedAt = now
	c.UpdatedAt = now
	if err := s.repo.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *service) Update(ctx context.Context, id primitive.ObjectID, in *CampaignInput) (*Campaign, error) {
	existing, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	now := s.now()
	c, err := in.Campaign(now)
	if err != nil {
		return nil, err
	}
	// An edit without a start date keeps the original one
	if in.StartAt == nil || in.StartAt.IsZero() {
		c.StartAt = existing.StartAt
		if c.EndAt != nil && !c.EndAt.After(c.StartAt) {
			return nil, errDates
		}
	}
	c.UpdatedAt = now
	if err := s.repo.Update(ctx, id, c); err != nil {
		return nil, err
	}
	return s.repo.Get(ctx, id)
}

func (s *service) SetStatus(ctx context.Context, id primitive.ObjectID, status string) error {
	if status != StatusActive && status != StatusPaused {
		return errStatus
	}
	return s.repo.SetStatus(ctx, id, status)
}

func (s *service) Delete(ctx context.Context, id primitive.ObjectID) error {
	return s.repo.Delete(ctx, id)
}

func (s *service) Get(ctx context.Context, id primitive.ObjectID) (*Campaign, error) {
	return s.repo.Get(ctx, id)
}

func (s *service) List(ctx context.Context, search string) ([]*Campaign, error) {
	return s.repo.List(ctx, search)
}

func (s *service) Daily(ctx context.Context, id primitive.ObjectID, n int) ([]DayStats, error) {
	now := s.now().In(dayZone)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, dayZone)
	start := today.AddDate(0, 0, -(n - 1))
	rows, err := s.repo.Daily(ctx, id, start.Format(dayLayout))
	if err != nil {
		return nil, err
	}
	byDay := make(map[string]DayStats, len(rows))
	for _, r := range rows {
		byDay[r.Day] = r
	}
	out := make([]DayStats, n)
	for i := 0; i < n; i++ {
		d := start.AddDate(0, 0, i).Format(dayLayout)
		row := byDay[d]
		row.Day = d
		out[i] = row
	}
	return out, nil
}

func (s *service) UserCity(ctx context.Context, userID primitive.ObjectID) (string, error) {
	return s.repo.UserCity(ctx, userID)
}
