-- Renewing early adds a second active plan that starts when the current one ends, so a user can
-- have more than one active row. Double purchases are stopped by a per-user lock in the app
-- instead (the purchase transaction takes pg_advisory_xact_lock for the user).
DROP INDEX app.expert_subscriptions_one_active_idx;

CREATE INDEX expert_subscriptions_user_active_idx ON app.expert_subscriptions (user_id, expires_at DESC)
    WHERE status = 'active';
