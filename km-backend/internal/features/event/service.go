package event

import (
	"context"
	"errors"
	"fmt"
	"km-backend/internal/common/apperr"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/payment"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type EventServiceImpl struct {
	repo          EventRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	notifService  notification.NotificationService
	cfg           *config.Config
	payments      payment.Service
	tx            database.Transactor
}

func NewEventService(
	repo EventRepository,
	userRepo user.UserRepository,
	walletService wallet.WalletService,
	cfg *config.Config,
	notifService notification.NotificationService,
	payments payment.Service,
	tx database.Transactor,
) EventService {
	s := &EventServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		notifService:  notifService,
		cfg:           cfg,
		payments:      payments,
		tx:            tx,
	}
	payments.Register(payment.PurposeEventTicket, payment.Handlers{
		Fulfill:   s.fulfillTicket,
		AfterPaid: s.afterTicketPaid,
		Revoke:    s.revokeTicket,
	})
	return s
}

func (s *EventServiceImpl) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	return s.repo.CreateEvent(ctx, e)
}

func (s *EventServiceImpl) GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error) {
	return s.repo.GetEvents(ctx, filter)
}

func (s *EventServiceImpl) GetEventByID(ctx context.Context, id string) (*Event, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetEventByID(ctx, objID)
}

func (s *EventServiceImpl) RegisterUser(ctx context.Context, eventID, userID string) error {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return errors.New("invalid event id")
	}
	uID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return errors.New("event not found")
	}

	if ev.IsPaid && ev.Price > 0 {
		return apperr.New("EVENT_IS_PAID", "this is a paid event; please purchase a ticket via Razorpay or Wallet checkout")
	}

	if ev.Capacity > 0 && (ev.AvailableSeats <= 0 || len(ev.Participants) >= ev.Capacity) {
		return errors.New("registration closed: this event has reached maximum capacity")
	}

	// Check if already registered
	for _, p := range ev.Participants {
		if p == uID {
			return apperr.New("EVENT_ALREADY_REGISTERED", "you are already registered for this event")
		}
	}

	// Retrieve user profile details for ticket
	var attendeeName = "Attendee"
	var attendeeEmail = ""
	if u, err := s.userRepo.FindUserByID(ctx, userID); err == nil && u != nil {
		if u.Name != "" {
			attendeeName = u.Name
		}
		attendeeEmail = u.Email
	}

	ticketNumber := fmt.Sprintf("TKT-EVT-%06d", time.Now().Unix()%1000000)
	qrData := fmt.Sprintf("KM:EVENT:%s:%s:%s", ev.ID.Hex(), uID.Hex(), ticketNumber)

	ticket := &EventTicket{
		TicketNumber:  ticketNumber,
		EventID:       evID,
		UserID:        uID,
		AttendeeName:  attendeeName,
		AttendeeEmail: attendeeEmail,
		Amount:        0,
		PaymentStatus: "free",
		PaymentMethod: "free",
		Status:        "confirmed",
		QRCodeData:    qrData,
		EventTitle:    ev.Title,
		EventDate:     ev.Date,
		EventTime:     ev.Time,
		EventLocation: ev.Location,
	}

	_, _ = s.repo.CreateTicket(ctx, ticket)

	if err := s.repo.RegisterUser(ctx, evID, uID); err != nil {
		return err
	}

	if ev.Capacity > 0 {
		_ = s.repo.DecrementAvailableSeats(ctx, evID)
	}

	if s.notifService != nil {
		go func() {
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:   uID,
				Type:     "event_confirmed",
				Category: notification.CategorySystem,
				Title:    "Event Registration Confirmed",
				Message:  fmt.Sprintf("You are registered for %s on %s!", ev.Title, ev.Date),
				Link:     "/events",
				Metadata: map[string]interface{}{
					"event_id":      ev.ID.Hex(),
					"ticket_number": ticketNumber,
				},
			})
		}()
	}

	return nil
}

func (s *EventServiceImpl) GetMyTickets(ctx context.Context, userID string) ([]EventTicket, error) {
	uID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}
	return s.repo.GetTicketsByUser(ctx, uID)
}

func (s *EventServiceImpl) GetEventTicket(ctx context.Context, userID string, eventID string) (*EventTicket, error) {
	uID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, errors.New("invalid event id")
	}
	return s.repo.GetTicketByEventAndUser(ctx, evID, uID)
}

// GetEventAttendees retrieves the attendee list for an event modal (F64)
func (s *EventServiceImpl) GetEventAttendees(ctx context.Context, eventID string) (*EventAttendeesResponse, error) {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, errors.New("invalid event id")
	}

	event, err := s.repo.GetEventByID(ctx, evID)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, errors.New("event not found")
	}

	attendees, err := s.repo.GetEventAttendees(ctx, evID)
	if err != nil {
		return nil, err
	}

	return &EventAttendeesResponse{
		EventID:     event.ID.Hex(),
		EventTitle:  event.Title,
		TotalJoined: len(attendees),
		Attendees:   attendees,
	}, nil
}

// Admin superpower methods

func (s *EventServiceImpl) AdminGetAllEvents(ctx context.Context, search string, page, limit int) ([]AdminEventItem, int64, error) {
	return s.repo.AdminGetAllEvents(ctx, search, page, limit)
}

func (s *EventServiceImpl) AdminGetEventDetail(ctx context.Context, eventID string) (*AdminEventDetailResponse, error) {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, errors.New("invalid event id")
	}
	return s.repo.AdminGetEventDetail(ctx, evID)
}

func (s *EventServiceImpl) AdminCreateEvent(ctx context.Context, e *Event) (*Event, error) {
	if e.Title == "" {
		return nil, errors.New("event title is required")
	}
	if e.Organizer == "" {
		e.Organizer = "KaamMilega Official"
	}
	return s.repo.CreateEvent(ctx, e)
}

func (s *EventServiceImpl) AdminUpdateEvent(ctx context.Context, eventID string, req AdminUpdateEventRequest) (*Event, error) {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, errors.New("invalid event id")
	}
	return s.repo.AdminUpdateEvent(ctx, evID, req)
}

func (s *EventServiceImpl) AdminDeleteEvent(ctx context.Context, eventID string) error {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return errors.New("invalid event id")
	}
	return s.repo.AdminDeleteEvent(ctx, evID)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}


