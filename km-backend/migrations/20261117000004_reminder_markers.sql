-- "Reminder already sent" markers, so each reminder goes out once (they were fields on the
-- MongoDB documents and were missed in the first migration). The partial indexes cover exactly
-- the rows the reminder worker still has to look at.

ALTER TABLE app.mentorship_bookings ADD COLUMN reminder_sent_at timestamptz;
ALTER TABLE app.event_tickets ADD COLUMN reminder_sent_at timestamptz;
ALTER TABLE app.instant_passes ADD COLUMN expiry_reminder_sent_at timestamptz;

CREATE INDEX mentorship_bookings_reminder_due_idx ON app.mentorship_bookings (scheduled_at)
    WHERE status = 'confirmed' AND reminder_sent_at IS NULL;
CREATE INDEX event_tickets_reminder_due_idx ON app.event_tickets (event_id)
    WHERE status = 'confirmed' AND reminder_sent_at IS NULL;
CREATE INDEX instant_passes_expiry_reminder_due_idx ON app.instant_passes (expires_at)
    WHERE has_active_pass AND expiry_reminder_sent_at IS NULL;
