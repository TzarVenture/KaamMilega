package notification

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"
)

// templateData is the single data-model passed to every email template.
// Fields unused by a specific template are safely ignored.
type templateData struct {
	RecipientName string
	JobTitle      string
	CompanyName   string
	Status        string
	StatusColor   string // Hex color string, e.g. "#0B5ED7"
	Rows          []tableRow
	Note          string
	CTAURL        string
	CTALabel      string
}

// tableRow represents a key-value pair rendered inside an email details table.
type tableRow struct {
	Label string
	Value string
	Mono  bool // render value in monospace (for IDs, codes)
	Bold  bool // render value in bold (for amounts, key facts)
}

// templateRegistry holds isolated template trees for each notification type to prevent
// cross-contamination of shared block definitions (e.g. {{define "content"}}).
type templateRegistry struct {
	interviewInvite    *template.Template
	applicationUpdate  *template.Template
	transactionReceipt *template.Template
	withdrawalAdmin    *template.Template
	emailOTP           *template.Template
	accountNotice      *template.Template
	jobAlert           *template.Template
}

// mustParseTemplates builds isolated template trees for every transactional email type.
// Each template is parsed in its own separate tree so {{define "content"}} never collides.
func mustParseTemplates() *templateRegistry {
	return &templateRegistry{
		interviewInvite:    template.Must(template.New("interview_invite").Parse(baseLayout + interviewInviteTmpl)),
		applicationUpdate:  template.Must(template.New("application_update").Parse(baseLayout + applicationUpdateTmpl)),
		transactionReceipt: template.Must(template.New("transaction_receipt").Parse(baseLayout + transactionReceiptTmpl)),
		withdrawalAdmin:    template.Must(template.New("withdrawal_admin").Parse(baseLayout + withdrawalAdminTmpl)),
		emailOTP:           template.Must(template.New("email_otp").Parse(baseLayout + emailOTPTmpl)),
		accountNotice:      template.Must(template.New("account_notice").Parse(baseLayout + accountNoticeTmpl)),
		jobAlert:           template.Must(template.New("job_alert").Funcs(jobAlertFuncs).Parse(baseLayout + jobAlertTmpl)),
	}
}

// renderTemplate executes the isolated template for the given notification type.
func renderTemplate(reg *templateRegistry, name string, data templateData) (string, error) {
	var t *template.Template
	switch name {
	case "interview_invite":
		t = reg.interviewInvite
	case "application_update":
		t = reg.applicationUpdate
	case "transaction_receipt":
		t = reg.transactionReceipt
	case "withdrawal_admin":
		t = reg.withdrawalAdmin
	case "email_otp":
		t = reg.emailOTP
	case "account_notice":
		t = reg.accountNotice
	case "job_alert":
		t = reg.jobAlert
	default:
		return "", fmt.Errorf("notification: unknown template %q", name)
	}

	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, "email_wrapper", data); err != nil {
		return "", fmt.Errorf("notification: execute template %s: %w", name, err)
	}
	return buf.String(), nil
}

// ─── Shared Base Layout ───────────────────────────────────────────────────────
// All templates extend this base by defining a "content" block.
// Brand tokens: Deep Navy #071A4D · Brand Orange #FF6B00 · Brand Blue #0B5ED7

