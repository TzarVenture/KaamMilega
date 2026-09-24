package mentorship

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type mockMentorshipRepo struct {
	bookings       map[string]*Booking
	mentorships    map[string]*Mentorship
	availabilities map[string][]Availability
}

func newMockMentorshipRepo() *mockMentorshipRepo {
	return &mockMentorshipRepo{
		bookings:       make(map[string]*Booking),
		mentorships:    make(map[string]*Mentorship),
		availabilities: make(map[string][]Availability),
	}
}

func (m *mockMentorshipRepo) CreateMentorship(ctx context.Context, mentorship *Mentorship) (*Mentorship, error) {
	if mentorship.ID.IsZero() {
		mentorship.ID = primitive.NewObjectID()
	}
	m.mentorships[mentorship.ID.Hex()] = mentorship
	return mentorship, nil
}

func (m *mockMentorshipRepo) GetMentorshipByID(ctx context.Context, id string) (*Mentorship, error) {
	ment, ok := m.mentorships[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return ment, nil
}

func (m *mockMentorshipRepo) ListMentorships(ctx context.Context, category string) ([]Mentorship, error) {
	var list []Mentorship
	for _, v := range m.mentorships {
		list = append(list, *v)
	}
	return list, nil
}

func (m *mockMentorshipRepo) GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error) {
	var list []Mentorship
	for _, v := range m.mentorships {
		if v.ExpertID.Hex() == expertID {
			list = append(list, *v)
		}
	}
	return list, nil
}

func (m *mockMentorshipRepo) UpdateMentorship(ctx context.Context, id string, mentorship *Mentorship) (*Mentorship, error) {
	m.mentorships[id] = mentorship
	return mentorship, nil
}

func (m *mockMentorshipRepo) DeleteMentorship(ctx context.Context, id string) error {
	delete(m.mentorships, id)
	return nil
}

func (m *mockMentorshipRepo) CreateBooking(ctx context.Context, booking *Booking) (*Booking, error) {
	if booking.ID.IsZero() {
		booking.ID = primitive.NewObjectID()
	}
	m.bookings[booking.ID.Hex()] = booking
	return booking, nil
}

func (m *mockMentorshipRepo) GetBookingByID(ctx context.Context, id string) (*Booking, error) {
	b, ok := m.bookings[id]
	if !ok {
		return nil, errors.New("booking not found")
	}
	return b, nil
}

func (m *mockMentorshipRepo) ListBookingsByUser(ctx context.Context, userID string) ([]Booking, error) {
	var list []Booking
	for _, v := range m.bookings {
		if v.UserID.Hex() == userID {
			list = append(list, *v)
		}
	}
	return list, nil
}

func (m *mockMentorshipRepo) ListBookingsByExpert(ctx context.Context, expertID string) ([]Booking, error) {
	var list []Booking
	for _, v := range m.bookings {
		if v.ExpertID.Hex() == expertID {
			list = append(list, *v)
		}
	}
	return list, nil
}

func (m *mockMentorshipRepo) UpdateBookingStatus(ctx context.Context, id string, status string) error {
	b, ok := m.bookings[id]
	if !ok {
		return errors.New("not found")
	}
	b.Status = status
	return nil
}

func (m *mockMentorshipRepo) UpdateBookingPayment(ctx context.Context, id string, paymentStatus string, paymentMethod string, rzpPaymentID string, status string) error {
	b, ok := m.bookings[id]
	if !ok {
		return errors.New("not found")
	}
	b.PaymentStatus = paymentStatus
	if paymentMethod != "" {
		b.PaymentMethod = paymentMethod
	}
	if rzpPaymentID != "" {
		b.RazorpayPaymentID = rzpPaymentID
	}
	if status != "" {
		b.Status = status
	}
	return nil
}

func (m *mockMentorshipRepo) UpdateMeetingLink(ctx context.Context, id string, meetingLink string) error {
	b, ok := m.bookings[id]
	if !ok {
		return errors.New("not found")
	}
	b.MeetingLink = meetingLink
	return nil
}

func (m *mockMentorshipRepo) UpdateAvailability(ctx context.Context, expertID string, availabilities []Availability) error {
	m.availabilities[expertID] = availabilities
	return nil
}

func (m *mockMentorshipRepo) GetAvailabilityByExpert(ctx context.Context, expertID string) ([]Availability, error) {
	return m.availabilities[expertID], nil
}

type mockWalletService struct {
	wallets map[string]*wallet.WalletSummaryResponse
}

func newMockWalletService() *mockWalletService {
	return &mockWalletService{
		wallets: make(map[string]*wallet.WalletSummaryResponse),
	}
}

