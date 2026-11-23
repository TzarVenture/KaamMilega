package recruiterplan

import (
	"km-backend/internal/common/apperr"
	"km-backend/internal/features/payment"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service Service
}

func NewController(service Service) *Controller {
	return &Controller{service: service}
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

// Overview godoc
// @Summary Plans for sale, my current plan and what I've used this period (recruiter)
// @Tags recruiter-plans
// @Produce json
// @Success 200 {object} Overview
// @Router /api/recruiter-plans [get]
func (ctrl *Controller) Overview(c *fiber.Ctx) error {
	res, err := ctrl.service.Overview(c.UserContext(), userID(c))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// BuyWithWallet godoc
// @Summary Buy a plan with the wallet (recruiter)
// @Tags recruiter-plans
// @Produce json
// @Param id path string true "Plan ID"
// @Router /api/recruiter-plans/{id}/buy-with-wallet [post]
func (ctrl *Controller) BuyWithWallet(c *fiber.Ctx) error {
	var body PurchaseRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			return badBody(c)
		}
	}
	sub, summary, receipt, err := ctrl.service.BuyWithWallet(c.UserContext(), userID(c), c.Params("id"), body.CouponCode)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"subscription": sub, "wallet": summary, "receipt": receipt})
}

// CreateOrder godoc
// @Summary Open a Razorpay checkout for a plan (recruiter)
// @Tags recruiter-plans
// @Produce json
// @Param id path string true "Plan ID"
// @Success 200 {object} CheckoutResponse
// @Router /api/recruiter-plans/{id}/create-order [post]
func (ctrl *Controller) CreateOrder(c *fiber.Ctx) error {
	var body PurchaseRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			return badBody(c)
		}
	}
	res, err := ctrl.service.CreateOrder(c.UserContext(), userID(c), c.Params("id"), body.CouponCode)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// VerifyPayment godoc
// @Summary Confirm a plan payment (recruiter)
// @Tags recruiter-plans
// @Accept json
// @Produce json
// @Param body body payment.ConfirmInput true "Signed Razorpay result"
// @Router /api/recruiter-plans/verify-payment [post]
func (ctrl *Controller) VerifyPayment(c *fiber.Ctx) error {
	var in payment.ConfirmInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	sub, err := ctrl.service.VerifyPayment(c.UserContext(), userID(c), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"subscription": sub})
}

// AdminPlans godoc
// @Summary Every recruiter plan, including switched-off ones (admin)
// @Tags recruiter-plans
// @Produce json
// @Router /api/admin/recruiter-plans [get]
func (ctrl *Controller) AdminPlans(c *fiber.Ctx) error {
	plans, err := ctrl.service.AdminPlans(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"plans": plans})
}

// CreatePlan godoc
// @Summary Create a recruiter plan (admin)
// @Tags recruiter-plans
// @Accept json
// @Produce json
// @Param body body PlanInput true "Plan"
// @Router /api/admin/recruiter-plans [post]
func (ctrl *Controller) CreatePlan(c *fiber.Ctx) error {
	var in PlanInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	p, err := ctrl.service.CreatePlan(c.UserContext(), in)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(p)
}

// UpdatePlan godoc
// @Summary Edit a recruiter plan (admin). Bought plans keep the limits they were sold with.
// @Tags recruiter-plans
// @Accept json
// @Produce json
// @Param id path string true "Plan ID"
// @Param body body PlanInput true "Plan"
// @Router /api/admin/recruiter-plans/{id} [put]
func (ctrl *Controller) UpdatePlan(c *fiber.Ctx) error {
	var in PlanInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	p, err := ctrl.service.UpdatePlan(c.UserContext(), c.Params("id"), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(p)
}

// GetSettings godoc
// @Summary Whether limits are enforced, and the free monthly allowance (admin)
// @Tags recruiter-plans
// @Produce json
// @Success 200 {object} Settings
// @Router /api/admin/recruiter-plans/settings [get]
func (ctrl *Controller) GetSettings(c *fiber.Ctx) error {
	s, err := ctrl.service.GetSettings(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(s)
}

// SaveSettings godoc
// @Summary Turn limits on or off and set the free monthly allowance (admin)
// @Tags recruiter-plans
// @Accept json
// @Produce json
// @Param body body Settings true "Settings"
// @Success 200 {object} Settings
// @Router /api/admin/recruiter-plans/settings [put]
func (ctrl *Controller) SaveSettings(c *fiber.Ctx) error {
	var in Settings
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	s, err := ctrl.service.SaveSettings(c.UserContext(), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(s)
}

// AdminSubscriptions godoc
// @Summary Plans recruiters have bought (admin)
// @Tags recruiter-plans
// @Produce json
// @Param page query int false "Page"
// @Param limit query int false "Page size (max 50)"
// @Router /api/admin/recruiter-plans/subscriptions [get]
func (ctrl *Controller) AdminSubscriptions(c *fiber.Ctx) error {
	res, err := ctrl.service.AdminSubscriptions(c.UserContext(), c.QueryInt("page", 1), c.QueryInt("limit", 20))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}
