// Package notification provides the centralized transactional email service for KaamMilega.
// It is the single source of truth for all outbound email communication:
//   - Interview scheduling invites
//   - Application status updates (Reviewing → Shortlisted → Selected → Rejected)
//   - Transactional receipts (wallet top-up, event ticket, subscription)
//
// Architecture follows the Dependency Inversion Principle:
// callers depend on the Mailer interface, not the concrete SMTP implementation.
// This allows unit-testing all email-triggering services without a real SMTP server.
package notification

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"km-backend/internal/config"
)

// ─── Public Interface ─────────────────────────────────────────────────────────

// Mailer is the single interface for sending transactional emails.
// Consumers depend only on this interface, never on a concrete implementation.
type Mailer interface {
	// SendInterviewInvite notifies a candidate that an interview has been scheduled.
	SendInterviewInvite(p InterviewInviteParams) error

	// SendApplicationUpdate notifies a candidate that their application status has changed.
	SendApplicationUpdate(p ApplicationUpdateParams) error

	// SendTransactionReceipt sends a detailed receipt after a financial transaction.
	SendTransactionReceipt(p TransactionReceiptParams) error

	// SendWithdrawalRequest notifies admin + expert of a payout request.
	SendWithdrawalRequest(p WithdrawalRequestParams) error

	// SendEmailOTP dispatches a verification or password reset OTP email.
	SendEmailOTP(p EmailOTPParams) error

	// SendRaw dispatches an arbitrary HTML email. Use only when no typed method fits.
	SendRaw(to, subject, htmlBody string) error
}

// ─── Parameter Types ──────────────────────────────────────────────────────────

// InterviewInviteParams carries all data needed to compose an interview invite email.
type InterviewInviteParams struct {
	ToEmail       string
	CandidateName string
	JobTitle      string
	CompanyName   string
	InterviewType string    // e.g. "Video Call", "In-Person", "Phone Screen"
	ScheduledAt   time.Time
	Location      string // Meeting link or physical address
	Notes         string
}

// ApplicationUpdateParams carries data for an application status change notification.
type ApplicationUpdateParams struct {
	ToEmail       string
	CandidateName string
	JobTitle      string
	CompanyName   string
	NewStatus     string // "Reviewing" | "Shortlisted" | "Interview Scheduled" | "Selected" | "Rejected"
	RecruiterName string
	ActionURL     string // Deep-link into the platform
}

// TransactionReceiptParams carries data for a payment confirmation receipt.
type TransactionReceiptParams struct {
	ToEmail         string
	RecipientName   string
	TransactionID   string
	TransactionType string // "Wallet Top-up" | "Event Ticket" | "Subscription" | "Mentorship Booking"
	Amount          float64
	Currency        string // Default "INR"
	Description     string
	IssuedAt        time.Time
}

// WithdrawalRequestParams carries data for expert payout request emails.
type WithdrawalRequestParams struct {
	AdminEmail    string
	ExpertEmail   string
	ExpertName    string
	Amount        float64
	ReferenceID   string
	PayoutMethod  string // "upi" | "bank"
	Destination   string // masked account or UPI ID
	Remaining     float64
	PhoneNumber   string
}

// EmailOTPParams carries data for authentication & verification OTP emails.
type EmailOTPParams struct {
	ToEmail  string
	Code     string
	Purpose  string // "verification" | "password_reset"
	UserName string // optional
}

// ─── SMTP Implementation ──────────────────────────────────────────────────────

// smtpMailer is the production implementation that sends via Brevo SMTP relay.
type smtpMailer struct {
	cfg       *config.Config
	templates *templateRegistry
}

// NewMailer constructs the production SMTP-backed Mailer.
// When SMTP credentials are absent (e.g. local dev without .env), it falls back
// to noopMailer so callers are never broken by a missing config.
func NewMailer(cfg *config.Config) Mailer {
	if cfg.SMTPUsername == "" || cfg.SMTPPassword == "" {
		return &noopMailer{}
	}
	templates := mustParseTemplates()
	return &smtpMailer{cfg: cfg, templates: templates}
}

