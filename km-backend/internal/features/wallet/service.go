package wallet

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WalletService interface {
	GetWalletSummary(ctx context.Context, userID string) (*WalletSummaryResponse, error)
	GetTransactions(ctx context.Context, userID string, query TransactionQuery) (*TransactionListResponse, error)
	RecordTransaction(ctx context.Context, input RecordTransactionInput) (*TransactionItemResponse, *WalletSummaryResponse, error)
	CreateTopupOrder(ctx context.Context, userID string, amount float64) (*CreateTopupOrderResponse, error)
	VerifyTopupPayment(ctx context.Context, userID string, req VerifyTopupPaymentRequest) (*WalletSummaryResponse, *TransactionItemResponse, error)

	// Withdrawals (F71)
	GetPayoutAccount(ctx context.Context, userID string) (*PayoutAccountResponse, error)
	RequestWithdrawal(ctx context.Context, userID string, req WithdrawalRequest) (*WithdrawalResponse, error)
	GetMyWithdrawals(ctx context.Context, userID string, query WithdrawalQuery) (*WithdrawalListResponse, error)
	GetAdminWithdrawals(ctx context.Context, query WithdrawalQuery) (*WithdrawalListResponse, error)
	RevealWithdrawalAccount(ctx context.Context, withdrawalID, adminID string) (*RevealedAccount, error)
	UpdateWithdrawal(ctx context.Context, withdrawalID, adminID string, req UpdateWithdrawalRequest) (*Withdrawal, error)

	// Dispute & Refund handling (F73)
	CreateDispute(ctx context.Context, userID string, req CreateDisputeRequest) (*WalletDispute, error)
	GetMyDisputes(ctx context.Context, userID string, query DisputeQuery) (*DisputeListResponse, error)
	GetAdminDisputes(ctx context.Context, query DisputeQuery) (*DisputeListResponse, error)
	ResolveDispute(ctx context.Context, disputeID string, adminID string, req ResolveDisputeRequest) (*WalletDispute, *WalletSummaryResponse, error)

	// Admin finance
	GetFinanceOverview(ctx context.Context) (*FinanceOverview, error)
	LookupWallet(ctx context.Context, search string) (*WalletLookupResponse, error)
	SetWalletStatus(ctx context.Context, userID, status string) (*WalletSummaryResponse, error)

	// RegisterPurchaseRevoker sets how to take back what a wallet purchase of this category
	// bought, when an admin refunds its dispute in full. Call it at startup.
	RegisterPurchaseRevoker(category TransactionCategory, fn PurchaseRevoker)
}

// PurchaseRevoker takes back the item a wallet purchase bought. It runs inside the refund
// transaction, so returning an error cancels the refund.
type PurchaseRevoker func(ctx context.Context, purchase *WalletTransaction) error

type WalletServiceImpl struct {
	repo         WalletRepository
	cfg          *config.Config
	mailer       notification.Mailer
	notifService notification.NotificationService
	payments     payment.Service
	tx           database.Transactor
	revokers     map[TransactionCategory]PurchaseRevoker
}

func (s *WalletServiceImpl) RegisterPurchaseRevoker(category TransactionCategory, fn PurchaseRevoker) {
	s.revokers[category] = fn
}

func NewWalletService(
	repo WalletRepository,
	cfg *config.Config,
	mailer notification.Mailer,
	notifService notification.NotificationService,
	payments payment.Service,
	tx database.Transactor,
) WalletService {
	s := &WalletServiceImpl{
		repo:         repo,
		cfg:          cfg,
		mailer:       mailer,
		notifService: notifService,
		payments:     payments,
		tx:           tx,
		revokers:     map[TransactionCategory]PurchaseRevoker{},
	}
	payments.Register(payment.PurposeWalletTopup, payment.Handlers{
		Fulfill:   s.fulfillTopup,
		AfterPaid: s.afterTopup,
		Revoke:    s.revokeTopup,
	})
	return s
}

func parseUserID(userID string) (primitive.ObjectID, error) {
	if userID == "" {
		return primitive.NilObjectID, apperr.New("UNAUTHORIZED", "unauthorized: missing user id")
	}
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return primitive.NilObjectID, apperr.New("BAD_REQUEST", "invalid user id format")
	}
	return oid, nil
}

// startOfDayIST is when "today" began for the daily limits.
func startOfDayIST(now time.Time) time.Time {
	ist := time.FixedZone("IST", 5*60*60+30*60)
	local := now.In(ist)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, ist)
}