func (w *mockWalletService) GetWalletSummary(ctx context.Context, userID string) (*wallet.WalletSummaryResponse, error) {
	sum, ok := w.wallets[userID]
	if !ok {
		sum = &wallet.WalletSummaryResponse{
			UserID:              userID,
			Currency:            "INR",
			Status:              "active",
			MainBalance:         0,
			EarningsBalance:     0,
			LockedBalance:       0,
			BonusBalance:        0,
			TotalBalance:        0,
			WithdrawableBalance: 0,
		}
		w.wallets[userID] = sum
	}
	return sum, nil
}

func (w *mockWalletService) AdjustBalances(ctx context.Context, userID string, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*wallet.WalletSummaryResponse, error) {
	sum, _ := w.GetWalletSummary(ctx, userID)
	sum.MainBalance += mainDelta
	sum.EarningsBalance += earningsDelta
	sum.LockedBalance += lockedDelta
	sum.BonusBalance += bonusDelta
	sum.TotalBalance = sum.MainBalance + sum.EarningsBalance + sum.BonusBalance
	sum.WithdrawableBalance = sum.EarningsBalance
	return sum, nil
}

func (w *mockWalletService) GetTransactions(ctx context.Context, userID string, query wallet.TransactionQuery) (*wallet.TransactionListResponse, error) {
	return &wallet.TransactionListResponse{}, nil
}

