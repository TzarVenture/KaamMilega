package wallet

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WalletService interface {
	GetWalletSummary(ctx context.Context, userID string) (*WalletSummaryResponse, error)
	AdjustBalances(ctx context.Context, userID string, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*WalletSummaryResponse, error)
	GetTransactions(ctx context.Context, userID string, query TransactionQuery) (*TransactionListResponse, error)
	RecordTransaction(ctx context.Context, input RecordTransactionInput) (*TransactionItemResponse, *WalletSummaryResponse, error)
	CreateTopupOrder(ctx context.Context, userID string, amount float64) (*CreateTopupOrderResponse, error)
	VerifyTopupPayment(ctx context.Context, userID string, req VerifyTopupPaymentRequest) (*WalletSummaryResponse, *TransactionItemResponse, error)
	RequestWithdrawal(ctx context.Context, userID string, req WithdrawalRequest) (*WithdrawalResponse, error)

	// Dispute & Refund handling (F73)
	CreateDispute(ctx context.Context, userID string, req CreateDisputeRequest) (*WalletDispute, error)
	GetMyDisputes(ctx context.Context, userID string, query DisputeQuery) (*DisputeListResponse, error)
	GetAdminDisputes(ctx context.Context, query DisputeQuery) (*DisputeListResponse, error)
	ResolveDispute(ctx context.Context, disputeID string, adminID string, req ResolveDisputeRequest) (*WalletDispute, *WalletSummaryResponse, error)
}

type WalletServiceImpl struct {
	repo       WalletRepository
	cfg        *config.Config
	httpClient *http.Client
	mailer     notification.Mailer
}

func NewWalletService(repo WalletRepository, cfg *config.Config, mailer notification.Mailer) WalletService {
	return &WalletServiceImpl{
		repo:       repo,
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		mailer:     mailer,
	}
}

// GetWalletSummary returns the structured wallet balance breakdown for a given user ID
func (s *WalletServiceImpl) GetWalletSummary(ctx context.Context, userID string) (*WalletSummaryResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	w, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}

	return formatWalletSummary(w), nil
}

// AdjustBalances safely modifies wallet balances atomically and returns the fresh summary
func (s *WalletServiceImpl) AdjustBalances(ctx context.Context, userID string, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*WalletSummaryResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	w, err := s.repo.UpdateBalances(ctx, oid, mainDelta, earningsDelta, lockedDelta, bonusDelta)
	if err != nil {
		return nil, err
	}

	return formatWalletSummary(w), nil
}

// formatWalletSummary converts the Wallet domain model into a structured summary
func formatWalletSummary(w *Wallet) *WalletSummaryResponse {
	total := w.MainBalance + w.EarningsBalance + w.BonusBalance
	if total < 0 {
		total = 0
	}

	withdrawable := w.EarningsBalance
	if withdrawable < 0 {
		withdrawable = 0
	}

	currency := w.Currency
	if currency == "" {
		currency = "INR"
	}

	status := w.Status
	if status == "" {
		status = "active"
	}

	return &WalletSummaryResponse{
		WalletID:            w.ID.Hex(),
		UserID:              w.UserID.Hex(),
		TotalBalance:        total,
		WithdrawableBalance: withdrawable,
		MainBalance:         w.MainBalance,
		EarningsBalance:     w.EarningsBalance,
		LockedBalance:       w.LockedBalance,
		BonusBalance:        w.BonusBalance,
		Currency:            currency,
		Status:              status,
		UpdatedAt:           w.UpdatedAt,
	}
}

// GetTransactions retrieves the paginated ledger history for a user
func (s *WalletServiceImpl) GetTransactions(ctx context.Context, userID string, query TransactionQuery) (*TransactionListResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	wallet, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 100 {
		query.Limit = 20
	}

	txList, total, err := s.repo.GetTransactionsByWalletID(ctx, wallet.ID, query)
	if err != nil {
		return nil, err
	}

	items := make([]TransactionItemResponse, 0, len(txList))
	for _, tx := range txList {
		items = append(items, formatTransactionItem(&tx))
	}

	totalPages := int(math.Ceil(float64(total) / float64(query.Limit)))
	if totalPages < 1 && total == 0 {
		totalPages = 1
	}

	return &TransactionListResponse{
		Transactions: items,
		Total:        total,
		Page:         query.Page,
		Limit:        query.Limit,
		TotalPages:   totalPages,
	}, nil
}

