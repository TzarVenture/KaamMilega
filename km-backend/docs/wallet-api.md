# Wallet and payments API for the mobile app

All routes are under `/api` and need `Authorization: Bearer <token>`.

- Amounts in JSON are rupees. Fields ending in `_paise` are paise.
- Errors look like `{"code": "WALLET_INSUFFICIENT", "error": "..."}`. Branch on `code`, never on the text.
- Never send a price from the app. The server works out every amount.

## What changed from the old API

- `POST /wallet/withdraw` takes only `{amount}`. Bank details are no longer sent. Money goes to the account approved in KYC.
- Withdrawal statuses are now `requested`, `processing`, `paid`, `failed`.
- The mock InstantPass order is gone. Use the real Razorpay flow below.
- Mentorship bookings have two new statuses, `awaiting_confirmation` and `reported`.
- Only earnings can be withdrawn. Spending balance cannot.

## Balance

`GET /wallet/balance`

```json
{
  "total_balance": 500, "withdrawable_balance": 0,
  "main_balance": 500, "earnings_balance": 0,
  "locked_balance": 0, "bonus_balance": 0,
  "currency": "INR", "status": "active"
}
```

Show `main_balance` as spending and `earnings_balance` as earnings. If `status` is not `active`, disable add money and withdraw.

`GET /wallet/transactions?page=1&limit=10` lists the ledger.

## Paying with Razorpay

Every online payment follows the same steps.

1. Call the create route for the purchase. It returns `order_id` and `key_id`.
2. Open the Razorpay SDK with those two values. Do not pass an amount of your own.
3. On success, send the three signed fields to the verify route:

```json
{ "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "..." }
```

4. If verify fails or the app loses connection, poll `GET /payments/orders/:order_id` every few seconds, up to about 15 seconds. It returns `{order_id, purpose, status, amount, target_id}`.

| `status` | Show |
|---|---|
| `created` | Still waiting. Say the payment is being confirmed |
| `paid` | Success |
| `refund_due` or `refunded` | The purchase failed and the money is being returned |
| `expired` | The payment was not completed |

The server also confirms payments on its own through the Razorpay webhook, so money is never lost if the app closes. Refresh on next open.

| Purchase | Create | Verify |
|---|---|---|
| Add money | `POST /wallet/topup/create-order` `{amount}` | `POST /wallet/topup/verify`, returns `{message, wallet, transaction}` |
| Session | `POST /mentorships/create-order` `{mentorship_id, scheduled_at, notes}` | `POST /mentorships/verify-payment`, returns `booking` |
| Event ticket | `POST /events/:id/create-order` `{attendee_name, attendee_email, attendee_phone}` | `POST /events/:id/verify-payment`, same attendee fields plus the signed fields, returns `ticket` |
| InstantPass | `POST /instant-work/pass/order` | `POST /instant-work/pass/verify`, returns the pass object |

Add money limits: ₹100 to ₹50,000 at a time, ₹1,00,000 a day, ₹2,00,000 maximum balance.

## Paying from the wallet

| Purchase | Route |
|---|---|
| Session | `POST /mentorships/book-wallet` `{mentorship_id, scheduled_at, notes}` |
| Event ticket | `POST /events/:id/wallet-checkout` `{attendee_name, attendee_email, attendee_phone}` |
| InstantPass | `POST /instant-work/pass/pay-wallet`, returns `{pass}` |

## Withdrawals

`GET /wallet/payout-account` returns `{eligible, method, account_holder, account_last4, ifsc, upi_id}`. If `eligible` is false, send the person to KYC.

`POST /wallet/withdraw` with `{amount}` returns `{withdrawal, wallet}`. Limits: from ₹100, up to ₹25,000 a day, one open withdrawal at a time.

`GET /wallet/withdrawals?page=1&limit=10` returns `{withdrawals, total, page, limit, total_pages}`. Each item has `id, amount, status, payout_method, account_last4, upi_id, bank_reference, failure_reason, created_at, processing_at, paid_at, failed_at`.

When a payout fails, the money returns to earnings automatically and `failure_reason` says why.

## Session confirmation

Booking statuses: `pending, confirmed, awaiting_confirmation, reported, completed, cancelled`.

1. The mentor marks the session done with `PATCH /mentorships/bookings/:id/status?status=completed`. The booking becomes `awaiting_confirmation`, and `release_after` is set 24 hours ahead.
2. The mentee either confirms or reports. If they do nothing, the mentor is paid at `release_after`.

- `POST /mentorships/bookings/:id/confirm`
- `POST /mentorships/bookings/:id/report` with `{reason}`. The payment stays on hold until an admin decides.

