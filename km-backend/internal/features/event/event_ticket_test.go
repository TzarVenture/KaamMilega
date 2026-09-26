package event

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Mock event repository
type mockEventRepo struct {
	events  map[string]*Event
	tickets map[string]*EventTicket
}

func newMockEventRepo() *mockEventRepo {
	return &mockEventRepo{
		events:  make(map[string]*Event),
		tickets: make(map[string]*EventTicket),
	}
}

func (m *mockEventRepo) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	if e.ID.IsZero() {
		e.ID = primitive.NewObjectID()
	}
	if e.Capacity > 0 && e.AvailableSeats == 0 && len(e.Participants) == 0 {
		e.AvailableSeats = e.Capacity
	}
	if e.Participants == nil {
		e.Participants = []primitive.ObjectID{}
	}
	m.events[e.ID.Hex()] = e
	return e, nil
}

func (m *mockEventRepo) GetEvents(ctx context.Context, filter EventFilter) ([]Event, int64, error) {
	var list []Event
	for _, e := range m.events {
		if filter.IsPaid != nil && e.IsPaid != *filter.IsPaid {
			continue
		}
		list = append(list, *e)
	}
	return list, int64(len(list)), nil
}

func (m *mockEventRepo) GetEventByID(ctx context.Context, id primitive.ObjectID) (*Event, error) {
	e, ok := m.events[id.Hex()]
	if !ok {
		return nil, errors.New("not found")
	}
	return e, nil
}

func (m *mockEventRepo) RegisterUser(ctx context.Context, eventID, userID primitive.ObjectID) error {
	e, ok := m.events[eventID.Hex()]
	if !ok {
		return errors.New("event not found")
	}
	e.Participants = append(e.Participants, userID)
	return nil
}

func (m *mockEventRepo) DecrementAvailableSeats(ctx context.Context, eventID primitive.ObjectID) error {
	e, ok := m.events[eventID.Hex()]
	if !ok {
		return errors.New("event not found")
	}
	if e.Capacity > 0 && e.AvailableSeats > 0 {
		e.AvailableSeats--
	}
	return nil
}

func (m *mockEventRepo) CreateTicket(ctx context.Context, ticket *EventTicket) (*EventTicket, error) {
	if ticket.ID.IsZero() {
		ticket.ID = primitive.NewObjectID()
	}
	m.tickets[ticket.ID.Hex()] = ticket
	return ticket, nil
}

func (m *mockEventRepo) GetTicketByID(ctx context.Context, id primitive.ObjectID) (*EventTicket, error) {
	t, ok := m.tickets[id.Hex()]
	if !ok {
		return nil, errors.New("ticket not found")
	}
	return t, nil
}

func (m *mockEventRepo) GetTicketByEventAndUser(ctx context.Context, eventID, userID primitive.ObjectID) (*EventTicket, error) {
	for _, t := range m.tickets {
		if t.EventID == eventID && t.UserID == userID && t.Status == "confirmed" {
			return t, nil
		}
	}
	return nil, nil
}

func (m *mockEventRepo) GetTicketsByUser(ctx context.Context, userID primitive.ObjectID) ([]EventTicket, error) {
	var list []EventTicket
	for _, t := range m.tickets {
		if t.UserID == userID && t.Status == "confirmed" {
			list = append(list, *t)
		}
	}
	return list, nil
}

func (m *mockEventRepo) GetTicketsByEvent(ctx context.Context, eventID primitive.ObjectID) ([]EventTicket, error) {
	var list []EventTicket
	for _, t := range m.tickets {
		if t.EventID == eventID && t.Status == "confirmed" {
			list = append(list, *t)
		}
	}
	return list, nil
}

// Mock User Repo
type mockUserRepo struct {
	user.UserRepository
	users map[string]*user.User
}

func (m *mockUserRepo) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	u, ok := m.users[id]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

