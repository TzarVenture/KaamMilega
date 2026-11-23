package mentorship

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// holdUsers keeps member profiles in memory for the auto-block rules
type holdUsers struct {
	user.UserRepository
	users map[primitive.ObjectID]*user.User
}

func (h *holdUsers) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	oid, _ := primitive.ObjectIDFromHex(id)
	if u, ok := h.users[oid]; ok {
		copy := *u
		return &copy, nil
	}
	return nil, nil
}

func (h *holdUsers) SetRatingSummary(ctx context.Context, id primitive.ObjectID, average float64, count int) error {
	return nil
}

func (h *holdUsers) HoldExpert(ctx context.Context, id primitive.ObjectID, at time.Time) (bool, error) {
	u := h.users[id]
	if u.ExpertHeldAt != nil {
		return false, nil
	}
	u.ExpertHeldAt = &at
	return true, nil
}

func (h *holdUsers) LiftExpertHold(ctx context.Context, id primitive.ObjectID, low int) (bool, error) {
	u := h.users[id]
	if u.ExpertHeldAt == nil {
		return false, nil
	}
	u.ExpertHeldAt = nil
	u.ExpertLowReviewBase = low
	return true, nil
}

func (h *holdUsers) HeldExperts(ctx context.Context) ([]*user.User, error) {
	var out []*user.User
	for _, u := range h.users {
		if u.ExpertHeldAt != nil {
			out = append(out, u)
		}
	}
	return out, nil
}

type holdFixture struct {
	*fixture
	users   *holdUsers
	session *Mentorship
}

func newHoldFixture() *holdFixture {
	f := newFixture()
	users := &holdUsers{users: map[primitive.ObjectID]*user.User{
		f.expert: {ID: f.expert, Name: "Expert"},
		f.mentee: {ID: f.mentee, Name: "Mentee"},
	}}
	f.svc = NewMentorshipService(f.repo, users, f.wallets, &config.Config{}, nil, f.payments, database.NoopTransactor{})
	session, _ := f.repo.CreateMentorship(f.ctx, &Mentorship{ExpertID: f.expert, Title: "Career talk", Price: 500})
	return &holdFixture{fixture: f, users: users, session: session}
}

// review adds a completed session with this rating
func (h *holdFixture) review(stars float64) {
	b, _ := h.repo.CreateBooking(h.ctx, &Booking{
		MentorshipID: h.session.ID, ExpertID: h.expert, UserID: h.mentee, Status: BookingCompleted,
	})
	if err := h.svc.SubmitBookingReview(h.ctx, h.mentee.Hex(), b.ID.Hex(), SubmitBookingReviewRequest{Rating: stars}); err != nil {
		panic(err)
	}
}

func (h *holdFixture) held() bool { return h.users.users[h.expert].ExpertHeldAt != nil }

func (h *holdFixture) listed() bool {
	list, _ := h.svc.ListMentorships(h.ctx, "")
	return len(list) == 1
}

func TestExpertIsHeldAfterTenLowReviews(t *testing.T) {
	h := newHoldFixture()
	for i := 0; i < 9; i++ {
		h.review(2)
	}
	h.review(5) // good reviews don't count
	if h.held() || !h.listed() {
		t.Fatal("held after 9 low reviews")
	}
	h.review(1)
	if !h.held() {
		t.Fatal("not held after 10 low reviews")
	}
	if h.listed() {
		t.Fatal("a held Expert's session is still listed")
	}
	_, _, err := h.svc.BookWithWallet(h.ctx, primitive.NewObjectID().Hex(), BookWithWalletRequest{
		MentorshipID: h.session.ID.Hex(), ScheduledAt: time.Now().Add(time.Hour),
	})
	if !errors.Is(err, ErrExpertOnHold) {
		t.Fatalf("booking a held Expert: got %v", err)
	}
	held, _ := h.svc.ListHeldExperts(h.ctx)
	if len(held) != 1 || held[0].LowReviews != 10 {
		t.Fatalf("admin list = %+v", held)
	}
}

func TestLiftedExpertStartsCountingAgain(t *testing.T) {
	h := newHoldFixture()
	for i := 0; i < 10; i++ {
		h.review(1)
	}
	if err := h.svc.LiftExpertHold(h.ctx, primitive.NewObjectID().Hex(), h.expert.Hex()); err != nil {
		t.Fatal(err)
	}
	if h.held() || !h.listed() {
		t.Fatal("still held after the lift")
	}
	if err := h.svc.LiftExpertHold(h.ctx, "", h.expert.Hex()); !errors.Is(err, ErrExpertNotOnHold) {
		t.Fatalf("second lift: got %v", err)
	}
	for i := 0; i < 9; i++ {
		h.review(2)
	}
	if h.held() {
		t.Fatal("old low reviews counted again after the lift")
	}
	h.review(2)
	if !h.held() {
		t.Fatal("not held after 10 new low reviews")
	}
}
