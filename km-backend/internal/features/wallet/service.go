package wallet

import (
	"context"
	"errors"
	"math"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WalletService interface {
	GetWalletSummary(ctx context.Context, userID string) (*WalletSummaryResponse, error)
	AdjustBalances(ctx context.Context, userID string, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*WalletSummaryResponse, error)
	GetTransactions(ctx context.Context, userID string, query TransactionQuery) (*TransactionListResponse, error)
	RecordTransaction(ctx context.Context, input RecordTransactionInput) (*TransactionItemResponse, *WalletSummaryResponse, error)
}

type WalletServiceImpl struct {
	repo WalletRepository
}

func NewWalletService(repo WalletRepository) WalletService {
	return &WalletServiceImpl{
		repo: repo,
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

