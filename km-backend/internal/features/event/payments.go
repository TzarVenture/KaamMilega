package event

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrEventSoldOut     = apperr.New("EVENT_SOLD_OUT", "sold out: event has reached maximum capacity")
	ErrEventTicketTaken = apperr.New("EVENT_TICKET_EXISTS", "you already have a confirmed ticket for this event")
	ErrEventIsFree      = apperr.New("EVENT_IS_FREE", "this is a free event; please use free registration")
	ErrEventNotFound    = apperr.New("EVENT_NOT_FOUND", "event not found")
)

type attendee struct {
	Name  string
	Email string
	Phone string
}

// sellableEvent loads a paid event and checks this user can still buy a ticket.
func (s *EventServiceImpl) sellableEvent(ctx context.Context, uid primitive.ObjectID, eventID string) (*Event, error) {
	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, ErrEventNotFound
	}
	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return nil, ErrEventNotFound
	}
	if !ev.IsPaid || money.ToPaise(ev.Price) <= 0 {
		return nil, ErrEventIsFree
	}
	if ev.Capacity > 0 && (ev.AvailableSeats <= 0 || len(ev.Participants) >= ev.Capacity) {
		return nil, ErrEventSoldOut
	}
	if existing, _ := s.repo.GetTicketByEventAndUser(ctx, evID, uid); existing != nil {
		return nil, ErrEventTicketTaken
	}
	return ev, nil
}

func (s *EventServiceImpl) resolveAttendee(ctx context.Context, userID, name, email, phone string) attendee {
	if name == "" || email == "" {
		if u, err := s.userRepo.FindUserByID(ctx, userID); err == nil && u != nil {
			if name == "" {
				name = u.Name
			}
			if email == "" {
				email = u.Email
			}
		}
	}
	return attendee{Name: name, Email: email, Phone: phone}
}

// issueTicket claims a seat and writes the ticket. Inside a transaction, two buyers racing for
// the last seat collide on the event document and only one gets it.
func (s *EventServiceImpl) issueTicket(ctx context.Context, ev *Event, uid primitive.ObjectID, who attendee, method, orderID, paymentID string) (*EventTicket, error) {
	if existing, _ := s.repo.GetTicketByEventAndUser(ctx, ev.ID, uid); existing != nil {
		return nil, ErrEventTicketTaken
	}
	if ev.Capacity > 0 {
		if err := s.repo.DecrementAvailableSeats(ctx, ev.ID); err != nil {
			return nil, err
		}
	}

	id := primitive.NewObjectID()
	ticketNumber := "TKT-EVT-" + strings.ToUpper(id.Hex()[18:])
	created, err := s.repo.CreateTicket(ctx, &EventTicket{
		ID:                id,
		TicketNumber:      ticketNumber,
		EventID:           ev.ID,
		UserID:            uid,
		AttendeeName:      who.Name,
		AttendeeEmail:     who.Email,
		AttendeePhone:     who.Phone,
		Amount:            ev.Price,
		PaymentStatus:     "paid",
		PaymentMethod:     method,
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		Status:            "confirmed",
		QRCodeData:        fmt.Sprintf("KM:EVENT:%s:%s:%s", ev.ID.Hex(), uid.Hex(), ticketNumber),
		EventTitle:        ev.Title,
		EventDate:         ev.Date,
		EventTime:         ev.Time,
		EventLocation:     ev.Location,
	})
	if err != nil {
		return nil, fmt.Errorf("creating ticket: %w", err)
	}
	if err := s.repo.RegisterUser(ctx, ev.ID, uid); err != nil {
		return nil, err
	}
	return created, nil
}

func (s *EventServiceImpl) notifyTicket(t *EventTicket) {
	if s.notifService == nil {
		return
	}
	_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID:   t.UserID,
		Type:     "event_confirmed",
		Category: notification.CategorySystem,
		Title:    "Event ticket confirmed",
		Message:  fmt.Sprintf("Your ticket (%s) for %s is confirmed", t.TicketNumber, t.EventTitle),
		Link:     "/events",
		Metadata: map[string]interface{}{"event_id": t.EventID.Hex(), "ticket_number": t.TicketNumber},
	})
}

