-- Coupons and cashback (client answers Q16, Q50). The admin creates codes. A discount coupon
-- lowers the price; a cashback coupon gives bonus credit after the purchase. Codes work on the
-- InstantPass and on recruiter plans.
--
-- Wallet purchases spend bonus credit first and then the main balance. Cashback is only earned on
-- the part paid with real money (main balance or online), so bonus credit never earns more bonus.

CREATE TABLE app.coupons (
    id                app.object_id PRIMARY KEY,
    -- Stored in capitals; customers can type it in any case
    code              text          NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,23}$'),
    description       text          NOT NULL DEFAULT '' CHECK (length(description) <= 200),
    kind              text          NOT NULL CHECK (kind IN ('discount', 'cashback')),
    value_type        text          NOT NULL CHECK (value_type IN ('flat', 'percent')),
    amount_paise      bigint        CHECK (amount_paise > 0),
    percent           integer       CHECK (percent BETWEEN 1 AND 100),
    -- The most one use can be worth, for percent coupons
    max_benefit_paise bigint        CHECK (max_benefit_paise > 0),
    min_order_paise   bigint        NOT NULL DEFAULT 0 CHECK (min_order_paise >= 0),
    applies_to        text[]        NOT NULL CHECK (cardinality(applies_to) > 0
                                        AND applies_to <@ ARRAY['instant_pass', 'recruiter_plan']::text[]),
    starts_at         timestamptz,
    ends_at           timestamptz,
    -- NULL means no limit
    total_limit       integer       CHECK (total_limit > 0),
    per_user_limit    integer       CHECK (per_user_limit > 0),
    -- Coupons are switched off, never deleted, so past uses keep pointing at them
    is_active         boolean       NOT NULL DEFAULT true,
    created_by        app.object_id NOT NULL,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    CHECK ((value_type = 'flat') = (amount_paise IS NOT NULL)),
    CHECK ((value_type = 'percent') = (percent IS NOT NULL)),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

-- One use of a coupon. An online checkout holds a use ("reserved") until its payment arrives or
-- the order expires; a wallet purchase is "redeemed" straight away. A refund "reverses" the use,
-- which gives it back. "released" is a hold that was given up before payment.
--
-- A use counts towards the limits while it is redeemed, or reserved and not yet expired.
CREATE TABLE app.coupon_redemptions (
    id                app.object_id PRIMARY KEY,
    coupon_id         app.object_id NOT NULL REFERENCES app.coupons (id) ON DELETE RESTRICT,
    user_id           app.object_id NOT NULL,
    purpose           text          NOT NULL CHECK (purpose IN ('instant_pass', 'recruiter_plan')),
    channel           text          NOT NULL CHECK (channel IN ('wallet', 'online')),
    status            text          NOT NULL CHECK (status IN ('reserved', 'redeemed', 'released', 'reversed')),
    -- Prices at the time of use, so later coupon edits never change a past purchase
    list_paise        bigint        NOT NULL CHECK (list_paise > 0),
    discount_paise    bigint        NOT NULL DEFAULT 0 CHECK (discount_paise >= 0 AND discount_paise <= list_paise),
    cashback_paise    bigint        NOT NULL DEFAULT 0 CHECK (cashback_paise >= 0),
    razorpay_order_id text          UNIQUE REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    -- What was bought, such as "pass:<id>" or "recruiter_plan:<id>"; set once it is redeemed
    purchase_ref      text          UNIQUE CHECK (length(purchase_ref) BETWEEN 1 AND 80),
    reserved_until    timestamptz,
    redeemed_at       timestamptz,
    reversed_at       timestamptz,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    CHECK (status <> 'reserved' OR reserved_until IS NOT NULL),
    CHECK (status NOT IN ('redeemed', 'reversed') OR (purchase_ref IS NOT NULL AND redeemed_at IS NOT NULL))
);
CREATE INDEX coupon_redemptions_coupon_idx ON app.coupon_redemptions (coupon_id, user_id)
    WHERE status IN ('reserved', 'redeemed');
CREATE INDEX coupon_redemptions_user_idx ON app.coupon_redemptions (user_id, created_at DESC);

CREATE TRIGGER coupons_touch_updated_at BEFORE UPDATE ON app.coupons
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER coupon_redemptions_touch_updated_at BEFORE UPDATE ON app.coupon_redemptions
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE app.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Cashback is credited to the bonus balance, and taken back if the purchase is refunded
ALTER TABLE app.wallet_transactions DROP CONSTRAINT wallet_transactions_category_check;
ALTER TABLE app.wallet_transactions ADD CONSTRAINT wallet_transactions_category_check
    CHECK (category IN ('topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout',
                        'withdrawal', 'bonus_reward', 'refund', 'event_ticket', 'recruiter_plan',
                        'cashback'));
