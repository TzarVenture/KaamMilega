package mentorship

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/payment/paymenttest"
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
	// A copy, like a database read: later writes must not change what the caller loaded
	copied := *b
	return &copied, nil
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

func (m *mockMentorshipRepo) UpdateBookingReview(ctx context.Context, id string, rating float64, review string) error {
	b, ok := m.bookings[id]
	if !ok {
		return errors.New("not found")
	}
	b.Rating = rating
	b.Review = review
	return nil
}

func (m *mockMentorshipRepo) UpdateAvailability(ctx context.Context, expertID string, availabilities []Availability) error {
	m.availabilities[expertID] = availabilities
	return nil
}

func (m *mockMentorshipRepo) GetAvailabilityByExpert(ctx context.Context, expertID string) ([]Availability, error) {
	return m.availabilities[expertID], nil
}

func (m *mockMentorshipRepo) GetReviewsByMentorshipID(ctx context.Context, mentorshipID string) ([]Booking, error) {
	var list []Booking
	for _, b := range m.bookings {
		if b.MentorshipID.Hex() == mentorshipID && b.Rating > 0 {
			list = append(list, *b)
		}
	}
	return list, nil
}

func (m *mockMentorshipRepo) GetReviewsByExpertID(ctx context.Context, expertID string) ([]Booking, error) {
	var list []Booking
	for _, b := range m.bookings {
		if b.ExpertID.Hex() == expertID && b.Rating > 0 {
			list = append(list, *b)
		}
	}
	return list, nil
}

func (m *mockMentorshipRepo) UpdateMentorshipRatingStats(ctx context.Context, mentorshipID string, rating float64, reviewsCount int) error {
	for _, ms := range m.mentorships {
		if ms.ID.Hex() == mentorshipID {
			ms.Rating = rating
			ms.Reviews = reviewsCount
			return nil
		}
	}
	return nil
}

func (m *mockMentorshipRepo) TransitionBooking(ctx context.Context, id string, from []string, t BookingTransition) (bool, error) {
	b, ok := m.bookings[id]
	if !ok {
		return false, nil
	}
	for _, status := range from {
		if b.Status == status {
			b.Status = t.Status
			if t.PaymentStatus != "" {
				b.PaymentStatus = t.PaymentStatus
			}
			b.ReleaseAfter = t.ReleaseAfter
			b.ReportReason = t.ReportReason
			b.ResolutionNote = t.ResolutionNote
			return true, nil
		}
	}
	return false, nil
}

func (m *mockMentorshipRepo) ListBookingsDueRelease(ctx context.Context, now time.Time, limit int64) ([]Booking, error) {
	var list []Booking
	for _, b := range m.bookings {
		if b.Status == BookingAwaitingConfirmation && b.ReleaseAfter != nil && !b.ReleaseAfter.After(now) {
			list = append(list, *b)
		}
	}
	return list, nil
}

func (m *mockMentorshipRepo) ListReportedBookings(ctx context.Context) ([]Booking, error) {
	var list []Booking
	for _, b := range m.bookings {
		if b.Status == BookingReported {
			list = append(list, *b)
		}
	}
	return list, nil
}

type mockWalletService struct {
	wallet.WalletService
	wallets map[string]*wallet.WalletSummaryResponse
}

func newMockWalletService() *mockWalletService {
	return &mockWalletService{wallets: make(map[string]*wallet.WalletSummaryResponse)}
}

func (w *mockWalletService) GetWalletSummary(ctx context.Context, userID string) (*wallet.WalletSummaryResponse, error) {
	sum, ok := w.wallets[userID]
	if !ok {
		sum = &wallet.WalletSummaryResponse{UserID: userID, Currency: "INR", Status: "active"}
		w.wallets[userID] = sum
	}
	return sum, nil
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

	return &wallet.TransactionItemResponse{
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
	}, sum, nil
}

