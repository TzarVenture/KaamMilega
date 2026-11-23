-- Recruiter monthly plans (client answers Q4, Q6, Q49). The admin creates the plans and sets their
-- prices and limits. A recruiter buys one with the wallet or online; buying again while a plan is
-- running queues the new one to start when the current one ends.
--
-- Whether limits are enforced, and the free allowance for recruiters without a plan, are platform
-- settings (MongoDB settings collection, key "recruiter_plans"), so turning enforcement on needs no
-- migration. NULL in a limit column means unlimited.

CREATE TABLE app.recruiter_plans (
    id               app.object_id PRIMARY KEY,
    name             text          NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    description      text          NOT NULL DEFAULT '' CHECK (length(description) <= 300),
    price_paise      bigint        NOT NULL CHECK (price_paise > 0),
    period_days      integer       NOT NULL CHECK (period_days BETWEEN 1 AND 366),
    job_posts        integer       CHECK (job_posts >= 0),
    new_chats        integer       CHECK (new_chats >= 0),
    resume_downloads integer       CHECK (resume_downloads >= 0),
    ai_job_writer    boolean       NOT NULL DEFAULT false,
    sort_order       integer       NOT NULL DEFAULT 0,
    -- Plans are switched off, never deleted, so past subscriptions keep pointing at them
    is_active        boolean       NOT NULL DEFAULT true,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX recruiter_plans_active_idx ON app.recruiter_plans (is_active, sort_order, price_paise);

-- One bought plan. Its limits and price are copied at purchase, so editing a plan later never
-- changes what a recruiter already paid for.
CREATE TABLE app.recruiter_subscriptions (
    id                  app.object_id PRIMARY KEY,
    user_id             app.object_id NOT NULL,
    plan_id             app.object_id NOT NULL REFERENCES app.recruiter_plans (id) ON DELETE RESTRICT,
    plan_name           text          NOT NULL,
    price_paise         bigint        NOT NULL CHECK (price_paise >= 0),
    job_posts           integer       CHECK (job_posts >= 0),
    new_chats           integer       CHECK (new_chats >= 0),
    resume_downloads    integer       CHECK (resume_downloads >= 0),
    ai_job_writer       boolean       NOT NULL DEFAULT false,
    channel             text          NOT NULL CHECK (channel IN ('wallet', 'online')),
    status              text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded')),
    razorpay_order_id   text          UNIQUE REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    razorpay_payment_id text,
    starts_at           timestamptz   NOT NULL,
    expires_at          timestamptz   NOT NULL,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CHECK (expires_at > starts_at),
    CHECK ((channel = 'online') = (razorpay_order_id IS NOT NULL))
);
CREATE INDEX recruiter_subscriptions_user_idx ON app.recruiter_subscriptions (user_id, expires_at DESC)
    WHERE status = 'active';

-- One use of a limited thing. The unique key makes repeats free: a job counts once, and a chat
-- with the same person counts once per plan period. "period" is the subscription id, or
-- "free:YYYY-MM" for the free allowance of a calendar month (India time).
CREATE TABLE app.recruiter_usage (
    id              app.object_id PRIMARY KEY,
    user_id         app.object_id NOT NULL,
    period          text          NOT NULL CHECK (length(period) BETWEEN 1 AND 40),
    subscription_id app.object_id REFERENCES app.recruiter_subscriptions (id) ON DELETE RESTRICT,
    kind            text          NOT NULL CHECK (kind IN ('job_post', 'new_chat', 'resume_download')),
    ref_id          text          NOT NULL CHECK (length(ref_id) BETWEEN 1 AND 64),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (user_id, period, kind, ref_id)
);
CREATE INDEX recruiter_usage_subscription_idx ON app.recruiter_usage (subscription_id) WHERE subscription_id IS NOT NULL;

CREATE TRIGGER recruiter_plans_touch_updated_at BEFORE UPDATE ON app.recruiter_plans
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER recruiter_subscriptions_touch_updated_at BEFORE UPDATE ON app.recruiter_subscriptions
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE app.recruiter_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.recruiter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.recruiter_usage ENABLE ROW LEVEL SECURITY;

-- Plans can be paid online and from the wallet
ALTER TABLE app.payment_orders DROP CONSTRAINT payment_orders_purpose_check;
ALTER TABLE app.payment_orders ADD CONSTRAINT payment_orders_purpose_check
    CHECK (purpose IN ('wallet_topup', 'event_ticket', 'mentorship_booking', 'instant_pass', 'recruiter_plan'));

ALTER TABLE app.wallet_transactions DROP CONSTRAINT wallet_transactions_category_check;
ALTER TABLE app.wallet_transactions ADD CONSTRAINT wallet_transactions_category_check
    CHECK (category IN ('topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout',
                        'withdrawal', 'bonus_reward', 'refund', 'event_ticket', 'recruiter_plan'));
