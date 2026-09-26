package wallet

import (
	"context"
	"errors"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type mockWalletRepository struct {
	wallet       *Wallet
	transactions []WalletTransaction
	disputes     []WalletDispute
}

func (m *mockWalletRepository) GetOrCreateWallet(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	if m.wallet == nil {
		m.wallet = &Wallet{
			ID:              primitive.NewObjectID(),
			UserID:          userID,
			MainBalance:     200,
			EarningsBalance: 800,
			LockedBalance:   0,
			BonusBalance:    0,
			Currency:        "INR",
			Status:          "active",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
	}
	return m.wallet, nil
}

func (m *mockWalletRepository) GetWalletByUserID(ctx context.Context, userID primitive.ObjectID) (*Wallet, error) {
	return m.GetOrCreateWallet(ctx, userID)
}

func (m *mockWalletRepository) UpdateBalances(ctx context.Context, userID primitive.ObjectID, mainDelta, earningsDelta, lockedDelta, bonusDelta float64) (*Wallet, error) {
	if m.wallet == nil {
		_, _ = m.GetOrCreateWallet(ctx, userID)
	}
	m.wallet.MainBalance += mainDelta
	m.wallet.EarningsBalance += earningsDelta
	m.wallet.LockedBalance += lockedDelta
	m.wallet.BonusBalance += bonusDelta
	return m.wallet, nil
}

func (m *mockWalletRepository) CreateTransaction(ctx context.Context, tx *WalletTransaction) error {
	m.transactions = append(m.transactions, *tx)
	return nil
}

func (m *mockWalletRepository) GetTransactionsByWalletID(ctx context.Context, walletID primitive.ObjectID, query TransactionQuery) ([]WalletTransaction, int64, error) {
	return m.transactions, int64(len(m.transactions)), nil
}

func (m *mockWalletRepository) RecordAtomicTransaction(ctx context.Context, input RecordTransactionInput) (*WalletTransaction, *Wallet, error) {
	if m.wallet == nil {
		_, _ = m.GetOrCreateWallet(ctx, input.UserID)
	}

	delta := input.Amount
	if input.Type == TypeDebit {
		delta = -input.Amount
	}

	switch input.TargetBalance {
	case BalanceEarnings:
		if input.Type == TypeDebit && m.wallet.EarningsBalance < input.Amount {
			return nil, nil, errors.New("insufficient earnings balance")
		}
		m.wallet.EarningsBalance += delta
	case BalanceMain:
		if input.Type == TypeDebit && m.wallet.MainBalance < input.Amount {
			return nil, nil, errors.New("insufficient main balance")
		}
		m.wallet.MainBalance += delta
	case BalanceLocked:
		m.wallet.LockedBalance += delta
	case BalanceBonus:
		m.wallet.BonusBalance += delta
	}

	tx := &WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      m.wallet.ID,
		UserID:        input.UserID,
		Type:          input.Type,
		TargetBalance: input.TargetBalance,
		Category:      input.Category,
		Amount:        input.Amount,
		BalanceAfter:  m.wallet.EarningsBalance,
		ReferenceID:   input.ReferenceID,
		Description:   input.Description,
		Metadata:      input.Metadata,
		CreatedAt:     time.Now(),
	}
	m.transactions = append(m.transactions, *tx)
	return tx, m.wallet, nil
}

func (m *mockWalletRepository) GetUserContact(ctx context.Context, userID primitive.ObjectID) (string, string, error) {
	return "expert@example.com", "John Doe", nil
}

func (m *mockWalletRepository) GetTransactionByID(ctx context.Context, txID primitive.ObjectID) (*WalletTransaction, error) {
	for _, tx := range m.transactions {
		if tx.ID == txID {
			return &tx, nil
		}
	}
	return nil, errors.New("transaction not found")
}

func (m *mockWalletRepository) CreateDispute(ctx context.Context, dispute *WalletDispute) (*WalletDispute, error) {
	if dispute.ID.IsZero() {
		dispute.ID = primitive.NewObjectID()
	}
	dispute.CreatedAt = time.Now()
	dispute.UpdatedAt = time.Now()
	m.disputes = append(m.disputes, *dispute)
	return dispute, nil
}

func (m *mockWalletRepository) GetDisputeByID(ctx context.Context, id primitive.ObjectID) (*WalletDispute, error) {
	for _, d := range m.disputes {
		if d.ID == id {
			return &d, nil
		}
	}
	return nil, errors.New("dispute not found")
}

func (m *mockWalletRepository) GetDisputeByTransactionID(ctx context.Context, txID primitive.ObjectID) (*WalletDispute, error) {
	for _, d := range m.disputes {
		if d.TransactionID == txID {
			return &d, nil
		}
	}
	return nil, nil
}

func (m *mockWalletRepository) GetDisputes(ctx context.Context, query DisputeQuery) ([]WalletDispute, int64, error) {
	var filtered []WalletDispute
	for _, d := range m.disputes {
		if query.Status != "" && d.Status != query.Status {
			continue
		}
		if query.UserID != "" && d.UserID.Hex() != query.UserID {
			continue
		}
		filtered = append(filtered, d)
	}
	return filtered, int64(len(filtered)), nil
}

func (m *mockWalletRepository) UpdateDispute(ctx context.Context, dispute *WalletDispute) error {
	for i, d := range m.disputes {
		if d.ID == dispute.ID {
			m.disputes[i] = *dispute
			return nil
		}
	}
	return errors.New("dispute not found")
}

func TestRequestWithdrawal_Validations(t *testing.T) {
	cfg := &config.Config{
		Port: "8000",
	}
	mockRepo := &mockWalletRepository{}
	svc := NewWalletService(mockRepo, cfg, notification.NewMailer(cfg))
	ctx := context.Background()
	testUserID := primitive.NewObjectID().Hex()

	// 1. Missing user ID
	_, err := svc.RequestWithdrawal(ctx, "", WithdrawalRequest{Amount: 100})
	if err == nil || err.Error() != "unauthorized: missing user id" {
		t.Fatalf("expected missing user id error, got %v", err)
	}

	// 2. Minimum amount < ₹50
	_, err = svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:       20,
		PayoutMethod: "bank",
	})
	if err == nil || err.Error() != "minimum withdrawal amount is ₹50" {
		t.Fatalf("expected minimum amount error, got %v", err)
	}

	// 3. Maximum amount > ₹500,000
	_, err = svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:       600000,
		PayoutMethod: "bank",
	})
	if err == nil || err.Error() != "maximum single withdrawal amount is ₹5,00,000" {
		t.Fatalf("expected maximum amount ceiling error, got %v", err)
	}

	// 4. Invalid payout method
	_, err = svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:       100,
		PayoutMethod: "crypto",
	})
	if err == nil || err.Error() != "payout method must be 'bank' or 'upi'" {
		t.Fatalf("expected invalid payout method error, got %v", err)
	}

	// 5. Incomplete bank details
	_, err = svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:        100,
		PayoutMethod:  "bank",
		AccountNumber: "",
		IFSCCode:      "",
	})
	if err == nil || err.Error() != "account number and IFSC code are required for bank transfer" {
		t.Fatalf("expected incomplete bank details error, got %v", err)
	}

	// 6. Incomplete UPI details
	_, err = svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:       100,
		PayoutMethod: "upi",
		UPIID:        "",
	})
	if err == nil || err.Error() != "valid UPI ID is required for UPI payout" {
		t.Fatalf("expected missing upi id error, got %v", err)
	}

	// 7. Insufficient earnings balance
	_, err = svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:        2000, // Available is 800
		PayoutMethod:  "bank",
		AccountHolder: "Test User",
		AccountNumber: "1234567890",
		IFSCCode:      "HDFC0001234",
		PhoneNumber:   "9876543210",
	})
	if err == nil {
		t.Fatalf("expected insufficient balance error, got nil")
	}
}

