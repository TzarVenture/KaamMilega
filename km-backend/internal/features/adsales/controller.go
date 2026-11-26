package adsales

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
// @Summary Ad packages for sale and my ads (recruiter)
// @Tags recruiter-ads
// @Produce json
// @Success 200 {object} Overview
// @Router /api/recruiter-ads [get]
func (ctrl *Controller) Overview(c *fiber.Ctx) error {
	res, err := ctrl.service.Overview(c.UserContext(), userID(c))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// Create godoc
// @Summary Write a new ad for a package; it is paid for next (recruiter)
// @Tags recruiter-ads
// @Accept json
// @Produce json
// @Param body body SaveRequest true "Package and ad"
// @Success 200 {object} Ad
// @Router /api/recruiter-ads [post]
func (ctrl *Controller) Create(c *fiber.Ctx) error {
	var body SaveRequest
	if err := c.BodyParser(&body); err != nil {
		return badBody(c)
	}
	ad, err := ctrl.service.Save(c.UserContext(), userID(c), "", body)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(ad)
}

// Update godoc
// @Summary Change an ad. A change to a running ad waits for an admin. (recruiter)
// @Tags recruiter-ads
// @Accept json
// @Produce json
// @Param id path string true "Ad ID"
// @Param body body SaveRequest true "Ad"
// @Success 200 {object} Ad
// @Router /api/recruiter-ads/{id} [put]
func (ctrl *Controller) Update(c *fiber.Ctx) error {
	var body SaveRequest
	if err := c.BodyParser(&body); err != nil {
		return badBody(c)
	}
	ad, err := ctrl.service.Save(c.UserContext(), userID(c), c.Params("id"), body)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(ad)
}

// Delete godoc
// @Summary Delete an ad that isn't paid for (recruiter)
// @Tags recruiter-ads
// @Param id path string true "Ad ID"
// @Router /api/recruiter-ads/{id} [delete]
func (ctrl *Controller) Delete(c *fiber.Ctx) error {
	if err := ctrl.service.Delete(c.UserContext(), userID(c), c.Params("id")); err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func purchaseBody(c *fiber.Ctx) (PurchaseRequest, bool) {
	var body PurchaseRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			return body, false
		}
	}
	return body, true
}

// PayWithWallet godoc
// @Summary Pay for an ad from the wallet; it then waits for an admin (recruiter)
// @Tags recruiter-ads
// @Produce json
// @Param id path string true "Ad ID"
// @Router /api/recruiter-ads/{id}/pay-with-wallet [post]
func (ctrl *Controller) PayWithWallet(c *fiber.Ctx) error {
	body, ok := purchaseBody(c)
	if !ok {
		return badBody(c)
	}
	ad, summary, receipt, err := ctrl.service.PayWithWallet(c.UserContext(), userID(c), c.Params("id"), body.CouponCode)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"ad": ad, "wallet": summary, "receipt": receipt})
}

// CreateOrder godoc
// @Summary Open a Razorpay checkout for an ad (recruiter)
// @Tags recruiter-ads
// @Produce json
// @Param id path string true "Ad ID"
// @Success 200 {object} CheckoutResponse
// @Router /api/recruiter-ads/{id}/create-order [post]
func (ctrl *Controller) CreateOrder(c *fiber.Ctx) error {
	body, ok := purchaseBody(c)
	if !ok {
		return badBody(c)
	}
	res, err := ctrl.service.CreateOrder(c.UserContext(), userID(c), c.Params("id"), body.CouponCode)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// VerifyPayment godoc
// @Summary Confirm a Razorpay payment for an ad (recruiter)
// @Tags recruiter-ads
// @Accept json
// @Produce json
// @Router /api/recruiter-ads/verify-payment [post]
func (ctrl *Controller) VerifyPayment(c *fiber.Ctx) error {
	var in payment.ConfirmInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	ad, err := ctrl.service.VerifyPayment(c.UserContext(), userID(c), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"ad": ad})
}