// Mock Wallet Service
type mockWalletService struct {
	wallet.WalletService
	wallets map[string]*wallet.WalletSummaryResponse
}

func (w *mockWalletService) GetWalletSummary(ctx context.Context, userID string) (*wallet.WalletSummaryResponse, error) {
	sum, ok := w.wallets[userID]
	if !ok {
		sum = &wallet.WalletSummaryResponse{
			UserID:      userID,
			MainBalance: 0,
		}
		w.wallets[userID] = sum
	}
	return sum, nil
}

func (w *mockWalletService) RecordTransaction(ctx context.Context, input wallet.RecordTransactionInput) (*wallet.TransactionItemResponse, *wallet.WalletSummaryResponse, error) {
	uid := input.UserID.Hex()
	sum, _ := w.GetWalletSummary(ctx, uid)

	if input.Type == wallet.TypeDebit {
		if sum.MainBalance < input.Amount {
			return nil, nil, errors.New("insufficient balance")
		}
		sum.MainBalance -= input.Amount
		sum.TotalBalance -= input.Amount
	} else if input.Type == wallet.TypeCredit {
		sum.MainBalance += input.Amount
		sum.TotalBalance += input.Amount
	}

	tx := &wallet.TransactionItemResponse{
		ID:            primitive.NewObjectID().Hex(),
		WalletID:      uid,
		Type:          input.Type,
		TargetBalance: input.TargetBalance,
		Category:      input.Category,
		Amount:        input.Amount,
		Status:        wallet.StatusCompleted,
		ReferenceID:   input.ReferenceID,
		Description:   input.Description,
		CreatedAt:     time.Now(),
	}
	return tx, sum, nil
}

// -----------------------------------------------------------------------
// Test Cases
// -----------------------------------------------------------------------

func TestEvent_FreeRegistration(t *testing.T) {
	ctx := context.Background()
	repo := newMockEventRepo()
	userRepo := &mockUserRepo{users: make(map[string]*user.User)}
	walletSvc := &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
	cfg := &config.Config{}

	svc := NewEventService(repo, userRepo, walletSvc, cfg)

	// Create Free Event
	ev, _ := repo.CreateEvent(ctx, &Event{
		Title:          "Free Intro to Web Development",
		Organizer:      "KaamMilega Community",
		Date:           "2026-10-15",
		Time:           "18:00",
		Location:       "Online (Google Meet)",
		IsPaid:         false,
		Price:          0,
		Capacity:       100,
		AvailableSeats: 100,
	})

	userID := primitive.NewObjectID().Hex()
	userRepo.users[userID] = &user.User{
		Name:  "Test Attendee",
		Email: "attendee@example.com",
	}

	// Register user
	err := svc.RegisterUser(ctx, ev.ID.Hex(), userID)
	if err != nil {
		t.Fatalf("expected successful registration, got: %v", err)
	}

	// Verify participant added and seats decremented
	updatedEv, _ := repo.GetEventByID(ctx, ev.ID)
	if len(updatedEv.Participants) != 1 {
		t.Errorf("expected 1 participant, got %d", len(updatedEv.Participants))
	}
	if updatedEv.AvailableSeats != 99 {
		t.Errorf("expected 99 available seats, got %d", updatedEv.AvailableSeats)
	}

	// Verify duplicate registration rejection
	errDup := svc.RegisterUser(ctx, ev.ID.Hex(), userID)
	if errDup == nil {
		t.Errorf("expected duplicate registration error, got nil")
	}
}