func (m *smtpMailer) SendInterviewInvite(p InterviewInviteParams) error {
	if p.CandidateName == "" {
		p.CandidateName = "Candidate"
	}
	if p.Location == "" {
		p.Location = "To be communicated"
	}
	subject := fmt.Sprintf("Interview Scheduled — %s at %s", p.JobTitle, p.CompanyName)
	body, err := renderTemplate(m.templates, "interview_invite", templateData{
		RecipientName: p.CandidateName,
		JobTitle:      p.JobTitle,
		CompanyName:   p.CompanyName,
		Status:        "Interview Scheduled",
		StatusColor:   "#0B5ED7",
		Rows: []tableRow{
			{Label: "📅 Date & Time", Value: p.ScheduledAt.Format("Monday, 02 Jan 2006 · 03:04 PM")},
			{Label: "🎯 Format", Value: p.InterviewType},
			{Label: "📍 Location / Link", Value: p.Location},
		},
		Note:   p.Notes,
		CTAURL: "https://kaammilega.com/applications",
		CTALabel: "View My Applications",
	})
	if err != nil {
		return fmt.Errorf("notification: render interview invite: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}

func (m *smtpMailer) SendApplicationUpdate(p ApplicationUpdateParams) error {
	if p.CandidateName == "" {
		p.CandidateName = "Candidate"
	}
	statusColor := statusToColor(p.NewStatus)
	subject := fmt.Sprintf("Application Update — %s at %s", p.JobTitle, p.CompanyName)
	if p.ActionURL == "" {
		p.ActionURL = "https://kaammilega.com/applications"
	}
	body, err := renderTemplate(m.templates, "application_update", templateData{
		RecipientName: p.CandidateName,
		JobTitle:      p.JobTitle,
		CompanyName:   p.CompanyName,
		Status:        p.NewStatus,
		StatusColor:   statusColor,
		CTAURL:        p.ActionURL,
		CTALabel:      "View Application",
	})
	if err != nil {
		return fmt.Errorf("notification: render application update: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}

func (m *smtpMailer) SendTransactionReceipt(p TransactionReceiptParams) error {
	if p.RecipientName == "" {
		p.RecipientName = "Member"
	}
	if p.Currency == "" {
		p.Currency = "INR"
	}
	subject := fmt.Sprintf("[KaamMilega] Receipt — %s ₹%.2f", p.TransactionType, p.Amount)
	body, err := renderTemplate(m.templates, "transaction_receipt", templateData{
		RecipientName: p.RecipientName,
		Status:        "Payment Confirmed",
		StatusColor:   "#16A34A",
		Rows: []tableRow{
			{Label: "Transaction ID", Value: p.TransactionID, Mono: true},
			{Label: "Type", Value: p.TransactionType},
			{Label: "Amount", Value: fmt.Sprintf("%s %.2f", currencySymbol(p.Currency), p.Amount), Bold: true},
			{Label: "Description", Value: p.Description},
			{Label: "Date", Value: p.IssuedAt.Format("02 Jan 2006, 03:04 PM MST")},
		},
		CTAURL:   "https://kaammilega.com/wallet",
		CTALabel: "View Wallet",
	})
	if err != nil {
		return fmt.Errorf("notification: render transaction receipt: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}

func (m *smtpMailer) SendWithdrawalRequest(p WithdrawalRequestParams) error {
	// Admin alert
	if p.AdminEmail != "" {
		adminSubject := fmt.Sprintf("[KaamMilega Payout Alert] ₹%.2f — Ref: %s", p.Amount, p.ReferenceID)
		adminBody, err := renderTemplate(m.templates, "withdrawal_admin", templateData{
			RecipientName: "Admin",
			Status:        "New Payout Request",
			StatusColor:   "#FF6B00",
			Rows: []tableRow{
				{Label: "Reference ID", Value: p.ReferenceID, Mono: true},
				{Label: "Expert", Value: p.ExpertName},
				{Label: "Amount", Value: fmt.Sprintf("₹%.2f", p.Amount), Bold: true},
				{Label: "Method", Value: strings.ToUpper(p.PayoutMethod)},
				{Label: "Destination", Value: p.Destination},
				{Label: "Phone", Value: p.PhoneNumber},
				{Label: "Remaining Balance", Value: fmt.Sprintf("₹%.2f", p.Remaining)},
			},
			CTAURL:   "https://kaammilega.com/admin/payouts",
			CTALabel: "Review Payout",
		})
		if err == nil {
			_ = m.SendRaw(p.AdminEmail, adminSubject, adminBody)
		}
	}

	// Expert confirmation
	if p.ExpertEmail != "" {
		expertName := p.ExpertName
		if expertName == "" {
			expertName = "Valued Expert"
		}
		expertSubject := fmt.Sprintf("[KaamMilega] Withdrawal Request Received — ₹%.2f (%s)", p.Amount, p.ReferenceID)
		expertBody, err := renderTemplate(m.templates, "transaction_receipt", templateData{
			RecipientName: expertName,
			Status:        "Withdrawal Request Received",
			StatusColor:   "#0B5ED7",
			Note:          "Our accounts team is reviewing your request. Funds will be disbursed via IMPS or UPI within 1–2 business days.",
			Rows: []tableRow{
				{Label: "Reference ID", Value: p.ReferenceID, Mono: true},
				{Label: "Amount", Value: fmt.Sprintf("₹%.2f", p.Amount), Bold: true},
				{Label: "Payout Method", Value: strings.ToUpper(p.PayoutMethod)},
				{Label: "Destination", Value: p.Destination},
				{Label: "Remaining Earnings", Value: fmt.Sprintf("₹%.2f", p.Remaining)},
			},
			CTAURL:   "https://kaammilega.com/wallet",
			CTALabel: "View Wallet",
		})
		if err == nil {
			_ = m.SendRaw(p.ExpertEmail, expertSubject, expertBody)
		}
	}

	return nil
}

func (m *smtpMailer) SendEmailOTP(p EmailOTPParams) error {
	subject := "KaamMilega Verification Code"
	status := "Email Verification"
	if p.Purpose == "password_reset" {
		subject = "KaamMilega Password Reset Code"
		status = "Password Reset"
	}
	body, err := renderTemplate(m.templates, "email_otp", templateData{
		RecipientName: p.UserName,
		Status:        status,
		StatusColor:   "#0B5ED7",
		Note:          p.Code,
	})
	if err != nil {
		return fmt.Errorf("notification: render email otp: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}

func (m *smtpMailer) SendRaw(to, subject, htmlBody string) error {
	if to == "" {
		return fmt.Errorf("notification: empty recipient address")
	}
	return dialAndSend(m.cfg, to, subject, htmlBody)
}

// ─── No-Op Implementation ─────────────────────────────────────────────────────

// noopMailer is used when SMTP is not configured (local dev, CI).
// It silently discards all emails and never returns an error.
type noopMailer struct{}

func (n *noopMailer) SendInterviewInvite(_ InterviewInviteParams) error      { return nil }
func (n *noopMailer) SendApplicationUpdate(_ ApplicationUpdateParams) error  { return nil }
func (n *noopMailer) SendTransactionReceipt(_ TransactionReceiptParams) error { return nil }
func (n *noopMailer) SendWithdrawalRequest(_ WithdrawalRequestParams) error  { return nil }
func (n *noopMailer) SendEmailOTP(_ EmailOTPParams) error                    { return nil }
func (n *noopMailer) SendRaw(_, _, _ string) error                           { return nil }

// ─── SMTP Dial & Send ─────────────────────────────────────────────────────────

func dialAndSend(cfg *config.Config, to, subject, htmlBody string) error {
	addr := fmt.Sprintf("%s:%s", cfg.SMTPHost, cfg.SMTPPort)
	auth := smtp.PlainAuth("", cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPHost)

	header := fmt.Sprintf(
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		cfg.SMTPFromName, cfg.SMTPFromEmail, to, subject,
	)

	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("notification: smtp dial: %w", err)
	}
	defer client.Close()

	if err = client.StartTLS(&tls.Config{ServerName: cfg.SMTPHost, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("notification: starttls: %w", err)
	}
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("notification: smtp auth: %w", err)
	}
	if err = client.Mail(cfg.SMTPFromEmail); err != nil {
		return fmt.Errorf("notification: smtp mail from: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("notification: smtp rcpt to: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("notification: smtp data: %w", err)
	}
	if _, err = fmt.Fprint(w, header+htmlBody); err != nil {
		return fmt.Errorf("notification: smtp write: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("notification: smtp close writer: %w", err)
	}
	return client.Quit()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// statusToColor maps application status strings to KaamMilega brand colors.
func statusToColor(status string) string {
	s := strings.ToLower(status)
	switch {
	case strings.Contains(s, "selected") || strings.Contains(s, "offer"):
		return "#16A34A" // Growth Green
	case strings.Contains(s, "interview") || strings.Contains(s, "shortlist"):
		return "#0B5ED7" // Brand Blue
	case strings.Contains(s, "reject"):
		return "#EF4444" // Essential Coral
	case strings.Contains(s, "review"):
		return "#FF6B00" // Brand Orange
	default:
		return "#071A4D" // Deep Navy
	}
}

func currencySymbol(currency string) string {
	switch strings.ToUpper(currency) {
	case "INR":
		return "₹"
	case "USD":
		return "$"
	default:
		return currency
	}
}
