-- Money and everything money buys, moved from MongoDB to Postgres so that a purchase (the money
-- change plus the ticket, booking, plan or pass) commits in ONE ACID transaction.
--
-- Conventions
--   * Everything lives in schema "app", which Supabase's public Data API does not expose; RLS is
--     still enabled on every table with no policies, so the anon/authenticated keys can read nothing.
--     The backend connects as the database owner, which bypasses RLS.
--   * Ids keep the existing 24-character MongoDB ObjectId format, so API ids and links don't change
--     and user ids (users stay in MongoDB) look the same everywhere. ObjectIds are time-ordered.
--   * user_id / expert_id / recruiter_id point at MongoDB users, so they can't have foreign keys.
--     Every reference between tables in this file is a real foreign key.
--   * Money is bigint paise. Never floating point.
--   * Times are timestamptz (stored UTC).
--   * Enumerations are text + CHECK: easy to extend in a later migration, unlike Postgres enums.

CREATE SCHEMA IF NOT EXISTS app;

CREATE DOMAIN app.object_id AS text
    CHECK (VALUE ~ '^[0-9a-f]{24}$');

-- Keeps updated_at honest even for writes that forget it
CREATE FUNCTION app.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Wallet
-- ---------------------------------------------------------------------------------------------

CREATE TABLE app.wallets (
    id             app.object_id PRIMARY KEY,
    user_id        app.object_id NOT NULL UNIQUE,
    main_paise     bigint        NOT NULL DEFAULT 0 CHECK (main_paise >= 0),
    earnings_paise bigint        NOT NULL DEFAULT 0 CHECK (earnings_paise >= 0),
    locked_paise   bigint        NOT NULL DEFAULT 0 CHECK (locked_paise >= 0),
    bonus_paise    bigint        NOT NULL DEFAULT 0 CHECK (bonus_paise >= 0),
    currency       char(3)       NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    status         text          NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'frozen', 'suspended', 'closed')),
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now()
);

-- The ledger: one row per balance change. Rows are never deleted; only status moves on.
CREATE TABLE app.wallet_transactions (
    id                  app.object_id PRIMARY KEY,
    wallet_id           app.object_id NOT NULL REFERENCES app.wallets (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    user_id             app.object_id NOT NULL,
    type                text          NOT NULL CHECK (type IN ('credit', 'debit')),
    target_balance      text          NOT NULL CHECK (target_balance IN ('main', 'earnings', 'locked', 'bonus')),
    category            text          NOT NULL CHECK (category IN (
        'topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout', 'withdrawal',
        'bonus_reward', 'refund', 'subscription', 'event_ticket')),
    amount_paise        bigint        NOT NULL CHECK (amount_paise > 0),
    balance_after_paise bigint        NOT NULL CHECK (balance_after_paise >= 0),
    status              text          NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'pending', 'failed', 'reversed')),
    -- Idempotency key: the same action posted twice changes the balance once
    reference_id        text          NOT NULL UNIQUE CHECK (reference_id <> ''),
    description         text          NOT NULL DEFAULT '',
    metadata            jsonb,
    created_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX wallet_transactions_wallet_created_idx ON app.wallet_transactions (wallet_id, created_at DESC, id DESC);
CREATE INDEX wallet_transactions_user_idx ON app.wallet_transactions (user_id);

CREATE TABLE app.wallet_withdrawals (
    id             app.object_id PRIMARY KEY,
    user_id        app.object_id NOT NULL,
    wallet_id      app.object_id NOT NULL REFERENCES app.wallets (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    amount_paise   bigint        NOT NULL CHECK (amount_paise > 0),
    status         text          NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'processing', 'paid', 'failed')),
    payout_method  text          NOT NULL CHECK (payout_method IN ('bank', 'upi')),
    account_holder text          NOT NULL,
    account_last4  text,
    ifsc           text,
    upi_id         text,
    -- The ledger row that took the money out of earnings
    reference_id   text          NOT NULL UNIQUE REFERENCES app.wallet_transactions (reference_id) DEFERRABLE INITIALLY DEFERRED,
    bank_reference text,
    failure_reason text,
    handled_by     text,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    processing_at  timestamptz,
    paid_at        timestamptz,
    failed_at      timestamptz,
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CHECK (status <> 'paid' OR paid_at IS NOT NULL),
    CHECK (status <> 'failed' OR failed_at IS NOT NULL)
);
CREATE INDEX wallet_withdrawals_user_created_idx ON app.wallet_withdrawals (user_id, created_at DESC);
CREATE INDEX wallet_withdrawals_status_created_idx ON app.wallet_withdrawals (status, created_at);
-- At most one withdrawal in progress per user, enforced by the database
CREATE UNIQUE INDEX wallet_withdrawals_one_open_idx ON app.wallet_withdrawals (user_id)
    WHERE status IN ('requested', 'processing');