func pageOf(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return page, limit
}

func totalPages(total int64, limit int) int {
	return int(math.Ceil(float64(total) / float64(limit)))
}

// GetWalletSummary returns the structured wallet balance breakdown for a given user ID
func (s *WalletServiceImpl) GetWalletSummary(ctx context.Context, userID string) (*WalletSummaryResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	w, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}
	return formatWalletSummary(w), nil
}

// formatWalletSummary converts the Wallet domain model into a structured summary
func formatWalletSummary(w *Wallet) *WalletSummaryResponse {
	currency := w.Currency
	if currency == "" {
		currency = "INR"
	}
	status := w.Status
	if status == "" {
		status = WalletActive
	}
	return &WalletSummaryResponse{
		WalletID:            w.ID.Hex(),
		UserID:              w.UserID.Hex(),
		TotalBalance:        money.ToRupees(w.MainPaise + w.EarningsPaise + w.BonusPaise),
		WithdrawableBalance: money.ToRupees(w.EarningsPaise),
		MainBalance:         money.ToRupees(w.MainPaise),
		EarningsBalance:     money.ToRupees(w.EarningsPaise),
		LockedBalance:       money.ToRupees(w.LockedPaise),
		BonusBalance:        money.ToRupees(w.BonusPaise),
		Currency:            currency,
		Status:              status,
		UpdatedAt:           w.UpdatedAt,
	}
}

// GetTransactions retrieves the paginated ledger history for a user
func (s *WalletServiceImpl) GetTransactions(ctx context.Context, userID string, query TransactionQuery) (*TransactionListResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	wallet, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}

	query.Page, query.Limit = pageOf(query.Page, query.Limit)
	txList, total, err := s.repo.GetTransactionsByWalletID(ctx, wallet.ID, query)
	if err != nil {
		return nil, err
	}

	items := make([]TransactionItemResponse, 0, len(txList))
	for i := range txList {
		items = append(items, formatTransactionItem(&txList[i]))
	}
	return &TransactionListResponse{
		Transactions: items,
		Total:        total,
		Page:         query.Page,
		Limit:        query.Limit,
		TotalPages:   totalPages(total, query.Limit),
	}, nil
}

// RecordTransaction changes a balance and writes its ledger row as one step
func (s *WalletServiceImpl) RecordTransaction(ctx context.Context, input RecordTransactionInput) (*TransactionItemResponse, *WalletSummaryResponse, error) {
	tx, updatedWallet, err := s.repo.RecordAtomicTransaction(ctx, input)
	if err != nil {
		return nil, nil, err
	}
	item := formatTransactionItem(tx)
	return &item, formatWalletSummary(updatedWallet), nil
}

// formatTransactionItem maps a WalletTransaction to a client-facing JSON DTO
func formatTransactionItem(tx *WalletTransaction) TransactionItemResponse {
	return TransactionItemResponse{
		ID:            tx.ID.Hex(),
		WalletID:      tx.WalletID.Hex(),
		Type:          tx.Type,
		TargetBalance: tx.TargetBalance,
		Category:      tx.Category,
		Amount:        money.ToRupees(tx.AmountPaise),
		BalanceAfter:  money.ToRupees(tx.BalanceAfterPaise),
		Status:        tx.Status,
		ReferenceID:   tx.ReferenceID,
		Description:   tx.Description,
		Metadata:      tx.Metadata,
		Disputable:    disputeRefusal(tx, time.Now()) == nil,
		CreatedAt:     tx.CreatedAt,
	}
}

