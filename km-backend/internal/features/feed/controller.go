package feed

import (
	"strconv"
	"strings"
	"time"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FeedController struct {
	service FeedService
}

func NewFeedController(service FeedService) *FeedController {
	return &FeedController{service: service}
}

func parseCurrentUserID(c *fiber.Ctx) *primitive.ObjectID {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return nil
	}
	oid, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil
	}
	return &oid
}

func isAdmin(c *fiber.Ctx) bool {
	switch roles := c.Locals("roles").(type) {
	case []interface{}:
		for _, r := range roles {
			if s, ok := r.(string); ok && s == "admin" {
				return true
			}
		}
	case []string:
		for _, r := range roles {
			if r == "admin" {
				return true
			}
		}
	}
	return false
}

// GetFeed godoc
// @Summary List feed posts
// @Description Fetch paginated feed posts with cursor-based pagination
// @Tags feed
// @Produce json
// @Param category query string false "Feed category (all, jobs, skills, mentors)"
// @Param before query string false "RFC3339 cursor timestamp"
// @Param limit query int false "Number of posts to return (default 15)"
// @Param author_id query string false "Filter by specific author ID"
// @Param saved query bool false "Filter only current user saved posts"
// @Success 200 {object} FeedListResponse
// @Router /api/feed [get]
func (ctrl *FeedController) GetFeed(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)

	category := c.Query("category", "")
	beforeStr := c.Query("before", "")
	var before time.Time
	if beforeStr != "" {
		if t, err := time.Parse(time.RFC3339Nano, beforeStr); err == nil {
			before = t
		} else if t, err := time.Parse(time.RFC3339, beforeStr); err == nil {
			before = t
		}
	}

	limit, _ := strconv.Atoi(c.Query("limit", "15"))

	var authorOID *primitive.ObjectID
	if authorStr := strings.TrimSpace(c.Query("author_id", "")); authorStr != "" {
		if oid, err := primitive.ObjectIDFromHex(authorStr); err == nil {
			authorOID = &oid
		}
	}

	savedOnly := c.Query("saved", "false") == "true"

	res, err := ctrl.service.GetFeed(c.UserContext(), currentUserID, category, before, limit, authorOID, savedOnly)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(res)
}

// GetPost godoc
// @Summary Get post by ID
// @Tags feed
// @Produce json
// @Param id path string true "Post ID"
// @Success 200 {object} FeedPostResponse
// @Router /api/feed/{id} [get]
func (ctrl *FeedController) GetPost(c *fiber.Ctx) error {
	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	currentUserID := parseCurrentUserID(c)
	post, err := ctrl.service.GetPost(c.UserContext(), currentUserID, postID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	}

	return c.JSON(post)
}

// CreatePost godoc
// @Summary Create a feed post
// @Tags feed
// @Accept json
// @Produce json
// @Param request body CreatePostRequest true "Post payload"
// @Success 201 {object} FeedPostResponse
// @Router /api/feed [post]
func (ctrl *FeedController) CreatePost(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreatePostRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	post, err := ctrl.service.CreatePost(c.UserContext(), *currentUserID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusCreated).JSON(post)
}

// DeletePost godoc
// @Summary Delete a feed post
// @Tags feed
// @Param id path string true "Post ID"
// @Success 200 {object} map[string]string
// @Router /api/feed/{id} [delete]
func (ctrl *FeedController) DeletePost(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	if err := ctrl.service.DeletePost(c.UserContext(), *currentUserID, isAdmin(c), postID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Post deleted successfully"})
}

// ReactToPost godoc
// @Summary React to a feed post
// @Tags feed
// @Accept json
// @Produce json
// @Param id path string true "Post ID"
// @Param request body ReactionRequest true "Reaction payload"
// @Success 200 {object} FeedPostResponse
// @Router /api/feed/{id}/reactions [post]
func (ctrl *FeedController) ReactToPost(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	var req ReactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	post, err := ctrl.service.ReactToPost(c.UserContext(), *currentUserID, postID, req.Reaction)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(post)
}

// ToggleSavePost godoc
// @Summary Save or unsave a feed post
// @Tags feed
// @Param id path string true "Post ID"
// @Success 200 {object} map[string]any
// @Router /api/feed/{id}/save [post]
func (ctrl *FeedController) ToggleSavePost(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	isSaved, err := ctrl.service.ToggleSavePost(c.UserContext(), *currentUserID, postID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"saved": isSaved})
}

// ToggleRepostPost godoc
// @Summary Repost or un-repost a feed post
// @Tags feed
// @Param id path string true "Post ID"
// @Success 200 {object} map[string]any
// @Router /api/feed/{id}/repost [post]
func (ctrl *FeedController) ToggleRepostPost(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	isReposted, count, err := ctrl.service.ToggleRepostPost(c.UserContext(), *currentUserID, postID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"reposted": isReposted, "reposts_count": count})
}

// AddComment godoc
// @Summary Add comment to a post
// @Tags feed
// @Accept json
// @Produce json
// @Param id path string true "Post ID"
// @Param request body CommentRequest true "Comment body"
// @Success 201 {object} FeedCommentResponse
// @Router /api/feed/{id}/comments [post]
func (ctrl *FeedController) AddComment(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	var req CommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	comment, err := ctrl.service.AddComment(c.UserContext(), *currentUserID, postID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusCreated).JSON(comment)
}

// GetComments godoc
// @Summary Get comments for a post
// @Tags feed
// @Produce json
// @Param id path string true "Post ID"
// @Param limit query int false "Number of comments"
// @Success 200 {array} FeedCommentResponse
// @Router /api/feed/{id}/comments [get]
func (ctrl *FeedController) GetComments(c *fiber.Ctx) error {
	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	currentUserID := parseCurrentUserID(c)

	comments, err := ctrl.service.GetComments(c.UserContext(), currentUserID, postID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.JSON(comments)
}

// DeleteComment godoc
// @Summary Delete a comment
// @Tags feed
// @Param id path string true "Post ID"
// @Param commentId path string true "Comment ID"
// @Success 200 {object} map[string]string
// @Router /api/feed/{id}/comments/{commentId} [delete]
func (ctrl *FeedController) DeleteComment(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	commentID, err := primitive.ObjectIDFromHex(c.Params("commentId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid comment ID"})
	}

	if err := ctrl.service.DeleteComment(c.UserContext(), *currentUserID, isAdmin(c), commentID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Comment deleted successfully"})
}

// ReportPost godoc
// @Summary Report a feed post
// @Tags feed
// @Accept json
// @Produce json
// @Param id path string true "Post ID"
// @Param request body ReportPostRequest true "Report body"
// @Success 200 {object} map[string]string
// @Router /api/feed/{id}/report [post]
func (ctrl *FeedController) ReportPost(c *fiber.Ctx) error {
	currentUserID := parseCurrentUserID(c)
	if currentUserID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	postID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid post ID"})
	}

	var req ReportPostRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := ctrl.service.ReportPost(c.UserContext(), *currentUserID, postID, req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.JSON(fiber.Map{"message": "Post reported. Our moderation team will review it."})
}

