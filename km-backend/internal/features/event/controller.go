package event

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
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

	created, err := ctrl.service.CreateEvent(c.Context(), &e)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(created)
}

func (ctrl *EventController) GetEvents(c *fiber.Ctx) error {
	search := c.Query("search", "")
	location := c.Query("location", "")
	sort := c.Query("sort", "")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	filter := EventFilter{
		Search:   search,
		Location: location,
		Sort:     sort,
		Page:     page,
		Limit:    limit,
	}

	events, total, err := ctrl.service.GetEvents(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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
	userID := c.Locals("user_id").(string) // Assuming user_id is set in middleware
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	err := ctrl.service.RegisterUser(c.Context(), eventID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Successfully registered for event"})
}
