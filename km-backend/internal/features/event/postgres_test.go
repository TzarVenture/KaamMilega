package event

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"

	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/database/pgtest"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// These run against a throwaway Postgres schema (see pgtest). Attendee profiles come from
// MongoDB, which these tests don't need, so the client never connects.

func TestMain(m *testing.M) { os.Exit(pgtest.Run(m)) }

type pgEnv struct {
	ctx  context.Context
	repo *EventRepositoryImpl
	tx   *database.PgTransactor
}

func setupPG(t *testing.T) *pgEnv {
	t.Helper()
	pg := pgtest.New(t)
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI("mongodb://127.0.0.1:1"))
	if err != nil {
		t.Fatal(err)
	}
	mdb := &database.MongodbDB{Client: client, Config: &config.Config{}, DB: client.Database("unused")}
	return &pgEnv{
		ctx:  context.Background(),
		repo: NewEventRepository(pg, mdb).(*EventRepositoryImpl),
		tx:   database.NewPgTransactor(pg),
	}
}

func (e *pgEnv) event(t *testing.T, capacity int, price float64) *Event {
	t.Helper()
	ev, err := e.repo.CreateEvent(e.ctx, &Event{Title: "Meetup", Organizer: "KM", Date: "2026-12-01", Capacity: capacity, IsPaid: price > 0, Price: price})
	if err != nil {
		t.Fatal(err)
	}
	return ev
}

// book claims a seat and writes the ticket in one transaction, as issueTicket does
func (e *pgEnv) book(ev *Event, user primitive.ObjectID) error {
	return e.tx.Run(e.ctx, func(ctx context.Context) error {
		if err := e.repo.DecrementAvailableSeats(ctx, ev.ID); err != nil {
			return err
		}
		id := primitive.NewObjectID()
		if _, err := e.repo.CreateTicket(ctx, &EventTicket{
			ID: id, TicketNumber: "TKT-" + id.Hex(), EventID: ev.ID, UserID: user, Amount: ev.Price,
			PaymentStatus: "paid", PaymentMethod: "wallet", Status: "confirmed",
		}); err != nil {
			return err
		}
		return e.repo.RegisterUser(ctx, ev.ID, user)
	})
}

func TestEventRoundTrip(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 5, 499.5)
	got, err := e.repo.GetEventByID(e.ctx, ev.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Price != 499.5 || got.AvailableSeats != 5 || got.Currency != "INR" || len(got.Participants) != 0 {
		t.Fatalf("event = %+v", got)
	}
}

func TestOnlyOneBuyerGetsTheLastSeat(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 1, 100)

	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = e.book(ev, primitive.NewObjectID())
		}(i)
	}
	wg.Wait()

	won := 0
	for _, err := range errs {
		switch {
		case err == nil:
			won++
		case !errors.Is(err, ErrEventSoldOut):
			t.Fatalf("unexpected error: %v", err)
		}
	}
	got, _ := e.repo.GetEventByID(e.ctx, ev.ID)
	if won != 1 || got.AvailableSeats != 0 || len(got.Participants) != 1 {
		t.Fatalf("won = %d, seats = %d, participants = %d", won, got.AvailableSeats, len(got.Participants))
	}
}

func TestSecondTicketForSamePersonIsRejectedAndRollsBackTheSeat(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 3, 100)
	user := primitive.NewObjectID()
	if err := e.book(ev, user); err != nil {
		t.Fatal(err)
	}
	if err := e.book(ev, user); !errors.Is(err, ErrEventTicketTaken) {
		t.Fatalf("err = %v", err)
	}
	got, _ := e.repo.GetEventByID(e.ctx, ev.ID)
	if got.AvailableSeats != 2 {
		t.Fatalf("seats = %d, the failed booking must not keep a seat", got.AvailableSeats)
	}
}