func TestEvent_PaidEventRejectsFreeRegistration(t *testing.T) {
	ctx := context.Background()
	repo := newMockEventRepo()
	userRepo := &mockUserRepo{users: make(map[string]*user.User)}
	walletSvc := &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
	cfg := &config.Config{}

	svc := NewEventService(repo, userRepo, walletSvc, cfg)

	// Create Paid Event
	ev, _ := repo.CreateEvent(ctx, &Event{
		Title:          "Advanced System Design Masterclass",
		Organizer:      "Tech Masters",
		Date:           "2026-10-20",
		Time:           "11:00",
		Location:       "Bangalore Tech Park",
		IsPaid:         true,
		Price:          499.0,
		Capacity:       50,
		AvailableSeats: 50,
	})

	userID := primitive.NewObjectID().Hex()
	err := svc.RegisterUser(ctx, ev.ID.Hex(), userID)
	if err == nil {
		t.Fatalf("expected paid event to reject free registration, got nil")
	}
}

func TestEvent_WalletCheckout_InsufficientFunds(t *testing.T) {
	ctx := context.Background()
	repo := newMockEventRepo()
	userRepo := &mockUserRepo{users: make(map[string]*user.User)}
	walletSvc := &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
	cfg := &config.Config{}

	svc := NewEventService(repo, userRepo, walletSvc, cfg)

	ev, _ := repo.CreateEvent(ctx, &Event{
		Title:          "Fullstack AI Masterclass",
		IsPaid:         true,
		Price:          399.0,
		Capacity:       50,
		AvailableSeats: 50,
	})

	userID := primitive.NewObjectID().Hex()
	walletSvc.wallets[userID] = &wallet.WalletSummaryResponse{
		MainBalance: 100.0, // Insufficient (needs 399)
	}

	_, _, err := svc.BookTicketWithWallet(ctx, userID, ev.ID.Hex(), EventWalletCheckoutRequest{
		AttendeeName:  "Dev Candidate",
		AttendeeEmail: "dev@example.com",
	})
	if err == nil {
		t.Fatalf("expected insufficient balance error, got nil")
	}
}

func TestEvent_WalletCheckout_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockEventRepo()
	userRepo := &mockUserRepo{users: make(map[string]*user.User)}
	walletSvc := &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
	cfg := &config.Config{}

	svc := NewEventService(repo, userRepo, walletSvc, cfg)

	ev, _ := repo.CreateEvent(ctx, &Event{
		Title:          "DevOps & Kubernetes Workshop",
		Organizer:      "Cloud Experts",
		Date:           "2026-11-05",
		Time:           "10:00",
		Location:       "Online (Zoom)",
		IsPaid:         true,
		Price:          299.0,
		Capacity:       30,
		AvailableSeats: 30,
	})

	userID := primitive.NewObjectID().Hex()
	userObjID, _ := primitive.ObjectIDFromHex(userID)
	walletSvc.wallets[userID] = &wallet.WalletSummaryResponse{
		UserID:      userID,
		MainBalance: 1000.0, // Sufficient
	}

	ticket, updatedWallet, err := svc.BookTicketWithWallet(ctx, userID, ev.ID.Hex(), EventWalletCheckoutRequest{
		AttendeeName:  "Jane Dev",
		AttendeeEmail: "jane@gmail.com",
		AttendeePhone: "9876543210",
	})
	if err != nil {
		t.Fatalf("expected successful ticket booking, got: %v", err)
	}

	// Assertions
	if ticket.PaymentStatus != "paid" || ticket.PaymentMethod != "wallet" {
		t.Errorf("unexpected ticket payment state: %+v", ticket)
	}
	if ticket.Amount != 299.0 {
		t.Errorf("expected amount 299, got %.2f", ticket.Amount)
	}
	if ticket.TicketNumber == "" || ticket.QRCodeData == "" {
		t.Errorf("expected generated ticket number and QR data, got empty")
	}
	if updatedWallet.MainBalance != 701.0 { // 1000 - 299 = 701
		t.Errorf("expected updated wallet balance ₹701, got ₹%.2f", updatedWallet.MainBalance)
	}

	// Verify participant and seats
	updatedEv, _ := repo.GetEventByID(ctx, ev.ID)
	if len(updatedEv.Participants) != 1 || updatedEv.Participants[0] != userObjID {
		t.Errorf("expected participant added to event")
	}
	if updatedEv.AvailableSeats != 29 {
		t.Errorf("expected 29 seats remaining, got %d", updatedEv.AvailableSeats)
	}

	// Verify ticket retrieval
	myTickets, err := svc.GetMyTickets(ctx, userID)
	if err != nil || len(myTickets) != 1 {
		t.Errorf("expected 1 ticket in GetMyTickets, got %d", len(myTickets))
	}

	singleTicket, err := svc.GetEventTicket(ctx, userID, ev.ID.Hex())
	if err != nil || singleTicket == nil || singleTicket.TicketNumber != ticket.TicketNumber {
		t.Errorf("expected ticket match in GetEventTicket")
	}
}

