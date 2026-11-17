package mentorship

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"
	"km-backend/internal/features/payment/paymenttest"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These run the booking money flow end to end on a throwaway Postgres schema (see pgtest), with
// the real wallet: booking, escrow, payout and refund each commit together with the booking.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type pgFixture struct {
	ctx     context.Context
	pg      *database.PostgresDB
	repo    *MentorshipRepositoryImpl
	wallets wallet.WalletService
	svc     *MentorshipServiceImpl
	expert  primitive.ObjectID
	mentee  primitive.ObjectID
	m       *Mentorship
}

func newPGFixture(t *testing.T) *pgFixture {
	t.Helper()
	pg := pgtest.New(t)
	tx := database.NewPgTransactor(pg)
	// Users live in MongoDB; nothing here reads them, so the client never connects
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1"))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}

	payments := paymenttest.New()
	wallets := wallet.NewWalletService(wallet.NewWalletRepository(pg, tx, mdb), &config.Config{}, nil, nil, payments, tx)
	repo := NewMentorshipRepository(pg).(*MentorshipRepositoryImpl)
	f := &pgFixture{
		ctx:     context.Background(),
		pg:      pg,
		repo:    repo,
		wallets: wallets,
		svc:     NewMentorshipService(repo, nil, wallets, &config.Config{}, nil, payments, tx).(*MentorshipServiceImpl),
		expert:  primitive.NewObjectID(),
		mentee:  primitive.NewObjectID(),
	}
	f.m, err = repo.CreateMentorship(f.ctx, &Mentorship{ExpertID: f.expert, Title: "Mock interview", Duration: 30, Price: 500})
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *pgFixture) topUp(t *testing.T, amount float64) {
	t.Helper()
	if _, _, err := f.wallets.RecordTransaction(f.ctx, wallet.RecordTransactionInput{
		UserID: f.mentee, Type: wallet.TypeCredit, TargetBalance: wallet.BalanceMain, Category: wallet.CategoryTopup,
		Amount: amount, ReferenceID: "topup:" + primitive.NewObjectID().Hex(), Description: "test",
	}); err != nil {
		t.Fatal(err)
	}
}

func (f *pgFixture) balances(t *testing.T) (main, locked, earnings float64) {
	t.Helper()
	mentee, err := f.wallets.GetWalletSummary(f.ctx, f.mentee.Hex())
	if err != nil {
		t.Fatal(err)
	}
	expert, err := f.wallets.GetWalletSummary(f.ctx, f.expert.Hex())
	if err != nil {
		t.Fatal(err)
	}
	return mentee.MainBalance, mentee.LockedBalance, expert.EarningsBalance
}

func (f *pgFixture) book(t *testing.T) *Booking {
	t.Helper()
	b, _, err := f.svc.BookWithWallet(f.ctx, f.mentee.Hex(), BookWithWalletRequest{MentorshipID: f.m.ID.Hex(), ScheduledAt: time.Now().Add(time.Minute)})
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// started moves the session's start time into the past, as if it had happened
func (f *pgFixture) started(t *testing.T, b *Booking) {
	t.Helper()
	if err := f.pg.DB.Exec(`UPDATE mentorship_bookings SET scheduled_at = ? WHERE id = ?`, time.Now().Add(-time.Hour), b.ID.Hex()).Error; err != nil {
		t.Fatal(err)
	}
}

func TestPGWalletBookingHoldsTheMoney(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 800)
	b := f.book(t)

	if main, locked, _ := f.balances(t); main != 300 || locked != 500 {
		t.Fatalf("main = %v, locked = %v", main, locked)
	}
	got, err := f.repo.GetBookingByID(f.ctx, b.ID.Hex())
	if err != nil || got.Status != BookingConfirmed || got.PaymentStatus != "paid" || got.Amount != 500 {
		t.Fatalf("booking = %+v, err = %v", got, err)
	}
}

func TestPGBookingWithoutEnoughMoneyLeavesNothingBehind(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 100)
	_, _, err := f.svc.BookWithWallet(f.ctx, f.mentee.Hex(), BookWithWalletRequest{MentorshipID: f.m.ID.Hex(), ScheduledAt: time.Now().Add(time.Minute)})
	if !errors.Is(err, wallet.ErrInsufficient) {
		t.Fatalf("err = %v", err)
	}
	if list, _ := f.repo.ListBookingsByUser(f.ctx, f.mentee.Hex()); len(list) != 0 {
		t.Fatalf("a booking was left behind: %+v", list)
	}
	if main, locked, _ := f.balances(t); main != 100 || locked != 0 {
		t.Fatalf("main = %v, locked = %v", main, locked)
	}
}

