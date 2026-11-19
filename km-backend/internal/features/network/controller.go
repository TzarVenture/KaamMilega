package network

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"km-backend/internal/common/apperr"
)

type NetworkController struct {
	service NetworkService
}

func NewNetworkController(service NetworkService) *NetworkController {
	return &NetworkController{service: service}
}

func (ctrl *NetworkController) SendInvitation(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req ConnectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := ctrl.service.SendInvitation(c.Context(), userID, req.ReceiverID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Invitation sent"})
}

func (ctrl *NetworkController) AcceptInvitation(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req AcceptRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := ctrl.service.AcceptInvitation(c.Context(), userID, req.SenderID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Invitation accepted"})
}

func (ctrl *NetworkController) IgnoreInvitation(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req AcceptRequest // Reusing same struct for SenderID
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := ctrl.service.IgnoreInvitation(c.Context(), userID, req.SenderID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Invitation ignored"})
}

func (ctrl *NetworkController) GetPendingInvitations(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	invitations, err := ctrl.service.GetPendingInvitations(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(invitations)
}

func (ctrl *NetworkController) GetSentInvitations(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sent, err := ctrl.service.GetSentPendingInvitations(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	res := make([]string, 0, len(sent))
	for _, id := range sent {
		res = append(res, id.Hex())
	}

	return c.JSON(res)
}

func (ctrl *NetworkController) GetConnections(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	connections, err := ctrl.service.GetConnections(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(connections)
}

func (ctrl *NetworkController) GetStatus(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	otherUserID := c.Params("id")

	status, err := ctrl.service.GetConnectionStatus(c.Context(), userIDStr, otherUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"status": status})
}

func (ctrl *NetworkController) DeleteConnection(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	otherID := c.Params("id")
	if otherID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing id parameter"})
	}

	if err := ctrl.service.DeleteConnection(c.Context(), userID, otherID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Connection deleted"})
}

func (ctrl *NetworkController) GetSuggestions(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	filter := SuggestionsFilter{
		Type:  c.Query("type", "all"),
		Page:  c.QueryInt("page", 1),
		Limit: c.QueryInt("limit", 20),
	}

	suggestions, err := ctrl.service.GetSuggestions(c.Context(), userID, filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(suggestions)
}

func (ctrl *NetworkController) DismissSuggestion(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetID := c.Params("id")
	if targetID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing suggestion id"})
	}

	if err := ctrl.service.DismissSuggestion(c.Context(), userID, targetID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Suggestion dismissed"})
}

func signedInUser(c *fiber.Ctx) (primitive.ObjectID, bool) {
	s, _ := c.Locals("user_id").(string)
	id, err := primitive.ObjectIDFromHex(s)
	return id, err == nil
}

func (ctrl *NetworkController) CompanySuggestions(c *fiber.Ctx) error {
	userID, ok := signedInUser(c)
	if !ok {
		return apperr.Respond(c, errNotSignedIn)
	}
	list, err := ctrl.service.CompanySuggestions(c.Context(), userID, c.QueryInt("limit", 6))
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"data": list})
}

func (ctrl *NetworkController) FollowedCompanies(c *fiber.Ctx) error {
	userID, ok := signedInUser(c)
	if !ok {
		return apperr.Respond(c, errNotSignedIn)
	}
	ids, err := ctrl.service.FollowedCompanies(c.Context(), userID)
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"data": ids})
}

func (ctrl *NetworkController) FollowCompany(c *fiber.Ctx) error {
	userID, ok := signedInUser(c)
	if !ok {
		return apperr.Respond(c, errNotSignedIn)
	}
	if err := ctrl.service.FollowCompany(c.Context(), userID, c.Params("id")); err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"following": true})
}

func (ctrl *NetworkController) UnfollowCompany(c *fiber.Ctx) error {
	userID, ok := signedInUser(c)
	if !ok {
		return apperr.Respond(c, errNotSignedIn)
	}
	if err := ctrl.service.UnfollowCompany(c.Context(), userID, c.Params("id")); err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"following": false})
}

func (ctrl *NetworkController) CompanyPeople(c *fiber.Ctx) error {
	userID, ok := signedInUser(c)
	if !ok {
		return apperr.Respond(c, errNotSignedIn)
	}
	people, err := ctrl.service.CompanyPeople(c.Context(), userID, c.Params("id"), c.QueryInt("limit", 24))
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"data": people})
}
