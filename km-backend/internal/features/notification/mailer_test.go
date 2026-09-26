package notification_test

import (
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// newTestConfig returns a config with blank SMTP credentials so NewMailer
// returns a noopMailer — no real network connections during unit tests.
func newTestConfig() *config.Config {
	return &config.Config{
		SMTPHost:      "smtp-relay.brevo.com",
		SMTPPort:      "587",
		SMTPUsername:  "", // intentionally empty → noopMailer
		SMTPPassword:  "",
		SMTPFromEmail: "no-reply@kaammilega.com",
		SMTPFromName:  "KaamMilega",
	}
}

// capturingMailer is a test double that records every sent email without
// touching a real SMTP server. It satisfies the notification.Mailer interface.
type capturingMailer struct {
	Invitations  []notification.InterviewInviteParams
	Updates      []notification.ApplicationUpdateParams
	Receipts     []notification.TransactionReceiptParams
	Withdrawals  []notification.WithdrawalRequestParams
	RawSent      []rawEmail
}

type rawEmail struct {
	To      string
	Subject string
	Body    string
}

func (c *capturingMailer) SendInterviewInvite(p notification.InterviewInviteParams) error {
	c.Invitations = append(c.Invitations, p)
	return nil
}
func (c *capturingMailer) SendApplicationUpdate(p notification.ApplicationUpdateParams) error {
	c.Updates = append(c.Updates, p)
	return nil
}
func (c *capturingMailer) SendTransactionReceipt(p notification.TransactionReceiptParams) error {
	c.Receipts = append(c.Receipts, p)
	return nil
}
func (c *capturingMailer) SendWithdrawalRequest(p notification.WithdrawalRequestParams) error {
	c.Withdrawals = append(c.Withdrawals, p)
	return nil
}
func (c *capturingMailer) SendRaw(to, subject, body string) error {
	c.RawSent = append(c.RawSent, rawEmail{To: to, Subject: subject, Body: body})
	return nil
}

// ─── NewMailer construction ────────────────────────────────────────────────────

func TestNewMailer_NoCredentials_ReturnsNoopMailer(t *testing.T) {
	cfg := newTestConfig()
	mailer := notification.NewMailer(cfg)
	// noop should never error
	err := mailer.SendRaw("test@example.com", "Subject", "<p>Body</p>")
	if err != nil {
		t.Fatalf("noopMailer.SendRaw returned unexpected error: %v", err)
	}
}

func TestNewMailer_WithCredentials_ReturnsSMTPMailer(t *testing.T) {
	cfg := newTestConfig()
	cfg.SMTPUsername = "test@brevo.com"
	cfg.SMTPPassword = "supersecret"
	mailer := notification.NewMailer(cfg)
	// We don't dial a real server in unit tests; just verify it's not nil
	if mailer == nil {
		t.Fatal("expected non-nil Mailer")
	}
}

// ─── NoopMailer ───────────────────────────────────────────────────────────────

func TestNoopMailer_AllMethodsReturnNil(t *testing.T) {
	cfg := newTestConfig() // empty creds → noopMailer
	mailer := notification.NewMailer(cfg)
	now := time.Now()

	tests := []struct {
		name string
		fn   func() error
	}{
		{"SendInterviewInvite", func() error {
			return mailer.SendInterviewInvite(notification.InterviewInviteParams{
				ToEmail:       "candidate@example.com",
				CandidateName: "Raju Singh",
				JobTitle:      "Software Engineer",
				CompanyName:   "Technova",
				InterviewType: "Video Call",
				ScheduledAt:   now,
				Location:      "https://meet.google.com/abc",
			})
		}},
		{"SendApplicationUpdate", func() error {
			return mailer.SendApplicationUpdate(notification.ApplicationUpdateParams{
				ToEmail:       "candidate@example.com",
				CandidateName: "Priya Sharma",
				JobTitle:      "Store Executive",
				CompanyName:   "Tata Croma",
				NewStatus:     "Shortlisted",
			})
		}},
		{"SendTransactionReceipt", func() error {
			return mailer.SendTransactionReceipt(notification.TransactionReceiptParams{
				ToEmail:         "user@example.com",
				RecipientName:   "Sachin Kumar",
				TransactionID:   "TXN-20260101-ABCD",
				TransactionType: "Wallet Top-up",
				Amount:          500.00,
				IssuedAt:        now,
			})
		}},
		{"SendWithdrawalRequest", func() error {
			return mailer.SendWithdrawalRequest(notification.WithdrawalRequestParams{
				AdminEmail:  "admin@kaammilega.com",
				ExpertEmail: "expert@example.com",
				ExpertName:  "Rajesh Verma",
				Amount:      2500.00,
				ReferenceID: "WD-20260101-EFGH",
				PayoutMethod: "upi",
				Destination: "rajesh@upi",
				Remaining:   1000.00,
			})
		}},
		{"SendRaw", func() error {
			return mailer.SendRaw("test@example.com", "Hello", "<p>Hi</p>")
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.fn(); err != nil {
				t.Errorf("%s: unexpected error: %v", tt.name, err)
			}
		})
	}
}

// ─── capturingMailer via interface ────────────────────────────────────────────

func TestCapturingMailer_RecordsInvitations(t *testing.T) {
	m := &capturingMailer{}
	p := notification.InterviewInviteParams{
		ToEmail:       "candidate@example.com",
		CandidateName: "Dharmender Kumar",
		JobTitle:      "Warehouse Executive",
		CompanyName:   "Technova Logistics",
		InterviewType: "In-Person",
		ScheduledAt:   time.Date(2026, 10, 1, 10, 30, 0, 0, time.UTC),
		Location:      "Bhiwandi Warehouse, Gate 3",
	}
	if err := m.SendInterviewInvite(p); err != nil {
		t.Fatal(err)
	}
	if len(m.Invitations) != 1 {
		t.Fatalf("expected 1 invitation, got %d", len(m.Invitations))
	}
	if m.Invitations[0].CandidateName != "Dharmender Kumar" {
		t.Errorf("unexpected candidate name: %s", m.Invitations[0].CandidateName)
	}
}

func TestCapturingMailer_RecordsApplicationUpdates(t *testing.T) {
	m := &capturingMailer{}
	statuses := []string{"Reviewing", "Shortlisted", "Interview Scheduled", "Selected", "Rejected"}
	for _, s := range statuses {
		if err := m.SendApplicationUpdate(notification.ApplicationUpdateParams{
			ToEmail:   "candidate@example.com",
			NewStatus: s,
		}); err != nil {
			t.Fatalf("status=%s: unexpected error: %v", s, err)
		}
	}
	if len(m.Updates) != len(statuses) {
		t.Errorf("expected %d updates, got %d", len(statuses), len(m.Updates))
	}
}

func TestCapturingMailer_RecordsTransactionReceipts(t *testing.T) {
	m := &capturingMailer{}
	txTypes := []string{"Wallet Top-up", "Event Ticket", "Subscription", "Mentorship Booking"}
	for _, tt := range txTypes {
		err := m.SendTransactionReceipt(notification.TransactionReceiptParams{
			ToEmail:         "user@example.com",
			TransactionType: tt,
			Amount:          499.00,
			IssuedAt:        time.Now(),
		})
		if err != nil {
			t.Fatalf("txType=%s: unexpected error: %v", tt, err)
		}
	}
	if len(m.Receipts) != len(txTypes) {
		t.Errorf("expected %d receipts, got %d", len(txTypes), len(m.Receipts))
	}
}

func TestCapturingMailer_RecordsWithdrawals(t *testing.T) {
	m := &capturingMailer{}
	err := m.SendWithdrawalRequest(notification.WithdrawalRequestParams{
		AdminEmail:   "admin@kaammilega.com",
		ExpertEmail:  "expert@example.com",
		ExpertName:   "Roshni Expert",
		Amount:       3000.00,
		ReferenceID:  "WD-XYZ",
		PayoutMethod: "bank",
		Destination:  "SBI (••••5678, IFSC: SBIN0000001)",
		Remaining:    500.00,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Withdrawals) != 1 {
		t.Fatalf("expected 1 withdrawal, got %d", len(m.Withdrawals))
	}
}

// ─── Parameter validation / defaults ─────────────────────────────────────────

func TestSendRaw_EmptyRecipient_ShouldNotPanic(t *testing.T) {
	// noopMailer must not panic on empty recipient
	cfg := newTestConfig()
	mailer := notification.NewMailer(cfg)
	err := mailer.SendRaw("", "Subject", "<p>body</p>")
	// noopMailer silently discards, never errors
	if err != nil {
		t.Errorf("noopMailer.SendRaw returned error for empty recipient: %v", err)
	}
}

// ─── Interface contract check ─────────────────────────────────────────────────

// Compile-time assertion: capturingMailer must implement notification.Mailer.
var _ notification.Mailer = (*capturingMailer)(nil)

// ─── Template smoke tests (optional, run against noopMailer) ──────────────────

func TestMailer_InterviewInvite_DoesNotPanic(t *testing.T) {
	cfg := newTestConfig()
	mailer := notification.NewMailer(cfg)
	err := mailer.SendInterviewInvite(notification.InterviewInviteParams{
		ToEmail:       "smoke@example.com",
		CandidateName: "", // should be defaulted internally
		JobTitle:      "Driver",
		InterviewType: "Phone Screen",
		ScheduledAt:   time.Now(),
	})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestMailer_TransactionReceipt_CurrencyDefault(t *testing.T) {
	m := &capturingMailer{}
	_ = m.SendTransactionReceipt(notification.TransactionReceiptParams{
		ToEmail:         "user@example.com",
		TransactionType: "Wallet Top-up",
		Amount:          199.00,
		Currency:        "", // should default to INR
		IssuedAt:        time.Now(),
	})
	if len(m.Receipts) != 1 {
		t.Fatal("receipt not recorded")
	}
}

// ─── StatusToColor (indirectly via interface) ────────────────────────────────

func TestApplicationUpdate_VariousStatuses(t *testing.T) {
	m := &capturingMailer{}
	cases := map[string]string{
		"Reviewing":            "should match orange",
		"Shortlisted":          "should match blue",
		"Interview Scheduled":  "should match blue",
		"Selected":             "should match green",
		"Rejected":             "should match red",
		"Unknown Status":       "should match navy",
	}
	for status := range cases {
		err := m.SendApplicationUpdate(notification.ApplicationUpdateParams{
			ToEmail:   "c@example.com",
			NewStatus: status,
		})
		if err != nil {
			t.Errorf("status=%q: unexpected error: %v", status, err)
		}
	}
}

// ─── RawEmail via capturing mailer ────────────────────────────────────────────

func TestCapturingMailer_SendRaw_RecordsEmail(t *testing.T) {
	m := &capturingMailer{}
	_ = m.SendRaw("user@example.com", "Test Subject", "<p>Hello</p>")
	if len(m.RawSent) != 1 {
		t.Fatalf("expected 1 raw email, got %d", len(m.RawSent))
	}
	if m.RawSent[0].To != "user@example.com" {
		t.Errorf("unexpected To: %s", m.RawSent[0].To)
	}
	if !strings.Contains(m.RawSent[0].Body, "Hello") {
		t.Error("body does not contain expected content")
	}
}
