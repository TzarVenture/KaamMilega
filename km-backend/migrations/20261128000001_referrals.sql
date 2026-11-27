-- Referral rewards (client answers Q31-Q36; rules agreed 27 Nov 2026). Every member has a code to
-- invite people with. A referral counts once the new member makes their first real payment, and is
-- rewarded 30 days later if that money wasn't refunded. Normal members get an amount the admin sets
-- (wallet credit). Admin-approved aggregators get ₹5,000 for every 20 such referrals: half as
-- wallet credit, half recorded as cash owed until cash payouts are built.

-- Each member's own invite code, made the first time they open their referral page
CREATE TABLE app.referral_codes (
    user_id    app.object_id PRIMARY KEY,
    code       text          NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,12}$'),
    created_at timestamptz   NOT NULL DEFAULT now()
);

-- Members the admin approved as aggregators. Removing one keeps the row with active = false so
-- their history stays readable.
CREATE TABLE app.referral_aggregators (
    user_id     app.object_id PRIMARY KEY,
    active      boolean       NOT NULL DEFAULT true,
    note        text          NOT NULL DEFAULT '' CHECK (length(note) <= 200),
    approved_by text          NOT NULL,
    approved_at timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);

-- One aggregator reward: a group of referrals. The credit half went into the wallet; the cash half
-- is owed until an admin records it as paid outside the app.
CREATE TABLE app.referral_payouts (
    id           app.object_id PRIMARY KEY,
    user_id      app.object_id NOT NULL,
    batch_no     integer       NOT NULL CHECK (batch_no > 0),
    referrals    integer       NOT NULL CHECK (referrals > 0),
    credit_paise bigint        NOT NULL CHECK (credit_paise >= 0),
    cash_paise   bigint        NOT NULL CHECK (cash_paise >= 0),
    cash_paid_at timestamptz,
    cash_paid_by text,
    cash_note    text          NOT NULL DEFAULT '' CHECK (length(cash_note) <= 200),
    created_at   timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (user_id, batch_no),
    CHECK ((cash_paid_at IS NULL) = (cash_paid_by IS NULL))
);
CREATE INDEX referral_payouts_cash_owed_idx ON app.referral_payouts (created_at) WHERE cash_paid_at IS NULL AND cash_paise > 0;

-- One row per invited member: who invited them and how far along the reward is
--   pending   signed up with a code, hasn't paid for anything yet
--   paid      made their first real payment; waiting out the 30 days
--   released  the 30 days passed with the money still spent: rewarded (or counted for an aggregator)
--   cancelled the money was refunded, or the account was erased
CREATE TABLE app.referrals (
    id            app.object_id PRIMARY KEY,
    referrer_id   app.object_id NOT NULL,
    referred_id   app.object_id NOT NULL UNIQUE,
    status        text          NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'released', 'cancelled')),
    -- The first real payment: a payment order id or a wallet ledger reference
    first_payment text,
    paid_at       timestamptz,
    release_at    timestamptz,
    released_at   timestamptz,
    -- What the referrer got: a member reward, a count towards an aggregator group, or nothing
    -- (the member amount was 0 then)
    reward_kind   text          CHECK (reward_kind IN ('member', 'aggregator', 'none')),
    reward_paise  bigint        NOT NULL DEFAULT 0 CHECK (reward_paise >= 0),
    payout_id     app.object_id REFERENCES app.referral_payouts (id),
    cancel_reason text,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    updated_at    timestamptz   NOT NULL DEFAULT now(),
    CHECK (referrer_id <> referred_id),
    CHECK (status = 'pending' OR status = 'cancelled' OR (paid_at IS NOT NULL AND release_at IS NOT NULL)),
    CHECK (status <> 'released' OR (released_at IS NOT NULL AND reward_kind IS NOT NULL)),
    CHECK (payout_id IS NULL OR reward_kind = 'aggregator')
);
CREATE INDEX referrals_referrer_idx ON app.referrals (referrer_id, created_at DESC);
CREATE INDEX referrals_pending_idx ON app.referrals (created_at) WHERE status = 'pending';
CREATE INDEX referrals_due_idx ON app.referrals (release_at) WHERE status = 'paid';
CREATE INDEX referrals_unbatched_idx ON app.referrals (referrer_id, released_at)
    WHERE reward_kind = 'aggregator' AND payout_id IS NULL;

-- Referral rewards are their own kind of wallet credit
ALTER TABLE app.wallet_transactions DROP CONSTRAINT wallet_transactions_category_check;
ALTER TABLE app.wallet_transactions ADD CONSTRAINT wallet_transactions_category_check
    CHECK (category IN ('topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout',
                        'withdrawal', 'bonus_reward', 'refund', 'event_ticket', 'recruiter_plan',
                        'cashback', 'recruiter_ad', 'referral_reward'));
