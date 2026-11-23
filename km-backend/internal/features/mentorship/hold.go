package mentorship

import (
	"context"
	"fmt"
	"log"
	"time"

	"km-backend/internal/common/apperr"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Expert auto-block (client answer Q59): an Expert who gets 10 reviews of 2 stars or less is put
// on hold. Their sessions are hidden and can't be booked until an admin lifts the hold. Bookings
// already made carry on as normal, since the mentees paid for them. After a lift, the count
// starts again from zero.
const (
	lowReviewMaxStars = 2
	lowReviewHoldAt   = 10
)

var (
	ErrExpertOnHold    = apperr.New("EXPERT_ON_HOLD", "this Expert isn't taking bookings right now")
	ErrExpertNotOnHold = apperr.New("EXPERT_NOT_ON_HOLD", "this Expert isn't on hold")
	ErrExpertNotFound  = apperr.New("EXPERT_NOT_FOUND", "Expert not found")
)

// HeldExpert is one row of the admin's list of Experts on hold
type HeldExpert struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	ProfileImage  string    `json:"profile_image,omitempty"`
	HeldAt        time.Time `json:"held_at"`
	LowReviews    int       `json:"low_reviews"` // since the last lift
	RatingAverage float64   `json:"rating_average"`
	RatingCount   int       `json:"rating_count"`
}

// countLowReviews counts reviews of 2 stars or less
func countLowReviews(reviews []Booking) int {
	n := 0
	for _, b := range reviews {
		if b.Rating >= 1 && b.Rating <= lowReviewMaxStars {
			n++
		}
	}
	return n
}

// expertOnHold says whether an Expert is on hold. A lookup error doesn't block a booking.
func (s *MentorshipServiceImpl) expertOnHold(ctx context.Context, expertID primitive.ObjectID) bool {
	if s.userRepo == nil {
		return false
	}
	u, err := s.userRepo.FindUserByID(ctx, expertID.Hex())
	return err == nil && u != nil && u.ExpertHeldAt != nil
}

// checkExpertHold puts the Expert on hold once they reach 10 low reviews since the last lift
func (s *MentorshipServiceImpl) checkExpertHold(ctx context.Context, expertID primitive.ObjectID, lowReviews int) error {
	u, err := s.userRepo.FindUserByID(ctx, expertID.Hex())
	if err != nil || u == nil {
		return err
	}
	if u.ExpertHeldAt != nil || lowReviews-u.ExpertLowReviewBase < lowReviewHoldAt {
		return nil
	}
	held, err := s.userRepo.HoldExpert(ctx, expertID, time.Now())
	if err != nil || !held {
		return err
	}
	log.Printf("expert %s put on hold after %d low reviews", expertID.Hex(), lowReviews-u.ExpertLowReviewBase)
	go s.notify(expertID, nil, "expert_on_hold", "Your sessions are paused",
		fmt.Sprintf("You received %d reviews of %d stars or less, so your sessions are hidden and can't be booked. Sessions already booked go ahead as normal. Our team will review your account.", lowReviewHoldAt, lowReviewMaxStars),
		"/expert/mentorship", "", "")
	return nil
}

// ListHeldExperts returns the Experts on hold for the admin
func (s *MentorshipServiceImpl) ListHeldExperts(ctx context.Context) ([]HeldExpert, error) {
	users, err := s.userRepo.HeldExperts(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]HeldExpert, 0, len(users))
	for _, u := range users {
		low := 0
		if reviews, err := s.repo.GetReviewsByExpertID(ctx, u.ID.Hex()); err == nil {
			low = countLowReviews(reviews) - u.ExpertLowReviewBase
		}
		out = append(out, HeldExpert{
			ID:            u.ID.Hex(),
			Name:          u.Name,
			ProfileImage:  u.ProfileImage,
			HeldAt:        *u.ExpertHeldAt,
			LowReviews:    low,
			RatingAverage: u.RatingAverage,
			RatingCount:   u.RatingCount,
		})
	}
	return out, nil
}

// LiftExpertHold lets an Expert take bookings again. The low reviews so far no longer count.
func (s *MentorshipServiceImpl) LiftExpertHold(ctx context.Context, adminID, expertID string) error {
	eid, err := primitive.ObjectIDFromHex(expertID)
	if err != nil {
		return ErrExpertNotFound
	}
	reviews, err := s.repo.GetReviewsByExpertID(ctx, expertID)
	if err != nil {
		return err
	}
	lifted, err := s.userRepo.LiftExpertHold(ctx, eid, countLowReviews(reviews))
	if err != nil {
		return err
	}
	if !lifted {
		return ErrExpertNotOnHold
	}
	log.Printf("admin %s lifted the hold on expert %s", adminID, expertID)
	go s.notify(eid, nil, "expert_hold_lifted", "Your sessions are live again",
		"Our team reviewed your account. Your sessions are visible and can be booked again.",
		"/expert/mentorship", "", "")
	return nil
}
