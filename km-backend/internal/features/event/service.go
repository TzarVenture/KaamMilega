package event

import (
	"context"
	"errors"
	"fmt"
	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"log"
	"net/url"
	"strings"

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
		return ErrEventNotFound
	}
	uID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return errNoUser
	}

	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return ErrEventNotFound
	}

	if ev.IsPaid && ev.Price > 0 {
		return apperr.New("EVENT_IS_PAID", "this is a paid event; please purchase a ticket via Razorpay or Wallet checkout")
	}

	if ev.Capacity > 0 && (ev.AvailableSeats <= 0 || len(ev.Participants) >= ev.Capacity) {
		return ErrEventSoldOut
	}

	// Check if already registered
	for _, p := range ev.Participants {
		if p == uID {
			return ErrAlreadyRegistered
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

	// Built from the ticket's own id, so it is unique (the time-based number could repeat)
	ticketID := primitive.NewObjectID()
	ticketNumber := "TKT-EVT-" + strings.ToUpper(ticketID.Hex()[18:])
	qrData := fmt.Sprintf("KM:EVENT:%s:%s:%s", ev.ID.Hex(), uID.Hex(), ticketNumber)

	ticket := &EventTicket{
		ID:            ticketID,
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

	// The seat, the ticket and the registration are saved together or not at all
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		if ev.Capacity > 0 {
			if err := s.repo.DecrementAvailableSeats(ctx, evID); err != nil {
				return err
			}
		}
		if _, err := s.repo.CreateTicket(ctx, ticket); err != nil {
			return err
		}
		return s.repo.RegisterUser(ctx, evID, uID)
	})
	switch {
	case errors.Is(err, ErrEventSoldOut):
		return ErrEventSoldOut
	case errors.Is(err, ErrEventTicketTaken):
		return ErrAlreadyRegistered
	case err != nil:
		return err
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
		return nil, errNoUser
	}
	return s.repo.GetTicketsByUser(ctx, uID)
}

func (s *EventServiceImpl) GetEventTicket(ctx context.Context, userID string, eventID string) (*EventTicket, error) {
	uID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errNoUser
	}
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, ErrEventNotFound
	}
	ticket, err := s.repo.GetTicketByEventAndUser(ctx, evID, uID)
	if err != nil || ticket == nil {
		return ticket, err
	}
	// The joining link is only ever handed out with a ticket
	if ev, evErr := s.repo.GetEventByID(ctx, evID); evErr == nil && ev != nil {
		ticket.MeetingLink = ev.MeetingLink
	}
	return ticket, nil
}

// validateMeetingLink accepts an empty link or a full https:// URL
func validateMeetingLink(link string) error {
	if link == "" {
		return nil
	}
	u, err := url.Parse(strings.TrimSpace(link))
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return ErrMeetingLink
	}
	return nil
}

// GetEventAttendees retrieves the attendee list for an event modal (F64)
func (s *EventServiceImpl) GetEventAttendees(ctx context.Context, eventID string) (*EventAttendeesResponse, error) {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, ErrEventNotFound
	}

	event, err := s.repo.GetEventByID(ctx, evID)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, ErrEventNotFound
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
		return nil, ErrEventNotFound
	}
	return s.repo.AdminGetEventDetail(ctx, evID)
}

func (s *EventServiceImpl) AdminCreateEvent(ctx context.Context, e *Event) (*Event, error) {
	if e.Title == "" {
		return nil, ErrEventFieldsMissing
	}
	if err := validateMeetingLink(e.MeetingLink); err != nil {
		return nil, err
	}
	if e.Organizer == "" {
		e.Organizer = "KaamMilega Official"
	}
	return s.repo.CreateEvent(ctx, e)
}

func (s *EventServiceImpl) AdminUpdateEvent(ctx context.Context, eventID string, req AdminUpdateEventRequest) (*Event, error) {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, ErrEventNotFound
	}
	if req.MeetingLink != nil {
		trimmed := strings.TrimSpace(*req.MeetingLink)
		if err := validateMeetingLink(trimmed); err != nil {
			return nil, err
		}
		req.MeetingLink = &trimmed
	}
	return s.repo.AdminUpdateEvent(ctx, evID, req)
}