type fixture struct {
	ctx      context.Context
	repo     *mockMentorshipRepo
	wallets  *mockWalletService
	payments *paymenttest.Fake
	svc      MentorshipService
	expert   primitive.ObjectID
	mentee   primitive.ObjectID
}

func newFixture() *fixture {
	f := &fixture{
		ctx:      context.Background(),
		repo:     newMockMentorshipRepo(),
		wallets:  newMockWalletService(),
		payments: paymenttest.New(),
		expert:   primitive.NewObjectID(),
		mentee:   primitive.NewObjectID(),
	}
	f.svc = NewMentorshipService(f.repo, nil, f.wallets, &config.Config{}, nil, f.payments, database.NoopTransactor{})
	return f
}

// paidBooking creates a booking whose money is already held, and whose start time has passed.
func (f *fixture) paidBooking(status, method string) *Booking {
	b, _ := f.repo.CreateBooking(f.ctx, &Booking{
		ExpertID:      f.expert,
		UserID:        f.mentee,
		Amount:        500,
		Status:        status,
		PaymentStatus: "paid",
		PaymentMethod: method,
		ScheduledAt:   time.Now().Add(-time.Hour),
	})
	_, _, _ = f.wallets.RecordTransaction(f.ctx, wallet.RecordTransactionInput{
		UserID: f.mentee, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceLocked, Amount: 500,
	})
	return b
}

func (f *fixture) balances() (locked, main, earnings float64) {
	mentee, _ := f.wallets.GetWalletSummary(f.ctx, f.mentee.Hex())
	expert, _ := f.wallets.GetWalletSummary(f.ctx, f.expert.Hex())
	return mentee.LockedBalance, mentee.MainBalance, expert.EarningsBalance
}

func TestMarkingDoneStartsTheConfirmationWindowWithoutPaying(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingConfirmed, methodWallet)

	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCompleted); err != nil {
		t.Fatal(err)
	}
	if b.Status != BookingAwaitingConfirmation || b.ReleaseAfter == nil {
		t.Fatalf("booking = %+v", b)
	}
	if wait := time.Until(*b.ReleaseAfter); wait < 23*time.Hour || wait > 25*time.Hour {
		t.Fatalf("release in %v", wait)
	}
	if locked, _, earnings := f.balances(); locked != 500 || earnings != 0 {
		t.Fatalf("locked = %v, earnings = %v", locked, earnings)
	}
}

func TestSessionCanNotBeMarkedDoneBeforeItStarts(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingConfirmed, methodWallet)
	b.ScheduledAt = time.Now().Add(time.Hour)

	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCompleted); !errors.Is(err, ErrSessionNotDue) {
		t.Fatalf("err = %v", err)
	}
}

func TestMenteeConfirmationPaysTheMentorOnce(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingAwaitingConfirmation, methodWallet)

	if err := f.svc.ConfirmSession(f.ctx, f.mentee.Hex(), b.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if err := f.svc.ConfirmSession(f.ctx, f.mentee.Hex(), b.ID.Hex()); !errors.Is(err, ErrBookingMoved) {
		t.Fatalf("second confirm: %v", err)
	}
	if locked, _, earnings := f.balances(); b.Status != BookingCompleted || locked != 0 || earnings != 500 {
		t.Fatalf("status = %s, locked = %v, earnings = %v", b.Status, locked, earnings)
	}
}

func TestOnlyTheMenteeCanConfirmOrReport(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingAwaitingConfirmation, methodWallet)

	if err := f.svc.ConfirmSession(f.ctx, f.expert.Hex(), b.ID.Hex()); !errors.Is(err, ErrNotYourBooking) {
		t.Fatalf("confirm: %v", err)
	}
	if err := f.svc.ReportSession(f.ctx, f.expert.Hex(), b.ID.Hex(), "x"); !errors.Is(err, ErrNotYourBooking) {
		t.Fatalf("report: %v", err)
	}
}

