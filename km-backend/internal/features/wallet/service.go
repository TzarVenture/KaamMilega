package wallet

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/smtp"
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
	RequestWithdrawal(ctx context.Context, userID string, req WithdrawalRequest) (*WithdrawalResponse, error)
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

	var desc string
	if req.PayoutMethod == "bank" {
		metadata["account_number"] = req.AccountNumber
		metadata["ifsc_code"] = req.IFSCCode
		metadata["bank_name"] = req.BankName
		masked := req.AccountNumber
		if len(masked) > 4 {
			masked = "••••" + masked[len(masked)-4:]
		}
		desc = fmt.Sprintf("Withdrawal to Bank A/C (%s)", masked)
	} else {
		metadata["upi_id"] = req.UPIID
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

	// Asynchronously notify admin and user via SMTP
	go s.sendWithdrawalNotificationEmails(req, refID, walletDoc.EarningsBalance-req.Amount, userEmail, userName)

	return &WithdrawalResponse{
		Transaction: txItem,
		Wallet:      updatedWallet,
		Message:     fmt.Sprintf("Withdrawal request of ₹%.2f submitted successfully. Reference ID: %s", req.Amount, refID),
	}, nil
}

// sendWithdrawalNotificationEmails dispatches payout alerts to admin and confirmation to expert
func (s *WalletServiceImpl) sendWithdrawalNotificationEmails(req WithdrawalRequest, refID string, remaining float64, userEmail, userName string) {
	if s.cfg.SMTPHost == "" || s.cfg.SMTPUsername == "" {
		return
	}

	destDetails := fmt.Sprintf("UPI ID: %s", req.UPIID)
	maskedDest := fmt.Sprintf("UPI (%s)", req.UPIID)
	if req.PayoutMethod == "bank" {
		destDetails = fmt.Sprintf("Bank: %s | A/C: %s | IFSC: %s | Holder: %s", req.BankName, req.AccountNumber, req.IFSCCode, req.AccountHolder)
		maskedAcc := req.AccountNumber
		if len(maskedAcc) > 4 {
			maskedAcc = "••••" + maskedAcc[len(maskedAcc)-4:]
		}
		bankName := req.BankName
		if bankName == "" {
			bankName = "Bank Transfer"
		}
		maskedDest = fmt.Sprintf("%s (%s, IFSC: %s)", bankName, maskedAcc, req.IFSCCode)
	}

	// 1. Dispatch Alert Email to Platform Admin
	adminEmail := s.cfg.SMTPFromEmail
	if adminEmail != "" {
		adminSubject := fmt.Sprintf("[KaamMilega Payout Alert] New Withdrawal Request: ₹%.2f (%s)", req.Amount, refID)
		adminBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
    <h2 style="color: #1a2b8c; margin-top: 0;">New Payout Request Received</h2>
    <p>An expert has requested a payout from their earnings balance:</p>
    <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Reference ID:</td><td style="padding: 8px 0; font-weight: bold; font-family: monospace;">%s</td></tr>
      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Expert Name:</td><td style="padding: 8px 0; font-weight: bold;">%s</td></tr>
      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Amount:</td><td style="padding: 8px 0; font-weight: bold; color: #10b981;">₹%.2f</td></tr>
      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Payout Method:</td><td style="padding: 8px 0; font-weight: bold; text-transform: uppercase;">%s</td></tr>
      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Destination:</td><td style="padding: 8px 0; font-weight: bold;">%s</td></tr>
      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Phone / Contact:</td><td style="padding: 8px 0; font-weight: bold;">%s</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Remaining Earnings:</td><td style="padding: 8px 0; font-weight: bold;">₹%.2f</td></tr>
    </table>
    <p style="color: #64748b; font-size: 13px;">Please verify account details, disburse funds via IMPS/NEFT/UPI, and confirm with the expert.</p>
  </div>
</body>
</html>`, refID, userName, req.Amount, req.PayoutMethod, destDetails, req.PhoneNumber, remaining)

		_ = sendSMTPMail(s.cfg, adminEmail, adminSubject, adminBody)
	}

	// 2. Dispatch Confirmation Receipt Email to the Withdrawing Expert
	if userEmail != "" {
		if userName == "" {
			userName = "Valued Expert"
		}
		userSubject := fmt.Sprintf("[KaamMilega] Withdrawal Request Received - ₹%.2f (%s)", req.Amount, refID)
		userBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #1a2b8c; margin: 0; font-size: 24px; font-weight: 800;">KaamMilega™</h1>
      <p style="color: #64748b; font-size: 13px; margin-top: 4px; font-weight: 500;">Withdrawal Request Confirmation</p>
    </div>

    <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hi <strong>%s</strong>,</p>
    <p style="color: #334155; font-size: 14px; line-height: 1.6;">We have received your request to withdraw earnings from your KaamMilega wallet. The requested amount has been deducted from your earnings balance and queued for transfer.</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Withdrawal Amount:</td>
          <td style="padding: 10px 0; font-weight: 800; color: #10b981; font-size: 18px; text-align: right;">₹%.2f</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Reference ID:</td>
          <td style="padding: 10px 0; font-weight: bold; color: #1e293b; font-family: monospace; text-align: right;">%s</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Payout Method:</td>
          <td style="padding: 10px 0; font-weight: bold; color: #1e293b; text-transform: uppercase; text-align: right;">%s</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Destination:</td>
          <td style="padding: 10px 0; font-weight: bold; color: #1e293b; text-align: right;">%s</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Remaining Earnings:</td>
          <td style="padding: 10px 0; font-weight: bold; color: #1e293b; text-align: right;">₹%.2f</td>
        </tr>
      </table>
    </div>

    <div style="background: #eff6ff; border-left: 4px solid #1a2b8c; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
      <p style="color: #1e3a8a; font-size: 13px; line-height: 1.5; margin: 0;">
        <strong>What's Next?</strong><br>
        Our accounts team is reviewing your request and will disburse funds directly via IMPS or UPI. You can track this withdrawal in your Wallet Transaction History.
      </p>
    </div>

    <p style="color: #64748b; font-size: 12px; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 16px; line-height: 1.5;">
      If you did not initiate this withdrawal request, please reach out to us immediately at support@kaammilega.com quoting your Reference ID (<strong>%s</strong>).
    </p>
  </div>
</body>
</html>`, userName, req.Amount, refID, req.PayoutMethod, maskedDest, remaining, refID)

		_ = sendSMTPMail(s.cfg, userEmail, userSubject, userBody)
	}
}

// sendSMTPMail helper dispatches an HTML email via Brevo / SMTP configuration
func sendSMTPMail(cfg *config.Config, to, subject, htmlBody string) error {
	if cfg.SMTPHost == "" || cfg.SMTPUsername == "" || to == "" {
		return errors.New("missing smtp configuration or recipient")
	}

	addr := fmt.Sprintf("%s:%s", cfg.SMTPHost, cfg.SMTPPort)
	auth := smtp.PlainAuth("", cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPHost)

	header := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		cfg.SMTPFromName, cfg.SMTPFromEmail, to, subject)

	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()

	if err = client.StartTLS(&tls.Config{ServerName: cfg.SMTPHost}); err != nil {
		return err
	}
	if err = client.Auth(auth); err != nil {
		return err
	}
	if err = client.Mail(cfg.SMTPFromEmail); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, _ = w.Write([]byte(header + htmlBody))
	_ = w.Close()
	return client.Quit()
}


