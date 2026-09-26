package event

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type EventServiceImpl struct {
	repo          EventRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	cfg           *config.Config
	httpClient    *http.Client
}

func NewEventService(
	repo EventRepository,
	userRepo user.UserRepository,
	walletService wallet.WalletService,
	cfg *config.Config,
) EventService {
	return &EventServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		cfg:           cfg,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
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
		return errors.New("this is a paid event; please purchase a ticket via Razorpay or Wallet checkout")
	}

	if ev.Capacity > 0 && (ev.AvailableSeats <= 0 || len(ev.Participants) >= ev.Capacity) {
		return errors.New("registration closed: this event has reached maximum capacity")
	}

	// Check if already registered
	for _, p := range ev.Participants {
		if p == uID {
			return errors.New("you are already registered for this event")
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

	return nil
}

func (s *EventServiceImpl) CreateEventOrder(ctx context.Context, userID string, eventID string, req CreateEventOrderRequest) (*CreateEventOrderResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, errors.New("invalid event id")
	}

	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return nil, errors.New("event not found")
	}

	if !ev.IsPaid || ev.Price <= 0 {
		return nil, errors.New("this is a free event; please use free registration")
	}

	if ev.Capacity > 0 && (ev.AvailableSeats <= 0 || len(ev.Participants) >= ev.Capacity) {
		return nil, errors.New("sold out: event has reached maximum capacity")
	}

	uID, _ := primitive.ObjectIDFromHex(userID)
	existingTicket, _ := s.repo.GetTicketByEventAndUser(ctx, evID, uID)
	if existingTicket != nil {
		return nil, errors.New("you already have a confirmed ticket for this event")
	}

	keyID := s.cfg.RazorpayKeyID
	keySecret := s.cfg.RazorpayKeySecret
	if keyID == "" || keySecret == "" {
		return nil, errors.New("razorpay credentials not configured on platform")
	}

	amountPaise := int64(ev.Price * 100)
	receiptID := fmt.Sprintf("evt_%s_%d", eventID[:min(6, len(eventID))], time.Now().Unix()%1000000)

	payload := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  receiptID,
		"notes": map[string]interface{}{
			"user_id":     userID,
			"event_id":    eventID,
			"event_title": ev.Title,
			"purpose":     "event_ticket",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode razorpay order request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach razorpay api: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read razorpay response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order creation failed (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var rzpOrder struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(respBytes, &rzpOrder); err != nil {
		return nil, fmt.Errorf("failed to decode razorpay response: %w", err)
	}

	return &CreateEventOrderResponse{
		OrderID:     rzpOrder.ID,
		Amount:      ev.Price,
		AmountPaise: amountPaise,
		Currency:    "INR",
		KeyID:       keyID,
		EventTitle:  ev.Title,
	}, nil
}

func (s *EventServiceImpl) VerifyEventPayment(ctx context.Context, userID string, eventID string, req VerifyEventPaymentRequest) (*EventTicket, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	if req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" || req.RazorpaySignature == "" {
		return nil, errors.New("missing razorpay payment verification fields")
	}

	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, errors.New("invalid event id")
	}

	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return nil, errors.New("event not found")
	}

	keySecret := s.cfg.RazorpayKeySecret
	if keySecret == "" {
		return nil, errors.New("razorpay credentials not configured")
	}

	// Verify HMAC-SHA256 signature
	data := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
	h := hmac.New(sha256.New, []byte(keySecret))
	h.Write([]byte(data))
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(req.RazorpaySignature)) {
		return nil, errors.New("invalid payment signature: razorpay verification failed")
	}

	uID, _ := primitive.ObjectIDFromHex(userID)

	// Check if already ticketed
	existingTicket, _ := s.repo.GetTicketByEventAndUser(ctx, evID, uID)
	if existingTicket != nil {
		return existingTicket, nil
	}

	// Attendee details fallback
	attendeeName := req.AttendeeName
	attendeeEmail := req.AttendeeEmail
	if attendeeName == "" || attendeeEmail == "" {
		if u, err := s.userRepo.FindUserByID(ctx, userID); err == nil && u != nil {
			if attendeeName == "" {
				attendeeName = u.Name
			}
			if attendeeEmail == "" {
				attendeeEmail = u.Email
			}
		}
	}

	ticketNumber := fmt.Sprintf("TKT-EVT-%06d", time.Now().Unix()%1000000)
	qrData := fmt.Sprintf("KM:EVENT:%s:%s:%s", ev.ID.Hex(), uID.Hex(), ticketNumber)

	ticket := &EventTicket{
		TicketNumber:      ticketNumber,
		EventID:           evID,
		UserID:            uID,
		AttendeeName:      attendeeName,
		AttendeeEmail:     attendeeEmail,
		AttendeePhone:     req.AttendeePhone,
		Amount:            ev.Price,
		PaymentStatus:     "paid",
		PaymentMethod:     "razorpay",
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		Status:            "confirmed",
		QRCodeData:        qrData,
		EventTitle:        ev.Title,
		EventDate:         ev.Date,
		EventTime:         ev.Time,
		EventLocation:     ev.Location,
	}

	created, err := s.repo.CreateTicket(ctx, ticket)
	if err != nil {
		return nil, fmt.Errorf("failed to issue ticket: %w", err)
	}

	_ = s.repo.RegisterUser(ctx, evID, uID)
	if ev.Capacity > 0 {
		_ = s.repo.DecrementAvailableSeats(ctx, evID)
	}

	return created, nil
}