// CreateTopupOrder generates a Razorpay Order for adding money to the wallet
func (s *WalletServiceImpl) CreateTopupOrder(ctx context.Context, userID string, amount float64) (*CreateTopupOrderResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	if !money.HasAtMostTwoDecimals(amount) {
		return nil, apperr.New("WALLET_AMOUNT_INVALID", "enter a valid amount")
	}
	paise := money.ToPaise(amount)
	if paise < MinTopupPaise {
		return nil, apperr.New("WALLET_TOPUP_MIN", fmt.Sprintf("the minimum you can add is %s", money.INR(MinTopupPaise)))
	}
	if paise > MaxTopupPaise {
		return nil, apperr.New("WALLET_TOPUP_MAX", fmt.Sprintf("you can add up to %s at a time", money.INR(MaxTopupPaise)))
	}

	wallet, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}
	if wallet.Status != WalletActive && wallet.Status != "" {
		return nil, ErrFrozen
	}
	if wallet.MainPaise+paise > MaxMainBalancePaise {
		return nil, apperr.New("WALLET_BALANCE_LIMIT", fmt.Sprintf("your wallet balance can't go above %s", money.INR(MaxMainBalancePaise)))
	}
	addedToday, err := s.payments.SumPaidSince(ctx, oid, payment.PurposeWalletTopup, startOfDayIST(time.Now()))
	if err != nil {
		return nil, err
	}
	if addedToday+paise > MaxDailyTopupPaise {
		return nil, apperr.New("WALLET_TOPUP_DAILY_LIMIT", fmt.Sprintf("you can add up to %s a day", money.INR(MaxDailyTopupPaise)))
	}

	checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
		UserID:      oid,
		Purpose:     payment.PurposeWalletTopup,
		AmountPaise: paise,
		Description: "Add money to wallet",
	})
	if err != nil {
		return nil, err
	}
	return &CreateTopupOrderResponse{
		OrderID:     checkout.OrderID,
		Amount:      checkout.Amount,
		AmountPaise: checkout.AmountPaise,
		Currency:    checkout.Currency,
		KeyID:       checkout.KeyID,
	}, nil
}

func topupReference(paymentID string) string { return "topup:" + paymentID }

func (s *WalletServiceImpl) fulfillTopup(ctx context.Context, order *payment.Order) error {
	_, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
		UserID:        order.UserID,
		Type:          TypeCredit,
		TargetBalance: BalanceMain,
		Category:      CategoryTopup,
		Amount:        order.Amount(),
		ReferenceID:   topupReference(order.RazorpayPaymentID),
		Description:   "Added to wallet",
		Metadata: map[string]interface{}{
			"razorpay_order_id":   order.RazorpayOrderID,
			"razorpay_payment_id": order.RazorpayPaymentID,
			"payment_channel":     "razorpay",
		},
	})
	if errors.Is(err, ErrClosed) {
		return payment.Unfulfillable("Wallet is closed")
	}
	return err
}

// afterTopup sends the receipt once, after the money is recorded
func (s *WalletServiceImpl) afterTopup(order *payment.Order) {
	ctx := context.Background()
	amount := order.Amount()
	if s.mailer != nil {
		if email, name, _ := s.repo.GetUserContact(ctx, order.UserID); email != "" {
			_ = s.mailer.SendTransactionReceipt(notification.TransactionReceiptParams{
				ToEmail:         email,
				RecipientName:   name,
				TransactionID:   order.RazorpayPaymentID,
				TransactionType: "Wallet top-up",
				Amount:          amount,
				Currency:        "INR",
				Description:     fmt.Sprintf("%s added to your wallet", money.INR(order.AmountPaise)),
				IssuedAt:        time.Now(),
			})
		}
	}
	s.notify(order.UserID, "wallet_credit", "Money added to wallet",
		fmt.Sprintf("%s was added to your wallet", money.INR(order.AmountPaise)),
		map[string]interface{}{"payment_id": order.RazorpayPaymentID, "amount": amount})
}

// revokeTopup takes refunded money back out of the wallet. It fails if it's already been spent.
func (s *WalletServiceImpl) revokeTopup(ctx context.Context, order *payment.Order) error {
	_, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
		UserID:        order.UserID,
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategoryRefund,
		Amount:        order.Amount(),
		ReferenceID:   topupReference(order.RazorpayPaymentID) + ":refund",
		Description:   "Refunded to your original payment method",
		Metadata:      map[string]interface{}{"razorpay_payment_id": order.RazorpayPaymentID},
	})
	return err
}

func (s *WalletServiceImpl) notify(userID primitive.ObjectID, kind, title, message string, metadata map[string]interface{}) {
	if s.notifService == nil {
		return
	}
	_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID:   userID,
		Type:     kind,
		Category: notification.CategorySystem,
		Title:    title,
		Message:  message,
		Link:     "/wallet",
		Metadata: metadata,
	})
}

