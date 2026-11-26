package story

import (
	"context"
	"errors"
	"log"
	"time"

	"km-backend/internal/common/api"
	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.uber.org/fx"
)

type Api struct {
	service Service
	config  *config.Config
}

func NewApi(service Service, cfg *config.Config) api.Route {
	return &Api{service: service, config: cfg}
}

func (a *Api) Setup(app *fiber.App) {
	auth := middleware.AuthMiddleware(a.config.JWTSecret)
	g := app.Group("/api/stories", auth)
	g.Get("/", a.Bar)
	g.Post("/", a.Create)
	g.Post("/:id/view", a.View)
	g.Get("/:id/viewers", a.Viewers)
	g.Delete("/:id", a.Delete)
	g.Post("/:id/report", a.Report)

	admin := app.Group("/api/admin/stories", auth, middleware.RequireRole("admin"))
	admin.Get("/reports", a.AdminReports)
	admin.Post("/:id/decision", a.AdminDecide)
}

func fail(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	case errors.Is(err, ErrNotOwner), errors.Is(err, ErrReportOwn):
		return c.Status(fiber.StatusForbidden).JSON(apperr.Body(err))
	case errors.Is(err, ErrDailyLimit):
		return c.Status(fiber.StatusTooManyRequests).JSON(apperr.Body(err))
	case apperr.CodeOf(err) != "":
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	log.Printf("story: %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Something went wrong. Please try again."})
}

func me(c *fiber.Ctx) (primitive.ObjectID, error) {
	s, _ := c.Locals("user_id").(string)
	id, err := primitive.ObjectIDFromHex(s)
	if err != nil {
		return id, c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	return id, nil
}

func storyID(c *fiber.Ctx) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	return id, err == nil
}

// Bar godoc
// @Summary Stories to show at the top of the feed
// @Description One group per member: your own first, then members with stories you haven't seen. Each group's stories are oldest first.
// @Tags stories
// @Produce json
// @Success 200 {array} Group
// @Router /api/stories [get]
func (a *Api) Bar(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	groups, err := a.service.Bar(c.UserContext(), uid)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(groups)
}

// Create godoc
// @Summary Share a story (a photo or a video, with an optional caption), shown for 24 hours
// @Description Upload first: a photo through POST /api/files/upload with kind=story_image, a video (up to 60 seconds, 50 MB) through POST /api/files/multipart with kind=story_video.
// @Tags stories
// @Accept json
// @Produce json
// @Param body body CreateRequest true "The media and caption"
// @Success 201 {object} StoryResponse
// @Router /api/stories [post]
func (a *Api) Create(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	var req CreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	res, err := a.service.Create(c.UserContext(), uid, req)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(res)
}

// View godoc
// @Summary Mark a story as seen (counted once per member; the owner's own views don't count)
// @Tags stories
// @Param id path string true "Story ID"
// @Success 204
// @Router /api/stories/{id}/view [post]
func (a *Api) View(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	id, ok := storyID(c)
	if !ok {
		return fail(c, ErrNotFound)
	}
	if err := a.service.View(c.UserContext(), uid, id); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Viewers godoc
// @Summary Who viewed your story, newest first
// @Tags stories
// @Produce json
// @Param id path string true "Story ID"
// @Success 200 {array} ViewerResponse
// @Router /api/stories/{id}/viewers [get]
func (a *Api) Viewers(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	id, ok := storyID(c)
	if !ok {
		return fail(c, ErrNotFound)
	}
	out, err := a.service.Viewers(c.UserContext(), uid, id)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(out)
}

// Delete godoc
// @Summary Delete your story
// @Tags stories
// @Param id path string true "Story ID"
// @Success 204
// @Router /api/stories/{id} [delete]
func (a *Api) Delete(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	id, ok := storyID(c)
	if !ok {
		return fail(c, ErrNotFound)
	}
	if err := a.service.Delete(c.UserContext(), uid, id); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Report godoc
// @Summary Report a story
// @Description reason: spam, harassment, misleading, inappropriate or other. Three reports hide the story until a moderator decides.
// @Tags stories
// @Accept json
// @Param id path string true "Story ID"
// @Param body body ReportRequest true "Why"
// @Success 204
// @Router /api/stories/{id}/report [post]
func (a *Api) Report(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	id, ok := storyID(c)
	if !ok {
		return fail(c, ErrNotFound)
	}
	var req ReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := a.service.Report(c.UserContext(), uid, id, req); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// AdminReports godoc
// @Summary Reported stories waiting for a decision (admins)
// @Tags stories
// @Produce json
// @Param page query int false "Page, from 1"
// @Success 200 {object} map[string]interface{}
// @Router /api/admin/stories/reports [get]
func (a *Api) AdminReports(c *fiber.Ctx) error {
	items, total, err := a.service.Queue(c.UserContext(), c.QueryInt("page", 1), c.QueryInt("limit", 20))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"items": items, "total": total})
}

// AdminDecide godoc
// @Summary Keep or remove a reported story (admins)
// @Tags stories
// @Accept json
// @Param id path string true "Story ID"
// @Param body body DecisionRequest true "keep or remove"
// @Success 204
// @Router /api/admin/stories/{id}/decision [post]
func (a *Api) AdminDecide(c *fiber.Ctx) error {
	uid, err := me(c)
	if err != nil {
		return err
	}
	id, ok := storyID(c)
	if !ok {
		return fail(c, ErrNotFound)
	}
	var req DecisionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := a.service.Decide(c.UserContext(), uid, id, req.Action); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// RegisterSweeper deletes ended stories every 10 minutes
func RegisterSweeper(lc fx.Lifecycle, s Service) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				t := time.NewTicker(10 * time.Minute)
				defer t.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-t.C:
						runCtx, stop := context.WithTimeout(ctx, 5*time.Minute)
						if err := s.Sweep(runCtx); err != nil {
							log.Printf("story: clearing ended stories: %v", err)
						}
						stop()
					}
				}
			}()
			return nil
		},
		OnStop: func(stopCtx context.Context) error {
			cancel()
			select {
			case <-done:
			case <-stopCtx.Done():
			}
			return nil
		},
	})
}
