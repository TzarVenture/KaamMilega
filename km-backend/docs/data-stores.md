# Where KaamMilega keeps its data

Checked against the code on 18 Nov 2026 (branch `feat/postgres-setup`). If you change where something lives, update this file in the same commit.

## The rule

**Money, and everything money buys, lives in Postgres. Everything else lives in MongoDB.**

A purchase touches a wallet, a ledger row and the thing bought (a ticket, a booking, a pass). Postgres can save all of those together in one transaction: either everything is saved or nothing is. If they were split across two databases, a crash halfway could take someone's money and give them nothing. Social and content data (profiles, posts, chat) involves no money, changes shape often and is read in big documents, so MongoDB suits it.

There are three stores:

| Store | Provider | What it holds |
|---|---|---|
| Postgres, schema `app` | Supabase (Mumbai) | Wallets, ledger, payments, events and tickets, mentor sessions and bookings, Instant Milega |
| MongoDB | Atlas | Users, jobs, applications, chat, feed, network, notifications, analytics, courses, ads, settings |
| Files | Cloudflare R2 | Uploaded images and documents: a public bucket (photos, banners) and a private one (KYC documents, resumes) |

## Postgres (Supabase, schema `app`)

| Table | What it holds |
|---|---|
| `wallets` | One wallet per user: main, earnings, locked (escrow) and bonus balances, in paise |
| `wallet_transactions` | The ledger. One row per balance change. Rows are never deleted |
| `wallet_withdrawals` | Requests to move earnings to a bank or UPI account |
| `wallet_disputes` | A user's complaint about a ledger row, and how it was settled |
| `payment_orders` | Every Razorpay checkout: what it was for, its status and any refund |
| `events`, `event_participants`, `event_tickets` | Events, who registered, and tickets (free or paid) |
| `mentorships`, `expert_availability`, `mentorship_bookings` | An Expert's sessions, weekly hours, and booked calls (escrow until done) |
| `instant_passes`, `instant_workers`, `instant_jobs` | The ₹99 pass, worker profiles and gigs (locations use PostGIS) |

The schema is created by hand-written SQL migrations in `km-backend/migrations`, applied with Atlas (`atlas.sum` stops anyone editing a migration that has already run).

## MongoDB (Atlas)

| Area | Collections |
|---|---|
| People | `users`, `otps`, `account_action_codes`, `account_exit_feedback`, `push_tokens`, `certifications`, `skill_endorsements` |
| Jobs | `jobs`, `applications`, `interviews`, `companies`, `questions` |
| Chat | `conversations`, `messages`, `user_blocks`, `chat_reports` |
| Feed and network | `feed_posts`, `feed_comments`, `feed_reactions`, `feed_saves`, `feed_reports`, `network_connections`, `network_dismissed_suggestions` |
| Notifications | `notifications` |
| Analytics | `analytics_profile_views`, `analytics_search_appearances`, `analytics_post_impressions` |
| Learning | `courses` |
| Ads | `ad_campaigns`, `ad_daily`, `ad_views` (no payments yet) |
| Site content | `settings`, `policies`, `policy_versions`, `testimonials`, `cities`, `skills`, `app_waitlist` |
| Files | `files` (who uploaded which R2 file, so private files can be checked before use) |
| Logs | `logs` (deleted automatically after 30 days) |

## How the stores connect

**One kind of ID everywhere.** Every record gets a MongoDB-style ID (24 hex characters), including Postgres rows. Postgres stores them in a type called `app.object_id`, which rejects anything that isn't 24 hex characters. A user is always the same ID in both databases.

**Postgres points at MongoDB users by ID.** Columns such as `user_id`, `expert_id`, `organizer_id` and `recruiter_id` hold the ID of a user in MongoDB. A database can't enforce a link to another database, so the code takes these IDs from the signed-in session or from records it has just read (admin screens act on an ID the admin picked). Inside Postgres, links between tables are real foreign keys.