func TestPGConfirmingTwiceAtOncePaysTheMentorOnce(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 500)
	b := f.book(t)
	f.started(t, b)
	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCompleted); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 3)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = f.svc.ConfirmSession(f.ctx, f.mentee.Hex(), b.ID.Hex())
		}(i)
	}
	wg.Wait()

	ok := 0
	for _, err := range errs {
		if err == nil {
			ok++
		} else if !errors.Is(err, ErrBookingMoved) {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if main, locked, earnings := f.balances(t); ok != 1 || main != 0 || locked != 0 || earnings != 500 {
		t.Fatalf("ok = %d, main = %v, locked = %v, earnings = %v", ok, main, locked, earnings)
	}
}

func TestPGCancelRefundsTheWalletOnce(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 500)
	b := f.book(t)

	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCancelled); err != nil {
		t.Fatal(err)
	}
	// Cancelling again is a no-op; it must not refund a second time
	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCancelled); err != nil {
		t.Fatal(err)
	}
	if main, locked, earnings := f.balances(t); main != 500 || locked != 0 || earnings != 0 {
		t.Fatalf("main = %v, locked = %v, earnings = %v", main, locked, earnings)
	}
	got, _ := f.repo.GetBookingByID(f.ctx, b.ID.Hex())
	if got.Status != BookingCancelled || got.PaymentStatus != "refunded" {
		t.Fatalf("booking = %+v", got)
	}
}

func TestPGAutomaticReleaseAfterTheWindow(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 500)
	b := f.book(t)
	f.started(t, b)
	if err := f.svc.UpdateBookingStatus(f.ctx, f.expert.Hex(), b.ID.Hex(), BookingCompleted); err != nil {
		t.Fatal(err)
	}
	if n, err := f.svc.ReleaseDueSessions(f.ctx); err != nil || n != 0 {
		t.Fatalf("early release: n = %d, err = %v", n, err)
	}
	if err := f.pg.DB.Exec(`UPDATE mentorship_bookings SET release_after = ? WHERE id = ?`, time.Now().Add(-time.Minute), b.ID.Hex()).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err := f.svc.ReleaseDueSessions(f.ctx); err != nil {
			t.Fatal(err)
		}
	}
	if _, locked, earnings := f.balances(t); locked != 0 || earnings != 500 {
		t.Fatalf("locked = %v, earnings = %v", locked, earnings)
	}
}

func TestPGDeletedMentorshipIsHiddenButBookingsKeepIt(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 500)
	b := f.book(t)
	if err := f.repo.DeleteMentorship(f.ctx, f.m.ID.Hex()); err != nil {
		t.Fatal(err)
	}
	if m, _ := f.repo.GetMentorshipByID(f.ctx, f.m.ID.Hex()); m != nil {
		t.Fatal("deleted mentorship still visible")
	}
	if list, _ := f.repo.ListMentorships(f.ctx, ""); len(list) != 0 {
		t.Fatal("deleted mentorship still listed")
	}
	if got, err := f.repo.GetBookingByID(f.ctx, b.ID.Hex()); err != nil || got.MentorshipID != f.m.ID {
		t.Fatalf("booking lost its mentorship: %+v, %v", got, err)
	}
}

func TestPGAvailabilityRoundTripAndValidation(t *testing.T) {
	f := newPGFixture(t)
	slots := []Availability{{DayOfWeek: 1, StartTime: "09:00", EndTime: "17:30", IsActive: true}, {DayOfWeek: 3, StartTime: "10:15", EndTime: "12:00", IsActive: true}}
	if err := f.repo.UpdateAvailability(f.ctx, f.expert.Hex(), slots); err != nil {
		t.Fatal(err)
	}
	got, err := f.repo.GetAvailabilityByExpert(f.ctx, f.expert.Hex())
	if err != nil || len(got) != 2 || got[0].StartTime != "09:00" || got[0].EndTime != "17:30" || got[1].DayOfWeek != 3 {
		t.Fatalf("got = %+v, err = %v", got, err)
	}

	bad := []Availability{{DayOfWeek: 2, StartTime: "18:00", EndTime: "09:00", IsActive: true}}
	if err := f.repo.UpdateAvailability(f.ctx, f.expert.Hex(), bad); !errors.Is(err, ErrAvailabilityInvalid) {
		t.Fatalf("err = %v", err)
	}
	if got, _ := f.repo.GetAvailabilityByExpert(f.ctx, f.expert.Hex()); len(got) != 2 {
		t.Fatalf("a rejected update must leave the old slots: %+v", got)
	}
}

func TestPGReviewUpdatesRating(t *testing.T) {
	f := newPGFixture(t)
	f.topUp(t, 500)
	b := f.book(t)
	if err := f.repo.UpdateBookingStatus(f.ctx, b.ID.Hex(), BookingCompleted); err != nil {
		t.Fatal(err)
	}
	if err := f.svc.SubmitBookingReview(f.ctx, f.mentee.Hex(), b.ID.Hex(), SubmitBookingReviewRequest{Rating: 4.5, Review: "Helpful"}); err != nil {
		t.Fatal(err)
	}
	m, _ := f.repo.GetMentorshipByID(f.ctx, f.m.ID.Hex())
	if m.Rating != 4.5 || m.Reviews != 1 {
		t.Fatalf("mentorship = %+v", m)
	}
}