const baseLayout = `
{{define "email_wrapper"}}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>KaamMilega Notification</title>
</head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #D9E0EA;overflow:hidden;box-shadow:0 10px 25px -5px rgba(7, 26, 77, 0.06);">

        {{/* ── Top Accent Bar (Gradient Brand Blue -> Brand Orange) ── */}}
        <tr>
          <td style="background:linear-gradient(90deg, #0B5ED7 0%, #FF6B00 100%);height:4px;line-height:4px;font-size:4px;">&nbsp;</td>
        </tr>

        {{/* ── Brand Header (Clean White Card Top with Brand Logo & Icon) ── */}}
        <tr>
          <td style="background:#FFFFFF;padding:28px 32px 20px;text-align:center;border-bottom:1px solid #F1F5F9;">
            <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <a href="https://kaammilega.com" target="_blank" style="text-decoration:none;display:inline-block;">
                    <img src="https://kaammilega.com/kaammilega-logo-icon.png" alt="KaamMilega Icon" width="38" height="39" style="display:block;width:38px;height:39px;max-width:38px;border:0;outline:none;text-decoration:none;" />
                  </a>
                </td>
                <td style="vertical-align:middle;">
                  <a href="https://kaammilega.com" target="_blank" style="text-decoration:none;display:inline-block;">
                    <img src="https://kaammilega.com/kaammilega-logo-text.png" alt="Kaammilega™" width="158" height="28" style="display:block;width:158px;height:28px;max-width:158px;border:0;outline:none;text-decoration:none;" />
                  </a>
                </td>
              </tr>
            </table>
            {{if .Status}}
            <div style="margin-top:14px;">
              <span style="display:inline-block;background:#F4F7FB;border:1px solid #D9E0EA;color:{{if .StatusColor}}{{.StatusColor}}{{else}}#071A4D{{end}};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:4px 14px;border-radius:20px;">
                {{.Status}}
              </span>
            </div>
            {{end}}
          </td>
        </tr>

        {{/* ── Card Body ── */}}
        <tr>
          <td style="background:#ffffff;padding:32px;">
            {{template "content" .}}
          </td>
        </tr>

        {{/* ── Footer ── */}}
        <tr>
          <td style="padding:24px 32px;background:#F8FAFC;border-top:1px solid #F1F5F9;text-align:center;color:#8F9AA8;font-size:11px;line-height:1.6;">
            © 2026 KaamMilega Platform Pvt. Ltd. · All rights reserved.<br>
            <a href="https://kaammilega.com" style="color:#0B5ED7;text-decoration:none;font-weight:600;">kaammilega.com</a>
            &nbsp;·&nbsp;
            <a href="https://kaammilega.com/settings" style="color:#0B5ED7;text-decoration:none;font-weight:600;">Notification Settings</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
{{end}}

{{/* ── Reusable sub-components ── */}}

{{define "greeting"}}
<p style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;">Hi {{.RecipientName}},</p>
{{end}}

{{define "detail_table"}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7FB;border:1px solid #D9E0EA;border-radius:12px;margin:20px 0;overflow:hidden;">
  {{range .Rows}}
  <tr style="border-bottom:1px solid #D9E0EA;">
    <td style="padding:12px 16px;color:#5B6472;font-size:13px;width:42%;vertical-align:top;">{{.Label}}</td>
    <td style="padding:12px 16px;color:{{if .Bold}}#111827{{else}}#374151{{end}};font-size:13px;font-weight:{{if .Bold}}800{{else}}500{{end}};font-family:{{if .Mono}}monospace{{else}}inherit{{end}};word-break:break-all;">{{.Value}}</td>
  </tr>
  {{end}}
</table>
{{end}}

{{define "cta_button"}}
{{if .CTAURL}}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto 0;">
  <tr>
    <td style="background:#FF6B00;border-radius:10px;text-align:center;">
      <a href="{{.CTAURL}}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">{{.CTALabel}} →</a>
    </td>
  </tr>
</table>
{{end}}
{{end}}

{{define "status_badge"}}
<div style="display:inline-block;background:{{.StatusColor}}1a;border:1.5px solid {{.StatusColor}}40;color:{{.StatusColor}};border-radius:20px;padding:6px 18px;font-size:13px;font-weight:700;margin:10px 0 14px;letter-spacing:0.3px;">
  {{.Status}}
</div>
{{end}}

{{define "note_box"}}
{{if .Note}}
<div style="background:#EFF6FF;border-left:4px solid #0B5ED7;padding:14px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
  <p style="color:#1E3A8A;font-size:13px;line-height:1.6;margin:0;">{{.Note}}</p>
</div>
{{end}}
{{end}}

{{define "settings_note"}}
<p style="margin:24px 0 0;color:#8F9AA8;font-size:12px;line-height:1.6;border-top:1px solid #F4F7FB;padding-top:20px;">
  You received this email because your account has email notifications enabled.
  Manage your preferences in <a href="https://kaammilega.com/settings" style="color:#0B5ED7;">Account Settings</a>.
</p>
{{end}}
`

// ─── Interview Invite Template ─────────────────────────────────────────────────