func TestMentorIsPaidAutomaticallyOnlyAfterTheWindow(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingAwaitingConfirmation, methodWallet)
	later := time.Now().Add(time.Hour)
	b.ReleaseAfter = &later

	if n, err := f.svc.ReleaseDueSessions(f.ctx); err != nil || n != 0 {
		t.Fatalf("early: n = %d, err = %v", n, err)
	}

	earlier := time.Now().Add(-time.Minute)
	b.ReleaseAfter = &earlier
	if n, err := f.svc.ReleaseDueSessions(f.ctx); err != nil || n != 1 {
		t.Fatalf("due: n = %d, err = %v", n, err)
	}
	if n, _ := f.svc.ReleaseDueSessions(f.ctx); n != 0 {
		t.Fatalf("a released session was paid again")
	}
	if _, _, earnings := f.balances(); earnings != 500 {
		t.Fatalf("earnings = %v", earnings)
	}
}

func TestReportStopsTheAutomaticPayment(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingAwaitingConfirmation, methodWallet)
	earlier := time.Now().Add(-time.Minute)
	b.ReleaseAfter = &earlier

	if err := f.svc.ReportSession(f.ctx, f.mentee.Hex(), b.ID.Hex(), "   "); !errors.Is(err, ErrReasonRequired) {
		t.Fatalf("blank reason: %v", err)
	}
	if err := f.svc.ReportSession(f.ctx, f.mentee.Hex(), b.ID.Hex(), "Mentor did not join"); err != nil {
		t.Fatal(err)
	}
	if n, _ := f.svc.ReleaseDueSessions(f.ctx); n != 0 || b.Status != BookingReported {
		t.Fatalf("n = %d, status = %s", n, b.Status)
	}
	if _, _, earnings := f.balances(); earnings != 0 {
		t.Fatalf("earnings = %v", earnings)
	}
}

func TestSessionCanNotBeReportedBeforeItStarts(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingConfirmed, methodWallet)
	b.ScheduledAt = time.Now().Add(time.Hour)

	if err := f.svc.ReportSession(f.ctx, f.mentee.Hex(), b.ID.Hex(), "early"); !errors.Is(err, ErrSessionNotDue) {
		t.Fatalf("err = %v", err)
	}
}

func TestAdminCanSettleAReportEitherWay(t *testing.T) {
	f := newFixture()
	paid := f.paidBooking(BookingReported, methodWallet)
	if err := f.svc.ResolveReport(f.ctx, "admin", paid.ID.Hex(), ResolveReportRequest{Action: "release", Note: "joined"}); err != nil {
		t.Fatal(err)
	}
	if locked, main, earnings := f.balances(); locked != 0 || main != 0 || earnings != 500 {
		t.Fatalf("release: locked = %v, main = %v, earnings = %v", locked, main, earnings)
	}

	refunded := f.paidBooking(BookingReported, methodWallet)
	if err := f.svc.ResolveReport(f.ctx, "admin", refunded.ID.Hex(), ResolveReportRequest{Action: "refund"}); err != nil {
		t.Fatal(err)
	}
	if err := f.svc.ResolveReport(f.ctx, "admin", refunded.ID.Hex(), ResolveReportRequest{Action: "refund"}); !errors.Is(err, ErrBookingMoved) {
		t.Fatalf("second decision: %v", err)
	}
	if locked, main, earnings := f.balances(); locked != 0 || main != 500 || earnings != 500 {
		t.Fatalf("refund: locked = %v, main = %v, earnings = %v", locked, main, earnings)
	}
	if refunded.Status != BookingCancelled || refunded.PaymentStatus != "refunded" {
		t.Fatalf("booking = %+v", refunded)
	}
}

func TestCancellingAWalletBookingRefundsTheWallet(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingConfirmed, methodWallet)

	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCancelled); err != nil {
		t.Fatal(err)
	}
	if locked, main, _ := f.balances(); b.PaymentStatus != "refunded" || locked != 0 || main != 500 {
		t.Fatalf("payment = %s, locked = %v, main = %v", b.PaymentStatus, locked, main)
	}
}