// AdminDeleteEvent hides an event, cancels its tickets and refunds every paid one, in one
// transaction: a wallet payment goes back to the wallet, a card or UPI payment is queued for a
// Razorpay refund. Queued refunds are sent after the commit; the recovery job retries failures.
func (s *EventServiceImpl) AdminDeleteEvent(ctx context.Context, eventID string) error {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return ErrEventNotFound
	}
	var cancelled []EventTicket
	var cardRefunds []string
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		cardRefunds = nil
		if cancelled, err = s.repo.AdminDeleteEvent(ctx, evID); err != nil {
			return err
		}
		for i := range cancelled {
			queued, err := s.refundTicket(ctx, &cancelled[i])
			if err != nil {
				return err
			}
			if queued {
				cardRefunds = append(cardRefunds, cancelled[i].RazorpayOrderID)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	for _, orderID := range cardRefunds {
		if err := s.payments.ProcessRefundByRazorpayOrder(ctx, orderID); err != nil {
			log.Printf("[event] deleted event %s: refund for order %s will be retried: %v", eventID, orderID, err)
		}
	}
	for i := range cancelled {
		s.notifyCancelled(&cancelled[i])
	}
	return nil
}

// refundTicket pays back a cancelled ticket. It reports whether a card or UPI refund was queued,
// which the caller sends once the transaction has committed. Call inside a transaction.
func (s *EventServiceImpl) refundTicket(ctx context.Context, t *EventTicket) (bool, error) {
	paise := money.ToPaise(t.Amount)
	if paise <= 0 {
		return false, nil
	}
	switch t.PaymentMethod {
	case "razorpay":
		_, err := s.payments.MarkRefundDue(ctx, t.RazorpayOrderID, paise, "Event cancelled")
		if errors.Is(err, payment.ErrNotRefundable) {
			return false, nil // already refunded or on its way
		}
		return err == nil, err
	case "wallet":
		// A partial dispute refund already paid some of it back
		already, err := s.repo.SettleTicketDispute(ctx, t.ID)
		if err != nil {
			return false, err
		}
		if paise -= already; paise <= 0 {
			return false, nil
		}
		_, _, err = s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
			UserID:        t.UserID,
			Type:          wallet.TypeCredit,
			TargetBalance: wallet.BalanceMain,
			Category:      wallet.CategoryRefund,
			Amount:        money.ToRupees(paise),
			ReferenceID:   "ticket:" + t.ID.Hex() + ":refund",
			Description:   "Refund: " + t.EventTitle + " was cancelled",
			Metadata: map[string]interface{}{
				"ticket_id":     t.ID.Hex(),
				"ticket_number": t.TicketNumber,
				"event_id":      t.EventID.Hex(),
			},
		})
		if errors.Is(err, wallet.ErrClosed) {
			// The member deleted their account; there is no wallet to pay into
			log.Printf("[event] ticket %s: wallet closed, refund of ₹%.2f needs manual handling", t.TicketNumber, money.ToRupees(paise))
			t.PaymentStatus = "paid"
			return false, s.repo.KeepTicketPaid(ctx, t.ID)
		}
		return false, err
	}
	return false, nil
}

func (s *EventServiceImpl) notifyCancelled(t *EventTicket) {
	if s.notifService == nil {
		return
	}
	message := fmt.Sprintf("%s has been cancelled.", t.EventTitle)
	if money.ToPaise(t.Amount) > 0 && t.PaymentMethod == "wallet" {
		message += " Your ticket money is back in your wallet."
	} else if money.ToPaise(t.Amount) > 0 {
		message += " Your refund is on its way to your original payment method."
	}
	go func() {
		_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
			UserID:   t.UserID,
			Type:     "event_cancelled",
			Category: notification.CategorySystem,
			Title:    "Event cancelled",
			Message:  message,
			Link:     "/events",
			Metadata: map[string]interface{}{"event_id": t.EventID.Hex(), "ticket_number": t.TicketNumber},
		})
	}()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}


