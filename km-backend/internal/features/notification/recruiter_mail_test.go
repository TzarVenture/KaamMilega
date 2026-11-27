package notification

import (
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"
)

// captureMailer renders the real templates but keeps the email instead of sending it
type captured struct{ to, subject, body string }

func render(t *testing.T, send func(m *smtpMailer) error) captured {
	t.Helper()
	var got captured
	m := &smtpMailer{cfg: &config.Config{FrontendURL: "https://example.test"}, templates: mustParseTemplates()}
	sendRaw = func(_ *config.Config, to, subject, body string) error {
		got = captured{to, subject, body}
		return nil
	}
	defer func() { sendRaw = dialAndSend }()
	if err := send(m); err != nil {
		t.Fatal(err)
	}
	return got
}

func TestInterviewEmailsUseIndiaTimeAndKind(t *testing.T) {
	at := time.Date(2026, 12, 1, 5, 30, 0, 0, time.UTC) // 11:00 AM in India
	for kind, want := range map[string]string{
		"":                   "has been scheduled",
		InterviewRescheduled: "has been changed",
		InterviewCancelled:   "has been cancelled",
	} {
		got := render(t, func(m *smtpMailer) error {
			return m.SendInterviewInvite(InterviewInviteParams{ToEmail: "c@x.test", CandidateName: "Asha", JobTitle: "Driver", CompanyName: "Aura", InterviewType: "Video", ScheduledAt: at, Kind: kind})
		})
		if !strings.Contains(got.body, want) {
			t.Errorf("kind %q: body lacks %q", kind, want)
		}
		if !strings.Contains(got.body, "11:00 AM IST") {
			t.Errorf("kind %q: time not in India time", kind)
		}
		if !strings.Contains(got.body, "https://example.test/interviews") {
			t.Errorf("kind %q: link should use FRONTEND_URL", kind)
		}
	}
}

func TestStatusEmailSaysNotSelected(t *testing.T) {
	got := render(t, func(m *smtpMailer) error {
		return m.SendApplicationUpdate(ApplicationUpdateParams{ToEmail: "c@x.test", JobTitle: "Driver", NewStatus: "Rejected"})
	})
	if strings.Contains(got.body, ">Rejected<") || !strings.Contains(got.body, "Not selected") {
		t.Error("candidate should read Not selected, not Rejected")
	}
	hired := render(t, func(m *smtpMailer) error {
		return m.SendApplicationUpdate(ApplicationUpdateParams{ToEmail: "c@x.test", JobTitle: "Driver", NewStatus: "Hired"})
	})
	if !strings.Contains(hired.body, "hired") {
		t.Error("hired email lacks its message")
	}
}

func TestNewApplicantEmailToEmployer(t *testing.T) {
	got := render(t, func(m *smtpMailer) error {
		return m.SendNewApplication(NewApplicationParams{ToEmail: "r@x.test", RecruiterName: "Anand", CandidateName: "Asha", City: "Delhi", JobTitle: "Driver", ActionURL: "https://example.test/recruiter/applications?a=1"})
	})
	if got.to != "r@x.test" || !strings.Contains(got.subject, "Asha") || !strings.Contains(got.body, "Delhi") || !strings.Contains(got.body, "/recruiter/applications?a=1") {
		t.Errorf("unexpected email: %q", got.subject)
	}
}
