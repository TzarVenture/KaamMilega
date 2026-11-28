package notification

import "fmt"

// StaleJobParams is the reminder about a job that has been open a long time, or the notice
// that it was paused because nobody answered the reminder
type StaleJobParams struct {
	ToEmail       string
	RecruiterName string
	JobTitle      string
	OpenDays      int
	// PauseInDays: how long until it is paused (reminder); Paused: it has been paused now
	PauseInDays int
	Paused      bool
	ActionURL   string
}

func (m *smtpMailer) SendStaleJob(p StaleJobParams) error {
	if p.RecruiterName == "" {
		p.RecruiterName = "there"
	}
	if p.ActionURL == "" {
		p.ActionURL = m.siteURL("/recruiter/jobs/list")
	}
	subject := fmt.Sprintf("Is %s still hiring?", p.JobTitle)
	intro := fmt.Sprintf("Your job %s has been open for %d days. If you're still hiring, tap Keep it open. If not, we'll pause it in %s so job seekers don't apply to a job that's filled.",
		p.JobTitle, p.OpenDays, plural(p.PauseInDays, "day", "days"))
	cta := "Keep it open"
	if p.Paused {
		subject = fmt.Sprintf("We paused %s", p.JobTitle)
		intro = fmt.Sprintf("Your job %s was open for %d days and we didn't hear back, so we paused it. Job seekers can't see it now. You can open it again any time.", p.JobTitle, p.OpenDays)
		cta = "Open it again"
	}
	body, err := renderTemplate(m.templates, "recruiter_notice", templateData{
		RecipientName: p.RecruiterName,
		Intro:         intro,
		Rows:          []tableRow{{Label: "Job", Value: p.JobTitle, Bold: true}, {Label: "Open for", Value: plural(p.OpenDays, "day", "days")}},
		CTAURL:        p.ActionURL,
		CTALabel:      cta,
	})
	if err != nil {
		return fmt.Errorf("notification: render stale job: %w", err)
	}
	return m.SendRaw(p.ToEmail, subject, body)
}
