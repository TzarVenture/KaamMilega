package feed

import (
	"errors"
	"log"
	"strconv"
	"strings"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/analytics"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FeedController struct {
	service FeedService
}

func NewFeedController(service FeedService) *FeedController {
	return &FeedController{service: service}
}

var errInvalidID = apperr.New("FEED_POST_NOT_FOUND", "This post doesn't exist or was removed.")

// fail picks the status for an error: missing → 404, not yours → 403, too fast → 429, any
// other coded error is a bad request, and the rest is logged and hidden behind a 500
func fail(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrPostNotFound), errors.Is(err, ErrCommentNotFound):
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	case errors.Is(err, ErrNotAllowed), errors.Is(err, ErrReportOwnPost):
		return c.Status(fiber.StatusForbidden).JSON(apperr.Body(err))
	case errors.Is(err, ErrPostRateLimited), errors.Is(err, ErrCommentRateLimit):
		return c.Status(fiber.StatusTooManyRequests).JSON(apperr.Body(err))
	case apperr.CodeOf(err) != "":
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	log.Printf("feed: %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Something went wrong. Please try again."})
}

// viewer is the signed-in member, or nil on a public request
func viewer(c *fiber.Ctx) *primitive.ObjectID {
	s, _ := c.Locals("user_id").(string)
	id, err := primitive.ObjectIDFromHex(s)
	if err != nil {
		return nil
	}
	return &id
}

// me is the signed-in member on a protected route (the auth middleware guarantees one)
func me(c *fiber.Ctx) (primitive.ObjectID, bool) {
	v := viewer(c)
	if v == nil {
		return primitive.NilObjectID, false
	}
	return *v, true
}

func isAdmin(c *fiber.Ctx) bool {
	switch roles := c.Locals("roles").(type) {
	case []string:
		for _, r := range roles {
			if r == "admin" {
				return true
			}
		}
	case []interface{}:
		for _, r := range roles {
			if s, ok := r.(string); ok && s == "admin" {
				return true
			}
		}
	}
	return false
}

