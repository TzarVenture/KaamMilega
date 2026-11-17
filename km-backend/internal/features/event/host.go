package event

import (
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/apperr"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// HostEventRequest is what an Expert fills in to host an event. Only these fields are read from
// the request: seats, attendees and the price are set here, never by the caller. Events hosted
// this way are always free, because only KaamMilega runs paid events (client answers, Nov 2026).
type HostEventRequest struct {
	Title       string `json:"title"`
	Organizer   string `json:"organizer"`
	Description string `json:"description"`
	Date        string `json:"date"` // YYYY-MM-DD
	Time        string `json:"time"` // HH:MM
	Location    string `json:"location"`
	MeetingLink string `json:"meeting_link"`
	ImageURL    string `json:"image_url"`
	Category    string `json:"category"`
	Capacity    int    `json:"capacity"` // 0 = no limit
}

const (
	maxEventTitle    = 120
	maxEventDetails  = 3000
	maxEventCapacity = 100000
)

var (
	ErrEventFieldsMissing = apperr.New("EVENT_FIELDS_REQUIRED", "fill in the title, host name, description, date, time and location")
	ErrEventTooLong       = apperr.New("EVENT_TEXT_TOO_LONG", "the title can be up to 120 characters and the description up to 3,000")
	ErrEventDateInvalid   = apperr.New("EVENT_DATE_INVALID", "choose a date and time that haven't passed yet")
	ErrEventCapacity      = apperr.New("EVENT_CAPACITY_INVALID", "seats must be between 0 (no limit) and 1,00,000")
)

// india is the time zone event dates and times are written in
var india = time.FixedZone("IST", 5*60*60+30*60)

// toEvent checks the request and builds a free event hosted by organizerID
func (r HostEventRequest) toEvent(organizerID primitive.ObjectID, now time.Time) (*Event, error) {
	trim := strings.TrimSpace
	e := &Event{
		Title:       trim(r.Title),
		Organizer:   trim(r.Organizer),
		OrganizerID: organizerID,
		Description: trim(r.Description),
		Date:        trim(r.Date),
		Time:        trim(r.Time),
		Location:    trim(r.Location),
		MeetingLink: trim(r.MeetingLink),
		ImageURL:    trim(r.ImageURL),
		Category:    trim(r.Category),
		Capacity:    r.Capacity,
		Currency:    "INR",
	}
	if e.Title == "" || e.Organizer == "" || e.Description == "" || e.Date == "" || e.Time == "" || e.Location == "" {
		return nil, ErrEventFieldsMissing
	}
	if utf8.RuneCountInString(e.Title) > maxEventTitle || utf8.RuneCountInString(e.Description) > maxEventDetails {
		return nil, ErrEventTooLong
	}
	starts, err := time.ParseInLocation("2006-01-02 15:04", e.Date+" "+e.Time, india)
	if err != nil || starts.Before(now) {
		return nil, ErrEventDateInvalid
	}
	if e.Capacity < 0 || e.Capacity > maxEventCapacity {
		return nil, ErrEventCapacity
	}
	if err := validateMeetingLink(e.MeetingLink); err != nil {
		return nil, err
	}
	e.AvailableSeats = e.Capacity
	return e, nil
}