**Reads across the two:**
- Wallet screens, event attendee lists and attendee details read names and photos from MongoDB `users`.
- The "has an active pass" check (Expert application and others), chat's pass limit, global search (events), activity history and the admin dashboard read from Postgres.
- Reminders read interviews from MongoDB and sessions and tickets from Postgres.

**Writes across the two:** only **account deletion** writes to both. It runs as a list of steps that are each safe to run again. The money step is one Postgres transaction: sessions are switched off, the wallet is closed and dispute names are cleared. If any step fails, the account stays "pending deletion" and the whole list runs again later. Notifications are written to MongoDB after a Postgres purchase commits. If one is lost, the purchase is still correct.

**A purchase, step by step** (for example a paid event ticket):

1. The app asks the server for a checkout. The server reads the price from Postgres, never from the app, and creates a `payment_orders` row and a Razorpay order.
2. The user pays on Razorpay.
3. Razorpay tells the server (the app's confirmation and Razorpay's webhook both work, and whichever arrives second does nothing). In **one Postgres transaction**, the order is marked paid, a seat is taken and the ticket is written.
4. If the seat is gone by then, the order is marked "refund due". A recovery job sends refunds to Razorpay and keeps retrying until Razorpay confirms.

Paying from the wallet does steps 1 to 3 as one transaction: the wallet debit and the ticket are saved together.

## Safety rules already in place

- **Money is whole paise** (`bigint`), never decimals, so ₹0.10 + ₹0.20 is always exactly ₹0.30.
- **Every ledger row has a unique reference** (for example `ticket:<id>:refund`). Posting the same action twice changes the balance once.
- **A wallet is locked while it changes**, so two requests can't both spend the same rupee.
- **Balances can't go below zero.** The code checks, and the table has a CHECK as a last line of defence.
- **Allowed values are listed in the tables** (statuses, categories, payment methods), so a typo can't be saved.
- **Events and sessions are hidden, not deleted.** Ledger rows and tickets are records we may need for accounts.
- **`updated_at` is set by the database**, so it can't be forgotten.
- **Supabase's public API can't see the `app` schema**: row level security is on, and the `anon` and `authenticated` roles have no access. Only the backend connects.
- **The connection is encrypted.** The server adds `sslmode=require` if the address doesn't set it, and the database password is never logged.
- **The backend uses at most 10 connections**, leaving room in Supabase's shared pool.
- **MongoDB has unique indexes** (for example email, mobile, username, one application per job, one connection per pair, one block per pair), so duplicates are refused even when two requests race. Indexes are created when the server starts, from each feature's repository.

## Fixed on 18 Nov

- Deleting a paid event now refunds every ticket in the same transaction: wallet payments go back to the wallet, card and UPI payments are refunded through Razorpay. Ticket holders are notified.
- That refund pays only what an approved dispute hasn't already returned, and closes a dispute that is still open, so nobody is paid twice.
- Admin revenue now subtracts those refunds, and "Active gigs" counts only gigs that are still under way.

## Still open (needs a decision)

1. **The backend signs in to Postgres as `postgres`, the all-powerful admin user.** Industry practice is a separate app user that can read and write the `app` tables but can't drop tables or change the schema. Migrations keep using the admin user. This changes the live database and the server's `.env`, so it needs your go-ahead. The SQL is ready below.
2. **Backups.** The 16 and 17 Nov copies are in the local `docs/db-backup-2026-11-16` and `docs/db-backup-2026-11-17` folders (not in git). Before launch, turn on scheduled backups for both databases on the paid plans.
3. **Stricter certificate check (optional).** `sslmode=require` encrypts the connection. `verify-full` also checks it's really Supabase, but needs Supabase's certificate file on the server.
4. **Unused code.** `database.NewTransactor` (MongoDB transactions) isn't used any more; every feature uses the Postgres one.

### Least-privilege app user (not applied)

```sql
-- Run once as the admin user, then put km_app in the backend's DATABASE_URI.
CREATE ROLE km_app LOGIN PASSWORD '<a new strong password>';
GRANT USAGE ON SCHEMA app, extensions TO km_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO km_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO km_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO km_app;
```
