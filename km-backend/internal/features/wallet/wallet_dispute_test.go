package wallet

import (
	"context"
	"testing"
	"time"

	"km-backend/internal/config"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func setupDisputeTestEnv() (*mockWalletRepository, WalletService, string, primitive.ObjectID) {
	mockRepo := &mockWalletRepository{}
	cfg := &config.Config{Port: "8000"}
	svc := NewWalletService(mockRepo, cfg)

	userOID := primitive.NewObjectID()
	userID := userOID.Hex()

	w := &Wallet{
		ID:              primitive.NewObjectID(),
		UserID:          userOID,
		MainBalance:     1000.0,
		EarningsBalance: 0,
		LockedBalance:   0,
		BonusBalance:    0,
		Currency:        "INR",
		Status:          "active",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	mockRepo.wallet = w

	return mockRepo, svc, userID, w.ID
}

func TestDispute_CreateDispute_Success(t *testing.T) {
	mockRepo, svc, userID, walletID := setupDisputeTestEnv()
	ctx := context.Background()

	// Add a valid debit transaction (e.g. paid event ticket or mentorship)
	debitTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      walletID,
		UserID:        mockRepo.wallet.UserID,
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategoryEventTicket,
		Amount:        499.0,
		ReferenceID:   "TKT-EVT-123456",
		Description:   "Event Ticket Booking",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, debitTx)

	// User files dispute
	req := CreateDisputeRequest{
		TransactionID: debitTx.ID.Hex(),
		Reason:        DisputeReasonSessionCancelled,
		Description:   "The speaker did not show up and session was cancelled.",
	}

	dispute, err := svc.CreateDispute(ctx, userID, req)
	if err != nil {
		t.Fatalf("expected successful dispute creation, got: %v", err)
	}

	if dispute.Status != DisputeStatusPending {
		t.Errorf("expected status 'pending', got: %s", dispute.Status)
	}
	if dispute.Amount != 499.0 {
		t.Errorf("expected amount 499.0, got: %.2f", dispute.Amount)
	}
	if dispute.Reason != DisputeReasonSessionCancelled {
		t.Errorf("expected reason session_cancelled, got: %s", dispute.Reason)
	}
}

func TestDispute_CreditTransaction_Rejection(t *testing.T) {
	mockRepo, svc, userID, walletID := setupDisputeTestEnv()
	ctx := context.Background()

	// Add a credit transaction (recharge)
	creditTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      walletID,
		UserID:        mockRepo.wallet.UserID,
		Type:          TypeCredit,
		TargetBalance: BalanceMain,
		Category:      CategoryTopup,
		Amount:        500.0,
		ReferenceID:   "pay_topup_123",
		Description:   "Wallet Recharge",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, creditTx)

	// Attempt dispute on credit
	req := CreateDisputeRequest{
		TransactionID: creditTx.ID.Hex(),
		Reason:        DisputeReasonDuplicateCharge,
		Description:   "I want to dispute this recharge",
	}

	_, err := svc.CreateDispute(ctx, userID, req)
	if err == nil {
		t.Fatalf("expected error disputing credit transaction, got nil")
	}
}

func TestDispute_DuplicateDispute_Rejection(t *testing.T) {
	mockRepo, svc, userID, walletID := setupDisputeTestEnv()
	ctx := context.Background()

	debitTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      walletID,
		UserID:        mockRepo.wallet.UserID,
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategorySessionBooking,
		Amount:        999.0,
		ReferenceID:   "BOOK-987",
		Description:   "Mentorship Session",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, debitTx)

	req := CreateDisputeRequest{
		TransactionID: debitTx.ID.Hex(),
		Reason:        DisputeReasonServiceNotProvided,
		Description:   "Expert was not reachable.",
	}

	// 1st submission -> succeeds
	_, err := svc.CreateDispute(ctx, userID, req)
	if err != nil {
		t.Fatalf("expected 1st dispute to succeed, got: %v", err)
	}

	// 2nd submission -> rejected
	_, errDuplicate := svc.CreateDispute(ctx, userID, req)
	if errDuplicate == nil {
		t.Fatalf("expected duplicate dispute error, got nil")
	}
}

func TestDispute_Unauthorized_Rejection(t *testing.T) {
	mockRepo, svc, userID, _ := setupDisputeTestEnv()
	ctx := context.Background()

	// Transaction belongs to ANOTHER wallet
	otherWalletID := primitive.NewObjectID()
	otherTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      otherWalletID,
		UserID:        primitive.NewObjectID(),
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategoryPassPurchase,
		Amount:        99.0,
		ReferenceID:   "PASS-123",
		Description:   "Platform Pass",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, otherTx)

	req := CreateDisputeRequest{
		TransactionID: otherTx.ID.Hex(),
		Reason:        DisputeReasonOther,
		Description:   "Not my charge",
	}

	_, err := svc.CreateDispute(ctx, userID, req)
	if err == nil {
		t.Fatalf("expected unauthorized error, got nil")
	}
}