func TestRequestWithdrawal_BankSuccess(t *testing.T) {
	cfg := &config.Config{
		Port: "8000",
	}
	mockRepo := &mockWalletRepository{}
	svc := NewWalletService(mockRepo, cfg, notification.NewMailer(cfg))
	ctx := context.Background()
	testUserID := primitive.NewObjectID().Hex()

	res, err := svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:        300,
		PayoutMethod:  "bank",
		AccountHolder: "John Doe",
		AccountNumber: "50100123456789",
		IFSCCode:      "HDFC0001234",
		BankName:      "HDFC Bank",
		PhoneNumber:   "9876543210",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res == nil || res.Transaction == nil || res.Wallet == nil {
		t.Fatalf("expected populated response, got %v", res)
	}

	// Check earnings balance debited: 800 - 300 = 500
	if res.Wallet.EarningsBalance != 500 {
		t.Errorf("expected earnings_balance 500, got %f", res.Wallet.EarningsBalance)
	}
	if res.Wallet.WithdrawableBalance != 500 {
		t.Errorf("expected withdrawable_balance 500, got %f", res.Wallet.WithdrawableBalance)
	}

	// Check transaction details
	if res.Transaction.Type != "debit" {
		t.Errorf("expected type debit, got %s", res.Transaction.Type)
	}
	if res.Transaction.Category != "withdrawal" {
		t.Errorf("expected category withdrawal, got %s", res.Transaction.Category)
	}
	if res.Transaction.TargetBalance != "earnings" {
		t.Errorf("expected target_balance earnings, got %s", res.Transaction.TargetBalance)
	}
	if res.Transaction.Amount != 300 {
		t.Errorf("expected amount 300, got %f", res.Transaction.Amount)
	}
}

func TestRequestWithdrawal_UPISuccess(t *testing.T) {
	cfg := &config.Config{
		Port: "8000",
	}
	mockRepo := &mockWalletRepository{}
	svc := NewWalletService(mockRepo, cfg, notification.NewMailer(cfg))
	ctx := context.Background()
	testUserID := primitive.NewObjectID().Hex()

	res, err := svc.RequestWithdrawal(ctx, testUserID, WithdrawalRequest{
		Amount:       250,
		PayoutMethod: "upi",
		UPIID:        "expert@okhdfcbank",
		PhoneNumber:  "9876543210",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Initial 800 - 250 = 550
	if res.Wallet.EarningsBalance != 550 {
		t.Errorf("expected earnings_balance 550, got %f", res.Wallet.EarningsBalance)
	}
	if res.Transaction.Category != "withdrawal" {
		t.Errorf("expected category withdrawal, got %s", res.Transaction.Category)
	}
}