CREATE TABLE app.wallet_disputes (
    id                    app.object_id PRIMARY KEY,
    user_id               app.object_id NOT NULL,
    user_name             text          NOT NULL DEFAULT '',
    user_email            text          NOT NULL DEFAULT '',
    -- One dispute per ledger row
    transaction_id        app.object_id NOT NULL UNIQUE REFERENCES app.wallet_transactions (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    reference_id          text          NOT NULL,
    amount_paise          bigint        NOT NULL CHECK (amount_paise > 0),
    refund_paise          bigint        NOT NULL DEFAULT 0 CHECK (refund_paise >= 0 AND refund_paise <= amount_paise),
    target_balance        text          NOT NULL CHECK (target_balance IN ('main', 'earnings', 'locked', 'bonus')),
    category              text          NOT NULL,
    reason                text          NOT NULL CHECK (reason IN (
        'session_cancelled', 'service_not_provided', 'duplicate_charge', 'technical_failure', 'dissatisfied', 'other')),
    description           text          NOT NULL,
    status                text          NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    admin_notes           text,
    refund_transaction_id app.object_id REFERENCES app.wallet_transactions (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    resolved_by           text,
    resolved_at           timestamptz,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX wallet_disputes_user_created_idx ON app.wallet_disputes (user_id, created_at DESC);
CREATE INDEX wallet_disputes_status_created_idx ON app.wallet_disputes (status, created_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Razorpay orders
-- ---------------------------------------------------------------------------------------------

CREATE TABLE app.payment_orders (
    id                  app.object_id PRIMARY KEY,
    razorpay_order_id   text          NOT NULL UNIQUE,
    razorpay_payment_id text          UNIQUE, -- NULLs don't collide, so only real payment ids are unique
    user_id             app.object_id NOT NULL,
    purpose             text          NOT NULL CHECK (purpose IN (
        'wallet_topup', 'event_ticket', 'mentorship_booking', 'subscription', 'instant_pass')),
    amount_paise        bigint        NOT NULL CHECK (amount_paise > 0),
    currency            char(3)       NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    target_id           text,
    details             jsonb,
    description         text,
    status              text          NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'paid', 'expired', 'refund_due', 'refunded')),
    last_failure        text,
    refund_paise        bigint        NOT NULL DEFAULT 0 CHECK (refund_paise >= 0 AND refund_paise <= amount_paise),
    refund_reason       text,
    refund_id           text,
    refund_error        text,
    paid_at             timestamptz,
    refunded_at         timestamptz,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CHECK (status IN ('created', 'expired') OR razorpay_payment_id IS NOT NULL)
);
CREATE INDEX payment_orders_status_created_idx ON app.payment_orders (status, created_at);
CREATE INDEX payment_orders_user_purpose_paid_idx ON app.payment_orders (user_id, purpose, paid_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------------------------

CREATE TABLE app.events (
    id              app.object_id PRIMARY KEY,
    title           text          NOT NULL,
    organizer       text          NOT NULL DEFAULT '',
    organizer_id    app.object_id,
    description     text          NOT NULL DEFAULT '',
    date            text          NOT NULL DEFAULT '', -- Kept as entered (same as before the move)
    time            text          NOT NULL DEFAULT '',
    location        text          NOT NULL DEFAULT '',
    meeting_link    text,
    image_url       text,
    category        text,
    is_paid         boolean       NOT NULL DEFAULT false,
    price_paise     bigint        NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
    currency        char(3)       NOT NULL DEFAULT 'INR',
    capacity        integer       NOT NULL DEFAULT 0 CHECK (capacity >= 0), -- 0 = unlimited
    available_seats integer       NOT NULL DEFAULT 0 CHECK (available_seats >= 0),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    CHECK (capacity = 0 OR available_seats <= capacity)
);
CREATE INDEX events_organizer_idx ON app.events (organizer_id);
CREATE INDEX events_created_idx ON app.events (created_at DESC);

-- Who registered for an event (was the participants array)
CREATE TABLE app.event_participants (
    event_id   app.object_id NOT NULL REFERENCES app.events (id) ON DELETE CASCADE,
    user_id    app.object_id NOT NULL,
    created_at timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);
CREATE INDEX event_participants_user_idx ON app.event_participants (user_id);

CREATE TABLE app.event_tickets (
    id                  app.object_id PRIMARY KEY,
    ticket_number       text          NOT NULL UNIQUE,
    event_id            app.object_id NOT NULL REFERENCES app.events (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    user_id             app.object_id NOT NULL,
    attendee_name       text          NOT NULL DEFAULT '',
    attendee_email      text          NOT NULL DEFAULT '',
    attendee_phone      text,
    amount_paise        bigint        NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
    payment_status      text          NOT NULL CHECK (payment_status IN ('free', 'paid', 'refunded')),
    payment_method      text          NOT NULL CHECK (payment_method IN ('free', 'razorpay', 'wallet')),
    razorpay_order_id   text          REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    razorpay_payment_id text,
    status              text          NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    qr_code_data        text          NOT NULL DEFAULT '',
    event_title         text,
    event_date          text,
    event_time          text,
    event_location      text,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now()
);
-- One live ticket per person per event
CREATE UNIQUE INDEX event_tickets_one_confirmed_idx ON app.event_tickets (event_id, user_id) WHERE status = 'confirmed';
CREATE INDEX event_tickets_user_created_idx ON app.event_tickets (user_id, created_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Mentorship
-- ---------------------------------------------------------------------------------------------

CREATE TABLE app.mentorships (
    id          app.object_id PRIMARY KEY,
    expert_id   app.object_id NOT NULL,
    title       text          NOT NULL,
    description text          NOT NULL DEFAULT '',
    category    text          NOT NULL DEFAULT '',
    duration    integer       NOT NULL CHECK (duration > 0), -- minutes
    price_paise bigint        NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
    rating      numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    reviews     integer       NOT NULL DEFAULT 0 CHECK (reviews >= 0),
    status      text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX mentorships_expert_idx ON app.mentorships (expert_id);
CREATE INDEX mentorships_status_created_idx ON app.mentorships (status, created_at DESC);

CREATE TABLE app.expert_availability (
    id          app.object_id PRIMARY KEY,
    expert_id   app.object_id NOT NULL,
    day_of_week smallint      NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    start_time  time          NOT NULL,
    end_time    time          NOT NULL,
    is_active   boolean       NOT NULL DEFAULT true,
    CHECK (end_time > start_time)
);
CREATE INDEX expert_availability_expert_idx ON app.expert_availability (expert_id, day_of_week);

CREATE TABLE app.mentorship_bookings (
    id                  app.object_id PRIMARY KEY,
    mentorship_id       app.object_id NOT NULL REFERENCES app.mentorships (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    expert_id           app.object_id NOT NULL,
    user_id             app.object_id NOT NULL,
    scheduled_at        timestamptz   NOT NULL,
    status              text          NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'awaiting_confirmation', 'reported', 'completed', 'cancelled')),
    amount_paise        bigint        NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
    payment_status      text          NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    payment_method      text          CHECK (payment_method IN ('wallet', 'razorpay')),
    razorpay_order_id   text          UNIQUE REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    razorpay_payment_id text,
    release_after       timestamptz,
    report_reason       text,
    reported_at         timestamptz,
    resolution_note     text,
    meeting_link        text,
    notes               text,
    rating              numeric(2, 1) CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    review              text,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX mentorship_bookings_user_scheduled_idx ON app.mentorship_bookings (user_id, scheduled_at DESC);
CREATE INDEX mentorship_bookings_expert_scheduled_idx ON app.mentorship_bookings (expert_id, scheduled_at DESC);
CREATE INDEX mentorship_bookings_mentorship_idx ON app.mentorship_bookings (mentorship_id);
CREATE INDEX mentorship_bookings_release_idx ON app.mentorship_bookings (release_after)
    WHERE status IN ('confirmed', 'awaiting_confirmation');

-- ---------------------------------------------------------------------------------------------
-- Expert subscriptions
-- ---------------------------------------------------------------------------------------------

CREATE TABLE app.expert_subscriptions (
    id                  app.object_id PRIMARY KEY,
    user_id             app.object_id NOT NULL,
    plan_type           text          NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
    amount_paise        bigint        NOT NULL CHECK (amount_paise >= 0),
    payment_method      text          NOT NULL CHECK (payment_method IN ('razorpay', 'wallet')),
    payment_status      text          NOT NULL CHECK (payment_status IN ('paid', 'pending', 'refunded')),
    status              text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    razorpay_order_id   text          UNIQUE REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    razorpay_payment_id text,
    starts_at           timestamptz   NOT NULL,
    expires_at          timestamptz   NOT NULL,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CHECK (expires_at > starts_at)
);
CREATE INDEX expert_subscriptions_user_expires_idx ON app.expert_subscriptions (user_id, expires_at DESC);
CREATE UNIQUE INDEX expert_subscriptions_one_active_idx ON app.expert_subscriptions (user_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------------------------
-- Instant work (location search uses PostGIS, which Supabase ships)
-- ---------------------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE app.instant_workers (
    id                app.object_id PRIMARY KEY,
    user_id           app.object_id NOT NULL UNIQUE,
    name              text          NOT NULL DEFAULT '',
    avatar            text          NOT NULL DEFAULT '',
    mobile            text          NOT NULL DEFAULT '',
    active_skill      text          NOT NULL DEFAULT '',
    hourly_rate_paise bigint        NOT NULL DEFAULT 0 CHECK (hourly_rate_paise >= 0),
    rating            numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    total_gigs        integer       NOT NULL DEFAULT 0 CHECK (total_gigs >= 0),
    location          extensions.geography(Point, 4326),
    is_free_now       boolean       NOT NULL DEFAULT false,
    last_ping_at      timestamptz,
    quota_remaining   integer       NOT NULL DEFAULT 0 CHECK (quota_remaining >= 0),
    pass_expires_at   timestamptz,
    updated_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX instant_workers_location_idx ON app.instant_workers USING gist (location);
CREATE INDEX instant_workers_free_ping_idx ON app.instant_workers (is_free_now, last_ping_at DESC);
CREATE INDEX instant_workers_skill_free_idx ON app.instant_workers (active_skill, is_free_now);

CREATE TABLE app.instant_passes (
    id                  app.object_id PRIMARY KEY,
    user_id             app.object_id NOT NULL,
    has_active_pass     boolean       NOT NULL DEFAULT true,
    channel             text,
    ended_reason        text,
    quota_total         integer       NOT NULL CHECK (quota_total > 0),
    quota_remaining     integer       NOT NULL CHECK (quota_remaining >= 0),
    price_paise         bigint        NOT NULL CHECK (price_paise >= 0),
    razorpay_order_id   text          UNIQUE REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    razorpay_payment_id text,
    activated_at        timestamptz   NOT NULL,
    expires_at          timestamptz   NOT NULL,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CHECK (quota_remaining <= quota_total),
    CHECK (expires_at > activated_at)
);
-- At most one current pass per user, so two purchases at the same moment can't both win
CREATE UNIQUE INDEX instant_passes_one_current_idx ON app.instant_passes (user_id) WHERE has_active_pass;
CREATE INDEX instant_passes_user_expires_idx ON app.instant_passes (user_id, expires_at DESC);

CREATE TABLE app.instant_jobs (
    id               app.object_id PRIMARY KEY,
    recruiter_id     app.object_id NOT NULL,
    recruiter_name   text          NOT NULL DEFAULT '',
    recruiter_mobile text,
    company_name     text          NOT NULL DEFAULT '',
    skill            text          NOT NULL,
    location         extensions.geography(Point, 4326) NOT NULL,
    address          text          NOT NULL DEFAULT '',
    pay_rate_paise   bigint        NOT NULL CHECK (pay_rate_paise >= 0),
    rate_type        text          NOT NULL CHECK (rate_type IN ('hourly', 'flat')),
    duration_hours   integer       NOT NULL DEFAULT 0 CHECK (duration_hours >= 0),
    required_workers integer       NOT NULL DEFAULT 1 CHECK (required_workers > 0),
    notes            text          NOT NULL DEFAULT '',
    status           text          NOT NULL,
    candidate_id     app.object_id,
    candidate_name   text,
    candidate_mobile text,
    matched_at       timestamptz,
    completed_at     timestamptz,
    closed_at        timestamptz,
    cancelled_at     timestamptz,
    expires_at       timestamptz   NOT NULL,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX instant_jobs_location_idx ON app.instant_jobs USING gist (location);
CREATE INDEX instant_jobs_status_expires_idx ON app.instant_jobs (status, expires_at DESC);
CREATE INDEX instant_jobs_candidate_status_idx ON app.instant_jobs (candidate_id, status);
CREATE INDEX instant_jobs_recruiter_status_idx ON app.instant_jobs (recruiter_id, status);

-- ---------------------------------------------------------------------------------------------
-- updated_at triggers and lock-down
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'wallets', 'wallet_withdrawals', 'wallet_disputes', 'payment_orders', 'events', 'event_tickets',
        'mentorships', 'mentorship_bookings', 'expert_subscriptions', 'instant_workers', 'instant_passes',
        'instant_jobs']
    LOOP
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()',
                       t || '_touch_updated_at', t);
    END LOOP;

    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'app'
    LOOP
        EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END;
$$;

-- Supabase's API roles get nothing in this schema
REVOKE ALL ON SCHEMA app FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated;