func TestCancellingACardBookingRefundsTheCardNotTheWallet(t *testing.T) {
	f := newFixture()
	checkout, _, _ := f.payments.CreateOrder(f.ctx, payment.CreateOrderInput{UserID: f.mentee, Purpose: payment.PurposeMentorshipBooking, AmountPaise: 50000})
	b := f.paidBooking(BookingConfirmed, methodRazorpay)
	b.RazorpayOrderID = checkout.OrderID

	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCancelled); err != nil {
		t.Fatal(err)
	}
	if locked, main, _ := f.balances(); locked != 0 || main != 0 {
		t.Fatalf("locked = %v, main = %v", locked, main)
	}
	if len(f.payments.Refunds) != 1 || f.payments.Orders[checkout.OrderID].RefundPaise != 50000 {
		t.Fatalf("refunds = %v", f.payments.Refunds)
	}
}

func TestCardBookingExistsOnlyAfterPaymentAndOnlyOnce(t *testing.T) {
	f := newFixture()
	m, _ := f.repo.CreateMentorship(f.ctx, &Mentorship{ExpertID: f.expert, Title: "Go", Price: 500})
	checkout, err := f.svc.CreateBookingOrder(f.ctx, f.mentee.Hex(), CreateMentorshipOrderRequest{MentorshipID: m.ID.Hex(), ScheduledAt: time.Now().Add(time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	if len(f.repo.bookings) != 0 {
		t.Fatal("an unpaid checkout must not create a booking")
	}

	input := VerifyMentorshipPaymentRequest{RazorpayOrderID: checkout.OrderID, RazorpayPaymentID: "pay_1", RazorpaySignature: "sig"}
	for i := 0; i < 2; i++ {
		b, err := f.svc.VerifyBookingPayment(f.ctx, f.mentee.Hex(), input)
		if err != nil {
			t.Fatal(err)
		}
		if b.ID.Hex() != checkout.BookingID || b.Status != BookingConfirmed || b.Amount != 500 {
			t.Fatalf("booking = %+v", b)
		}
	}
	if locked, _, _ := f.balances(); len(f.repo.bookings) != 1 || locked != 500 {
		t.Fatalf("bookings = %d, locked = %v", len(f.repo.bookings), locked)
	}

	if _, err := f.svc.VerifyBookingPayment(f.ctx, f.expert.Hex(), input); !errors.Is(err, payment.ErrOrderNotFound) {
		t.Fatalf("another user: %v", err)
	}
}

func TestMentorCanNotBookTheirOwnSession(t *testing.T) {
	f := newFixture()
	m, _ := f.repo.CreateMentorship(f.ctx, &Mentorship{ExpertID: f.expert, Title: "Go", Price: 500})
	_, err := f.svc.CreateBookingOrder(f.ctx, f.expert.Hex(), CreateMentorshipOrderRequest{MentorshipID: m.ID.Hex(), ScheduledAt: time.Now().Add(time.Hour)})
	if !errors.Is(err, ErrSelfBooking) {
		t.Fatalf("err = %v", err)
	}
}

func TestUpdateBookingStatus_Guards(t *testing.T) {
	f := newFixture()
	b := f.paidBooking(BookingCompleted, methodWallet)

	if err := f.svc.UpdateBookingStatus(f.ctx, primitive.NewObjectID().Hex(), b.ID.Hex(), BookingCompleted); !errors.Is(err, ErrNotYourBooking) {
		t.Fatalf("another mentor: %v", err)
	}
	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCancelled); !errors.Is(err, ErrBookingMoved) {
		t.Fatalf("after completion: %v", err)
	}
	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), "paid_out"); !errors.Is(err, ErrInvalidBookState) {
		t.Fatalf("unknown status: %v", err)
	}
}