// RecordTransaction atomically alters the wallet balance and records an audit log entry
func (s *WalletServiceImpl) RecordTransaction(ctx context.Context, input RecordTransactionInput) (*TransactionItemResponse, *WalletSummaryResponse, error) {
	tx, updatedWallet, err := s.repo.RecordAtomicTransaction(ctx, input)
	if err != nil {
		return nil, nil, err
	}

	txResponse := formatTransactionItem(tx)
	walletSummary := formatWalletSummary(updatedWallet)

	return &txResponse, walletSummary, nil
}

// formatTransactionItem maps a WalletTransaction to a client-facing JSON DTO
func formatTransactionItem(tx *WalletTransaction) TransactionItemResponse {
	return TransactionItemResponse{
		ID:            tx.ID.Hex(),
		WalletID:      tx.WalletID.Hex(),
		Type:          tx.Type,
		TargetBalance: tx.TargetBalance,
		Category:      tx.Category,
		Amount:        tx.Amount,
		BalanceAfter:  tx.BalanceAfter,
		Status:        tx.Status,
		ReferenceID:   tx.ReferenceID,
		Description:   tx.Description,
		Metadata:      tx.Metadata,
		CreatedAt:     tx.CreatedAt,
	}
}

// CreateTopupOrder generates a Razorpay Order ID for recharging the wallet
func (s *WalletServiceImpl) CreateTopupOrder(ctx context.Context, userID string, amount float64) (*CreateTopupOrderResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	if amount < 10 {
		return nil, errors.New("minimum recharge amount is ₹10")
	}
	if amount > 100000 {
		return nil, errors.New("maximum recharge amount is ₹1,00,000")
	}

	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	// Ensure user's wallet exists
	_, err = s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}

	amountPaise := int64(amount * 100)
	receiptID := fmt.Sprintf("rcpt_%s_%d", userID[:min(8, len(userID))], time.Now().Unix())

	keyID := s.cfg.RazorpayKeyID
	keySecret := s.cfg.RazorpayKeySecret

	if keyID == "" || keySecret == "" {
		return nil, errors.New("razorpay gateway credentials not configured")
	}

	// Make HTTP call to Razorpay Orders API
	payload := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  receiptID,
		"notes": map[string]interface{}{
			"user_id": userID,
			"purpose": "wallet_topup",
		},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal order request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	req.SetBasicAuth(keyID, keySecret)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach razorpay api: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read razorpay response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order creation failed (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var rzpOrder struct {
		ID       string `json:"id"`
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
		Status   string `json:"status"`
	}
	if err := json.Unmarshal(respBytes, &rzpOrder); err != nil {
		return nil, fmt.Errorf("failed to decode razorpay response: %w", err)
	}

	return &CreateTopupOrderResponse{
		OrderID:     rzpOrder.ID,
		Amount:      amount,
		AmountPaise: amountPaise,
		Currency:    "INR",
		KeyID:       keyID,
	}, nil
}

