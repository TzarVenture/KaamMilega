# Badges and police verification API for the mobile app

All routes are under `/api` and need `Authorization: Bearer <token>`.
Errors look like `{"code": "POLICE_FILE_INVALID", "error": "..."}`. Branch on `code`, never on the text.

## Badges

A member can have up to three badges. The server works them out, so the app only shows what it gets.

| Badge | `badges` value | Who gets it |
|---|---|---|
| Verified | `verified` | Companies whose documents were checked, and approved experts |
| Top rated | `top_rated` | 4.5 average or more across at least 10 session reviews |
| Police checked | `police_checked` | An approved police certificate less than 12 months old |

`badges` is a list of strings, in the order above, wherever a member's name is shown:

- `GET /user/profile` (yourself) and `GET /user/:id` (someone else)
- Post and comment authors in the feed, people in the reactions list
- Profile viewers, network suggestions, certificate bylines

Older screens may still read `is_verified`. It stays and means the same as `verified` in `badges`.

Show each badge as an icon next to the name, and spell them out on the profile page. Suggested icons: a seal with a check for Verified, a medal for Top rated, a shield with a check for Police checked.

## Police verification (the member)

The certificate is a private file. Upload it first, then send its id.

1. `POST /files/upload` as multipart with `file` and `kind=police_certificate`. PDF, JPG or PNG, up to 5 MB. Keep the `id` from the response.
2. `POST /police-verification` with:

```json
{ "file_id": "665f...", "issued_on": "2026-10-01" }
```

`issued_on` is the date printed on the certificate, as `YYYY-MM-DD`. It can't be in the future or more than 12 months ago.

Both `GET /police-verification` and the submit route return:

```json
{
  "verification": {
    "status": "pending",
    "file_id": "665f...",
    "issued_on": "2026-10-01T00:00:00+05:30",
    "expires_at": "2027-10-01T00:00:00+05:30",
    "submitted_at": "2026-11-21T10:00:00Z"
  },
  "badge": false,
  "valid_months": 12,
  "can_submit": true
}
```

`verification` is `null` if the member has never uploaded one. After a decision it also has `reviewed_at`, and `rejection_reason` when rejected.

| State | Show |
|---|---|
| `verification` is null | The upload form |
| `status` is `pending` | "Under review", sent on `submitted_at`. They may send a different file |
| `status` is `approved` and `badge` is true | "Approved", badge shows until `expires_at` |
| `status` is `approved` and `badge` is false | "Expired" on `expires_at`, and the upload form |
| `status` is `rejected` | "Not approved" with `rejection_reason`, and the upload form |

Show the upload form only when `can_submit` is true. It is false while an approved certificate is valid, and turns true again in its last 30 days so the member can renew before the badge ends.

The member gets a notification of type `police_verification` when an admin decides. Its link is `/settings?tab=verification`. In the app, open the police verification screen.

## Police verification (admin)

`GET /admin/police-verifications?status=pending&page=1&limit=20` returns `{items, total, page, limit}`. `status` is `pending`, `approved` or `rejected`. Each item is `{member: {id, name, avatar, city, roles}, verification}`.

Open the certificate with `GET /files/:file_id/link`, which returns a signed link for 10 minutes.

`POST /admin/police-verifications/:member_id/review` with:

```json
{ "status": "rejected", "reason": "The name doesn't match the profile", "file_id": "665f..." }
```

`reason` is needed to reject. Send the `file_id` you opened: if the member sent a new file since, the server refuses with `POLICE_REVIEW_NOT_PENDING`, so reload the list.

## Error codes

| Code | Do |
|---|---|
| `POLICE_FILE_INVALID` | Ask for the file again |
| `POLICE_ISSUED_ON_INVALID`, `POLICE_ISSUED_ON_FUTURE`, `POLICE_CERTIFICATE_EXPIRED` | Show the message by the date field |
| `POLICE_CERTIFICATE_STILL_VALID` | Hide the form; the current certificate is still good |
| `POLICE_REVIEW_DECISION_INVALID`, `POLICE_REVIEW_REASON_REQUIRED` | Admin form errors |
| `POLICE_REVIEW_NOT_PENDING` | Reload the list |
