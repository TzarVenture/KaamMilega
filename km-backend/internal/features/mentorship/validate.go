package mentorship

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
)

var (
	ErrSessionTitle     = apperr.New("MENTORSHIP_TITLE_INVALID", fmt.Sprintf("give the session a title of up to %d characters", MaxTitleLength))
	ErrSessionDetails   = apperr.New("MENTORSHIP_DETAILS_INVALID", fmt.Sprintf("add a category and a description of up to %d characters", MaxDetailsLength))
	ErrSessionDuration  = apperr.New("MENTORSHIP_DURATION_INVALID", fmt.Sprintf("a session lasts between %d and %d minutes", MinSessionMinutes, MaxSessionMinutes))
	ErrSessionPrice     = apperr.New("MENTORSHIP_PRICE_RANGE", "set a price between ₹99 and ₹50,000")
	ErrSessionStatus    = apperr.New("MENTORSHIP_STATE_INVALID", "a session can only be active or paused")
	ErrNotYourSession   = apperr.New("MENTORSHIP_FORBIDDEN", "this session isn't yours")
	ErrSessionHasBooked = apperr.New("MENTORSHIP_HAS_BOOKINGS", "this session has bookings that aren't finished. Complete or cancel them first, or pause the session instead")
)

// cleanSession trims a session's text and checks every field an expert fills in
func cleanSession(req *CreateMentorshipRequest) error {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Category = strings.TrimSpace(req.Category)
	req.Status = strings.TrimSpace(req.Status)

	if req.Title == "" || utf8.RuneCountInString(req.Title) > MaxTitleLength {
		return ErrSessionTitle
	}
	if req.Category == "" || req.Description == "" || utf8.RuneCountInString(req.Description) > MaxDetailsLength {
		return ErrSessionDetails
	}
	if req.Duration < MinSessionMinutes || req.Duration > MaxSessionMinutes {
		return ErrSessionDuration
	}
	if req.Price < MinSessionPrice || req.Price > MaxSessionPrice {
		return ErrSessionPrice
	}
	if req.Status != "" && req.Status != "active" && req.Status != "inactive" {
		return ErrSessionStatus
	}
	return nil
}

// openBooking is a booking that still needs the session: not yet done, paid out or refunded
func openBooking(status string) bool {
	switch status {
	case BookingPending, BookingConfirmed, BookingAwaitingConfirmation, BookingReported:
		return true
	}
	return false
}

// sessionErrorStatus picks the HTTP status for an error from creating, editing or deleting a session
func sessionErrorStatus(err error) int {
	switch {
	case errors.Is(err, ErrMentorshipGone):
		return fiber.StatusNotFound
	case errors.Is(err, ErrNotYourSession):
		return fiber.StatusForbidden
	case errors.Is(err, ErrSessionHasBooked):
		return fiber.StatusConflict
	case errors.Is(err, ErrSessionTitle), errors.Is(err, ErrSessionDetails), errors.Is(err, ErrSessionDuration),
		errors.Is(err, ErrSessionPrice), errors.Is(err, ErrSessionStatus):
		return fiber.StatusBadRequest
	}
	return fiber.StatusInternalServerError
}