func TestRevokeReturnsTheSeatOnce(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 2, 100)
	user := primitive.NewObjectID()
	order := "order_" + primitive.NewObjectID().Hex()
	if err := e.repo.pg.Exec(`INSERT INTO payment_orders (id, razorpay_order_id, razorpay_payment_id, user_id, purpose, amount_paise, status)
		VALUES (?, ?, 'pay_1', ?, 'event_ticket', 10000, 'paid')`, primitive.NewObjectID().Hex(), order, user.Hex()).Error; err != nil {
		t.Fatal(err)
	}
	err := e.tx.Run(e.ctx, func(ctx context.Context) error {
		if err := e.repo.DecrementAvailableSeats(ctx, ev.ID); err != nil {
			return err
		}
		if _, err := e.repo.CreateTicket(ctx, &EventTicket{TicketNumber: "TKT-R", EventID: ev.ID, UserID: user, Amount: 100,
			PaymentStatus: "paid", PaymentMethod: "razorpay", RazorpayOrderID: order, Status: "confirmed"}); err != nil {
			return err
		}
		return e.repo.RegisterUser(ctx, ev.ID, user)
	})
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 2; i++ {
		if err := e.repo.RevokeTicket(e.ctx, ev.ID, user, order); err != nil {
			t.Fatal(err)
		}
	}
	got, _ := e.repo.GetEventByID(e.ctx, ev.ID)
	if got.AvailableSeats != 2 || len(got.Participants) != 0 {
		t.Fatalf("seats = %d, participants = %d", got.AvailableSeats, len(got.Participants))
	}
	if tk, _ := e.repo.GetTicketByEventAndUser(e.ctx, ev.ID, user); tk != nil {
		t.Fatal("ticket still confirmed")
	}
}

func TestDeletedEventIsHiddenAndTicketsCancelled(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 0, 0)
	user := primitive.NewObjectID()
	if _, err := e.repo.CreateTicket(e.ctx, &EventTicket{TicketNumber: "TKT-D", EventID: ev.ID, UserID: user,
		PaymentStatus: "free", PaymentMethod: "free", Status: "confirmed"}); err != nil {
		t.Fatal(err)
	}
	if err := e.repo.AdminDeleteEvent(e.ctx, ev.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.repo.GetEventByID(e.ctx, ev.ID); err == nil {
		t.Fatal("deleted event still visible")
	}
	list, total, err := e.repo.GetEvents(e.ctx, EventFilter{})
	if err != nil || total != 0 || len(list) != 0 {
		t.Fatalf("list = %d, total = %d, err = %v", len(list), total, err)
	}
	if tickets, _ := e.repo.GetTicketsByUser(e.ctx, user); len(tickets) != 0 {
		t.Fatal("ticket of a deleted event is still confirmed")
	}
	if err := e.repo.AdminDeleteEvent(e.ctx, ev.ID); err == nil {
		t.Fatal("deleting twice should report not found")
	}
}

func TestAdminCanNotSetMoreSeatsThanCapacity(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 10, 0)
	seats := 50
	if _, err := e.repo.AdminUpdateEvent(e.ctx, ev.ID, AdminUpdateEventRequest{Price: -1, Capacity: -1, AvailableSeats: &seats}); !errors.Is(err, ErrSeatsAboveCapacity) {
		t.Fatalf("err = %v", err)
	}
}

func TestSearchAndAdminStats(t *testing.T) {
	e := setupPG(t)
	ev := e.event(t, 5, 200)
	e.event(t, 0, 0) // a second event that doesn't match
	if _, err := e.repo.AdminUpdateEvent(e.ctx, ev.ID, AdminUpdateEventRequest{Title: "Go 100% workshop", Price: -1, Capacity: -1}); err != nil {
		t.Fatal(err)
	}
	if err := e.book(ev, primitive.NewObjectID()); err != nil {
		t.Fatal(err)
	}

	list, total, err := e.repo.GetEvents(e.ctx, EventFilter{Search: "100%"})
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("search: list = %d, total = %d, err = %v", len(list), total, err)
	}
	items, _, err := e.repo.AdminGetAllEvents(e.ctx, "workshop", 1, 10)
	if err != nil || len(items) != 1 {
		t.Fatalf("admin list = %d, err = %v", len(items), err)
	}
	if it := items[0]; it.TotalTicketsSold != 1 || it.TotalRevenue != 200 || it.WalletBookings != 1 || it.TotalParticipants != 1 {
		t.Fatalf("stats = %+v", it)
	}
}
