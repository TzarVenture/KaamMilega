package notification

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/config"
)

// Calendar invites: interview emails carry an .ics event so the candidate can add the interview to
// Google Calendar, Outlook or Apple Calendar in one tap. Each interview keeps one event ID, so a
// reschedule moves the same event and a cancellation removes it.

// InterviewLength is how long the calendar event lasts (interviews have no end time of their own)
const InterviewLength = 30 * time.Minute

// CalendarEvent is one interview as a calendar event
type CalendarEvent struct {
	UID         string // the same for every email about one interview
	Sequence    int64  // goes up with every change, so calendars keep the newest
	Start       time.Time
	Length      time.Duration
	Summary     string
	Description string
	Location    string
	URL         string
	Organizer   string // name shown as the organiser
	FromEmail   string
	ToName      string
	ToEmail     string
	Cancelled   bool
	Stamp       time.Time
}

// Method is the iCalendar method the email carries
func (e CalendarEvent) Method() string {
	if e.Cancelled {
		return "CANCEL"
	}
	return "REQUEST"
}

// icsText escapes text values (RFC 5545 3.3.11)
func icsText(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	r := strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\n", `\n`, "\r", `\n`)
	return r.Replace(s)
}

// icsParam quotes a parameter value such as CN (quotes are not allowed inside)
func icsParam(s string) string {
	s = strings.NewReplacer(`"`, "'", "\r", " ", "\n", " ").Replace(s)
	return `"` + s + `"`
}

// foldLine splits a content line into pieces of at most 75 bytes, never inside a character
func foldLine(line string) string {
	if len(line) <= 75 {
		return line
	}
	var b strings.Builder
	limit := 75
	for len(line) > limit {
		cut := limit
		for cut > 0 && !utf8.RuneStart(line[cut]) {
			cut--
		}
		b.WriteString(line[:cut])
		b.WriteString("\r\n ")
		line = line[cut:]
		limit = 74 // the leading space counts
	}
	b.WriteString(line)
	return b.String()
}

const icsTime = "20060102T150405Z"

// ICS is the event as an iCalendar file
func (e CalendarEvent) ICS() string {
	length := e.Length
	if length <= 0 {
		length = InterviewLength
	}
	status := "CONFIRMED"
	if e.Cancelled {
		status = "CANCELLED"
	}
	stamp := e.Stamp
	if stamp.IsZero() {
		stamp = time.Now()
	}
	lines := []string{
		"BEGIN:VCALENDAR",
		"PRODID:-//KaamMilega//Interviews//EN",
		"VERSION:2.0",
		"CALSCALE:GREGORIAN",
		"METHOD:" + e.Method(),
		"BEGIN:VEVENT",
		"UID:" + e.UID,
		fmt.Sprintf("SEQUENCE:%d", e.Sequence),
		"DTSTAMP:" + stamp.UTC().Format(icsTime),
		"DTSTART:" + e.Start.UTC().Format(icsTime),
		"DTEND:" + e.Start.Add(length).UTC().Format(icsTime),
		"SUMMARY:" + icsText(e.Summary),
		"STATUS:" + status,
		"TRANSP:OPAQUE",
	}
	if e.Description != "" {
		lines = append(lines, "DESCRIPTION:"+icsText(e.Description))
	}
	if e.Location != "" {
		lines = append(lines, "LOCATION:"+icsText(e.Location))
	}
	if e.URL != "" {
		lines = append(lines, "URL:"+e.URL)
	}
	if e.FromEmail != "" {
		lines = append(lines, "ORGANIZER;CN="+icsParam(e.Organizer)+":mailto:"+e.FromEmail)
	}
	if e.ToEmail != "" {
		lines = append(lines, "ATTENDEE;CN="+icsParam(e.ToName)+";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:"+e.ToEmail)
	}
	if !e.Cancelled {
		// A reminder one hour before
		lines = append(lines, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:"+icsText(e.Summary), "TRIGGER:-PT1H", "END:VALARM")
	}
	lines = append(lines, "END:VEVENT", "END:VCALENDAR")
	for i, l := range lines {
		lines[i] = foldLine(l)
	}
	return strings.Join(lines, "\r\n") + "\r\n"
}

// base64Lines encodes data in 76-character lines, as MIME wants
func base64Lines(data string) string {
	enc := base64.StdEncoding.EncodeToString([]byte(data))
	var b strings.Builder
	for len(enc) > 76 {
		b.WriteString(enc[:76])
		b.WriteString("\r\n")
		enc = enc[76:]
	}
	b.WriteString(enc)
	b.WriteString("\r\n")
	return b.String()
}

func mimeBoundary() string {
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	return "km" + hex.EncodeToString(buf)
}

// calendarMessage is the full email: the HTML body and the event (inline for mail apps that show
// invites, and as an invite.ics attachment for the rest)
func calendarMessage(cfg *config.Config, to, subject, htmlBody string, ev CalendarEvent) string {
	mixed, alt := mimeBoundary(), mimeBoundary()
	ics := ev.ICS()
	method := ev.Method()
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\n", cfg.SMTPFromName, cfg.SMTPFromEmail, to, subject)
	fmt.Fprintf(&b, "Content-Type: multipart/mixed; boundary=%q\r\n\r\n", mixed)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: multipart/alternative; boundary=%q\r\n\r\n", mixed, alt)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n%s", alt, base64Lines(htmlBody))
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/calendar; charset=UTF-8; method=%s\r\nContent-Transfer-Encoding: base64\r\n\r\n%s", alt, method, base64Lines(ics))
	fmt.Fprintf(&b, "--%s--\r\n", alt)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: application/ics; name=\"invite.ics\"\r\nContent-Disposition: attachment; filename=\"invite.ics\"\r\nContent-Transfer-Encoding: base64\r\n\r\n%s", mixed, base64Lines(ics))
	fmt.Fprintf(&b, "--%s--\r\n", mixed)
	return b.String()
}

// sendCalendar delivers an email with a calendar event (tests swap it to keep the email instead)
var sendCalendar = deliverCalendar

func deliverCalendar(cfg *config.Config, to, subject, htmlBody string, ev CalendarEvent) error {
	return deliver(cfg, to, calendarMessage(cfg, to, subject, htmlBody, ev))
}

// interviewEvent is the calendar event for an interview email
func interviewEvent(p InterviewInviteParams, fromEmail, link string) CalendarEvent {
	summary := "Interview: " + p.JobTitle
	organizer := "KaamMilega"
	if p.CompanyName != "" {
		summary += " at " + p.CompanyName
		organizer = p.CompanyName + " via KaamMilega"
	}
	var desc []string
	if p.InterviewType != "" {
		desc = append(desc, "Format: "+p.InterviewType)
	}
	if p.Location != "" {
		desc = append(desc, "Location / link: "+p.Location)
	}
	if strings.TrimSpace(p.Notes) != "" {
		desc = append(desc, "Notes: "+strings.TrimSpace(p.Notes))
	}
	desc = append(desc, "See your interviews: "+link)
	return CalendarEvent{
		UID:         p.InterviewID + "@kaammilega.com",
		Sequence:    p.Version,
		Start:       p.ScheduledAt,
		Length:      InterviewLength,
		Summary:     summary,
		Description: strings.Join(desc, "\n"),
		Location:    p.Location,
		URL:         link,
		Organizer:   organizer,
		FromEmail:   fromEmail,
		ToName:      p.CandidateName,
		ToEmail:     p.ToEmail,
		Cancelled:   p.Kind == InterviewCancelled,
		Stamp:       time.Now(),
	}
}