// AdminPackages godoc
// @Summary Every ad package, including switched-off ones (admin)
// @Tags recruiter-ads
// @Produce json
// @Router /api/admin/ad-packages [get]
func (ctrl *Controller) AdminPackages(c *fiber.Ctx) error {
	list, err := ctrl.service.AdminPackages(c.UserContext())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"packages": list})
}

// CreatePackage godoc
// @Summary Add an ad package (admin)
// @Tags recruiter-ads
// @Accept json
// @Produce json
// @Param body body PackageInput true "Package"
// @Router /api/admin/ad-packages [post]
func (ctrl *Controller) CreatePackage(c *fiber.Ctx) error {
	var in PackageInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	p, err := ctrl.service.CreatePackage(c.UserContext(), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(p)
}

// UpdatePackage godoc
// @Summary Change an ad package; ads already bought keep what they paid for (admin)
// @Tags recruiter-ads
// @Accept json
// @Produce json
// @Param id path string true "Package ID"
// @Param body body PackageInput true "Package"
// @Router /api/admin/ad-packages/{id} [put]
func (ctrl *Controller) UpdatePackage(c *fiber.Ctx) error {
	var in PackageInput
	if err := c.BodyParser(&in); err != nil {
		return badBody(c)
	}
	p, err := ctrl.service.UpdatePackage(c.UserContext(), c.Params("id"), in)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(p)
}

// AdminAds godoc
// @Summary Recruiter ads. ?status=review|running|ended|rejected|refunded|all (admin)
// @Tags recruiter-ads
// @Produce json
// @Success 200 {object} AdminPage
// @Router /api/admin/recruiter-ads [get]
func (ctrl *Controller) AdminAds(c *fiber.Ctx) error {
	res, err := ctrl.service.AdminAds(c.UserContext(), AdminQuery{
		Status: c.Query("status"), Page: c.QueryInt("page", 1), Limit: c.QueryInt("limit", 20),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

func (ctrl *Controller) decide(c *fiber.Ctx, fn func(adID, adminID, reason string) (*Ad, error)) error {
	var body RejectRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			return badBody(c)
		}
	}
	ad, err := fn(c.Params("id"), userID(c), body.Reason)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(ad)
}

// Approve godoc
// @Summary Approve a paid ad; it runs from now for its package's days (admin)
// @Tags recruiter-ads
// @Param id path string true "Ad ID"
// @Router /api/admin/recruiter-ads/{id}/approve [post]
func (ctrl *Controller) Approve(c *fiber.Ctx) error {
	return ctrl.decide(c, func(id, admin, _ string) (*Ad, error) { return ctrl.service.Approve(c.UserContext(), id, admin) })
}

// Reject godoc
// @Summary Reject a paid ad and refund it to the recruiter's wallet (admin)
// @Tags recruiter-ads
// @Param id path string true "Ad ID"
// @Param body body RejectRequest true "Reason"
// @Router /api/admin/recruiter-ads/{id}/reject [post]
func (ctrl *Controller) Reject(c *fiber.Ctx) error {
	return ctrl.decide(c, func(id, admin, reason string) (*Ad, error) {
		return ctrl.service.Reject(c.UserContext(), id, admin, reason)
	})
}

// ApproveChange godoc
// @Summary Put a recruiter's change to a running ad live (admin)
// @Tags recruiter-ads
// @Param id path string true "Ad ID"
// @Router /api/admin/recruiter-ads/{id}/approve-change [post]
func (ctrl *Controller) ApproveChange(c *fiber.Ctx) error {
	return ctrl.decide(c, func(id, admin, _ string) (*Ad, error) { return ctrl.service.ApproveChange(c.UserContext(), id, admin) })
}

// RejectChange godoc
// @Summary Refuse a recruiter's change to a running ad; the ad keeps running as it was (admin)
// @Tags recruiter-ads
// @Param id path string true "Ad ID"
// @Param body body RejectRequest true "Reason"
// @Router /api/admin/recruiter-ads/{id}/reject-change [post]
func (ctrl *Controller) RejectChange(c *fiber.Ctx) error {
	return ctrl.decide(c, func(id, admin, reason string) (*Ad, error) {
		return ctrl.service.RejectChange(c.UserContext(), id, admin, reason)
	})
}