// VerifyTopupPayment confirms a checkout. The amount credited is the one saved with the order.
func (s *WalletServiceImpl) VerifyTopupPayment(ctx context.Context, userID string, req VerifyTopupPaymentRequest) (*WalletSummaryResponse, *TransactionItemResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, nil, err
	}
	order, err := s.payments.Confirm(ctx, oid, payment.PurposeWalletTopup, payment.ConfirmInput{
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		RazorpaySignature: req.RazorpaySignature,
	})
	if err != nil {
		return nil, nil, err
	}

	wallet, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, nil, err
	}
	var item *TransactionItemResponse
	if tx, err := s.repo.GetTransactionByReference(ctx, topupReference(order.RazorpayPaymentID)); err == nil && tx != nil {
		formatted := formatTransactionItem(tx)
		item = &formatted
	}
	return formatWalletSummary(wallet), item, nil
}

// GetPayoutAccount says whether a user can withdraw and where the money would go
func (s *WalletServiceImpl) GetPayoutAccount(ctx context.Context, userID string) (*PayoutAccountResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	account, err := s.repo.GetPayoutAccount(ctx, oid)
	if err != nil {
		return nil, err
	}
	if !account.Approved {
		return &PayoutAccountResponse{Eligible: false}, nil
	}
	return &PayoutAccountResponse{
		Eligible:      true,
		Method:        account.Method,
		AccountHolder: account.AccountHolder,
		AccountLast4:  account.AccountLast4,
		IFSC:          account.IFSC,
		UPIID:         account.UPIID,
	}, nil
}

func maskedDestination(w *Withdrawal) string {
	if w.PayoutMethod == "upi" {
		return "UPI (" + w.UPIID + ")"
	}
	return fmt.Sprintf("Bank account ending %s (IFSC %s)", w.AccountLast4, w.IFSC)
}

func withdrawalReference(id primitive.ObjectID) string { return "withdrawal:" + id.Hex() }

// RequestWithdrawal takes the money out of earnings now and queues the payout. The one
// transaction, plus the "one open withdrawal" rule, is what stops a double click paying twice.
func (s *WalletServiceImpl) RequestWithdrawal(ctx context.Context, userID string, req WithdrawalRequest) (*WithdrawalResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	if !money.HasAtMostTwoDecimals(req.Amount) {
		return nil, apperr.New("WALLET_AMOUNT_INVALID", "enter a valid amount")
	}
	paise := money.ToPaise(req.Amount)
	if paise < MinWithdrawalPaise {
		return nil, apperr.New("WITHDRAWAL_MIN", fmt.Sprintf("the minimum withdrawal is %s", money.INR(MinWithdrawalPaise)))
	}

	account, err := s.repo.GetPayoutAccount(ctx, oid)
	if err != nil {
		return nil, err
	}
	if !account.Approved || (account.Method != "bank" && account.Method != "upi") {
		return nil, ErrKYCRequired
	}

	now := time.Now()
	withdrawal := &Withdrawal{
		ID:            primitive.NewObjectID(),
		UserID:        oid,
		AmountPaise:   paise,
		Amount:        money.ToRupees(paise),
		Status:        WithdrawalRequested,
		PayoutMethod:  account.Method,
		AccountHolder: account.AccountHolder,
		AccountLast4:  account.AccountLast4,
		IFSC:          account.IFSC,
		UPIID:         account.UPIID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	withdrawal.ReferenceID = withdrawalReference(withdrawal.ID)

	var summary *WalletSummaryResponse
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		open, err := s.repo.CountOpenWithdrawals(ctx, oid)
		if err != nil {
			return err
		}
		if open > 0 {
			return ErrWithdrawalOpen
		}
		today, err := s.repo.SumWithdrawalsSince(ctx, oid, startOfDayIST(now))
		if err != nil {
			return err
		}
		if today+paise > MaxDailyWithdrawalPaise {
			return apperr.New("WITHDRAWAL_DAILY_LIMIT", fmt.Sprintf("you can withdraw up to %s a day", money.INR(MaxDailyWithdrawalPaise)))
		}

		_, updated, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
			UserID:        oid,
			Type:          TypeDebit,
			TargetBalance: BalanceEarnings,
			Category:      CategoryWithdrawal,
			Amount:        money.ToRupees(paise),
			ReferenceID:   withdrawal.ReferenceID,
			Description:   "Withdrawal to " + maskedDestination(withdrawal),
			Status:        StatusPending,
			Metadata:      map[string]interface{}{"withdrawal_id": withdrawal.ID.Hex(), "payout_method": account.Method},
		})
		if errors.Is(err, ErrInsufficient) {
			return ErrEarningsLow
		}
		if err != nil {
			return err
		}
		summary = formatWalletSummary(updated)
		return s.repo.CreateWithdrawal(ctx, withdrawal)
	})
	if err != nil {
		return nil, err
	}

	go s.afterWithdrawalRequested(withdrawal, summary.EarningsBalance)
	return &WithdrawalResponse{Withdrawal: withdrawal, Wallet: summary}, nil
}

