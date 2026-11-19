-- When the ₹99 pass first paid for a chat the free allowance wouldn't cover (someone who isn't a
-- recruiter, or past the day's free chats). A pass with this set can't be refunded (client answer Q5).

ALTER TABLE app.instant_passes ADD COLUMN benefit_used_at timestamptz;
