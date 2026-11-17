-- The paid Expert plans (₹499 a month, ₹4,499 a year) were retired on 29 Oct: an expert now needs
-- 2+ years of experience, the ₹99 InstantPass and an admin-approved KYC application. Nothing
-- reads or writes plans any more, so the table and the 'subscription' payment kinds go.

DROP TABLE app.expert_subscriptions;

-- The only plan order ever paid (a test account, 16 Nov). Its money record is kept in the
-- 17 Nov backup; removing it lets the allowed payment kinds below be tightened.
DELETE FROM app.payment_orders WHERE purpose = 'subscription';

ALTER TABLE app.payment_orders DROP CONSTRAINT payment_orders_purpose_check;
ALTER TABLE app.payment_orders ADD CONSTRAINT payment_orders_purpose_check
    CHECK (purpose IN ('wallet_topup', 'event_ticket', 'mentorship_booking', 'instant_pass'));

-- No wallet entry ever used 'subscription' (checked 17 Nov), so the ledger keeps its full history
ALTER TABLE app.wallet_transactions DROP CONSTRAINT wallet_transactions_category_check;
ALTER TABLE app.wallet_transactions ADD CONSTRAINT wallet_transactions_category_check
    CHECK (category IN ('topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout',
                        'withdrawal', 'bonus_reward', 'refund', 'event_ticket'));