Show mentors "You'll be paid when the mentee confirms, or after 24 hours". Do not say the money has been released.

## Refund requests

`POST /wallet/disputes` with `{transaction_id, reason, description}`.

`reason` is one of `service_not_provided, session_cancelled, duplicate_charge, technical_failure, dissatisfied, other`.

`GET /wallet/my/disputes` lists requests with status `pending, under_review, approved, rejected`.

## Error codes to handle on screen

| Code | Do |
|---|---|
| `WALLET_INSUFFICIENT` | Offer add money or online payment |
| `WALLET_FROZEN` | Show the hold message and support contact |
| `WALLET_TOPUP_MIN`, `WALLET_TOPUP_MAX`, `WALLET_TOPUP_DAILY_LIMIT`, `WALLET_BALANCE_LIMIT` | Show the server message by the amount field |
| `EARNINGS_INSUFFICIENT`, `WITHDRAWAL_MIN`, `WITHDRAWAL_DAILY_LIMIT` | Show the server message by the amount field |
| `WITHDRAWAL_KYC_REQUIRED` | Send the person to KYC |
| `WITHDRAWAL_ALREADY_OPEN` | Show the open withdrawal |
| `PAYMENT_SIGNATURE_INVALID`, `PAYMENT_NOT_COMPLETE` | Poll the order status, as above |
| `PAYMENT_REFUNDING` | Tell the person their money is being returned |

## InstantPass and spot gigs

The ₹99 pass gives 10 gig credits and unlocks unlimited chats and the Expert application for 90 days. Running out of credits doesn't end the 90 days. A new pass can be bought once the current one has no credits left or has expired.

`GET /instant-work/candidate/status` returns `{has_active_pass, quota_remaining, quota_total, pass_expires_at, is_free_now, active_skill, hourly_rate, current_location, last_ping_at}`.

| Action | Route | Notes |
|---|---|---|
| Go Free Now | `POST /instant-work/availability` `{is_free_now: true, skill, hourly_rate, lat, lng}` | Needs a pass with credits. Location is required |
| Stop | `POST /instant-work/availability` `{is_free_now: false}` | |
| Location ping | `POST /instant-work/location` `{lat, lng}` | Send at least every 2 minutes. Workers silent for 5 minutes leave the radar |
| Open gigs nearby | `GET /instant-work/candidate/feed?lat=&lng=&radius_km=&skill=` | `lat` and `lng` are required. Radius 1 to 10 km, default 5 |
| Accept | `POST /instant-work/claim` `{job_id}` | Uses 1 credit. One gig at a time |
| Mark done | `PUT /instant-work/jobs/:id/complete` | Worker, after accepting |
| Nearby workers | `GET /instant-work/recruiter/radar?lat=&lng=&radius_km=&skill=` | Names are shortened and locations moved 100 to 180 m. Best rated first |
| Post a gig | `POST /instant-work/dispatch` `{skill, lat, lng, address, pay_rate, rate_type, duration_hours, notes}` | `rate_type` is `flat` or `hourly` (hourly needs 1 to 24 hours). One worker per gig, one open gig per hirer. Open for 3 minutes |
| Cancel a waiting gig | `PUT /instant-work/jobs/:id/cancel` | Only before a worker accepts |
| Approve a done gig | `PUT /instant-work/jobs/:id/close` | No money moves yet |

Codes: `PASS_REQUIRED` and `PASS_QUOTA_EXHAUSTED` (HTTP 402, offer the pass), `PASS_ALREADY_ACTIVE`, `GIG_UNAVAILABLE`, `INSTANT_ALREADY_ON_GIG`, `INSTANT_OPEN_JOB_EXISTS`, `INSTANT_JOB_WRONG_STATE` (HTTP 409), `INSTANT_LOCATION_INVALID`, `INSTANT_SKILL_REQUIRED`, `INSTANT_JOB_INVALID` (HTTP 400, show the message).

## Chat limit

`GET /chat/entitlement` returns `{started_today, daily_free_limit, free_remaining, resets_at, has_active_pass, unlimited, can_start_new, pass_quota_remaining}`.

Without the ₹99 pass, a person can start 3 new chats a day (India time), and only with recruiters. Replies in an existing chat are always free, and chats a recruiter starts don't count. Pass holders, recruiters and admins have no limit (`unlimited: true`).

Starting a chat returns `CHAT_QUOTA_REACHED` when the 3 are used today, or `CHAT_PASS_REQUIRED` when the other person isn't a recruiter. Offer the pass for both.
