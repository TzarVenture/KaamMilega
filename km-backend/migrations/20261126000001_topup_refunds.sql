-- Refunds of unspent top-up money (client answer Q11). A member asks for all of their unspent
-- top-up money back; the money is held out of the main balance until an admin decides. When the
-- admin approves, it goes back to the original payments through Razorpay, newest top-up first.
-- Razorpay only refunds payments up to 6 months old, so older top-ups stay spendable but can't be
-- refunded. The company pays Razorpay's fee: the member gets the full amount back.

CREATE TABLE app.wallet_topup_refunds (
    id             app.object_id PRIMARY KEY,
    user_id        app.object_id NOT NULL,
    wallet_id      app.object_id NOT NULL REFERENCES app.wallets (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    -- What was held out of the main balance
    amount_paise   bigint        NOT NULL CHECK (amount_paise > 0),
    status         text          NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'refunded', 'rejected')),
    -- The ledger row that held the money
    reference_id   text          NOT NULL UNIQUE REFERENCES app.wallet_transactions (reference_id) DEFERRABLE INITIALLY DEFERRED,
    -- What was sent back through Razorpay. It can be less than amount_paise when a top-up passed
    -- Razorpay's 6-month limit while the request waited; the rest goes back to the wallet.
    refunded_paise bigint        NOT NULL DEFAULT 0 CHECK (refunded_paise >= 0 AND refunded_paise <= amount_paise),
    -- Which payment orders were refunded and how much of each: [{"order_id": "...", "paise": 100}]
    parts          jsonb         NOT NULL DEFAULT '[]'::jsonb,
    reason         text          NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
    reject_reason  text          CHECK (length(reject_reason) <= 300),
    handled_by     text,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    decided_at     timestamptz,
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CHECK (status = 'requested' OR decided_at IS NOT NULL),
    CHECK (status <> 'rejected' OR reject_reason IS NOT NULL)
);
CREATE INDEX wallet_topup_refunds_user_created_idx ON app.wallet_topup_refunds (user_id, created_at DESC);
CREATE INDEX wallet_topup_refunds_status_created_idx ON app.wallet_topup_refunds (status, created_at);
-- At most one waiting request per member, enforced by the database
CREATE UNIQUE INDEX wallet_topup_refunds_one_open_idx ON app.wallet_topup_refunds (user_id)
    WHERE status = 'requested';