const interviewInviteTmpl = `
{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.65;">
  Congratulations! Your interview for <strong>{{.JobTitle}}</strong>
  {{if .CompanyName}}at <strong>{{.CompanyName}}</strong>{{end}} has been scheduled.
</p>
{{template "status_badge" .}}
<p style="margin:16px 0 4px;color:#5B6472;font-size:13px;font-weight:600;">Here are your interview details:</p>
{{template "detail_table" .}}
{{template "note_box" .}}
<p style="margin:16px 0 0;color:#374151;font-size:14px;line-height:1.65;">
  Please make sure to be available 5 minutes before your scheduled time. Good luck! 🎉
</p>
{{template "cta_button" .}}
{{template "settings_note" .}}
{{end}}
`

// ─── Application Update Template ──────────────────────────────────────────────

const applicationUpdateTmpl = `
{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  There is an update on your job application for <strong>{{.JobTitle}}</strong>{{if .CompanyName}} at <strong>{{.CompanyName}}</strong>{{end}}.
</p>

<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
  <p style="margin:0 0 8px;color:#64748B;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Application Status</p>
  {{template "status_badge" .}}
  <p style="margin:8px 0 0;color:#334155;font-size:14px;line-height:1.6;">
    {{if eq .Status "Shortlisted"}}
      🎉 Congratulations! Your profile has been <strong>shortlisted</strong> by the hiring team.
    {{else if eq .Status "Interviewing"}}
      📅 Great news! Your application is in the <strong>interview stage</strong>. The recruiter will reach out with scheduling details.
    {{else if eq .Status "Selected"}}
      🌟 Fantastic news! You have been <strong>selected</strong> for this role.
    {{else if eq .Status "Rejected"}}
      Thank you for taking the time to apply. While this role was not a match, new matching opportunities are posted daily on KaamMilega.
    {{else}}
      Your application status has been updated to <strong>{{.Status}}</strong>.
    {{end}}
  </p>
</div>

{{template "note_box" .}}
{{template "cta_button" .}}
{{template "settings_note" .}}
{{end}}
`

// ─── Transaction Receipt Template ─────────────────────────────────────────────

const transactionReceiptTmpl = `
{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.65;">
  Your transaction has been processed successfully.
</p>
{{template "status_badge" .}}
{{template "detail_table" .}}
{{template "note_box" .}}
{{template "cta_button" .}}
<p style="margin:20px 0 0;color:#8F9AA8;font-size:12px;line-height:1.6;border-top:1px solid #F4F7FB;padding-top:20px;">
  If you did not authorize this transaction, please contact us immediately at
  <a href="mailto:support@kaammilega.com" style="color:#0B5ED7;">support@kaammilega.com</a>.
</p>
{{end}}
`

// ─── Withdrawal Admin Alert Template ─────────────────────────────────────────

const withdrawalAdminTmpl = `
{{define "content"}}
<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.65;font-weight:600;">
  🔔 A new payout request requires your attention.
</p>
{{template "status_badge" .}}
{{template "detail_table" .}}
{{template "note_box" .}}
{{template "cta_button" .}}
<p style="margin:20px 0 0;color:#8F9AA8;font-size:12px;line-height:1.6;border-top:1px solid #F4F7FB;padding-top:20px;">
  Please verify the account details, disburse the funds via IMPS / NEFT / UPI,
  and confirm receipt to the expert. This is an internal platform notification.
</p>
{{end}}
`

// ─── Account Lifecycle Notice Template ────────────────────────────────────────
// .Status carries the notice kind; .Note the deletion date for "deletion_scheduled".
// The badge-free layout keeps the message plain: this is a security-relevant email.

