package wallet

import (
	"errors"
	"log"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/features/payment"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WalletController struct {
	service WalletService
	config  *config.Config
}

func NewWalletController(service WalletService, config *config.Config) *WalletController {
	return &WalletController{
		service: service,
		config:  config,
	}
}

// fail answers with a coded error. Anything without a code is internal: it's logged here and
// the user only sees a plain message.
func fail(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrWithdrawalNotFound), errors.Is(err, ErrWalletNotFound), errors.Is(err, payment.ErrOrderNotFound):
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	case errors.Is(err, payment.ErrGateway), errors.Is(err, payment.ErrNotConfigured):
		return c.Status(fiber.StatusServiceUnavailable).JSON(apperr.Body(err))
	case apperr.CodeOf(err) != "":
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	log.Printf("[wallet] %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "something went wrong, please try again"})
}

func currentUser(c *fiber.Ctx) (string, bool) {
	userID, ok := c.Locals("user_id").(string)
	return userID, ok && userID != ""
}

func unauthorized(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: valid authentication token required"})
}

func badBody(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body format"})
}

// GetBalance retrieves the authenticated user's wallet summary
func (ctrl *WalletController) GetBalance(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	summary, err := ctrl.service.GetWalletSummary(c.Context(), userID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(summary)
}

// GetTransactions returns paginated ledger logs for the authenticated user
func (ctrl *WalletController) GetTransactions(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	result, err := ctrl.service.GetTransactions(c.Context(), userID, TransactionQuery{
		Page:          c.QueryInt("page", 1),
		Limit:         c.QueryInt("limit", 20),
		Type:          TransactionType(c.Query("type")),
		Category:      TransactionCategory(c.Query("category")),
		TargetBalance: TargetBalance(c.Query("target_balance")),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(result)
}

// CreateTopupOrder starts adding money to the wallet
func (ctrl *WalletController) CreateTopupOrder(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	var req CreateTopupOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	order, err := ctrl.service.CreateTopupOrder(c.Context(), userID, req.Amount)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(order)
}

// VerifyTopupPayment confirms the checkout and credits the wallet
func (ctrl *WalletController) VerifyTopupPayment(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	var req VerifyTopupPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	summary, tx, err := ctrl.service.VerifyTopupPayment(c.Context(), userID, req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{
		"message":     "Wallet recharged successfully",
		"wallet":      summary,
		"transaction": tx,
	})
}

// GetPayoutAccount tells the wallet screen whether withdrawal is possible and to where
func (ctrl *WalletController) GetPayoutAccount(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	account, err := ctrl.service.GetPayoutAccount(c.Context(), userID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(account)
}

// RequestWithdrawal queues a payout from earnings (F71)
func (ctrl *WalletController) RequestWithdrawal(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	var req WithdrawalRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	res, err := ctrl.service.RequestWithdrawal(c.Context(), userID, req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// GetMyWithdrawals lists the signed-in user's payouts
func (ctrl *WalletController) GetMyWithdrawals(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	res, err := ctrl.service.GetMyWithdrawals(c.Context(), userID, WithdrawalQuery{
		Page:  c.QueryInt("page", 1),
		Limit: c.QueryInt("limit", 20),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// CreateDispute handles raising a dispute on an eligible transaction (F73)
func (ctrl *WalletController) CreateDispute(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	var req CreateDisputeRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	dispute, err := ctrl.service.CreateDispute(c.Context(), userID, req)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(dispute)
}

// GetMyDisputes returns disputes filed by the authenticated user
func (ctrl *WalletController) GetMyDisputes(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	res, err := ctrl.service.GetMyDisputes(c.Context(), userID, DisputeQuery{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Status: DisputeStatus(c.Query("status")),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// GetAdminDisputes returns all disputes across platform for admin review
func (ctrl *WalletController) GetAdminDisputes(c *fiber.Ctx) error {
	res, err := ctrl.service.GetAdminDisputes(c.Context(), DisputeQuery{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Status: DisputeStatus(c.Query("status")),
		UserID: c.Query("user_id"),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// ResolveAdminDispute acts on a dispute
func (ctrl *WalletController) ResolveAdminDispute(c *fiber.Ctx) error {
	adminID, _ := currentUser(c)
	var req ResolveDisputeRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	dispute, summary, err := ctrl.service.ResolveDispute(c.Context(), c.Params("id"), adminID, req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"dispute": dispute, "wallet": summary})
}

// GetAdminWithdrawals returns the payout queue
func (ctrl *WalletController) GetAdminWithdrawals(c *fiber.Ctx) error {
	res, err := ctrl.service.GetAdminWithdrawals(c.Context(), WithdrawalQuery{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Status: WithdrawalStatus(c.Query("status")),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

// RevealWithdrawalAccount returns the full account for a payout. Each view is logged.
func (ctrl *WalletController) RevealWithdrawalAccount(c *fiber.Ctx) error {
	adminID, _ := currentUser(c)
	account, err := ctrl.service.RevealWithdrawalAccount(c.Context(), c.Params("id"), adminID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(account)
}

// UpdateWithdrawal records a payout as processing, paid or failed
func (ctrl *WalletController) UpdateWithdrawal(c *fiber.Ctx) error {
	adminID, _ := currentUser(c)
	var req UpdateWithdrawalRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	withdrawal, err := ctrl.service.UpdateWithdrawal(c.Context(), c.Params("id"), adminID, req)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(withdrawal)
}

// GetFinanceOverview returns platform money totals and ledger checks
func (ctrl *WalletController) GetFinanceOverview(c *fiber.Ctx) error {
	overview, err := ctrl.service.GetFinanceOverview(c.Context())
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(overview)
}

// LookupWallet finds a user's wallet by user id, email or mobile
func (ctrl *WalletController) LookupWallet(c *fiber.Ctx) error {
	result, err := ctrl.service.LookupWallet(c.Context(), c.Query("q"))
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(result)
}

// SetWalletStatus freezes or unfreezes a wallet
func (ctrl *WalletController) SetWalletStatus(c *fiber.Ctx) error {
	if _, err := primitive.ObjectIDFromHex(c.Params("user_id")); err != nil {
		return fail(c, ErrWalletNotFound)
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badBody(c)
	}
	summary, err := ctrl.service.SetWalletStatus(c.Context(), c.Params("user_id"), body.Status)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(summary)
}