func (s *WalletServiceImpl) afterWithdrawalRequested(w *Withdrawal, remaining float64) {
	if s.mailer != nil {
		email, name, _ := s.repo.GetUserContact(context.Background(), w.UserID)
		_ = s.mailer.SendWithdrawalRequest(notification.WithdrawalRequestParams{
			AdminEmail:   s.cfg.SMTPFromEmail,
			ExpertEmail:  email,
			ExpertName:   name,
			Amount:       w.Amount,
			ReferenceID:  w.ReferenceID,
			PayoutMethod: w.PayoutMethod,
			Destination:  maskedDestination(w),
			Remaining:    remaining,
		})
	}
	s.notify(w.UserID, "wallet_withdrawal", "Withdrawal requested",
		fmt.Sprintf("Your withdrawal of %s is being processed", money.INR(w.AmountPaise)),
		map[string]interface{}{"reference_id": w.ReferenceID, "amount": w.Amount})
}

func (s *WalletServiceImpl) listWithdrawals(ctx context.Context, query WithdrawalQuery) (*WithdrawalListResponse, error) {
	query.Page, query.Limit = pageOf(query.Page, query.Limit)
	list, total, err := s.repo.ListWithdrawals(ctx, query)
	if err != nil {
		return nil, err
	}
	return &WithdrawalListResponse{
		Withdrawals: list,
		Total:       total,
		Page:        query.Page,
		Limit:       query.Limit,
		TotalPages:  totalPages(total, query.Limit),
	}, nil
}

// GetMyWithdrawals returns the signed-in user's withdrawals
func (s *WalletServiceImpl) GetMyWithdrawals(ctx context.Context, userID string, query WithdrawalQuery) (*WithdrawalListResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	query.UserID = &oid
	return s.listWithdrawals(ctx, query)
}

// GetAdminWithdrawals returns the payout queue with who each request is from
func (s *WalletServiceImpl) GetAdminWithdrawals(ctx context.Context, query WithdrawalQuery) (*WithdrawalListResponse, error) {
	res, err := s.listWithdrawals(ctx, query)
	if err != nil {
		return nil, err
	}
	for i := range res.Withdrawals {
		res.Withdrawals[i].UserEmail, res.Withdrawals[i].UserName, _ = s.repo.GetUserContact(ctx, res.Withdrawals[i].UserID)
	}
	return res, nil
}

// RevealWithdrawalAccount gives an admin the full destination needed to send a manual payout
func (s *WalletServiceImpl) RevealWithdrawalAccount(ctx context.Context, withdrawalID, adminID string) (*RevealedAccount, error) {
	w, err := s.withdrawalByID(ctx, withdrawalID)
	if err != nil {
		return nil, err
	}
	if w.Status != WithdrawalRequested && w.Status != WithdrawalProcessing {
		return nil, ErrWithdrawalState
	}
	account, err := s.repo.GetPayoutAccount(ctx, w.UserID)
	if err != nil {
		return nil, err
	}
	if !account.Approved || account.Method != w.PayoutMethod || account.AccountLast4 != w.AccountLast4 || account.UPIID != w.UPIID {
		return nil, ErrPayoutChanged
	}
	log.Printf("[wallet] admin %s viewed the payout account for withdrawal %s", adminID, w.ID.Hex())
	return &RevealedAccount{
		Method:        account.Method,
		AccountHolder: account.AccountHolder,
		AccountNumber: account.AccountNumber,
		IFSC:          account.IFSC,
		UPIID:         account.UPIID,
	}, nil
}

func (s *WalletServiceImpl) withdrawalByID(ctx context.Context, id string) (*Withdrawal, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, ErrWithdrawalNotFound
	}
	w, err := s.repo.GetWithdrawal(ctx, oid)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, ErrWithdrawalNotFound
	}
	return w, nil
}

