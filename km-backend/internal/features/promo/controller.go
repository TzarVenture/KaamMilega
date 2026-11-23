package promo

import (
	"km-backend/internal/common/apperr"

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

// Quote godoc
// @Summary Price a purchase with a coupon code, for the checkout screen
// @Description Holds nothing; the price is worked out again at payment. Send an empty code to get the price and wallet split without a coupon.
// @Tags coupons
// @Accept json
// @Produce json
// @Param body body QuoteRequest true "Purchase and code"
// @Success 200 {object} Quote
// @Router /api/coupons/quote [post]
func (ctrl *Controller) Quote(c *fiber.Ctx) error {
	var req QuoteRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.Quote(c.UserContext(), userID(c), req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// AdminCoupons godoc
// @Summary All coupons with how much each has been used (admin)
// @Tags admin-coupons
// @Produce json
// @Router /api/admin/coupons [get]
func (ctrl *Controller) AdminCoupons(c *fiber.Ctx) error {
	items, err := ctrl.service.AdminCoupons(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"coupons": items})
}

// CreateCoupon godoc
// @Summary Create a coupon (admin)
// @Tags admin-coupons
// @Accept json
// @Produce json
// @Param body body CouponInput true "Coupon"
// @Success 201 {object} Coupon
// @Router /api/admin/coupons [post]
func (ctrl *Controller) CreateCoupon(c *fiber.Ctx) error {
	var in CouponInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.CreateCoupon(c.UserContext(), userID(c), in)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(res)
}

// UpdateCoupon godoc
// @Summary Edit a coupon (admin). The code can't change; edits apply to future uses only.
// @Tags admin-coupons
// @Accept json
// @Produce json
// @Param id path string true "Coupon ID"
// @Param body body CouponInput true "Coupon"
// @Success 200 {object} Coupon
// @Router /api/admin/coupons/{id} [put]
func (ctrl *Controller) UpdateCoupon(c *fiber.Ctx) error {
	var in CouponInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.UpdateCoupon(c.UserContext(), c.Params("id"), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// AdminRedemptions godoc
// @Summary Coupon uses, newest first, optionally for one coupon (admin)
// @Tags admin-coupons
// @Produce json
// @Param coupon_id query string false "Coupon ID"
// @Param page query int false "Page"
// @Param limit query int false "Page size (max 100)"
// @Success 200 {object} RedemptionPage
// @Router /api/admin/coupons/redemptions [get]
func (ctrl *Controller) AdminRedemptions(c *fiber.Ctx) error {
	res, err := ctrl.service.AdminRedemptions(c.UserContext(), c.Query("coupon_id"), c.QueryInt("page", 1), c.QueryInt("limit", 20))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}
