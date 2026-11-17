-- Deleting a mentorship keeps the row: its bookings (paid ones included) must keep pointing at
-- it. Deleted mentorships are hidden everywhere.
ALTER TABLE app.mentorships ADD COLUMN deleted_at timestamptz;

-- Reviews are 1 to 5 and may have two decimals
ALTER TABLE app.mentorship_bookings ALTER COLUMN rating TYPE numeric(3, 2);
