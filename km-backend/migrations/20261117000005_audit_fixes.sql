-- Fixes from the 17 Nov database audit.

-- Gig status was the only status column without a list of allowed values (values as in
-- instant_work.JobStatus)
ALTER TABLE app.instant_jobs ADD CONSTRAINT instant_jobs_status_check
    CHECK (status IN ('DISPATCHING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED', 'EXPIRED'));

-- Link columns without an index: lookups by them, and the checks Postgres runs when the row they
-- point at changes, would otherwise read the whole table
CREATE INDEX event_tickets_razorpay_order_idx ON app.event_tickets (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX wallet_withdrawals_wallet_idx ON app.wallet_withdrawals (wallet_id);
CREATE INDEX wallet_disputes_refund_tx_idx ON app.wallet_disputes (refund_transaction_id) WHERE refund_transaction_id IS NOT NULL;

-- Same as every other link: checked at commit, so rows can be written in any order inside a transaction
ALTER TABLE app.event_participants ALTER CONSTRAINT event_participants_event_id_fkey DEFERRABLE INITIALLY DEFERRED;