// UpdateWithdrawal records what happened to a payout. On failure the money goes back to earnings.
func (s *WalletServiceImpl) UpdateWithdrawal(ctx context.Context, withdrawalID, adminID string, req UpdateWithdrawalRequest) (*Withdrawal, error) {
	w, err := s.withdrawalByID(ctx, withdrawalID)
	if err != nil {
		return nil, err
	}

	update := WithdrawalUpdate{
		Status:        req.Status,
		BankReference: strings.TrimSpace(req.BankReference),
		FailureReason: strings.TrimSpace(req.FailureReason),
		HandledBy:     adminID,
		At:            time.Now(),
	}

	var from []WithdrawalStatus
	switch req.Status {
	case WithdrawalProcessing:
		from = []WithdrawalStatus{WithdrawalRequested}
	case WithdrawalPaid:
		if update.BankReference == "" {
			return nil, apperr.New("WITHDRAWAL_REFERENCE_REQUIRED", "enter the bank reference (UTR) for this payout")
		}
		from = []WithdrawalStatus{WithdrawalRequested, WithdrawalProcessing}
	case WithdrawalFailed:
		if update.FailureReason == "" {
			return nil, apperr.New("WITHDRAWAL_REASON_REQUIRED", "enter why this payout failed")
		}
		from = []WithdrawalStatus{WithdrawalRequested, WithdrawalProcessing}
	default:
		return nil, ErrWithdrawalState
	}

	err = s.tx.Run(ctx, func(ctx context.Context) error {
		moved, err := s.repo.UpdateWithdrawal(ctx, w.ID, from, update)
		if err != nil {
			return err
		}
		if !moved {
			return ErrWithdrawalState
		}
		switch req.Status {
		case WithdrawalPaid:
			return s.repo.SetTransactionStatus(ctx, w.ReferenceID, StatusCompleted)
		case WithdrawalFailed:
			if err := s.repo.SetTransactionStatus(ctx, w.ReferenceID, StatusReversed); err != nil {
				return err
			}
			_, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
				UserID:        w.UserID,
				Type:          TypeCredit,
				TargetBalance: BalanceEarnings,
				Category:      CategoryWithdrawal,
				Amount:        w.Amount,
				ReferenceID:   w.ReferenceID + ":reversal",
				Description:   "Withdrawal failed, money returned to earnings",
				Metadata:      map[string]interface{}{"withdrawal_id": w.ID.Hex()},
			})
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	switch req.Status {
	case WithdrawalPaid:
		go s.notify(w.UserID, "wallet_withdrawal", "Withdrawal paid",
			fmt.Sprintf("%s has been sent to your account", money.INR(w.AmountPaise)),
			map[string]interface{}{"reference_id": w.ReferenceID})
	case WithdrawalFailed:
		go s.notify(w.UserID, "wallet_withdrawal", "Withdrawal failed",
			fmt.Sprintf("Your withdrawal of %s failed and the money is back in your earnings", money.INR(w.AmountPaise)),
			map[string]interface{}{"reference_id": w.ReferenceID})
	}
	return s.repo.GetWithdrawal(ctx, w.ID)
}

// disputeRefusal says why a ledger row can't be disputed, or nil if it can. Only purchases paid
// from the wallet qualify. Session payments are held in escrow and have their own report path.
func disputeRefusal(tx *WalletTransaction, now time.Time) error {
	if tx.Type != TypeDebit || tx.TargetBalance != BalanceMain {
		return ErrDisputeNotEligible
	}
	switch tx.Category {
	case CategoryEventTicket, CategoryPassPurchase, CategorySubscription:
	default:
		return ErrDisputeNotEligible
	}
	if now.Sub(tx.CreatedAt) > DisputeWindow {
		return ErrDisputeExpired
	}
	return nil
}

// CreateDispute allows a user to file a dispute on an eligible wallet purchase (F73)
func (s *WalletServiceImpl) CreateDispute(ctx context.Context, userID string, req CreateDisputeRequest) (*WalletDispute, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	description := strings.TrimSpace(req.Description)
	if req.Reason == "" || description == "" {
		return nil, apperr.New("DISPUTE_DETAILS_REQUIRED", "choose a reason and describe the problem")
	}
	txOID, err := primitive.ObjectIDFromHex(req.TransactionID)
	if err != nil {
		return nil, ErrDisputeNotEligible
	}

	tx, err := s.repo.GetTransactionByID(ctx, txOID)
	if err != nil {
		return nil, err
	}
	if tx == nil || tx.UserID != oid {
		return nil, ErrDisputeNotEligible
	}
	if err := disputeRefusal(tx, time.Now()); err != nil {
		return nil, err
	}

	existing, err := s.repo.GetDisputeByTransactionID(ctx, tx.ID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDisputeExists
	}

	userEmail, userName, _ := s.repo.GetUserContact(ctx, oid)
	return s.repo.CreateDispute(ctx, &WalletDispute{
		UserID:        oid,
		UserName:      userName,
		UserEmail:     userEmail,
		TransactionID: tx.ID,
		ReferenceID:   tx.ReferenceID,
		AmountPaise:   tx.AmountPaise,
		TargetBalance: tx.TargetBalance,
		Category:      tx.Category,
		Reason:        req.Reason,
		Description:   description,
		Status:        DisputeStatusPending,
	})
}

func (s *WalletServiceImpl) listDisputes(ctx context.Context, query DisputeQuery) (*DisputeListResponse, error) {
	query.Page, query.Limit = pageOf(query.Page, query.Limit)
	disputes, total, err := s.repo.GetDisputes(ctx, query)
	if err != nil {
		return nil, err
	}
	return &DisputeListResponse{
		Disputes:   disputes,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: totalPages(total, query.Limit),
	}, nil
}

// GetMyDisputes returns all disputes filed by the authenticated user
func (s *WalletServiceImpl) GetMyDisputes(ctx context.Context, userID string, query DisputeQuery) (*DisputeListResponse, error) {
	if _, err := parseUserID(userID); err != nil {
		return nil, err
	}
	query.UserID = userID
	return s.listDisputes(ctx, query)
}

// GetAdminDisputes returns all disputes for admin review
func (s *WalletServiceImpl) GetAdminDisputes(ctx context.Context, query DisputeQuery) (*DisputeListResponse, error) {
	res, err := s.listDisputes(ctx, query)
	if err != nil {
		return nil, err
	}
	for i := range res.Disputes {
		d := &res.Disputes[i]
		if d.UserName == "" || d.UserEmail == "" {
			email, name, _ := s.repo.GetUserContact(ctx, d.UserID)
			if d.UserName == "" {
				d.UserName = name
			}
			if d.UserEmail == "" {
				d.UserEmail = email
			}
		}
	}
	return res, nil
}

func disputeAction(req ResolveDisputeRequest) string {
	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action != "" {
		return action
	}
	switch DisputeStatus(req.Status) {
	case DisputeStatusApproved:
		return "approve"
	case DisputeStatusRejected:
		return "reject"
	case DisputeStatusUnderReview:
		return "under_review"
	}
	return ""
}

// ResolveDispute marks a dispute under review, rejects it, or approves it and refunds the wallet.
// Claiming the status and crediting the refund happen together, so it can only pay once.
func (s *WalletServiceImpl) ResolveDispute(ctx context.Context, disputeID string, adminID string, req ResolveDisputeRequest) (*WalletDispute, *WalletSummaryResponse, error) {
	dOID, err := primitive.ObjectIDFromHex(disputeID)
	if err != nil {
		return nil, nil, apperr.New("DISPUTE_NOT_FOUND", "dispute not found")
	}
	dispute, err := s.repo.GetDisputeByID(ctx, dOID)
	if err != nil {
		return nil, nil, err
	}
	if dispute == nil {
		return nil, nil, apperr.New("DISPUTE_NOT_FOUND", "dispute not found")
	}

	open := []DisputeStatus{DisputeStatusPending, DisputeStatusUnderReview}
	notes := strings.TrimSpace(req.AdminNotes)
	now := time.Now()
	update := DisputeUpdate{AdminNotes: notes, ResolvedBy: adminID, ResolvedAt: &now}

	var claimErr error
	claim := func(ctx context.Context, from []DisputeStatus, u DisputeUpdate) {
		moved, err := s.repo.UpdateDispute(ctx, dOID, from, u)
		switch {
		case err != nil:
			claimErr = err
		case !moved:
			claimErr = ErrDisputeResolved
		default:
			claimErr = nil
		}
	}

	switch disputeAction(req) {
	case "under_review":
		claim(ctx, open, DisputeUpdate{Status: DisputeStatusUnderReview, AdminNotes: notes})
		if claimErr != nil {
			return nil, nil, claimErr
		}

	case "reject":
		update.Status = DisputeStatusRejected
		claim(ctx, open, update)
		if claimErr != nil {
			return nil, nil, claimErr
		}

	case "approve":
		refundPaise := dispute.AmountPaise
		if req.RefundAmount != nil {
			refundPaise = money.ToPaise(*req.RefundAmount)
			if refundPaise <= 0 {
				return nil, nil, apperr.New("WALLET_AMOUNT_INVALID", "enter a valid amount")
			}
		}
		if refundPaise > dispute.AmountPaise {
			return nil, nil, ErrRefundTooLarge
		}

		update.Status = DisputeStatusApproved
		update.RefundPaise = refundPaise
		err := s.tx.Run(ctx, func(ctx context.Context) error {
			claim(ctx, open, update)
			if claimErr != nil {
				return claimErr
			}
			tx, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
				UserID:        dispute.UserID,
				Type:          TypeCredit,
				TargetBalance: BalanceMain,
				Category:      CategoryRefund,
				Amount:        money.ToRupees(refundPaise),
				ReferenceID:   "dispute:" + dispute.ID.Hex() + ":refund",
				Description:   "Refund for your dispute",
				Metadata: map[string]interface{}{
					"dispute_id":     dispute.ID.Hex(),
					"original_tx_id": dispute.TransactionID.Hex(),
					"dispute_reason": string(dispute.Reason),
				},
			})
			if err != nil {
				return err
			}
			// A full refund also takes back what was bought; a partial one is goodwill
			if refundPaise == dispute.AmountPaise {
				if err := s.revokePurchase(ctx, dispute.TransactionID); err != nil {
					return err
				}
			}
			claim(ctx, []DisputeStatus{DisputeStatusApproved}, DisputeUpdate{Status: DisputeStatusApproved, RefundTxID: &tx.ID})
			return claimErr
		})
		if err != nil {
			return nil, nil, err
		}

	default:
		return nil, nil, apperr.New("DISPUTE_ACTION_INVALID", "choose approve, reject or under review")
	}

	updated, err := s.repo.GetDisputeByID(ctx, dOID)
	if err != nil {
		return nil, nil, err
	}
	summary, err := s.GetWalletSummary(ctx, dispute.UserID.Hex())
	if err != nil {
		return updated, nil, err
	}
	return updated, summary, nil
}

