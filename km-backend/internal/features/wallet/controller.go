package wallet

import (
	"fmt"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
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

// GetBalance retrieves the authenticated user's real-time wallet ledger summary
func (ctrl *WalletController) GetBalance(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	summary, err := ctrl.service.GetWalletSummary(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(summary)
}

// GetTransactions returns paginated ledger logs for the authenticated user
func (ctrl *WalletController) GetTransactions(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	txType := TransactionType(c.Query("type"))
	category := TransactionCategory(c.Query("category"))
	targetBalance := TargetBalance(c.Query("target_balance"))

	query := TransactionQuery{
		Page:          page,
		Limit:         limit,
		Type:          txType,
		Category:      category,
		TargetBalance: targetBalance,
	}

	result, err := ctrl.service.GetTransactions(c.Context(), userID, query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

// CreateTopupOrder initiates a Razorpay recharge order
func (ctrl *WalletController) CreateTopupOrder(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	var req CreateTopupOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body format",
		})
	}

	order, err := ctrl.service.CreateTopupOrder(c.Context(), userID, req.Amount)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(order)
}

// VerifyTopupPayment verifies the Razorpay payment signature and credits the user's wallet
func (ctrl *WalletController) VerifyTopupPayment(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	var req VerifyTopupPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body format",
		})
	}

	summary, tx, err := ctrl.service.VerifyTopupPayment(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":     "Wallet recharged successfully",
		"wallet":      summary,
		"transaction": tx,
	})
}

// RequestWithdrawal handles withdrawal requests from earnings balance (F71)
func (ctrl *WalletController) RequestWithdrawal(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	var req WithdrawalRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body format",
		})
	}

	res, err := ctrl.service.RequestWithdrawal(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(res)
}

// CreateDispute handles raising a dispute on an eligible transaction (F73)
func (ctrl *WalletController) CreateDispute(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	var req CreateDisputeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body format",
		})
	}

	dispute, err := ctrl.service.CreateDispute(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(dispute)
}

// GetMyDisputes returns disputes filed by the authenticated user
func (ctrl *WalletController) GetMyDisputes(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: valid authentication token required",
		})
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	status := DisputeStatus(c.Query("status"))

	res, err := ctrl.service.GetMyDisputes(c.Context(), userID, DisputeQuery{
		Page:   page,
		Limit:  limit,
		Status: status,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(res)
}

// GetAdminDisputes returns all disputes across platform for admin review
func (ctrl *WalletController) GetAdminDisputes(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	status := DisputeStatus(c.Query("status"))
	userID := c.Query("user_id")

	res, err := ctrl.service.GetAdminDisputes(c.Context(), DisputeQuery{
		Page:   page,
		Limit:  limit,
		Status: status,
		UserID: userID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(res)
}

// ResolveAdminDispute resolves a dispute by admin approval or rejection
func (ctrl *WalletController) ResolveAdminDispute(c *fiber.Ctx) error {
	adminID, ok := c.Locals("user_id").(string)
	if !ok || adminID == "" {
		adminID = "admin"
	}

	disputeID := c.Params("id")
	if disputeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "missing dispute id parameter",
		})
	}

	var req ResolveDisputeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body format",
		})
	}

	dispute, summary, err := ctrl.service.ResolveDispute(c.Context(), disputeID, adminID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"dispute": dispute,
		"wallet":  summary,
		"message": fmt.Sprintf("Dispute successfully %sd", req.Action),
	})
}


