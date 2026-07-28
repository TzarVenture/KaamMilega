package mentorship

import (
	"context"
	"errors"

	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MentorshipService interface {
	CreateMentorship(ctx context.Context, expertID string, req CreateMentorshipRequest) (*Mentorship, error)
	ListMentorships(ctx context.Context, category string) ([]MentorshipDetail, error)
	GetMentorship(ctx context.Context, id string) (*MentorshipDetail, error)
	GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error)
	UpdateMentorship(ctx context.Context, expertID string, id string, req CreateMentorshipRequest) (*Mentorship, error)
	DeleteMentorship(ctx context.Context, expertID string, id string) error

	BookSession(ctx context.Context, userID string, req BookMentorshipRequest) (*Booking, error)
	GetUserBookings(ctx context.Context, userID string) ([]Booking, error)
	GetExpertBookings(ctx context.Context, expertID string) ([]Booking, error)
	UpdateBookingStatus(ctx context.Context, expertID string, bookingID string, status string) error

	UpdateAvailability(ctx context.Context, expertID string, req []AvailabilityRequest) error
	GetAvailability(ctx context.Context, expertID string) ([]Availability, error)
}

type MentorshipServiceImpl struct {
	repo     MentorshipRepository
	userRepo user.UserRepository
}

func NewMentorshipService(repo MentorshipRepository, userRepo user.UserRepository) MentorshipService {
	return &MentorshipServiceImpl{
		repo:     repo,
		userRepo: userRepo,
	}
}

func (s *MentorshipServiceImpl) CreateMentorship(ctx context.Context, expertID string, req CreateMentorshipRequest) (*Mentorship, error) {
	eid, _ := primitive.ObjectIDFromHex(expertID)
	m := &Mentorship{
		ExpertID:    eid,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Duration:    req.Duration,
		Price:       req.Price,
		Status:      "active",
	}
	return s.repo.CreateMentorship(ctx, m)
}

func (s *MentorshipServiceImpl) ListMentorships(ctx context.Context, category string) ([]MentorshipDetail, error) {
	ms, err := s.repo.ListMentorships(ctx, category)
	if err != nil {
		return nil, err
	}

	var details []MentorshipDetail
	for _, m := range ms {
		u, _ := s.userRepo.FindUserByID(ctx, m.ExpertID.Hex())
		if u != nil {
			details = append(details, MentorshipDetail{
				Mentorship: m,
				Expert: ExpertInfo{
					ID:           u.ID.Hex(),
					Name:         u.Name,
					Headline:     u.Headline,
					ProfileImage: u.ProfileImage,
					Bio:          u.ExpertBio,
				},
			})
		}
	}
	return details, nil
}

func (s *MentorshipServiceImpl) GetMentorship(ctx context.Context, id string) (*MentorshipDetail, error) {
	m, err := s.repo.GetMentorshipByID(ctx, id)
	if err != nil || m == nil {
		return nil, err
	}

	u, _ := s.userRepo.FindUserByID(ctx, m.ExpertID.Hex())
	if u == nil {
		return nil, errors.New("expert not found")
	}

	return &MentorshipDetail{
		Mentorship: *m,
		Expert: ExpertInfo{
			ID:           u.ID.Hex(),
			Name:         u.Name,
			Headline:     u.Headline,
			ProfileImage: u.ProfileImage,
			Bio:          u.ExpertBio,
		},
	}, nil
}

func (s *MentorshipServiceImpl) GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error) {
	return s.repo.GetMentorshipsByExpert(ctx, expertID)
}

func (s *MentorshipServiceImpl) UpdateMentorship(ctx context.Context, expertID string, id string, req CreateMentorshipRequest) (*Mentorship, error) {
	m, err := s.repo.GetMentorshipByID(ctx, id)
	if err != nil || m == nil {
		return nil, err
	}
	if m.ExpertID.Hex() != expertID {
		return nil, errors.New("unauthorized")
	}

	m.Title = req.Title
	m.Description = req.Description
	m.Category = req.Category
	m.Duration = req.Duration
	m.Price = req.Price

	return s.repo.UpdateMentorship(ctx, id, m)
}

func (s *MentorshipServiceImpl) DeleteMentorship(ctx context.Context, expertID string, id string) error {
	m, err := s.repo.GetMentorshipByID(ctx, id)
	if err != nil || m == nil {
		return err
	}
	if m.ExpertID.Hex() != expertID {
		return errors.New("unauthorized")
	}
	return s.repo.DeleteMentorship(ctx, id)
}

func (s *MentorshipServiceImpl) BookSession(ctx context.Context, userID string, req BookMentorshipRequest) (*Booking, error) {
	m, err := s.repo.GetMentorshipByID(ctx, req.MentorshipID)
	if err != nil || m == nil {
		return nil, errors.New("mentorship not found")
	}

	uid, _ := primitive.ObjectIDFromHex(userID)
	booking := &Booking{
		MentorshipID: m.ID,
		ExpertID:     m.ExpertID,
		UserID:       uid,
		ScheduledAt:  req.ScheduledAt,
		Status:       "pending",
		Notes:        req.Notes,
	}

	return s.repo.CreateBooking(ctx, booking)
}

func (s *MentorshipServiceImpl) GetUserBookings(ctx context.Context, userID string) ([]Booking, error) {
	return s.repo.ListBookingsByUser(ctx, userID)
}

func (s *MentorshipServiceImpl) GetExpertBookings(ctx context.Context, expertID string) ([]Booking, error) {
	return s.repo.ListBookingsByExpert(ctx, expertID)
}

func (s *MentorshipServiceImpl) UpdateBookingStatus(ctx context.Context, expertID string, bookingID string, status string) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return errors.New("booking not found")
	}
	if b.ExpertID.Hex() != expertID {
		return errors.New("unauthorized")
	}
	return s.repo.UpdateBookingStatus(ctx, bookingID, status)
}

func (s *MentorshipServiceImpl) UpdateAvailability(ctx context.Context, expertID string, req []AvailabilityRequest) error {
	var avails []Availability
	for _, a := range req {
		avails = append(avails, Availability{
			DayOfWeek: a.DayOfWeek,
			StartTime: a.StartTime,
			EndTime:   a.EndTime,
			IsActive:  true,
		})
	}
	return s.repo.UpdateAvailability(ctx, expertID, avails)
}

func (s *MentorshipServiceImpl) GetAvailability(ctx context.Context, expertID string) ([]Availability, error) {
	return s.repo.GetAvailabilityByExpert(ctx, expertID)
}
