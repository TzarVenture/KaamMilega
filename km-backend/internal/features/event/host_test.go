package event

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func hostRequest() HostEventRequest {
	return HostEventRequest{
		Title: " Resume clinic ", Organizer: "Asha", Description: "Bring your resume.",
		Date: "2026-12-01", Time: "18:30", Location: "Online", Capacity: 50,
	}
}

var hostNow = time.Date(2026, 11, 17, 12, 0, 0, 0, india)

func TestHostedEventIsAlwaysFreeAndKeepsOnlyHostFields(t *testing.T) {
	// A caller trying to set the price, the seats left or the attendee list
	body := []byte(`{"title":"Resume clinic","organizer":"Asha","description":"Bring your resume.",
		"date":"2026-12-01","time":"18:30","location":"Online","capacity":50,
		"is_paid":true,"price":999,"available_seats":5000,"participants":["6adc525aec708287c87ec7f5"],
		"id":"6adc525aec708287c87ec7f5"}`)
	var req HostEventRequest
	if err := json.Unmarshal(body, &req); err != nil {
		t.Fatal(err)
	}
	host := primitive.NewObjectID()
	e, err := req.toEvent(host, hostNow)
	if err != nil {
		t.Fatal(err)
	}
	if e.IsPaid || e.Price != 0 {
		t.Fatalf("hosted event is paid %v at %v, want free", e.IsPaid, e.Price)
	}
	if e.AvailableSeats != 50 || len(e.Participants) != 0 || !e.ID.IsZero() {
		t.Fatalf("seats %d, participants %v, id %v: want 50 seats, nobody registered, a new id", e.AvailableSeats, e.Participants, e.ID)
	}
	if e.OrganizerID != host {
		t.Fatalf("organizer %v, want the signed-in host", e.OrganizerID)
	}
}

func TestHostedEventFieldsAreChecked(t *testing.T) {
	cases := map[string]struct {
		edit func(*HostEventRequest)
		want error
	}{
		"no title":    {func(r *HostEventRequest) { r.Title = "  " }, ErrEventFieldsMissing},
		"no location": {func(r *HostEventRequest) { r.Location = "" }, ErrEventFieldsMissing},
		"in the past": {func(r *HostEventRequest) { r.Date = "2026-11-17"; r.Time = "11:00" }, ErrEventDateInvalid},
		"bad date":    {func(r *HostEventRequest) { r.Date = "01/12/2026" }, ErrEventDateInvalid},
		"minus seats": {func(r *HostEventRequest) { r.Capacity = -1 }, ErrEventCapacity},
		"too many":    {func(r *HostEventRequest) { r.Capacity = 200000 }, ErrEventCapacity},
	}
	for name, c := range cases {
		req := hostRequest()
		c.edit(&req)
		if _, err := req.toEvent(primitive.NewObjectID(), hostNow); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", name, err, c.want)
		}
	}

	req := hostRequest()
	req.MeetingLink = "http://insecure.example"
	if _, err := req.toEvent(primitive.NewObjectID(), hostNow); err == nil {
		t.Error("an http:// meeting link was accepted")
	}

	e, err := hostRequest().toEvent(primitive.NewObjectID(), hostNow)
	if err != nil || e.Title != "Resume clinic" {
		t.Fatalf("valid event: %v, title %q", err, e.Title)
	}
}
