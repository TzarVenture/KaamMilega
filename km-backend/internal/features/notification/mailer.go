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

	// SendNewApplication tells an employer that someone applied to one of their jobs.
	SendNewApplication(p NewApplicationParams) error

	// SendTransactionReceipt sends a detailed receipt after a financial transaction.
	SendTransactionReceipt(p TransactionReceiptParams) error

	// SendWithdrawalRequest notifies admin + expert of a payout request.
	SendWithdrawalRequest(p WithdrawalRequestParams) error

	// SendEmailOTP dispatches a verification or password reset OTP email.
	SendEmailOTP(p EmailOTPParams) error

	// SendAccountNotice confirms an account lifecycle change (deactivation, deletion).
	SendAccountNotice(p AccountNoticeParams) error

	// SendJobAlert sends the daily digest of new jobs matching a candidate's profile.
	SendJobAlert(p JobAlertParams) error

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
	Kind          string // InterviewScheduled (default), InterviewRescheduled or InterviewCancelled
}

// Interview email kinds
const (
	InterviewScheduled   = "scheduled"
	InterviewRescheduled = "rescheduled"
	InterviewCancelled   = "cancelled"
)

// NewApplicationParams carries data for the employer's "new applicant" email.
type NewApplicationParams struct {
	ToEmail       string
	RecruiterName string
	CandidateName string
	Headline      string
	City          string
	JobTitle      string
	ActionURL     string // Deep-link to the applicant in the employer portal
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
	Purpose  string // "verification" | "password_reset" | "account_action"
	UserName string // optional
}

// AccountNoticeParams confirms an account lifecycle change to the account owner.
type AccountNoticeParams struct {
	ToEmail      string
	UserName     string
	Kind         string     // AccountNoticeDeactivated | ...DeletionScheduled | ...DeletionCancelled | ...Deleted
	ScheduledFor *time.Time // deletion date (DeletionScheduled), suspension end (Suspended; nil = permanent)
	Reason       string     // why an admin suspended the account (Suspended only)
}

// JobAlertParams carries the jobs for one candidate's daily job-alert email.
type JobAlertParams struct {
	ToEmail  string
	UserName string
	Jobs     []JobAlertItem
}

// JobAlertItem is one job in a job-alert email
type JobAlertItem struct {
	Title    string
	Company  string
	Location string
	Salary   string // pre-formatted, e.g. "₹15,000 – ₹20,000 / month"; empty when not given
	URL      string
}