func TestSubmitBookingReview(t *testing.T) {
	mockRepo := newMockMentorshipRepo()
	mockWallet := newMockWalletService()
	cfg := &config.Config{}

	svc := &MentorshipServiceImpl{
		repo:          mockRepo,
		walletService: mockWallet,
		cfg:           cfg,
	}

	ctx := context.Background()
	expertID := primitive.NewObjectID()
	mentorshipID := primitive.NewObjectID()
	menteeID := primitive.NewObjectID()
	otherUserID := primitive.NewObjectID()
	bookingID := primitive.NewObjectID()

	ms := &Mentorship{
		ID:       mentorshipID,
		ExpertID: expertID,
		Title:    "Go Architecture Mentorship",
	}
	_, _ = mockRepo.CreateMentorship(ctx, ms)

	booking := &Booking{
		ID:            bookingID,
		MentorshipID:  mentorshipID,
		ExpertID:      expertID,
		UserID:        menteeID,
		Amount:        500,
		Status:        "confirmed",
		PaymentStatus: "paid",
	}
	_, _ = mockRepo.CreateBooking(ctx, booking)

	// 1. Cannot review non-completed session
	req := SubmitBookingReviewRequest{Rating: 5, Review: "Great mentorship!"}
	err := svc.SubmitBookingReview(ctx, menteeID.Hex(), bookingID.Hex(), req)
	if err == nil || err.Error() != "can only review completed sessions" {
		t.Fatalf("expected can only review completed sessions, got %v", err)
	}

	// 2. Unauthorized mentee cannot review
	booking.Status = "completed"
	err = svc.SubmitBookingReview(ctx, otherUserID.Hex(), bookingID.Hex(), req)
	if err == nil || err.Error() != "unauthorized to review this booking" {
		t.Fatalf("expected unauthorized error, got %v", err)
	}

	// 3. Invalid rating (e.g. 6 or 0)
	err = svc.SubmitBookingReview(ctx, menteeID.Hex(), bookingID.Hex(), SubmitBookingReviewRequest{Rating: 6, Review: "Too high"})
	if err == nil || err.Error() != "rating must be between 1 and 5" {
		t.Fatalf("expected rating out of range error, got %v", err)
	}

	// 4. Valid review succeeds
	err = svc.SubmitBookingReview(ctx, menteeID.Hex(), bookingID.Hex(), req)
	if err != nil {
		t.Fatalf("expected valid review to succeed, got %v", err)
	}

	updated, _ := mockRepo.GetBookingByID(ctx, bookingID.Hex())
	if updated.Rating != 5 || updated.Review != "Great mentorship!" {
		t.Fatalf("expected rating 5 and review stored, got rating %.1f, review %s", updated.Rating, updated.Review)
	}

	// 5. Verify mentorship aggregate rating and reviews count were updated
	updatedMs, _ := mockRepo.GetMentorshipByID(ctx, mentorshipID.Hex())
	if updatedMs.Rating != 5 || updatedMs.Reviews != 1 {
		t.Fatalf("expected mentorship rating 5.0 and reviews count 1, got rating %.1f, reviews %d", updatedMs.Rating, updatedMs.Reviews)
	}

	// 6. Test GetMentorshipReviews endpoint logic
	reviewResp, err := svc.GetMentorshipReviews(ctx, mentorshipID.Hex())
	if err != nil {
		t.Fatalf("unexpected error fetching mentorship reviews: %v", err)
	}
	if reviewResp.TotalReviews != 1 || reviewResp.AverageRating != 5.0 {
		t.Fatalf("expected 1 review with 5.0 average, got %d reviews, %.1f avg", reviewResp.TotalReviews, reviewResp.AverageRating)
	}
	if reviewResp.Distribution.FiveStar != 1 {
		t.Fatalf("expected 1 5-star review in distribution, got %d", reviewResp.Distribution.FiveStar)
	}
	if len(reviewResp.Reviews) != 1 || reviewResp.Reviews[0].Review != "Great mentorship!" {
		t.Fatalf("expected review text in list, got %+v", reviewResp.Reviews)
	}
}
