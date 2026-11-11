package mentorship

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"km-backend/internal/config"
	"km-backend/internal/features/payment"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

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
	UpdateMeetingLink(ctx context.Context, expertID string, bookingID string, meetingLink string) error

	// Payment & Checkout methods for F76
	BookWithWallet(ctx context.Context, userID string, req BookWithWalletRequest) (*Booking, *wallet.WalletSummaryResponse, error)
	CreateBookingOrder(ctx context.Context, userID string, req CreateMentorshipOrderRequest) (*CreateMentorshipOrderResponse, error)
	VerifyBookingPayment(ctx context.Context, userID string, req VerifyMentorshipPaymentRequest) (*Booking, error)

	// After the session
	ConfirmSession(ctx context.Context, userID string, bookingID string) error
	ReportSession(ctx context.Context, userID string, bookingID string, reason string) error
	GetReportedBookings(ctx context.Context) ([]Booking, error)
	ResolveReport(ctx context.Context, adminID string, bookingID string, req ResolveReportRequest) error
	ReleaseDueSessions(ctx context.Context) (int, error)

	UpdateAvailability(ctx context.Context, expertID string, req []AvailabilityRequest) error
	GetAvailability(ctx context.Context, expertID string) ([]Availability, error)

	SubmitBookingReview(ctx context.Context, userID string, bookingID string, req SubmitBookingReviewRequest) error
	GetMentorshipReviews(ctx context.Context, mentorshipID string) (*MentorshipReviewsResponse, error)
	GetExpertReviews(ctx context.Context, expertID string) (*MentorshipReviewsResponse, error)
}

type MentorshipServiceImpl struct {
	repo          MentorshipRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	notifService  notification.NotificationService
	cfg           *config.Config
	payments      payment.Service
	tx            database.Transactor
}

func NewMentorshipService(
	repo MentorshipRepository, 
	userRepo user.UserRepository, 
	walletService wallet.WalletService, 
	cfg *config.Config,
	notifService notification.NotificationService,
	payments payment.Service,
	tx database.Transactor,
) MentorshipService {
	s := &MentorshipServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		notifService:  notifService,
		cfg:           cfg,
		payments:      payments,
		tx:            tx,
	}
	payments.Register(payment.PurposeMentorshipBooking, payment.Handlers{
		Fulfill:   s.fulfillBooking,
		AfterPaid: s.afterBookingPaid,
	})
	return s
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

	reviewsSummary, _ := s.GetMentorshipReviews(ctx, id)

	return &MentorshipDetail{
		Mentorship: *m,
		Expert: ExpertInfo{
			ID:           u.ID.Hex(),
			Name:         u.Name,
			Headline:     u.Headline,
			ProfileImage: u.ProfileImage,
			Bio:          u.ExpertBio,
			Rating:       m.Rating,
		},
		ReviewsSummary: reviewsSummary,
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
		MentorshipID:  m.ID,
		ExpertID:      m.ExpertID,
		UserID:        uid,
		ScheduledAt:   req.ScheduledAt,
		Status:        "pending",
		Amount:        m.Price,
		PaymentStatus: "pending",
		Notes:         req.Notes,
	}

	created, err := s.repo.CreateBooking(ctx, booking)
	if err != nil {
		return nil, err
	}

	if s.notifService != nil {
		go func() {
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:   m.ExpertID,
				ActorID:  &uid,
				Type:     "mentorship_booked",
				Category: notification.CategorySystem,
				Title:    "New Mentorship Session Booked",
				Message:  fmt.Sprintf("A candidate booked a session for %s", m.Title),
				Link:     "/expert/mentorship",
				Metadata: map[string]interface{}{
					"booking_id":    created.ID.Hex(),
					"mentorship_id": m.ID.Hex(),
				},
			})
		}()
	}

	return created, nil
}

func (s *MentorshipServiceImpl) GetUserBookings(ctx context.Context, userID string) ([]Booking, error) {
	bookings, err := s.repo.ListBookingsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	for i := range bookings {
		if bookings[i].MentorshipTitle == "" && !bookings[i].MentorshipID.IsZero() {
			m, _ := s.repo.GetMentorshipByID(ctx, bookings[i].MentorshipID.Hex())
			if m != nil {
				bookings[i].MentorshipTitle = m.Title
			}
		}
		if !bookings[i].ExpertID.IsZero() {
			u, _ := s.userRepo.FindUserByID(ctx, bookings[i].ExpertID.Hex())
			if u != nil {
				name := strings.TrimSpace(u.Name)
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				bookings[i].ExpertName = name
				bookings[i].ExpertHeadline = u.Headline
				bookings[i].ExpertImage = u.ProfileImage
			}
		}
	}
	return bookings, nil
}

