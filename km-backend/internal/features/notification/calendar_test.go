package notification

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"km-backend/internal/config"
)

// unfold joins folded iCalendar lines back together
func unfold(ics string) []string {
	return strings.Split(strings.ReplaceAll(ics, "\r\n ", ""), "\r\n")
}

func icsValue(lines []string, name string) string {
	for _, l := range lines {
		if strings.HasPrefix(l, name+":") || strings.HasPrefix(l, name+";") {
			return l
		}
	}
	return ""
}

func TestInterviewEmailCarriesCalendarInvite(t *testing.T) {
	at := time.Date(2026, 12, 1, 5, 30, 0, 0, time.UTC)
	var gotEv CalendarEvent
	var gotBody string
	sendCalendar = func(_ *config.Config, _, _, body string, ev CalendarEvent) error {
		gotEv, gotBody = ev, body
		return nil
	}
	defer func() { sendCalendar = deliverCalendar }()
	m := &smtpMailer{cfg: &config.Config{FrontendURL: "https://example.test", SMTPFromEmail: "no-reply@kaammilega.com"}, templates: mustParseTemplates()}

	for _, kind := range []string{InterviewScheduled, InterviewRescheduled, InterviewCancelled} {
		err := m.SendInterviewInvite(InterviewInviteParams{
			ToEmail: "c@x.test", CandidateName: "Asha", JobTitle: "Driver, night shift", CompanyName: "Aura; Co",
			InterviewType: "Video", ScheduledAt: at, Location: "https://meet.example/abc", Notes: "Bring ID\nArrive early",
			Kind: kind, InterviewID: "abc123", Version: 42,
		})
		if err != nil {
			t.Fatal(err)
		}
		if gotBody == "" {
			t.Fatalf("%s: no email body", kind)
		}
		lines := unfold(gotEv.ICS())
		if v := icsValue(lines, "UID"); v != "UID:abc123@kaammilega.com" {
			t.Errorf("%s: UID = %q", kind, v)
		}
		if v := icsValue(lines, "DTSTART"); v != "DTSTART:20261201T053000Z" {
			t.Errorf("%s: DTSTART = %q", kind, v)
		}
		if v := icsValue(lines, "DTEND"); v != "DTEND:20261201T060000Z" {
			t.Errorf("%s: DTEND = %q", kind, v)
		}
		if v := icsValue(lines, "SEQUENCE"); v != "SEQUENCE:42" {
			t.Errorf("%s: SEQUENCE = %q", kind, v)
		}
		if v := icsValue(lines, "SUMMARY"); v != `SUMMARY:Interview: Driver\, night shift at Aura\; Co` {
			t.Errorf("%s: SUMMARY not escaped: %q", kind, v)
		}
		if v := icsValue(lines, "DESCRIPTION"); !strings.Contains(v, `Bring ID\nArrive early`) {
			t.Errorf("%s: DESCRIPTION newline not escaped: %q", kind, v)
		}
		wantMethod, wantStatus := "METHOD:REQUEST", "STATUS:CONFIRMED"
		if kind == InterviewCancelled {
			wantMethod, wantStatus = "METHOD:CANCEL", "STATUS:CANCELLED"
		}
		if icsValue(lines, "METHOD") != wantMethod || icsValue(lines, "STATUS") != wantStatus {
			t.Errorf("%s: method/status = %q %q", kind, icsValue(lines, "METHOD"), icsValue(lines, "STATUS"))
		}
	}
}

func TestInterviewEmailWithoutIDHasNoInvite(t *testing.T) {
	called := false
	sendCalendar = func(*config.Config, string, string, string, CalendarEvent) error { called = true; return nil }
	defer func() { sendCalendar = deliverCalendar }()
	render(t, func(m *smtpMailer) error {
		return m.SendInterviewInvite(InterviewInviteParams{ToEmail: "c@x.test", JobTitle: "Driver", ScheduledAt: time.Now()})
	})
	if called {
		t.Error("an email without an interview ID should not carry an invite")
	}
}

func TestICSLinesAreFoldedAt75Bytes(t *testing.T) {
	ev := CalendarEvent{UID: "x@kaammilega.com", Start: time.Now(), Summary: strings.Repeat("साक्षात्कार ", 20), Description: strings.Repeat("a", 300)}
	ics := ev.ICS()
	for _, l := range strings.Split(ics, "\r\n") {
		if len(l) > 75 {
			t.Fatalf("line longer than 75 bytes: %d", len(l))
		}
	}
	if got := icsValue(unfold(ics), "SUMMARY"); got != "SUMMARY:"+ev.Summary {
		t.Errorf("folding broke the text: %q", got)
	}
}

func TestCalendarMessageHasHTMLAndInvite(t *testing.T) {
	cfg := &config.Config{SMTPFromName: "KaamMilega", SMTPFromEmail: "no-reply@kaammilega.com"}
	ev := CalendarEvent{UID: "abc@kaammilega.com", Start: time.Now(), Summary: "Interview", Cancelled: true}
	msg := calendarMessage(cfg, "c@x.test", "Interview Cancelled", "<p>hi</p>", ev)
	for _, want := range []string{"multipart/mixed", "multipart/alternative", "text/html", "text/calendar; charset=UTF-8; method=CANCEL", `filename="invite.ics"`} {
		if !strings.Contains(msg, want) {
			t.Errorf("message lacks %q", want)
		}
	}
	if !strings.Contains(msg, base64.StdEncoding.EncodeToString([]byte("<p>hi</p>"))) {
		t.Error("HTML body missing")
	}
}