func TestDispute_AdminResolve_Approve_Refund(t *testing.T) {
	mockRepo, svc, userID, walletID := setupDisputeTestEnv()
	ctx := context.Background()

	// Initial balance: 1000
	mockRepo.wallet.MainBalance = 500.0 // User had spent 500

	debitTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      walletID,
		UserID:        mockRepo.wallet.UserID,
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategoryEventTicket,
		Amount:        499.0,
		ReferenceID:   "TKT-REFUND-ME",
		Description:   "Event Ticket Booking",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, debitTx)

	dispute, err := svc.CreateDispute(ctx, userID, CreateDisputeRequest{
		TransactionID: debitTx.ID.Hex(),
		Reason:        DisputeReasonTechnicalFailure,
		Description:   "Stream crashed midway through the session.",
	})
	if err != nil {
		t.Fatalf("dispute creation failed: %v", err)
	}

	// Admin approves dispute with full refund
	resolvedDispute, updatedWallet, err := svc.ResolveDispute(ctx, dispute.ID.Hex(), "admin_123", ResolveDisputeRequest{
		Action:     "approve",
		AdminNotes: "Verified technical interruption. Full refund issued.",
	})
	if err != nil {
		t.Fatalf("expected successful dispute resolution, got: %v", err)
	}

	// Assertions
	if resolvedDispute.Status != DisputeStatusApproved {
		t.Errorf("expected status 'approved', got: %s", resolvedDispute.Status)
	}
	if resolvedDispute.ResolvedBy != "admin_123" {
		t.Errorf("expected resolved_by 'admin_123', got: %s", resolvedDispute.ResolvedBy)
	}
	if resolvedDispute.RefundTransactionID == nil {
		t.Errorf("expected refund transaction id to be set, got nil")
	}

	// Verify wallet was credited 499 (500 + 499 = 999)
	if updatedWallet.MainBalance != 999.0 {
		t.Errorf("expected updated wallet main balance 999.0, got: %.2f", updatedWallet.MainBalance)
	}

	// Verify refund transaction in ledger
	var refundTxFound bool
	for _, tx := range mockRepo.transactions {
		if tx.Category == CategoryRefund && tx.Type == TypeCredit && tx.Amount == 499.0 {
			refundTxFound = true
			break
		}
	}
	if !refundTxFound {
		t.Errorf("expected refund credit transaction in ledger, none found")
	}
}

func TestDispute_AdminResolve_Reject(t *testing.T) {
	mockRepo, svc, userID, walletID := setupDisputeTestEnv()
	ctx := context.Background()

	debitTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      walletID,
		UserID:        mockRepo.wallet.UserID,
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategoryEventTicket,
		Amount:        299.0,
		ReferenceID:   "TKT-REJECT",
		Description:   "Event Ticket",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, debitTx)

	dispute, _ := svc.CreateDispute(ctx, userID, CreateDisputeRequest{
		TransactionID: debitTx.ID.Hex(),
		Reason:        DisputeReasonDissatisfied,
		Description:   "I changed my mind after the event started.",
	})

	initialBalance := mockRepo.wallet.MainBalance

	// Admin rejects dispute
	resolvedDispute, updatedWallet, err := svc.ResolveDispute(ctx, dispute.ID.Hex(), "admin_123", ResolveDisputeRequest{
		Action:     "reject",
		AdminNotes: "Refund not eligible per policy after attendance.",
	})
	if err != nil {
		t.Fatalf("expected resolution to succeed, got: %v", err)
	}

	if resolvedDispute.Status != DisputeStatusRejected {
		t.Errorf("expected status 'rejected', got: %s", resolvedDispute.Status)
	}
	if updatedWallet.MainBalance != initialBalance {
		t.Errorf("expected balance to remain %.2f, got: %.2f", initialBalance, updatedWallet.MainBalance)
	}
}

func TestDispute_AlreadyResolved_Rejection(t *testing.T) {
	mockRepo, svc, userID, walletID := setupDisputeTestEnv()
	ctx := context.Background()

	debitTx := WalletTransaction{
		ID:            primitive.NewObjectID(),
		WalletID:      walletID,
		UserID:        mockRepo.wallet.UserID,
		Type:          TypeDebit,
		TargetBalance: BalanceMain,
		Category:      CategoryEventTicket,
		Amount:        100.0,
		ReferenceID:   "TKT-ONCE",
		Description:   "Ticket",
		CreatedAt:     time.Now(),
	}
	mockRepo.transactions = append(mockRepo.transactions, debitTx)

	dispute, _ := svc.CreateDispute(ctx, userID, CreateDisputeRequest{
		TransactionID: debitTx.ID.Hex(),
		Reason:        DisputeReasonOther,
		Description:   "Testing",
	})

	// 1st resolution
	_, _, err := svc.ResolveDispute(ctx, dispute.ID.Hex(), "admin_123", ResolveDisputeRequest{Action: "reject"})
	if err != nil {
		t.Fatalf("1st resolution failed: %v", err)
	}

	// 2nd resolution -> should fail
	_, _, errSecond := svc.ResolveDispute(ctx, dispute.ID.Hex(), "admin_123", ResolveDisputeRequest{Action: "approve"})
	if errSecond == nil {
		t.Fatalf("expected error re-resolving an already resolved dispute, got nil")
	}
}