// VerifyTopupPayment verifies HMAC signature and credits user's main balance atomically
func (s *WalletServiceImpl) VerifyTopupPayment(ctx context.Context, userID string, req VerifyTopupPaymentRequest) (*WalletSummaryResponse, *TransactionItemResponse, error) {
	if userID == "" {
		return nil, nil, errors.New("unauthorized: missing user id")
	}
	if req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" || req.RazorpaySignature == "" {
		return nil, nil, errors.New("missing razorpay payment verification parameters")
	}
	if req.Amount <= 0 {
		return nil, nil, errors.New("invalid topup amount")
	}

	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, nil, errors.New("invalid user id format")
	}

	keySecret := s.cfg.RazorpayKeySecret
	if keySecret == "" {
		return nil, nil, errors.New("razorpay gateway credentials not configured")
	}

	// Verify HMAC-SHA256 signature
	data := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
	h := hmac.New(sha256.New, []byte(keySecret))
	h.Write([]byte(data))
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(req.RazorpaySignature)) {
		return nil, nil, errors.New("invalid razorpay payment signature: verification failed")
	}

	// Signature verified! Atomically credit main_balance and record immutable transaction
	input := RecordTransactionInput{
		UserID:        oid,
		Type:          TypeCredit,
		TargetBalance: BalanceMain,
		Category:      CategoryTopup,
		Amount:        req.Amount,
		ReferenceID:   req.RazorpayPaymentID,
		Description:   "Wallet Recharge via Razorpay",
		Metadata: map[string]interface{}{
			"razorpay_order_id":   req.RazorpayOrderID,
			"razorpay_payment_id": req.RazorpayPaymentID,
			"payment_channel":     "razorpay",
		},
	}

	tx, summary, err := s.RecordTransaction(ctx, input)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to record topup transaction: %w", err)
	}

	// Dispatch automated transaction receipt via centralized mailer (non-blocking)
	if s.mailer != nil {
		userEmail, userName, _ := s.repo.GetUserContact(ctx, oid)
		if userEmail != "" {
			go func() {
				_ = s.mailer.SendTransactionReceipt(notification.TransactionReceiptParams{
					ToEmail:         userEmail,
					RecipientName:   userName,
					TransactionID:   req.RazorpayPaymentID,
					TransactionType: "Wallet Top-up",
					Amount:          req.Amount,
					Currency:        "INR",
					Description:     fmt.Sprintf("Wallet recharge of ₹%.2f via Razorpay", req.Amount),
					IssuedAt:        time.Now(),
				})
			}()
		}
	}

	return summary, tx, nil
}

// RequestWithdrawal processes an expert payout request from earnings_balance (F71)
func (s *WalletServiceImpl) RequestWithdrawal(ctx context.Context, userID string, req WithdrawalRequest) (*WithdrawalResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}

	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	if req.Amount < 50 {
		return nil, errors.New("minimum withdrawal amount is ₹50")
	}
	if req.Amount > 500000 {
		return nil, errors.New("maximum single withdrawal amount is ₹5,00,000")
	}

	if req.PayoutMethod != "bank" && req.PayoutMethod != "upi" {
		return nil, errors.New("payout method must be 'bank' or 'upi'")
	}

	if req.PayoutMethod == "bank" {
		if req.AccountNumber == "" || req.IFSCCode == "" {
			return nil, errors.New("account number and IFSC code are required for bank transfer")
		}
	} else {
		if req.UPIID == "" {
			return nil, errors.New("valid UPI ID is required for UPI payout")
		}
	}

	// Verify user has sufficient earnings balance
	walletDoc, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve wallet: %w", err)
	}

	if walletDoc.EarningsBalance < req.Amount {
		return nil, fmt.Errorf("insufficient withdrawable earnings (available: ₹%.2f, requested: ₹%.2f)", walletDoc.EarningsBalance, req.Amount)
	}

	refID := fmt.Sprintf("WTH_%s_%d", userID[:min(6, len(userID))], time.Now().UnixNano())

	metadata := map[string]interface{}{
		"payout_method":  req.PayoutMethod,
		"account_holder": req.AccountHolder,
		"phone_number":   req.PhoneNumber,
		"status":         "pending",
	}

	var desc, maskedDest string
	if req.PayoutMethod == "bank" {
		metadata["account_number"] = req.AccountNumber
		metadata["ifsc_code"] = req.IFSCCode
		metadata["bank_name"] = req.BankName
		masked := req.AccountNumber
		if len(masked) > 4 {
			masked = "••••" + masked[len(masked)-4:]
		}
		bankName := req.BankName
		if bankName == "" {
			bankName = "Bank Transfer"
		}
		maskedDest = fmt.Sprintf("%s (%s, IFSC: %s)", bankName, masked, req.IFSCCode)
		desc = fmt.Sprintf("Withdrawal to Bank A/C (%s)", masked)
	} else {
		metadata["upi_id"] = req.UPIID
		maskedDest = fmt.Sprintf("UPI (%s)", req.UPIID)
		desc = fmt.Sprintf("Withdrawal to UPI (%s)", req.UPIID)
	}

	// Record atomic debit transaction against BalanceEarnings
	input := RecordTransactionInput{
		UserID:        oid,
		Type:          TypeDebit,
		TargetBalance: BalanceEarnings,
		Category:      CategoryWithdrawal,
		Amount:        req.Amount,
		ReferenceID:   refID,
		Description:   desc,
		Metadata:      metadata,
	}

	txItem, updatedWallet, err := s.RecordTransaction(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to process withdrawal: %w", err)
	}

	// Look up user contact details for personalized confirmation email
	userEmail, userName, _ := s.repo.GetUserContact(ctx, oid)

	// Asynchronously notify admin and user via centralized Mailer
	if s.mailer != nil {
		go func() {
			_ = s.mailer.SendWithdrawalRequest(notification.WithdrawalRequestParams{
				AdminEmail:   s.cfg.SMTPFromEmail,
				ExpertEmail:  userEmail,
				ExpertName:   userName,
				Amount:       req.Amount,
				ReferenceID:  refID,
				PayoutMethod: req.PayoutMethod,
				Destination:  maskedDest,
				Remaining:    walletDoc.EarningsBalance - req.Amount,
				PhoneNumber:  req.PhoneNumber,
			})
		}()
	}

	return &WithdrawalResponse{
		Transaction: txItem,
		Wallet:      updatedWallet,
		Message:     fmt.Sprintf("Withdrawal request of ₹%.2f submitted successfully. Reference ID: %s", req.Amount, refID),
	}, nil
}

