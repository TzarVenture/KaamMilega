package referral

import (
	"context"
	"log"
	"time"

	"km-backend/internal/common/api"
	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/fx"
)

type Api struct {
	svc    Service
	config *config.Config
}

func NewApi(svc Service, cfg *config.Config) api.Route { return &Api{svc: svc, config: cfg} }

func (a *Api) Setup(app *fiber.App) {
	auth := middleware.AuthMiddleware(a.config.JWTSecret)

	mine := app.Group("/api/referrals", auth)
	mine.Get("/", a.overview)
	mine.Post("/claim", a.claim)

	admin := app.Group("/api/admin/referrals", auth, middleware.RequireRole(user.RoleAdmin))
	admin.Get("/", a.adminReferrals)
	admin.Get("/settings", a.getSettings)
	admin.Put("/settings", a.saveSettings)
	admin.Get("/aggregators", a.aggregators)
	admin.Post("/aggregators", a.setAggregator)
	admin.Get("/payouts", a.payouts)
	admin.Post("/payouts/:id/cash-paid", a.cashPaid)
}

func fail(c *fiber.Ctx, err error) error {
	return c.Status(apperr.StatusOf(err)).JSON(apperr.Body(err))
}

func badBody(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"code": "INVALID_REQUEST", "error": "Invalid request body"})
}

func userID(c *fiber.Ctx) string {
	s, _ := c.Locals("user_id").(string)
	return s
}

func paging(c *fiber.Ctx) (int, int) {
	page, limit := c.QueryInt("page", 1), c.QueryInt("limit", 20)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return page, limit
}

// overview godoc
// @Summary My invite code, my referrals and what they earned
// @Tags referrals
// @Produce json
// @Success 200 {object} Overview
// @Router /api/referrals [get]
func (a *Api) overview(c *fiber.Ctx) error {
	out, err := a.svc.Overview(c.UserContext(), userID(c))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(out)
}

// claim godoc
// @Summary Link my new account to the invite code I signed up with
// @Tags referrals
// @Accept json
// @Param body body object true "{code}"
// @Success 204
// @Router /api/referrals/claim [post]
func (a *Api) claim(c *fiber.Ctx) error {
	var body struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badBody(c)
	}
	if err := a.svc.Claim(c.UserContext(), userID(c), body.Code); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (a *Api) getSettings(c *fiber.Ctx) error {
	s, err := a.svc.GetSettings(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(s)
}

func (a *Api) saveSettings(c *fiber.Ctx) error {
	var in Settings
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	out, err := a.svc.SaveSettings(c.UserContext(), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(out)
}

func (a *Api) aggregators(c *fiber.Ctx) error {
	list, err := a.svc.ListAggregators(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"items": list})
}

// setAggregator approves ({"user": "<id or mobile>", "active": true}) or removes one
func (a *Api) setAggregator(c *fiber.Ctx) error {
	var body struct {
		User   string `json:"user"`
		Active bool   `json:"active"`
		Note   string `json:"note"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badBody(c)
	}
	out, err := a.svc.SetAggregator(c.UserContext(), userID(c), body.User, body.Active, body.Note)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(out)
}

func (a *Api) payouts(c *fiber.Ctx) error {
	page, limit := paging(c)
	list, total, err := a.svc.ListPayouts(c.UserContext(), c.Query("owed") == "1", page, limit)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"items": list, "total": total})
}

func (a *Api) cashPaid(c *fiber.Ctx) error {
	var body struct {
		Note string `json:"note"`
	}
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			return badBody(c)
		}
	}
	out, err := a.svc.MarkCashPaid(c.UserContext(), userID(c), c.Params("id"), body.Note)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(out)
}

func (a *Api) adminReferrals(c *fiber.Ctx) error {
	page, limit := paging(c)
	list, total, err := a.svc.ListReferrals(c.UserContext(), c.Query("status"), page, limit)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"items": list, "total": total})
}

// runEvery is how often new payments are looked for and finished waits rewarded
const runEvery = 10 * time.Minute

// RegisterWorker runs the referral timer in the background
func RegisterWorker(lc fx.Lifecycle, svc Service) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	run := func() {
		c, stop := context.WithTimeout(ctx, 5*time.Minute)
		defer stop()
		if err := svc.Run(c); err != nil && ctx.Err() == nil {
			log.Printf("[referral] run: %v", err)
		}
	}
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(3 * time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						run()
						timer.Reset(runEvery)
					}
				}
			}()
			return nil
		},
		OnStop: func(context.Context) error {
			cancel()
			<-done
			return nil
		},
	})
}
