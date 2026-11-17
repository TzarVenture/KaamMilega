-- Deleting an event keeps the row: its tickets (paid ones included) are payment records that must
-- keep pointing at it. Deleted events are hidden everywhere in the app.
ALTER TABLE app.events ADD COLUMN deleted_at timestamptz;

CREATE INDEX events_live_created_idx ON app.events (created_at DESC) WHERE deleted_at IS NULL;
DROP INDEX app.events_created_idx;