// CreateDispute allows a user to file a dispute on an eligible debit transaction (F73)
func (s *WalletServiceImpl) CreateDispute(ctx context.Context, userID string, req CreateDisputeRequest) (*WalletDispute, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	if req.TransactionID == "" {
		return nil, errors.New("missing transaction id")
	}
	if req.Reason == "" {
		return nil, errors.New("missing dispute reason")
	}
	if strings.TrimSpace(req.Description) == "" {
		return nil, errors.New("dispute explanation description is required")
	}

	uOID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	txOID, err := primitive.ObjectIDFromHex(req.TransactionID)
	if err != nil {
		return nil, errors.New("invalid transaction id format")
	}

	// 1. Fetch user wallet
	w, err := s.repo.GetOrCreateWallet(ctx, uOID)
	if err != nil {
		return nil, err
	}

	// 2. Fetch original transaction
	tx, err := s.repo.GetTransactionByID(ctx, txOID)
	if err != nil {
		return nil, errors.New("transaction not found")
	}

	// 3. Validate transaction ownership and eligibility
	if tx.WalletID != w.ID {
		return nil, errors.New("unauthorized: transaction does not belong to your wallet")
	}
	if tx.Type != TypeDebit {
		return nil, errors.New("only debit transactions (purchases/bookings) can be disputed")
	}
	if tx.Category == CategoryRefund {
		return nil, errors.New("refund transactions cannot be disputed")
	}

	// 4. Check if dispute already exists for this transaction
	existing, err := s.repo.GetDisputeByTransactionID(ctx, tx.ID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("a dispute request has already been filed for this transaction")
	}

	// 5. Fetch user contact details and build dispute
	userEmail, userName, _ := s.repo.GetUserContact(ctx, uOID)

	dispute := &WalletDispute{
		UserID:        uOID,
		UserName:      userName,
		UserEmail:     userEmail,
		TransactionID: tx.ID,
		ReferenceID:   tx.ReferenceID,
		Amount:        tx.Amount,
		TargetBalance: tx.TargetBalance,
		Category:      tx.Category,
		Reason:        req.Reason,
		Description:   strings.TrimSpace(req.Description),
		Status:        DisputeStatusPending,
	}

	created, err := s.repo.CreateDispute(ctx, dispute)
	if err != nil {
		return nil, err
	}

	return created, nil
}

