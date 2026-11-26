-- Recruiter self-serve ads (F89). The admin sets ad packages (a number of days at a price, shown
-- in the slots the admin picks). A recruiter writes an ad, pays for a package from the wallet or
-- online, and an admin approves the ad before it runs. The days count from approval. A rejected
-- ad is refunded in full to the KaamMilega wallet. Approved ads run as MongoDB ad campaigns like
-- the admin's own; the money and the review queue live here.

CREATE TABLE app.ad_packages (
    id          app.object_id PRIMARY KEY,
    name        text          NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    description text          NOT NULL DEFAULT '' CHECK (length(description) <= 300),
    days        integer       NOT NULL CHECK (days BETWEEN 1 AND 366),
    price_paise bigint        NOT NULL CHECK (price_paise > 0),
    -- Slot ids from the ads placements list
    placements  text[]        NOT NULL CHECK (cardinality(placements) > 0),
    sort_order  integer       NOT NULL DEFAULT 0,
    -- Packages are switched off, never deleted, so bought ads keep pointing at them
    is_active   boolean       NOT NULL DEFAULT true,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ad_packages_active_idx ON app.ad_packages (is_active, sort_order, price_paise);

-- One recruiter ad. The package's days, slots and price are copied at purchase, so editing a
-- package later never changes what was bought.
--   unpaid:   written, online payment not finished (never reviewed, never shown)
--   pending:  paid, waiting for an admin
--   approved: running (or ended) as the MongoDB campaign campaign_id
--   rejected: refused by an admin and refunded to the wallet
--   refunded: refunded by an admin from a wallet dispute
CREATE TABLE app.recruiter_ads (
    id                 app.object_id PRIMARY KEY,
    user_id            app.object_id NOT NULL,
    package_id         app.object_id NOT NULL REFERENCES app.ad_packages (id) ON DELETE RESTRICT,
    package_name       text          NOT NULL,
    days               integer       NOT NULL CHECK (days BETWEEN 1 AND 366),
    placements         text[]        NOT NULL CHECK (cardinality(placements) > 0),

    advertiser         text          NOT NULL CHECK (length(advertiser) BETWEEN 1 AND 80),
    headline           text          NOT NULL CHECK (length(headline) BETWEEN 1 AND 80),
    body               text          NOT NULL DEFAULT '' CHECK (length(body) <= 160),
    cta_label          text          NOT NULL DEFAULT '' CHECK (length(cta_label) <= 24),
    image_url          text          NOT NULL CHECK (length(image_url) BETWEEN 1 AND 1000),
    link_url           text          NOT NULL CHECK (length(link_url) BETWEEN 1 AND 1000),
    cities             text[]        NOT NULL DEFAULT '{}',
    audiences          text[]        NOT NULL DEFAULT '{}'
        CHECK (audiences <@ ARRAY['guest', 'user', 'recruiter', 'expert']::text[]),

    status             text          NOT NULL DEFAULT 'unpaid'
        CHECK (status IN ('unpaid', 'pending', 'approved', 'rejected', 'refunded')),
    channel            text          CHECK (channel IN ('wallet', 'online')),
    -- What was paid: the price after any coupon, and how the wallet part was split
    price_paise        bigint        NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
    paid_bonus_paise   bigint        NOT NULL DEFAULT 0 CHECK (paid_bonus_paise >= 0),
    paid_main_paise    bigint        NOT NULL DEFAULT 0 CHECK (paid_main_paise >= 0),
    paid_online_paise  bigint        NOT NULL DEFAULT 0 CHECK (paid_online_paise >= 0),
    razorpay_order_id  text          UNIQUE REFERENCES app.payment_orders (razorpay_order_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    -- What went back to the wallet on rejection
    refunded_paise     bigint        NOT NULL DEFAULT 0 CHECK (refunded_paise >= 0),

    -- The MongoDB campaign that runs the ad once approved
    campaign_id        app.object_id UNIQUE,
    starts_at          timestamptz,
    ends_at            timestamptz,

    -- A change to an approved ad waiting for an admin; the approved version keeps running meanwhile
    revision           jsonb,
    revision_at        timestamptz,
    -- Why the last change was refused (shown to the recruiter until the next change)
    revision_note      text          CHECK (length(revision_note) <= 300),

    reject_reason      text          CHECK (length(reject_reason) <= 300),
    handled_by         text,
    paid_at            timestamptz,
    decided_at         timestamptz,
    created_at         timestamptz   NOT NULL DEFAULT now(),
    updated_at         timestamptz   NOT NULL DEFAULT now(),

    CHECK (status = 'unpaid' OR channel IS NOT NULL),
    CHECK (status = 'unpaid' OR price_paise = paid_bonus_paise + paid_main_paise + paid_online_paise),
    CHECK (status <> 'approved' OR (campaign_id IS NOT NULL AND ends_at > starts_at)),
    CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),
    CHECK (revision IS NULL OR status = 'approved')
);
CREATE INDEX recruiter_ads_user_created_idx ON app.recruiter_ads (user_id, created_at DESC);
CREATE INDEX recruiter_ads_status_created_idx ON app.recruiter_ads (status, paid_at);
CREATE INDEX recruiter_ads_revision_idx ON app.recruiter_ads (revision_at) WHERE revision IS NOT NULL;

CREATE TRIGGER ad_packages_touch_updated_at BEFORE UPDATE ON app.ad_packages
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER recruiter_ads_touch_updated_at BEFORE UPDATE ON app.recruiter_ads
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE app.ad_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.recruiter_ads ENABLE ROW LEVEL SECURITY;

-- Ad packages can be paid online, from the wallet, and with coupons
ALTER TABLE app.payment_orders DROP CONSTRAINT payment_orders_purpose_check;
ALTER TABLE app.payment_orders ADD CONSTRAINT payment_orders_purpose_check
    CHECK (purpose IN ('wallet_topup', 'event_ticket', 'mentorship_booking', 'instant_pass', 'recruiter_plan',
                       'recruiter_ad'));

ALTER TABLE app.wallet_transactions DROP CONSTRAINT wallet_transactions_category_check;
ALTER TABLE app.wallet_transactions ADD CONSTRAINT wallet_transactions_category_check
    CHECK (category IN ('topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout',
                        'withdrawal', 'bonus_reward', 'refund', 'event_ticket', 'recruiter_plan',
                        'cashback', 'recruiter_ad'));

ALTER TABLE app.coupons DROP CONSTRAINT coupons_applies_to_check;
ALTER TABLE app.coupons ADD CONSTRAINT coupons_applies_to_check
    CHECK (cardinality(applies_to) > 0
           AND applies_to <@ ARRAY['instant_pass', 'recruiter_plan', 'recruiter_ad']::text[]);

ALTER TABLE app.coupon_redemptions DROP CONSTRAINT coupon_redemptions_purpose_check;
ALTER TABLE app.coupon_redemptions ADD CONSTRAINT coupon_redemptions_purpose_check
    CHECK (purpose IN ('instant_pass', 'recruiter_plan', 'recruiter_ad'));