const accountNoticeTmpl = `
{{define "content"}}
{{template "greeting" .}}
{{if eq .Status "deactivated"}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  Your KaamMilega account has been <strong>deactivated</strong>. Your profile is hidden from employers and other members,
  your job posts are paused, and you have been signed out on every device.
</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  Nothing has been deleted. Sign in any time to reactivate your account.
</p>
{{else if eq .Status "deletion_scheduled"}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  We received your request to <strong>delete your KaamMilega account</strong>. Your account is now deactivated and
  will be permanently deleted on <strong>{{.Note}}</strong>.
</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  Changed your mind? Sign in before that date to restore your account. After it, your profile, photos and personal
  details are erased and can't be recovered. Payment records are kept in anonymised form as required by law.
</p>
{{else if eq .Status "deletion_cancelled"}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  Your account deletion request was <strong>cancelled</strong>. Your account is active again and your profile and job posts are visible as before.
</p>
{{else if eq .Status "deleted"}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  Your KaamMilega account has been <strong>permanently deleted</strong>. Your profile, photos and personal details have been erased.
</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  Thank you for being part of KaamMilega. You're welcome back any time with a new account.
</p>
{{end}}
{{template "cta_button" .}}
<p style="margin:16px 0 0;color:#8F9AA8;font-size:13px;line-height:1.5;">
  Didn't request this? Contact support@kaammilega.com right away.
</p>
{{end}}
`

// ─── Daily Job Alert Template ──────────────────────────────────────────────────
// Each row: Label = job title, Value = "company · location|salary|url"

var jobAlertFuncs = template.FuncMap{
	"part": func(s string, i int) string {
		parts := strings.SplitN(s, "|", 3)
		if i < len(parts) {
			return parts[i]
		}
		return ""
	},
}

const jobAlertTmpl = `
{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  New jobs were posted that match your profile. Apply early: employers often hire from the first applicants.
</p>
{{range .Rows}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E3E9F1;border-radius:12px;margin:0 0 12px;">
  <tr>
    <td style="padding:14px 16px;">
      <a href="{{part .Value 2}}" style="color:#071A4D;font-size:15px;font-weight:700;text-decoration:none;">{{.Label}}</a>
      <div style="color:#5B6472;font-size:13px;margin-top:4px;">{{part .Value 0}}</div>
      {{with part .Value 1}}<div style="color:#16A34A;font-size:13px;font-weight:600;margin-top:4px;">{{.}}</div>{{end}}
    </td>
    <td align="right" style="padding:14px 16px;white-space:nowrap;">
      <a href="{{part .Value 2}}" style="color:#0B5ED7;font-size:13px;font-weight:600;text-decoration:none;">View job →</a>
    </td>
  </tr>
</table>
{{end}}
{{template "cta_button" .}}
<p style="margin:16px 0 0;color:#8F9AA8;font-size:12px;line-height:1.5;">
  You get this email because job alerts are on.
  <a href="https://kaammilega.com/settings?tab=notifications" style="color:#5B6472;">Turn off job alerts</a>
</p>
{{end}}
`

// ─── Email OTP Verification & Password Reset Template ─────────────────────────

const emailOTPTmpl = `
{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.65;">
  {{if eq .Status "Password Reset"}}
    We received a request to reset your password. Use the 4-digit verification code below to proceed with setting a new password:
  {{else if eq .Status "Account Verification"}}
    Use the verification code below to confirm a change to your account (deactivation or deletion). Only enter it on kaammilega.com:
  {{else}}
    Please use the 4-digit verification code below to confirm your email address and complete your account setup:
  {{end}}
</p>

{{/* ── OTP Code Display Box ── */}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background:#EFF6FF;border:2px dashed #0B5ED7;border-radius:16px;padding:24px 20px;">
      <div style="font-size:38px;font-weight:900;color:#071A4D;letter-spacing:14px;font-family:'Courier New',Courier,monospace;margin-left:14px;">
        {{.Note}}
      </div>
    </td>
  </tr>
</table>

{{/* ── Security Notice Box ── */}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF7ED;border:1px solid #FFEDD5;border-left:4px solid #FF6B00;border-radius:8px;margin-bottom:24px;">
  <tr>
    <td style="padding:12px 16px;font-size:13px;color:#9A3412;line-height:1.5;">
      ⏱️ <strong>Security Notice:</strong> This code will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
    </td>
  </tr>
</table>

<p style="margin:0;color:#8F9AA8;font-size:13px;line-height:1.5;">
  {{if eq .Status "Password Reset"}}
    If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
  {{else if eq .Status "Account Verification"}}
    If you did not request this, your account is safe: nothing changes without this code. Consider changing your password.
  {{else}}
    If you did not create an account or request this verification, please safely ignore this email.
  {{end}}
</p>
{{end}}
`