func (s *EventServiceImpl) BookTicketWithWallet(ctx context.Context, userID string, eventID string, req EventWalletCheckoutRequest) (*EventTicket, *wallet.WalletSummaryResponse, error) {
	if userID == "" {
		return nil, nil, errors.New("unauthorized: missing user id")
	}

	evID, err := primitive.ObjectIDFromHex(eventID)
	if err != nil {
		return nil, nil, errors.New("invalid event id")
	}

	ev, err := s.repo.GetEventByID(ctx, evID)
	if err != nil || ev == nil {
		return nil, nil, errors.New("event not found")
	}

	if !ev.IsPaid || ev.Price <= 0 {
		return nil, nil, errors.New("this is a free event; please use free registration")
	}

	if ev.Capacity > 0 && (ev.AvailableSeats <= 0 || len(ev.Participants) >= ev.Capacity) {
		return nil, nil, errors.New("sold out: event has reached maximum capacity")
	}

	uID, _ := primitive.ObjectIDFromHex(userID)
	existingTicket, _ := s.repo.GetTicketByEventAndUser(ctx, evID, uID)
	if existingTicket != nil {
		return nil, nil, errors.New("you already have a confirmed ticket for this event")
	}

	// 1. Verify user wallet balance
	walletSummary, err := s.walletService.GetWalletSummary(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch wallet summary: %w", err)
	}

	if walletSummary.MainBalance < ev.Price {
		return nil, nil, fmt.Errorf("insufficient wallet balance: ticket costs ₹%.2f, available balance is ₹%.2f", ev.Price, walletSummary.MainBalance)
	}

	// 2. Prepare Attendee info
	attendeeName := req.AttendeeName
	attendeeEmail := req.AttendeeEmail
	if attendeeName == "" || attendeeEmail == "" {
		if u, err := s.userRepo.FindUserByID(ctx, userID); err == nil && u != nil {
			if attendeeName == "" {
				attendeeName = u.Name
			}
			if attendeeEmail == "" {
				attendeeEmail = u.Email
			}
		}
	}

	ticketNumber := fmt.Sprintf("TKT-EVT-%06d", time.Now().Unix()%1000000)
	qrData := fmt.Sprintf("KM:EVENT:%s:%s:%s", ev.ID.Hex(), uID.Hex(), ticketNumber)

	ticket := &EventTicket{
		TicketNumber:  ticketNumber,
		EventID:       evID,
		UserID:        uID,
		AttendeeName:  attendeeName,
		AttendeeEmail: attendeeEmail,
		AttendeePhone: req.AttendeePhone,
		Amount:        ev.Price,
		PaymentStatus: "paid",
		PaymentMethod: "wallet",
		Status:        "confirmed",
		QRCodeData:    qrData,
		EventTitle:    ev.Title,
		EventDate:     ev.Date,
		EventTime:     ev.Time,
		EventLocation: ev.Location,
	}

	created, err := s.repo.CreateTicket(ctx, ticket)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create ticket: %w", err)
	}

	// 3. Atomically debit user wallet main balance via ledger
	debitInput := wallet.RecordTransactionInput{
		UserID:        uID,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceMain,
		Category:      wallet.CategoryEventTicket,
		Amount:        ev.Price,
		ReferenceID:   created.ID.Hex() + "_evt",
		Description:   fmt.Sprintf("Event Ticket: %s", ev.Title),
		Metadata: map[string]interface{}{
			"ticket_id":     created.ID.Hex(),
			"ticket_number": ticketNumber,
			"event_id":      eventID,
			"event_title":   ev.Title,
		},
	}

	_, updatedSummary, err := s.walletService.RecordTransaction(ctx, debitInput)
	if err != nil {
		return nil, nil, fmt.Errorf("wallet debit failed: %w", err)
	}

	// 4. Add user to event participants & decrement available seats
	_ = s.repo.RegisterUser(ctx, evID, uID)
	if ev.Capacity > 0 {
		_ = s.repo.DecrementAvailableSeats(ctx, evID)
	}

	return created, updatedSummary, nil
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
