# Referrals API

Members invite people with a link (`/?ref=CODE`). A referral **counts** once the new member's first real payment
is `wait_days` old (default 30) and the money wasn't refunded. Migration: `20261128000001_referrals.sql`.

## Rules

- **Real payment**: any paid online order except a wallet top-up, or spending from the wallet's main balance on a
  purchase (pass, session, event ticket, recruiter plan, recruiter ad). Bonus-balance spending doesn't count.
- **Linking**: the new account sends the code within 24 hours of joining and before its first payment. Own code,
  a second inviter, or an inactive inviter are refused. Sending the same code again is fine.
- **Refunds**: when the wait ends, the member's net spend (purchases minus purchase refunds) must still be above ₹0,
  otherwise the referral is cancelled (`cancel_reason = "refunded"`).
- **Normal members**: `member_reward` of wallet bonus credit per counted referral (₹0 = off).
- **Aggregators** (approved by an admin): every `aggregator_group` counted referrals (default 20) form one reward:
  `aggregator_credit` added to the wallet bonus balance, and `aggregator_cash` recorded as owed. The admin pays
  the cash outside the app and marks it paid. Aggregators don't get the per-referral member reward.
- Removing an aggregator: referrals counted after that are normal-member ones. Referrals already counted towards
  a group stay there and form groups again if they are approved again.
- A background job does the checks every 10 minutes (first run 3 minutes after start).
- Erasing an account cancels its unfinished referrals on both sides, deletes its code and removes aggregator status.
  Cash still owed shows as a warning before deletion.

## Member

| Method | Path | Body | Answer |
| --- | --- | --- | --- |
| GET | `/api/referrals` | | `{enabled, code, is_aggregator, member_reward, wait_days, counts{joined,waiting,released,cancelled}, earned, aggregator?{group_size,credit,cash,towards_next,groups,cash_owed,cash_received}, people[{first_name,status,joined_at,release_at?,reward}]}` |
| POST | `/api/referrals/claim` | `{code}` | 204 |

Claim errors (400): `REFERRAL_DISABLED`, `REFERRAL_OWN_CODE`, `REFERRAL_ALREADY_LINKED`, `REFERRAL_TOO_LATE`,
`REFERRAL_AFTER_PAYMENT`, `REFERRAL_INVITER_INACTIVE`; 404 `REFERRAL_CODE_NOT_FOUND`.

## Admin (role admin)

| Method | Path | Body / query | Answer |
| --- | --- | --- | --- |
| GET | `/api/admin/referrals` | `?status=pending\|paid\|released\|cancelled&page&limit` | `{items[referral + referrer_name/mobile, referred_name/mobile], total}` |
| GET / PUT | `/api/admin/referrals/settings` | `{enabled, member_reward, aggregator_group, aggregator_credit, aggregator_cash, wait_days}` | settings |
| GET | `/api/admin/referrals/aggregators` | | `{items[{user_id, active, note, name, mobile, released, waiting, credit_earned, cash_owed, ...}]}` |
| POST | `/api/admin/referrals/aggregators` | `{user: "<id or mobile>", active, note}` | aggregator |
| GET | `/api/admin/referrals/payouts` | `?owed=1&page&limit` | `{items[{id, user_id, batch_no, referrals, credit, cash, cash_paid_at?, cash_note, user_name, user_mobile}], total}` |
| POST | `/api/admin/referrals/payouts/:id/cash-paid` | `{note}` | payout |

Amounts are rupees. Wallet credits use category `referral_reward` with reference ids `referral:<id>:reward` and
`referral_payout:<id>:credit`, so a repeated run never pays twice.