// GetMyDisputes returns all disputes filed by the authenticated user
func (s *WalletServiceImpl) GetMyDisputes(ctx context.Context, userID string, query DisputeQuery) (*DisputeListResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	query.UserID = userID
	disputes, total, err := s.repo.GetDisputes(ctx, query)
	if err != nil {
		return nil, err
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	limit := query.Limit
	if limit < 1 {
		limit = 20
	}

	return &DisputeListResponse{
		Disputes: disputes,
		Total:    total,
		Page:     page,
		Limit:    limit,
	}, nil
}

// GetAdminDisputes returns all disputes for admin review
func (s *WalletServiceImpl) GetAdminDisputes(ctx context.Context, query DisputeQuery) (*DisputeListResponse, error) {
	disputes, total, err := s.repo.GetDisputes(ctx, query)
	if err != nil {
		return nil, err
	}

	for i := range disputes {
		if disputes[i].UserName == "" || disputes[i].UserEmail == "" {
			email, name, _ := s.repo.GetUserContact(ctx, disputes[i].UserID)
			if disputes[i].UserName == "" {
				disputes[i].UserName = name
			}
			if disputes[i].UserEmail == "" {
				disputes[i].UserEmail = email
			}
		}
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	limit := query.Limit
	if limit < 1 {
		limit = 20
	}

	return &DisputeListResponse{
		Disputes: disputes,
		Total:    total,
		Page:     page,
		Limit:    limit,
	}, nil
}

// ResolveDispute resolves a dispute with approval (and refund) or rejection
func (s *WalletServiceImpl) ResolveDispute(ctx context.Context, disputeID string, adminID string, req ResolveDisputeRequest) (*WalletDispute, *WalletSummaryResponse, error) {
	if disputeID == "" {
		return nil, nil, errors.New("missing dispute id")
	}

	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action == "" {
		if req.Status == "approved" {
			action = "approve"
		} else if req.Status == "rejected" {
			action = "reject"
		}
	}
	if action != "approve" && action != "reject" {
		return nil, nil, errors.New("invalid action: must be 'approve' or 'reject'")
	}

	dOID, err := primitive.ObjectIDFromHex(disputeID)
	if err != nil {
		return nil, nil, errors.New("invalid dispute id format")
	}

	dispute, err := s.repo.GetDisputeByID(ctx, dOID)
	if err != nil {
		return nil, nil, err
	}

	if dispute.Status == DisputeStatusApproved || dispute.Status == DisputeStatusRejected {
		return nil, nil, errors.New("dispute has already been resolved")
	}

	now := time.Now()
	dispute.AdminNotes = strings.TrimSpace(req.AdminNotes)
	dispute.ResolvedBy = adminID
	dispute.ResolvedAt = &now

	if action == "reject" {
		dispute.Status = DisputeStatusRejected
		if err := s.repo.UpdateDispute(ctx, dispute); err != nil {
			return nil, nil, err
		}
		summary, _ := s.GetWalletSummary(ctx, dispute.UserID.Hex())
		return dispute, summary, nil
	}

	// Action == "approve" -> Execute refund
	refundAmount := dispute.Amount
	if req.RefundAmount != nil && *req.RefundAmount > 0 {
		refundAmount = *req.RefundAmount
	}

	// Atomically credit user's main wallet with category "refund"
	recordInput := RecordTransactionInput{
		UserID:        dispute.UserID,
		Type:          TypeCredit,
		TargetBalance: BalanceMain,
		Category:      CategoryRefund,
		Amount:        refundAmount,
		ReferenceID:   "REFUND-" + dispute.ID.Hex(),
		Description:   fmt.Sprintf("Dispute Refund for: %s", dispute.ReferenceID),
		Metadata: map[string]interface{}{
			"dispute_id":          dispute.ID.Hex(),
			"original_tx_id":      dispute.TransactionID.Hex(),
			"dispute_reason":      string(dispute.Reason),
			"admin_resolution":    dispute.AdminNotes,
			"resolved_by":         adminID,
		},
	}

	refundTx, updatedSummary, err := s.RecordTransaction(ctx, recordInput)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to process refund credit: %w", err)
	}

	dispute.Status = DisputeStatusApproved
	if refundTx != nil {
		txOID, _ := primitive.ObjectIDFromHex(refundTx.ID)
		dispute.RefundTransactionID = &txOID
	}

	if err := s.repo.UpdateDispute(ctx, dispute); err != nil {
		return nil, updatedSummary, err
	}

	return dispute, updatedSummary, nil
}