// Account notice kinds
const (
	AccountNoticeDeactivated       = "deactivated"
	AccountNoticeDeletionScheduled = "deletion_scheduled"
	AccountNoticeDeletionCancelled = "deletion_cancelled"
	AccountNoticeDeleted           = "deleted"
	AccountNoticeSuspended         = "suspended"
	AccountNoticeSuspensionLifted  = "suspension_lifted"
)

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
	status, color := "Interview Scheduled", "#0B5ED7"
	switch p.Kind {
	case InterviewRescheduled:
		status, color = "Interview Rescheduled", "#FF6B00"
	case InterviewCancelled:
		status, color = "Interview Cancelled", "#64748B"
	}
	subject := fmt.Sprintf("%s — %s", status, p.JobTitle)
	if p.CompanyName != "" {
		subject += " at " + p.CompanyName
	}
	body, err := renderTemplate(m.templates, "interview_invite", templateData{
		RecipientName: p.CandidateName,
		JobTitle:      p.JobTitle,
		CompanyName:   p.CompanyName,
		Status:        status,
		StatusColor:   color,
		Rows: []tableRow{
			// Servers run on UTC: the candidate reads India time
			{Label: "📅 Date & Time", Value: p.ScheduledAt.In(istLocation()).Format("Monday, 02 Jan 2006 · 03:04 PM") + " IST"},
			{Label: "🎯 Format", Value: p.InterviewType},
			{Label: "📍 Location / Link", Value: p.Location},
		},
		Note:     p.Notes,
		CTAURL:   m.siteURL("/interviews"),
		CTALabel: "View My Interviews",
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
	// Candidates see "Not selected", never "Rejected"
	p.NewStatus = CandidateStatusLabel(p.NewStatus)
	statusColor := statusToColor(p.NewStatus)
	subject := fmt.Sprintf("Application Update — %s", p.JobTitle)
	if p.CompanyName != "" {
		subject += " at " + p.CompanyName
	}
	if p.ActionURL == "" {
		p.ActionURL = m.siteURL("/applications")
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

func (m *smtpMailer) SendNewApplication(p NewApplicationParams) error {
	if p.RecruiterName == "" {
		p.RecruiterName = "there"
	}
	if p.ActionURL == "" {
		p.ActionURL = m.siteURL("/recruiter/applications")
	}
	rows := []tableRow{{Label: "Candidate", Value: p.CandidateName, Bold: true}}
	if p.Headline != "" {
		rows = append(rows, tableRow{Label: "Headline", Value: p.Headline})
	}
	if p.City != "" {
		rows = append(rows, tableRow{Label: "City", Value: p.City})
	}
	body, err := renderTemplate(m.templates, "new_application", templateData{
		RecipientName: p.RecruiterName,
		JobTitle:      p.JobTitle,
		Status:        "New Applicant",
		StatusColor:   "#0B5ED7",
		Rows:          rows,
		CTAURL:        p.ActionURL,
		CTALabel:      "Review Applicant",
	})
	if err != nil {
		return fmt.Errorf("notification: render new application: %w", err)
	}
	return m.SendRaw(p.ToEmail, fmt.Sprintf("New applicant for %s — %s", p.JobTitle, p.CandidateName), body)
}

// siteURL is a full link to a page on the website (FRONTEND_URL, kaammilega.com by default)
func (m *smtpMailer) siteURL(path string) string {
	base := strings.TrimRight(m.cfg.FrontendURL, "/")
	if base == "" {
		base = "https://kaammilega.com"
	}
	return base + path
}

// CandidateStatusLabel is how a pipeline stage reads to the candidate
func CandidateStatusLabel(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "rejected":
		return "Not selected"
	case "interviewing":
		return "Interviewing"
	case "shortlisted":
		return "Shortlisted"
	case "hired":
		return "Hired"
	case "applied":
		return "Applied"
	}
	return status
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
	switch p.Purpose {
	case "password_reset":
		subject = "KaamMilega Password Reset Code"
		status = "Password Reset"
	case "account_action":
		subject = "Confirm your KaamMilega account change"
		status = "Account Verification"
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

func (m *smtpMailer) SendAccountNotice(p AccountNoticeParams) error {
	subjects := map[string]string{
		AccountNoticeDeactivated:       "Your KaamMilega account is deactivated",
		AccountNoticeDeletionScheduled: "Your KaamMilega account is scheduled for deletion",
		AccountNoticeDeletionCancelled: "Your KaamMilega account deletion was cancelled",
		AccountNoticeDeleted:           "Your KaamMilega account has been deleted",
		AccountNoticeSuspended:         "Your KaamMilega account is suspended",
		AccountNoticeSuspensionLifted:  "Your KaamMilega account is active again",
	}
	subject, ok := subjects[p.Kind]
	if !ok {
		return fmt.Errorf("notification: unknown account notice %q", p.Kind)
	}
	data := templateData{RecipientName: p.UserName, Status: p.Kind, StatusColor: "#071A4D"}
	if p.ScheduledFor != nil {
		data.Note = p.ScheduledFor.In(istLocation()).Format("2 January 2006")
	}
	if p.Kind == AccountNoticeSuspended {
		until := "Permanent"
		if p.ScheduledFor != nil {
			until = p.ScheduledFor.In(istLocation()).Format("2 January 2006, 3:04 PM")
		}
		data.Rows = []tableRow{{Label: "Reason", Value: p.Reason}, {Label: "Until", Value: until, Bold: true}}
	}
	if p.Kind == AccountNoticeDeactivated || p.Kind == AccountNoticeDeletionScheduled {
		data.CTAURL = "https://kaammilega.com/login"
		data.CTALabel = "Sign in to restore your account"
	}
	if p.Kind == AccountNoticeSuspensionLifted {
		data.CTAURL = "https://kaammilega.com/login"
		data.CTALabel = "Sign in"
	}
	body, err := renderTemplate(m.templates, "account_notice", data)
	if err != nil {
		return fmt.Errorf("notification: render account notice: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}

func (m *smtpMailer) SendJobAlert(p JobAlertParams) error {
	if len(p.Jobs) == 0 {
		return nil
	}
	rows := make([]tableRow, 0, len(p.Jobs))
	for _, j := range p.Jobs {
		rows = append(rows, tableRow{Label: j.Title, Value: j.Company + " · " + j.Location + "|" + j.Salary + "|" + j.URL})
	}
	subject := fmt.Sprintf("%d new job%s matching your profile", len(p.Jobs), map[bool]string{true: "", false: "s"}[len(p.Jobs) == 1])
	body, err := renderTemplate(m.templates, "job_alert", templateData{
		RecipientName: p.UserName,
		Rows:          rows,
		CTAURL:        "https://kaammilega.com/jobs",
		CTALabel:      "See all jobs",
	})
	if err != nil {
		return fmt.Errorf("notification: render job alert: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}

// istLocation is India Standard Time (dates in user-facing emails)
func istLocation() *time.Location {
	if loc, err := time.LoadLocation("Asia/Kolkata"); err == nil {
		return loc
	}
	return time.FixedZone("IST", 5*3600+1800)
}

func (m *smtpMailer) SendRaw(to, subject, htmlBody string) error {
	if to == "" {
		return fmt.Errorf("notification: empty recipient address")
	}
	return sendRaw(m.cfg, to, subject, htmlBody)
}

// sendRaw delivers an email (tests swap it to keep the email instead)
var sendRaw = dialAndSend

// ─── No-Op Implementation ─────────────────────────────────────────────────────

// noopMailer is used when SMTP is not configured (local dev, CI).
// It silently discards all emails and never returns an error.
type noopMailer struct{}

func (n *noopMailer) SendInterviewInvite(_ InterviewInviteParams) error      { return nil }
func (n *noopMailer) SendApplicationUpdate(_ ApplicationUpdateParams) error  { return nil }
func (n *noopMailer) SendNewApplication(_ NewApplicationParams) error        { return nil }
func (n *noopMailer) SendTransactionReceipt(_ TransactionReceiptParams) error { return nil }
func (n *noopMailer) SendWithdrawalRequest(_ WithdrawalRequestParams) error  { return nil }
func (n *noopMailer) SendEmailOTP(_ EmailOTPParams) error                    { return nil }
func (n *noopMailer) SendAccountNotice(_ AccountNoticeParams) error          { return nil }
func (n *noopMailer) SendJobAlert(_ JobAlertParams) error                    { return nil }
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
	case strings.Contains(s, "not selected") || strings.Contains(s, "cancel"):
		return "#64748B" // Slate
	case strings.Contains(s, "selected") || strings.Contains(s, "offer") || strings.Contains(s, "hired"):
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