// revokePurchase runs the revoker registered for the purchase's category, if any
func (s *WalletServiceImpl) revokePurchase(ctx context.Context, purchaseID primitive.ObjectID) error {
	purchase, err := s.repo.GetTransactionByID(ctx, purchaseID)
	if err != nil {
		return err
	}
	if purchase == nil {
		return nil
	}
	if revoke, ok := s.revokers[purchase.Category]; ok {
		return revoke(ctx, purchase)
	}
	return nil
}

// GetFinanceOverview returns platform money totals and any balance that disagrees with its ledger
func (s *WalletServiceImpl) GetFinanceOverview(ctx context.Context) (*FinanceOverview, error) {
	return s.repo.FinanceOverview(ctx)
}

// LookupWallet finds one user's wallet by user id, email or mobile
func (s *WalletServiceImpl) LookupWallet(ctx context.Context, search string) (*WalletLookupResponse, error) {
	contact, err := s.repo.FindUser(ctx, search)
	if err != nil {
		return nil, err
	}
	if contact == nil {
		return nil, ErrWalletNotFound
	}
	userID := contact.ID.Hex()
	summary, err := s.GetWalletSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	transactions, err := s.GetTransactions(ctx, userID, TransactionQuery{Page: 1, Limit: 50})
	if err != nil {
		return nil, err
	}
	return &WalletLookupResponse{
		UserID:       userID,
		Name:         contact.Name,
		Email:        contact.Email,
		Mobile:       contact.Mobile,
		Wallet:       summary,
		Transactions: transactions.Transactions,
	}, nil
}

// SetWalletStatus puts a wallet on hold or releases it
func (s *WalletServiceImpl) SetWalletStatus(ctx context.Context, userID, status string) (*WalletSummaryResponse, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	if status != WalletActive && status != WalletFrozen {
		return nil, apperr.New("WALLET_STATUS_INVALID", "a wallet can only be set to active or frozen")
	}
	w, err := s.repo.SetWalletStatus(ctx, oid, status)
	if err != nil {
		return nil, err
	}
	return formatWalletSummary(w), nil
}