func (w *mockWalletService) RecordTransaction(ctx context.Context, input wallet.RecordTransactionInput) (*wallet.TransactionItemResponse, *wallet.WalletSummaryResponse, error) {
	uid := input.UserID.Hex()
	sum, _ := w.GetWalletSummary(ctx, uid)

	delta := input.Amount
	if input.Type == wallet.TypeDebit {
		delta = -input.Amount
	}

	switch input.TargetBalance {
	case wallet.BalanceLocked:
		sum.LockedBalance += delta
	case wallet.BalanceEarnings:
		sum.EarningsBalance += delta
		sum.WithdrawableBalance = sum.EarningsBalance
	case wallet.BalanceMain:
		sum.MainBalance += delta
	case wallet.BalanceBonus:
		sum.BonusBalance += delta
	}
	sum.TotalBalance = sum.MainBalance + sum.EarningsBalance + sum.BonusBalance

	txItem := &wallet.TransactionItemResponse{
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
	return txItem, sum, nil
}

func (w *mockWalletService) CreateTopupOrder(ctx context.Context, userID string, amount float64) (*wallet.CreateTopupOrderResponse, error) {
	return nil, nil
}

func (w *mockWalletService) VerifyTopupPayment(ctx context.Context, userID string, req wallet.VerifyTopupPaymentRequest) (*wallet.WalletSummaryResponse, *wallet.TransactionItemResponse, error) {
	return nil, nil, nil
}

func (w *mockWalletService) RequestWithdrawal(ctx context.Context, userID string, req wallet.WithdrawalRequest) (*wallet.WithdrawalResponse, error) {
	return nil, nil
}

func TestUpdateBookingStatus_EscrowReleaseOnCompletion(t *testing.T) {
	mockRepo := newMockMentorshipRepo()
	mockWallet := newMockWalletService()
	cfg := &config.Config{Port: "8000"}

	svc := &MentorshipServiceImpl{
		repo:          mockRepo,
		walletService: mockWallet,
		cfg:           cfg,
	}

	ctx := context.Background()
	expertID := primitive.NewObjectID()
	menteeID := primitive.NewObjectID()
	bookingID := primitive.NewObjectID()

	// Mentee starts with 500 in locked escrow balance
	_, _ = mockWallet.AdjustBalances(ctx, menteeID.Hex(), 0, 0, 500, 0)
	// Expert starts with 0 in earnings
	expertWallet, _ := mockWallet.GetWalletSummary(ctx, expertID.Hex())
	if expertWallet.EarningsBalance != 0 {
		t.Fatalf("expected initial 0 earnings, got %f", expertWallet.EarningsBalance)
	}

	booking := &Booking{
		ID:            bookingID,
		ExpertID:      expertID,
		UserID:        menteeID,
		Amount:        500,
		Status:        "confirmed",
		PaymentStatus: "paid",
		PaymentMethod: "wallet",
	}
	_, _ = mockRepo.CreateBooking(ctx, booking)

	// Expert marks session as completed
	err := svc.UpdateBookingStatus(ctx, expertID.Hex(), bookingID.Hex(), "completed")
	if err != nil {
		t.Fatalf("unexpected error marking completed: %v", err)
	}

	// Verify booking status
	updatedBooking, _ := mockRepo.GetBookingByID(ctx, bookingID.Hex())
	if updatedBooking.Status != "completed" {
		t.Errorf("expected booking status 'completed', got '%s'", updatedBooking.Status)
	}

	// Verify mentee locked balance was debited: 500 - 500 = 0
	menteeWallet, _ := mockWallet.GetWalletSummary(ctx, menteeID.Hex())
	if menteeWallet.LockedBalance != 0 {
		t.Errorf("expected mentee locked balance 0, got %f", menteeWallet.LockedBalance)
	}

	// Verify expert earnings balance was credited: 0 + 500 = 500
	expertWallet, _ = mockWallet.GetWalletSummary(ctx, expertID.Hex())
	if expertWallet.EarningsBalance != 500 {
		t.Errorf("expected expert earnings balance 500, got %f", expertWallet.EarningsBalance)
	}
	if expertWallet.WithdrawableBalance != 500 {
		t.Errorf("expected expert withdrawable balance 500, got %f", expertWallet.WithdrawableBalance)
	}
}

func TestUpdateBookingStatus_RefundOnCancellation(t *testing.T) {
	mockRepo := newMockMentorshipRepo()
	mockWallet := newMockWalletService()
	cfg := &config.Config{Port: "8000"}

	svc := &MentorshipServiceImpl{
		repo:          mockRepo,
		walletService: mockWallet,
		cfg:           cfg,
	}

	ctx := context.Background()
	expertID := primitive.NewObjectID()
	menteeID := primitive.NewObjectID()
	bookingID := primitive.NewObjectID()

	// Mentee starts with 100 in main balance and 300 in locked balance
	_, _ = mockWallet.AdjustBalances(ctx, menteeID.Hex(), 100, 0, 300, 0)

	booking := &Booking{
		ID:            bookingID,
		ExpertID:      expertID,
		UserID:        menteeID,
		Amount:        300,
		Status:        "confirmed",
		PaymentStatus: "paid",
		PaymentMethod: "wallet",
	}
	_, _ = mockRepo.CreateBooking(ctx, booking)

	// Session is cancelled
	err := svc.UpdateBookingStatus(ctx, expertID.Hex(), bookingID.Hex(), "cancelled")
	if err != nil {
		t.Fatalf("unexpected error cancelling session: %v", err)
	}

	updatedBooking, _ := mockRepo.GetBookingByID(ctx, bookingID.Hex())
	if updatedBooking.Status != "cancelled" {
		t.Errorf("expected booking status 'cancelled', got '%s'", updatedBooking.Status)
	}
	if updatedBooking.PaymentStatus != "refunded" {
		t.Errorf("expected payment status 'refunded', got '%s'", updatedBooking.PaymentStatus)
	}

	// Mentee locked balance was released: 300 - 300 = 0
	menteeWallet, _ := mockWallet.GetWalletSummary(ctx, menteeID.Hex())
	if menteeWallet.LockedBalance != 0 {
		t.Errorf("expected mentee locked balance 0, got %f", menteeWallet.LockedBalance)
	}
	// Mentee main balance was refunded: 100 + 300 = 400
	if menteeWallet.MainBalance != 400 {
		t.Errorf("expected mentee main balance 400, got %f", menteeWallet.MainBalance)
	}
}

func TestUpdateBookingStatus_Guards(t *testing.T) {
	mockRepo := newMockMentorshipRepo()
	mockWallet := newMockWalletService()
	cfg := &config.Config{Port: "8000"}

	svc := &MentorshipServiceImpl{
		repo:          mockRepo,
		walletService: mockWallet,
		cfg:           cfg,
	}

	ctx := context.Background()
	expertID := primitive.NewObjectID()
	unauthorizedID := primitive.NewObjectID()
	menteeID := primitive.NewObjectID()
	bookingID := primitive.NewObjectID()

	booking := &Booking{
		ID:            bookingID,
		ExpertID:      expertID,
		UserID:        menteeID,
		Amount:        300,
		Status:        "completed",
		PaymentStatus: "paid",
	}
	_, _ = mockRepo.CreateBooking(ctx, booking)

	// 1. Unauthorized caller
	err := svc.UpdateBookingStatus(ctx, unauthorizedID.Hex(), bookingID.Hex(), "completed")
	if err == nil {
		t.Fatal("expected unauthorized error, got nil")
	}

	// 2. Modifying already completed session
	err = svc.UpdateBookingStatus(ctx, expertID.Hex(), bookingID.Hex(), "cancelled")
	if err == nil || err.Error() != "cannot change status of an already completed session" {
		t.Fatalf("expected already completed error, got %v", err)
	}
}