func (s *MentorshipServiceImpl) GetExpertBookings(ctx context.Context, expertID string) ([]Booking, error) {
	bookings, err := s.repo.ListBookingsByExpert(ctx, expertID)
	if err != nil {
		return nil, err
	}
	for i := range bookings {
		if bookings[i].MentorshipTitle == "" && !bookings[i].MentorshipID.IsZero() {
			m, _ := s.repo.GetMentorshipByID(ctx, bookings[i].MentorshipID.Hex())
			if m != nil {
				bookings[i].MentorshipTitle = m.Title
			}
		}
		if bookings[i].MenteeName == "" && !bookings[i].UserID.IsZero() {
			u, _ := s.userRepo.FindUserByID(ctx, bookings[i].UserID.Hex())
			if u != nil {
				name := strings.TrimSpace(u.Name)
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				bookings[i].MenteeName = name
				bookings[i].MenteeEmail = u.Email
			}
		}
	}
	return bookings, nil
}

func (s *MentorshipServiceImpl) UpdateMeetingLink(ctx context.Context, expertID string, bookingID string, meetingLink string) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return errors.New("booking not found")
	}
	if b.ExpertID.Hex() != expertID {
		return errors.New("unauthorized: caller is not the session expert")
	}
	return s.repo.UpdateMeetingLink(ctx, bookingID, meetingLink)
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

func (s *MentorshipServiceImpl) SubmitBookingReview(ctx context.Context, userID string, bookingID string, req SubmitBookingReviewRequest) error {
	booking, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || booking == nil {
		return errors.New("booking not found")
	}

	if booking.UserID.Hex() != userID {
		return errors.New("unauthorized to review this booking")
	}

	if booking.Status != "completed" {
		return errors.New("can only review completed sessions")
	}

	if req.Rating < 1 || req.Rating > 5 {
		return errors.New("rating must be between 1 and 5")
	}

	if err := s.repo.UpdateBookingReview(ctx, bookingID, req.Rating, req.Review); err != nil {
		return err
	}

	_ = s.recalculateMentorshipRating(ctx, booking.MentorshipID.Hex())
	return nil
}

func (s *MentorshipServiceImpl) recalculateMentorshipRating(ctx context.Context, mentorshipID string) error {
	bookings, err := s.repo.GetReviewsByMentorshipID(ctx, mentorshipID)
	if err != nil {
		return err
	}

	var totalReviews int
	var sumRating float64
	for _, b := range bookings {
		if b.Rating >= 1 && b.Rating <= 5 {
			totalReviews++
			sumRating += b.Rating
		}
	}

	var avgRating float64
	if totalReviews > 0 {
		avgRating = math.Round((sumRating/float64(totalReviews))*10) / 10
	}

	return s.repo.UpdateMentorshipRatingStats(ctx, mentorshipID, avgRating, totalReviews)
}

func (s *MentorshipServiceImpl) GetMentorshipReviews(ctx context.Context, mentorshipID string) (*MentorshipReviewsResponse, error) {
	bookings, err := s.repo.GetReviewsByMentorshipID(ctx, mentorshipID)
	if err != nil {
		return nil, err
	}
	return s.buildReviewsResponse(ctx, bookings)
}

func (s *MentorshipServiceImpl) GetExpertReviews(ctx context.Context, expertID string) (*MentorshipReviewsResponse, error) {
	bookings, err := s.repo.GetReviewsByExpertID(ctx, expertID)
	if err != nil {
		return nil, err
	}
	return s.buildReviewsResponse(ctx, bookings)
}

func (s *MentorshipServiceImpl) buildReviewsResponse(ctx context.Context, bookings []Booking) (*MentorshipReviewsResponse, error) {
	resp := &MentorshipReviewsResponse{
		Reviews: make([]ReviewItem, 0),
	}

	var sumRating float64
	for _, b := range bookings {
		if b.Rating < 1 || b.Rating > 5 {
			continue
		}

		resp.TotalReviews++
		sumRating += b.Rating

		intRating := int(math.Round(b.Rating))
		switch intRating {
		case 5:
			resp.Distribution.FiveStar++
		case 4:
			resp.Distribution.FourStar++
		case 3:
			resp.Distribution.ThreeStar++
		case 2:
			resp.Distribution.TwoStar++
		case 1:
			resp.Distribution.OneStar++
		}

		item := ReviewItem{
			ID:              b.ID,
			BookingID:       b.ID,
			MenteeID:        b.UserID,
			MenteeName:      b.MenteeName,
			MentorshipTitle: b.MentorshipTitle,
			Rating:          b.Rating,
			Review:          b.Review,
			CreatedAt:       b.UpdatedAt,
		}
		if item.CreatedAt.IsZero() {
			item.CreatedAt = b.CreatedAt
		}

		if (item.MenteeName == "" || item.MenteeAvatar == "") && !b.UserID.IsZero() && s.userRepo != nil {
			if u, _ := s.userRepo.FindUserByID(ctx, b.UserID.Hex()); u != nil {
				name := strings.TrimSpace(u.Name)
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				if item.MenteeName == "" {
					item.MenteeName = name
				}
				if item.MenteeAvatar == "" {
					item.MenteeAvatar = u.ProfileImage
				}
				if item.MenteeHeadline == "" {
					item.MenteeHeadline = u.Headline
				}
			}
		}

		resp.Reviews = append(resp.Reviews, item)
	}

	if resp.TotalReviews > 0 {
		resp.AverageRating = math.Round((sumRating/float64(resp.TotalReviews))*10) / 10
	}

	return resp, nil
}

