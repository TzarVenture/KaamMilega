// Package apperr gives API errors a stable code next to the English message, so the website and
// the app can show the message in the user's language.
//
// Every JSON error response looks like {"error": "<English message>", "code": "<CODE>"}:
//   - errors created with New carry their own specific code (OTP_INVALID, WALLET_INSUFFICIENT…);
//   - any other error response gets a generic code from its HTTP status (NOT_FOUND,
//     BAD_REQUEST…), added by the Codes middleware.
//
// Codes are part of the API: never rename one; add a new code instead. The website keeps the
// translations in km-frontend/messages/<locale>.json under "errors".
package apperr

import (
	"bytes"
	"encoding/json"
	"errors"

	"github.com/gofiber/fiber/v2"
)

// Error is an error with a code. The HTTP status stays the handler's choice.
type Error struct {
	Code    string
	Message string
}

// New creates a coded error. Use it for package-level sentinel errors (compare with errors.Is)
// or inline with a formatted message.
func New(code, message string) *Error {
	return &Error{Code: code, Message: message}
}

func (e *Error) Error() string { return e.Message }

// CodeOf returns the code of err or of a coded error it wraps, or "".
func CodeOf(err error) string {
	var e *Error
	if errors.As(err, &e) {
		return e.Code
	}
	return ""
}

// Body is the JSON body for an error response: the message, plus the code when err has one
// (otherwise the Codes middleware adds a generic code from the status).
func Body(err error) fiber.Map {
	if code := CodeOf(err); code != "" {
		return fiber.Map{"error": err.Error(), "code": code}
	}
	return fiber.Map{"error": err.Error()}
}

// StatusCode is the generic code for an HTTP error status.
func StatusCode(status int) string {
	switch {
	case status == fiber.StatusBadRequest, status == fiber.StatusUnprocessableEntity:
		return "BAD_REQUEST"
	case status == fiber.StatusUnauthorized:
		return "UNAUTHORIZED"
	case status == fiber.StatusPaymentRequired:
		return "PAYMENT_REQUIRED"
	case status == fiber.StatusForbidden:
		return "FORBIDDEN"
	case status == fiber.StatusNotFound:
		return "NOT_FOUND"
	case status == fiber.StatusConflict:
		return "CONFLICT"
	case status == fiber.StatusRequestEntityTooLarge:
		return "TOO_LARGE"
	case status == fiber.StatusTooManyRequests:
		return "TOO_MANY_REQUESTS"
	case status == fiber.StatusServiceUnavailable:
		return "UNAVAILABLE"
	case status >= 500:
		return "SERVER_ERROR"
	default:
		return "REQUEST_FAILED"
	}
}

// Codes adds a generic "code" to JSON error responses (status 400+) that have an "error" but no
// "code". Register it once, before the routes.
func Codes() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := c.Next(); err != nil {
			// Returned errors are written by the app's ErrorHandler, which adds the code itself
			return err
		}
		res := c.Response()
		status := res.StatusCode()
		if status < 400 || !bytes.HasPrefix(res.Header.ContentType(), []byte(fiber.MIMEApplicationJSON)) {
			return nil
		}
		var body map[string]any
		dec := json.NewDecoder(bytes.NewReader(res.Body()))
		dec.UseNumber() // keep numbers exactly as the handler wrote them
		if dec.Decode(&body) != nil {
			return nil
		}
		if _, ok := body["error"]; !ok {
			return nil
		}
		if _, ok := body["code"]; ok {
			return nil
		}
		body["code"] = StatusCode(status)
		out, err := json.Marshal(body)
		if err != nil {
			return nil
		}
		res.SetBody(out)
		return nil
	}
}
