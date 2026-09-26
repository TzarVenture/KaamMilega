package notification

import "html/template"

// templateData is the single data-model passed to every email template.
// Fields unused by a specific template are safely ignored.
type templateData struct {
	RecipientName string
	JobTitle      string
	CompanyName   string
	Status        string
	StatusColor   string    // Hex color string, e.g. "#0B5ED7"
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

// mustParseTemplates parses all transactional email templates.
// Panics at startup if any template has a syntax error — fail-fast is intentional.
func mustParseTemplates() *template.Template {
	t := template.Must(template.New("root").Parse(baseLayout))
	template.Must(t.New("interview_invite").Parse(interviewInviteTmpl))
	template.Must(t.New("application_update").Parse(applicationUpdateTmpl))
	template.Must(t.New("transaction_receipt").Parse(transactionReceiptTmpl))
	template.Must(t.New("withdrawal_admin").Parse(withdrawalAdminTmpl))
	return t
}

// ─── Shared Base Layout ───────────────────────────────────────────────────────
// All templates extend this base by defining a "body" block.
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
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">

        {{/* ── Header Bar ── */}}
        <tr>
          <td style="background:#071A4D;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
            <span style="display:inline-block;background:#FF6B00;color:#ffffff;font-size:16px;font-weight:900;width:40px;height:40px;line-height:40px;border-radius:10px;text-align:center;letter-spacing:-1px;">K</span>
            <div style="color:#ffffff;font-size:22px;font-weight:900;margin:10px 0 2px;letter-spacing:-0.5px;">
              Kaammi<span style="color:#FF6B00;">lega</span>™
            </div>
            <div style="color:rgba(255,255,255,0.55);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">
              {{.Status}}
            </div>
          </td>
        </tr>

        {{/* ── Card Body ── */}}
        <tr>
          <td style="background:#ffffff;border:1px solid #D9E0EA;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
            {{template "content" .}}
          </td>
        </tr>

        {{/* ── Footer ── */}}
        <tr>
          <td style="padding:20px 0;text-align:center;color:#8F9AA8;font-size:11px;line-height:1.6;">
            © 2026 KaamMilega Platform Pvt. Ltd. · All rights reserved.<br>
            <a href="https://kaammilega.com" style="color:#0B5ED7;text-decoration:none;">kaammilega.com</a>
            &nbsp;·&nbsp;
            <a href="https://kaammilega.com/settings" style="color:#0B5ED7;text-decoration:none;">Notification Settings</a>
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
<div style="display:inline-block;background:{{.StatusColor}}1a;border:1.5px solid {{.StatusColor}}40;color:{{.StatusColor}};border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;margin:12px 0 20px;letter-spacing:0.3px;">
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
{{define "interview_invite"}}
{{template "email_wrapper" .}}
{{end}}

{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.65;">
  Congratulations! Your interview for <strong>{{.JobTitle}}</strong>
  {{if .CompanyName}}at <strong>{{.CompanyName}}</strong>{{end}} has been scheduled.
</p>
{{template "status_badge" .}}
<p style="margin:4px 0 0;color:#5B6472;font-size:13px;">Here are your interview details:</p>
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
{{define "application_update"}}
{{template "email_wrapper" .}}
{{end}}

{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.65;">
  There's an update on your application for <strong>{{.JobTitle}}</strong>
  {{if .CompanyName}}at <strong>{{.CompanyName}}</strong>{{end}}.
</p>
<p style="margin:0 0 4px;color:#5B6472;font-size:13px;">Current status:</p>
{{template "status_badge" .}}
{{template "note_box" .}}
{{template "cta_button" .}}
{{template "settings_note" .}}
{{end}}
`

// ─── Transaction Receipt Template ─────────────────────────────────────────────

const transactionReceiptTmpl = `
{{define "transaction_receipt"}}
{{template "email_wrapper" .}}
{{end}}

{{define "content"}}
{{template "greeting" .}}
<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.65;">
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
{{define "withdrawal_admin"}}
{{template "email_wrapper" .}}
{{end}}

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