func TestEvent_RazorpayPaymentVerification(t *testing.T) {
	ctx := context.Background()
	repo := newMockEventRepo()
	userRepo := &mockUserRepo{users: make(map[string]*user.User)}
	walletSvc := &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
	secret := "test_secret_key_12345"
	cfg := &config.Config{RazorpayKeySecret: secret}

	svc := NewEventService(repo, userRepo, walletSvc, cfg)

	ev, _ := repo.CreateEvent(ctx, &Event{
		Title:          "Data Science Hackathon Pass",
		IsPaid:         true,
		Price:          199.0,
		Capacity:       100,
		AvailableSeats: 100,
	})

	userID := primitive.NewObjectID().Hex()
	orderID := "order_evt_998877"
	paymentID := "pay_evt_112233"

	// Calculate valid HMAC-SHA256 signature
	data := orderID + "|" + paymentID
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	validSig := hex.EncodeToString(h.Sum(nil))

	// Invalid signature test
	_, errInvalid := svc.VerifyEventPayment(ctx, userID, ev.ID.Hex(), VerifyEventPaymentRequest{
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		RazorpaySignature: "invalid_sig_abc",
	})
	if errInvalid == nil {
		t.Errorf("expected signature verification failure, got nil")
	}

	// Valid signature test
	ticket, errValid := svc.VerifyEventPayment(ctx, userID, ev.ID.Hex(), VerifyEventPaymentRequest{
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		RazorpaySignature: validSig,
		AttendeeName:      "Alex Data",
		AttendeeEmail:     "alex@datascience.com",
	})
	if errValid != nil {
		t.Fatalf("expected payment verification success, got: %v", errValid)
	}

	if ticket.PaymentStatus != "paid" || ticket.PaymentMethod != "razorpay" {
		t.Errorf("unexpected ticket payment status: %+v", ticket)
	}
	if ticket.RazorpayPaymentID != paymentID || ticket.RazorpayOrderID != orderID {
		t.Errorf("unexpected razorpay reference IDs")
	}
}

func TestEvent_CapacitySoldOut(t *testing.T) {
	ctx := context.Background()
	repo := newMockEventRepo()
	userRepo := &mockUserRepo{users: make(map[string]*user.User)}
	walletSvc := &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
	cfg := &config.Config{}

	svc := NewEventService(repo, userRepo, walletSvc, cfg)

	ev, _ := repo.CreateEvent(ctx, &Event{
		Title:          "Exclusive VIP Workshop",
		IsPaid:         true,
		Price:          999.0,
		Capacity:       1,
		AvailableSeats: 0, // Sold out
		Participants:   []primitive.ObjectID{primitive.NewObjectID()},
	})

	userID := primitive.NewObjectID().Hex()
	walletSvc.wallets[userID] = &wallet.WalletSummaryResponse{MainBalance: 5000.0}

	_, _, err := svc.BookTicketWithWallet(ctx, userID, ev.ID.Hex(), EventWalletCheckoutRequest{
		AttendeeName:  "VIP Attendee",
		AttendeeEmail: "vip@example.com",
	})
	if err == nil {
		t.Fatalf("expected sold out error, got nil")
	}
}
