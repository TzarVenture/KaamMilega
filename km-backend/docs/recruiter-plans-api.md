# Recruiter plans API for the mobile app

All routes are under `/api` and need `Authorization: Bearer <token>`. Recruiter routes need the `recruiter` role.
Errors look like `{"code": "PLAN_JOB_POSTS_USED_UP", "error": "..."}`. Branch on `code`, never on the text.
Amounts in JSON are rupees. Fields ending in `_paise` are paise. Never send a price from the app.

## How it works

- The admin creates plans: a price, how many days they last, and limits on job posts, new chats and resume downloads. A limit of `null` means unlimited.
- A recruiter without a plan gets a free allowance each calendar month (India time), set by the admin.
- Buying while a plan is running queues the new plan to start when the current one ends. Only one plan can wait in the queue.
- A plan keeps the limits it was sold with, even if the admin edits the plan later.
- Limits only block anything once the admin switches enforcement on (`enforced` below). Until then usage is counted but nothing is refused.

What counts:

| Limit | Counts when | Notes |
|---|---|---|
| Job posts | A job is posted | Editing or reopening a job doesn't count again |
| New chats | The recruiter sends the first message to someone | Each person counts once per plan period. Replies and chats the other person started are free |
| Resume downloads | Not counted yet | Shown on plans. It will apply to the candidate database, not to applicants' resumes |
| AI job writer | Not built yet | `ai_job_writer` says whether the plan includes it. Show it as coming soon |

## Plan screen

`GET /recruiter-plans`

```json
{
  "plans": [
    { "id": "665f...", "name": "Starter", "description": "", "price": 499, "price_paise": 49900,
      "period_days": 30, "job_posts": 5, "new_chats": 50, "resume_downloads": null,
      "ai_job_writer": false, "sort_order": 0, "is_active": true }
  ],
  "current": null,
  "queued": [],
  "usage": {
    "job_posts": { "used": 1, "limit": 2 },
    "new_chats": { "used": 4, "limit": 10 },
    "resume_downloads": { "used": 0, "limit": null }
  },
  "period_ends_at": "2026-12-01T00:00:00+05:30",
  "enforced": false,
  "ai_job_writer": false
}
```

- `current` is the plan running now, or `null` when the free allowance applies. It has `plan_name, price, job_posts, new_chats, resume_downloads, ai_job_writer, channel, status, starts_at, expires_at`.
- `queued` lists a bought plan waiting to start (`starts_at` is in the future).
- `usage` is for the current period: the running plan, or the free month. `period_ends_at` is when the counts start again.
- When `queued` is not empty, disable buying and say a plan is already waiting.

## Buying

With the wallet: `POST /recruiter-plans/:id/buy-with-wallet` returns `{subscription, wallet}`. It takes the price from the spending balance.

Online, the same steps as every Razorpay payment (see `wallet-api.md`):

1. `POST /recruiter-plans/:id/create-order` returns `{key_id, order_id, amount, amount_paise}`.
2. Open the Razorpay SDK with `key_id` and `order_id`.
3. `POST /recruiter-plans/verify-payment` with `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` returns `{subscription}`.
4. If verify fails, poll `GET /payments/orders/:order_id` as in `wallet-api.md`, then reload the plan screen.

The recruiter gets a notification of type `recruiter_plan` with link `/recruiter/plan`.

## When a limit is used up

Only while `enforced` is true:

- Posting a job returns HTTP 402 with `PLAN_JOB_POSTS_USED_UP`.
- Sending the first message to someone new returns HTTP 402 with `PLAN_CHATS_USED_UP`. Don't keep the unsent message as "retry"; offer the plan screen.

## Admin

| Route | Does |
|---|---|
| `GET /admin/recruiter-plans` | All plans, `{plans}`, including those off sale |
| `POST /admin/recruiter-plans` | Create a plan |
| `PUT /admin/recruiter-plans/:id` | Edit a plan |
| `GET /admin/recruiter-plans/settings` | `{enforce, free: {job_posts, new_chats, resume_downloads}}` |
| `PUT /admin/recruiter-plans/settings` | Save the same shape |
| `GET /admin/recruiter-plans/subscriptions?page=1&limit=20` | Bought plans, newest first, with `recruiter_name` and `company_name` |

A plan body is `{name, description, price, period_days, job_posts, new_chats, resume_downloads, ai_job_writer, sort_order, is_active}`. Price is ₹1 to ₹1,00,000, the length 1 to 366 days. Plans are switched off with `is_active: false`, never deleted.

An online plan can be refunded from Payments in the admin panel only if nothing on it has been used (`PLAN_ALREADY_USED` otherwise).

## Error codes

| Code | Do |
|---|---|
| `PLAN_JOB_POSTS_USED_UP`, `PLAN_CHATS_USED_UP` | Show the message and a link to the plan screen |
| `PLAN_ALREADY_QUEUED` | Say a plan is already waiting to start |
| `PLAN_INACTIVE`, `PLAN_NOT_FOUND` | Reload the plan screen |
| `PLAN_RECRUITERS_ONLY` | Only employer accounts can buy plans |
| `WALLET_INSUFFICIENT` | Offer add money or online payment |
