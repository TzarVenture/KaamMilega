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
	"time"

	"km-backend/internal/config"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WalletService interface {
	GetWalletSummary(ctx context.Context, userID string) (*WalletSummaryResponse, error)
	AdjustBalances(ctx context.Context, userID string, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*WalletSummaryResponse, error)
	GetTransactions(ctx context.Context, userID string, query TransactionQuery) (*TransactionListResponse, error)
	RecordTransaction(ctx context.Context, input RecordTransactionInput) (*TransactionItemResponse, *WalletSummaryResponse, error)
	CreateTopupOrder(ctx context.Context, userID string, amount float64) (*CreateTopupOrderResponse, error)
	VerifyTopupPayment(ctx context.Context, userID string, req VerifyTopupPaymentRequest) (*WalletSummaryResponse, *TransactionItemResponse, error)
}

type WalletServiceImpl struct {
	repo       WalletRepository
	cfg        *config.Config
	httpClient *http.Client
}

func NewWalletService(repo WalletRepository, cfg *config.Config) WalletService {
	return &WalletServiceImpl{
		repo:       repo,
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 15 * time.Second},
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

	return summary, tx, nil
}