// CreateEventOrder opens a checkout for one ticket at the event's current price
func (s *EventServiceImpl) CreateEventOrder(ctx context.Context, userID string, eventID string, req CreateEventOrderRequest) (*CreateEventOrderResponse, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, apperr.New("UNAUTHORIZED", "unauthorized: missing user id")
	}
	ev, err := s.sellableEvent(ctx, uid, eventID)
	if err != nil {
		return nil, err
	}

	who := s.resolveAttendee(ctx, userID, req.AttendeeName, req.AttendeeEmail, req.AttendeePhone)
	checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
		UserID:      uid,
		Purpose:     payment.PurposeEventTicket,
		AmountPaise: money.ToPaise(ev.Price),
		TargetID:    ev.ID.Hex(),
		Description: "Ticket: " + ev.Title,
		Details:     map[string]string{"attendee_name": who.Name, "attendee_email": who.Email, "attendee_phone": who.Phone},
	})
	if err != nil {
		return nil, err
	}

	return &CreateEventOrderResponse{
		OrderID:     checkout.OrderID,
		Amount:      checkout.Amount,
		AmountPaise: checkout.AmountPaise,
		Currency:    checkout.Currency,
		KeyID:       checkout.KeyID,
		EventTitle:  ev.Title,
	}, nil
}

func (s *EventServiceImpl) fulfillTicket(ctx context.Context, order *payment.Order) error {
	evID, err := primitive.ObjectIDFromHex(order.TargetID)
	if err != nil {
		return payment.Unfulfillable("This event could not be found")
	}
	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return payment.Unfulfillable("This event is no longer available")
	}
	// The ticket costs what was paid, even if the price has changed since the order was opened
	ev.Price = order.Amount()

	who := attendee{Name: order.Details["attendee_name"], Email: order.Details["attendee_email"], Phone: order.Details["attendee_phone"]}
	_, err = s.issueTicket(ctx, ev, order.UserID, who, "razorpay", order.RazorpayOrderID, order.RazorpayPaymentID)
	switch {
	case errors.Is(err, ErrEventSoldOut):
		return payment.Unfulfillable("This event sold out before your payment arrived")
	case errors.Is(err, ErrEventTicketTaken):
		return payment.Unfulfillable("You already have a ticket for this event")
	}
	return err
}

func (s *EventServiceImpl) afterTicketPaid(order *payment.Order) {
	evID, err := primitive.ObjectIDFromHex(order.TargetID)
	if err != nil {
		return
	}
	if t, _ := s.repo.GetTicketByEventAndUser(context.Background(), evID, order.UserID); t != nil {
		s.notifyTicket(t)
	}
}

// revokeTicket cancels a refunded ticket and gives the seat back
func (s *EventServiceImpl) revokeTicket(ctx context.Context, order *payment.Order) error {
	evID, err := primitive.ObjectIDFromHex(order.TargetID)
	if err != nil {
		return err
	}
	return s.repo.RevokeTicket(ctx, evID, order.UserID, order.RazorpayOrderID)
}

// VerifyEventPayment confirms a checkout and returns the ticket it bought
func (s *EventServiceImpl) VerifyEventPayment(ctx context.Context, userID string, eventID string, req VerifyEventPaymentRequest) (*EventTicket, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, apperr.New("UNAUTHORIZED", "unauthorized: missing user id")
	}
	order, err := s.payments.Confirm(ctx, uid, payment.PurposeEventTicket, payment.ConfirmInput{
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		RazorpaySignature: req.RazorpaySignature,
	})
	if err != nil {
		return nil, err
	}
	evID, err := primitive.ObjectIDFromHex(order.TargetID)
	if err != nil {
		return nil, ErrEventNotFound
	}
	return s.repo.GetTicketByEventAndUser(ctx, evID, uid)
}

// BookTicketWithWallet charges the wallet and issues the ticket as one step
func (s *EventServiceImpl) BookTicketWithWallet(ctx context.Context, userID string, eventID string, req EventWalletCheckoutRequest) (*EventTicket, *wallet.WalletSummaryResponse, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, nil, apperr.New("UNAUTHORIZED", "unauthorized: missing user id")
	}
	ev, err := s.sellableEvent(ctx, uid, eventID)
	if err != nil {
		return nil, nil, err
	}
	who := s.resolveAttendee(ctx, userID, req.AttendeeName, req.AttendeeEmail, req.AttendeePhone)

	var created *EventTicket
	var summary *wallet.WalletSummaryResponse
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if created, err = s.issueTicket(ctx, ev, uid, who, "wallet", "", ""); err != nil {
			return err
		}
		_, summary, err = s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
			UserID:        uid,
			Type:          wallet.TypeDebit,
			TargetBalance: wallet.BalanceMain,
			Category:      wallet.CategoryEventTicket,
			Amount:        ev.Price,
			ReferenceID:   "ticket:" + created.ID.Hex() + ":pay",
			Description:   "Event ticket: " + ev.Title,
			Metadata: map[string]interface{}{
				"ticket_id":     created.ID.Hex(),
				"ticket_number": created.TicketNumber,
				"event_id":      ev.ID.Hex(),
				"event_title":   ev.Title,
			},
		})
		return err
	})
	if err != nil {
		return nil, nil, err
	}

	go s.notifyTicket(created)
	return created, summary, nil
}
