package event

import (
	"km-backend/internal/common/apperr"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type EventController struct {
	service EventService
}

func NewEventController(service EventService) *EventController {
	return &EventController{service: service}
}

func (ctrl *EventController) CreateEvent(c *fiber.Ctx) error {
	var e Event
	if err := c.BodyParser(&e); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if userID, ok := c.Locals("user_id").(string); ok && userID != "" {
		if uID, err := primitive.ObjectIDFromHex(userID); err == nil {
			e.OrganizerID = uID
		}
	}

	created, err := ctrl.service.CreateEvent(c.Context(), &e)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(created)
}

func (ctrl *EventController) GetEvents(c *fiber.Ctx) error {
	search := c.Query("search", "")
	location := c.Query("location", "")
	sort := c.Query("sort", "")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	var isPaid *bool
	if paidStr := c.Query("is_paid", ""); paidStr != "" {
		if b, err := strconv.ParseBool(paidStr); err == nil {
			isPaid = &b
		}
	}

	filter := EventFilter{
		Search:   search,
		Location: location,
		Sort:     sort,
		IsPaid:   isPaid,
		Page:     page,
		Limit:    limit,
	}

	events, total, err := ctrl.service.GetEvents(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{
		"data":  events,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (ctrl *EventController) GetEventByID(c *fiber.Ctx) error {
	id := c.Params("id")
	event, err := ctrl.service.GetEventByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Event not found"})
	}
	return c.JSON(event)
}

func (ctrl *EventController) RegisterUser(c *fiber.Ctx) error {
	eventID := c.Params("id")
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	err := ctrl.service.RegisterUser(c.Context(), eventID, userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Successfully registered for event"})
}

// CreateEventOrder godoc
// @Summary Create a Razorpay order for paid event ticket
// @Tags events
// @Accept json
// @Produce json
// @Router /api/events/{id}/create-order [post]
func (ctrl *EventController) CreateEventOrder(c *fiber.Ctx) error {
	eventID := c.Params("id")
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateEventOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	orderRes, err := ctrl.service.CreateEventOrder(c.Context(), userID, eventID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(orderRes)
}

// VerifyEventPayment godoc
// @Summary Verify Razorpay payment and confirm event ticket
// @Tags events
// @Accept json
// @Produce json
// @Router /api/events/{id}/verify-payment [post]
func (ctrl *EventController) VerifyEventPayment(c *fiber.Ctx) error {
	eventID := c.Params("id")
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req VerifyEventPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	ticket, err := ctrl.service.VerifyEventPayment(c.Context(), userID, eventID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{
		"message": "Payment verified and ticket confirmed",
		"ticket":  ticket,
	})
}

// BookWithWallet godoc
// @Summary Purchase event ticket using KaamMilega Wallet balance
// @Tags events
// @Accept json
// @Produce json
// @Router /api/events/{id}/wallet-checkout [post]
func (ctrl *EventController) BookWithWallet(c *fiber.Ctx) error {
	eventID := c.Params("id")
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req EventWalletCheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	ticket, walletSummary, err := ctrl.service.BookTicketWithWallet(c.Context(), userID, eventID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{
		"message": "Ticket purchased successfully via wallet",
		"ticket":  ticket,
		"wallet":  walletSummary,
	})
}

// GetMyTickets godoc
// @Summary Get all tickets purchased by authenticated user
// @Tags events
// @Produce json
// @Router /api/events/my/tickets [get]
func (ctrl *EventController) GetMyTickets(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	tickets, err := ctrl.service.GetMyTickets(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(tickets)
}

// GetEventTicket godoc
// @Summary Get user's confirmed ticket for specific event
// @Tags events
// @Produce json
// @Router /api/events/{id}/ticket [get]
func (ctrl *EventController) GetEventTicket(c *fiber.Ctx) error {
	eventID := c.Params("id")
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	ticket, err := ctrl.service.GetEventTicket(c.Context(), userID, eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}
	if ticket == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No ticket found for this event"})
	}

	return c.JSON(ticket)
}

// GetEventAttendees returns the confirmed attendee list for an event (F64)
func (ctrl *EventController) GetEventAttendees(c *fiber.Ctx) error {
	eventID := c.Params("id")
	if eventID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Event ID is required"})
	}

	attendees, err := ctrl.service.GetEventAttendees(c.Context(), eventID)
	if err != nil {
		if err.Error() == "event not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(attendees)
}

// ──────────────────────────────────────────
// Admin Superpower Handlers (Strictly Protected)
// ──────────────────────────────────────────

func (ctrl *EventController) AdminGetAllEvents(c *fiber.Ctx) error {
	search := c.Query("search", "")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	items, total, err := ctrl.service.AdminGetAllEvents(c.Context(), search, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{
		"data":  items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (ctrl *EventController) AdminGetEventDetail(c *fiber.Ctx) error {
	eventID := c.Params("id")
	if eventID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Event ID is required"})
	}

	detail, err := ctrl.service.AdminGetEventDetail(c.Context(), eventID)
	if err != nil {
		if err.Error() == "event not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(detail)
}

func (ctrl *EventController) AdminCreateEvent(c *fiber.Ctx) error {
	var e Event
	if err := c.BodyParser(&e); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	created, err := ctrl.service.AdminCreateEvent(c.Context(), &e)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusCreated).JSON(created)
}

func (ctrl *EventController) AdminUpdateEvent(c *fiber.Ctx) error {
	eventID := c.Params("id")
	if eventID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Event ID is required"})
	}

	var req AdminUpdateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid update payload"})
	}

	updated, err := ctrl.service.AdminUpdateEvent(c.Context(), eventID, req)
	if err != nil {
		if err.Error() == "event not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(updated)
}

func (ctrl *EventController) AdminDeleteEvent(c *fiber.Ctx) error {
	eventID := c.Params("id")
	if eventID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Event ID is required"})
	}

	if err := ctrl.service.AdminDeleteEvent(c.Context(), eventID); err != nil {
		if err.Error() == "event not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{
		"message": "Event deleted successfully and related tickets updated",
		"id":      eventID,
	})
}