// RecordImpressions godoc
// @Summary Count posts seen on screen
// @Description The browser sends the posts that were at least half on screen for a moment. Each member, and each signed-out visitor (by the anonymous km_vid cookie the feed sets), counts once a day per post. Authors seeing their own posts, admins, bots and visitors without the cookie don't count. Up to 30 posts per call.
// @Tags feed
// @Accept json
// @Param body body ImpressionsRequest true "Post IDs"
// @Success 204
// @Router /api/feed/impressions [post]
func (ctrl *FeedController) RecordImpressions(c *fiber.Ctx) error {
	var who analytics.Viewer
	if id, ok := me(c); ok {
		if isAdmin(c) {
			return c.SendStatus(fiber.StatusNoContent)
		}
		who = analytics.Member(id)
	} else if vid := analytics.VisitorID(c); vid != "" {
		who = analytics.Guest(vid)
	} else {
		// Nothing to tell this visitor apart by, so nothing is counted
		return c.SendStatus(fiber.StatusNoContent)
	}
	var req ImpressionsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	ids := make([]primitive.ObjectID, 0, len(req.PostIDs))
	for _, raw := range req.PostIDs {
		if id, err := primitive.ObjectIDFromHex(raw); err == nil {
			ids = append(ids, id)
		}
	}
	if err := ctrl.service.RecordImpressions(c.Context(), who, ids); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Trending godoc
// @Summary Trending hashtags
// @Description The hashtags used by the most posts in the last 7 days.
// @Tags feed
// @Produce json
// @Success 200 {object} TrendingResponse
// @Router /api/feed/trending [get]
func (ctrl *FeedController) Trending(c *fiber.Ctx) error {
	res, err := ctrl.service.Trending(c.Context())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

func pathID(c *fiber.Ctx, name string) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(c.Params(name))
	return id, err == nil
}

// cursor reads an optional ?before=<id>; a malformed one starts from the top
func cursor(c *fiber.Ctx) *primitive.ObjectID {
	id, err := primitive.ObjectIDFromHex(strings.TrimSpace(c.Query("before")))
	if err != nil {
		return nil
	}
	return &id
}

func unauthorized(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Please sign in."})
}

// List godoc
// @Summary List feed posts
// @Description Newest first. Pass next_cursor back as `before` for the next page.
// @Tags feed
// @Produce json
// @Param category query string false "all | general | jobs | skills | mentors"
// @Param tag query string false "Hashtag, with or without #"
// @Param author_id query string false "Only this member's posts"
// @Param before query string false "Cursor from the previous page"
// @Param limit query int false "Page size (max 30)"
// @Success 200 {object} ListResponse
// @Router /api/feed [get]
func (ctrl *FeedController) List(c *fiber.Ctx) error {
	q := ListQuery{
		Category: strings.ToLower(strings.TrimSpace(c.Query("category"))),
		Tag:      c.Query("tag"),
		Before:   cursor(c),
	}
	q.Limit, _ = strconv.Atoi(c.Query("limit"))
	if raw := strings.TrimSpace(c.Query("author_id")); raw != "" {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil {
			return c.JSON(ListResponse{Posts: []PostResponse{}})
		}
		q.AuthorID = &id
	}
	res, err := ctrl.service.List(c.UserContext(), viewer(c), q)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// ListSaved godoc
// @Summary The signed-in member's saved posts
// @Tags feed
// @Produce json
// @Param before query string false "Cursor from the previous page"
// @Param limit query int false "Page size (max 30)"
// @Success 200 {object} ListResponse
// @Router /api/feed/saved [get]
func (ctrl *FeedController) ListSaved(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	res, err := ctrl.service.ListSaved(c.UserContext(), uid, cursor(c), limit)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// GetPost godoc
// @Summary One post (for shared links)
// @Tags feed
// @Produce json
// @Param id path string true "Post ID"
// @Success 200 {object} PostResponse
// @Router /api/feed/{id} [get]
func (ctrl *FeedController) GetPost(c *fiber.Ctx) error {
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	post, err := ctrl.service.GetPost(c.UserContext(), viewer(c), id)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(post)
}

// CreatePost godoc
// @Summary Create a post
// @Description Photos are uploaded first through POST /api/files/upload with kind=feed_image; pass their file IDs here.
// @Tags feed
// @Accept json
// @Produce json
// @Param request body CreatePostRequest true "Post"
// @Success 201 {object} PostResponse
// @Router /api/feed [post]
func (ctrl *FeedController) CreatePost(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	var req CreatePostRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	post, err := ctrl.service.CreatePost(c.UserContext(), uid, req)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(post)
}

// UpdatePost godoc
// @Summary Edit a post's text or category (author only)
// @Tags feed
// @Accept json
// @Produce json
// @Param id path string true "Post ID"
// @Param request body UpdatePostRequest true "Changes"
// @Success 200 {object} PostResponse
// @Router /api/feed/{id} [patch]
func (ctrl *FeedController) UpdatePost(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	var req UpdatePostRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	post, err := ctrl.service.UpdatePost(c.UserContext(), uid, id, req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(post)
}

// DeletePost godoc
// @Summary Delete a post and its photos (author or admin)
// @Tags feed
// @Param id path string true "Post ID"
// @Success 204
// @Router /api/feed/{id} [delete]
func (ctrl *FeedController) DeletePost(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	if err := ctrl.service.DeletePost(c.UserContext(), uid, isAdmin(c), id); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// React godoc
// @Summary Set the signed-in member's reaction (replaces an earlier one)
// @Tags feed
// @Accept json
// @Produce json
// @Param id path string true "Post ID"
// @Param request body ReactionRequest true "like | celebrate | support | insightful"
// @Success 200 {object} ReactionResponse
// @Router /api/feed/{id}/reaction [put]
func (ctrl *FeedController) React(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	var req ReactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	res, err := ctrl.service.React(c.UserContext(), uid, id, req.Type)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Unreact godoc
// @Summary Remove the signed-in member's reaction
// @Tags feed
// @Produce json
// @Param id path string true "Post ID"
// @Success 200 {object} ReactionResponse
// @Router /api/feed/{id}/reaction [delete]
func (ctrl *FeedController) Unreact(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	res, err := ctrl.service.Unreact(c.UserContext(), uid, id)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Save godoc
// @Summary Save a post (idempotent)
// @Tags feed
// @Param id path string true "Post ID"
// @Success 204
// @Router /api/feed/{id}/save [put]
func (ctrl *FeedController) Save(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	if err := ctrl.service.Save(c.UserContext(), uid, id); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Unsave godoc
// @Summary Remove a post from saved (idempotent)
// @Tags feed
// @Param id path string true "Post ID"
// @Success 204
// @Router /api/feed/{id}/save [delete]
func (ctrl *FeedController) Unsave(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	if err := ctrl.service.Unsave(c.UserContext(), uid, id); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListComments godoc
// @Summary A post's comments, newest first
// @Tags feed
// @Produce json
// @Param id path string true "Post ID"
// @Param before query string false "Cursor from the previous page"
// @Param limit query int false "Page size (max 50)"
// @Success 200 {object} CommentListResponse
// @Router /api/feed/{id}/comments [get]
func (ctrl *FeedController) ListComments(c *fiber.Ctx) error {
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	res, err := ctrl.service.ListComments(c.UserContext(), viewer(c), id, cursor(c), limit)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// AddComment godoc
// @Summary Comment on a post
// @Tags feed
// @Accept json
// @Produce json
// @Param id path string true "Post ID"
// @Param request body CommentRequest true "Comment"
// @Success 201 {object} CommentResponse
// @Router /api/feed/{id}/comments [post]
func (ctrl *FeedController) AddComment(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	var req CommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	comment, err := ctrl.service.AddComment(c.UserContext(), uid, id, req)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(comment)
}

// DeleteComment godoc
// @Summary Delete a comment (its author, the post's author or an admin)
// @Tags feed
// @Param id path string true "Post ID"
// @Param commentId path string true "Comment ID"
// @Success 204
// @Router /api/feed/{id}/comments/{commentId} [delete]
func (ctrl *FeedController) DeleteComment(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	postID, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	commentID, ok := pathID(c, "commentId")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(ErrCommentNotFound))
	}
	if err := ctrl.service.DeleteComment(c.UserContext(), uid, isAdmin(c), postID, commentID); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Report godoc
// @Summary Report a post to moderators; the reporter stops seeing it
// @Tags feed
// @Accept json
// @Param id path string true "Post ID"
// @Param request body ReportRequest true "reason: spam | harassment | misleading | inappropriate | other"
// @Success 204
// @Router /api/feed/{id}/report [post]
func (ctrl *FeedController) Report(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	var req ReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := ctrl.service.Report(c.UserContext(), uid, id, req); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ─── Moderation (admins) ────────────────────────────────────────────────────────

// AdminReports godoc
// @Summary Reported posts, grouped by post: open ones wait for a decision
// @Tags admin-feed
// @Param state query string false "open (default) | closed"
// @Param page query int false "Page, from 1"
// @Param limit query int false "Posts per page"
// @Success 200 {object} ModerationQueueResponse
// @Router /api/admin/feed/reports [get]
func (ctrl *FeedController) AdminReports(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	res, err := ctrl.service.ModerationQueue(c.UserContext(), c.Query("state") != "closed", page, limit)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// AdminReportDetail godoc
// @Summary A reported post with every report on it
// @Tags admin-feed
// @Param id path string true "Post ID"
// @Success 200 {object} ModerationDetailResponse
// @Router /api/admin/feed/reports/{id} [get]
func (ctrl *FeedController) AdminReportDetail(c *fiber.Ctx) error {
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	res, err := ctrl.service.ModerationDetail(c.UserContext(), id)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// AdminModerate godoc
// @Summary Keep a reported post (back in the feed) or remove it; closes its open reports
// @Tags admin-feed
// @Accept json
// @Param id path string true "Post ID"
// @Param request body ModerationRequest true "action: keep | remove"
// @Success 204
// @Router /api/admin/feed/reports/{id}/decision [post]
func (ctrl *FeedController) AdminModerate(c *fiber.Ctx) error {
	uid, ok := me(c)
	if !ok {
		return unauthorized(c)
	}
	id, ok := pathID(c, "id")
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errInvalidID))
	}
	var req ModerationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := ctrl.service.Moderate(c.UserContext(), uid, id, req.Action); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
