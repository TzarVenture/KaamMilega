# Push notifications (Firebase Cloud Messaging)

KaamMilega sends every in-app notification (new chat message, application update, interview,
connection, wallet, …) as a push to the user's browsers and phones. One backend serves the
website, the Android app and the iOS app.

Firebase project: **`kaammilega-7a667`**

## How it works

```
App / website                    KaamMilega backend                   Firebase
─────────────                    ──────────────────                   ────────
1. user turns push on
2. Firebase SDK → FCM token
3. POST /api/push/tokens ──────▶ stores token for the signed-in user
                                 …later, something happens…
                                 NotificationService.CreateNotification
                                   ├─ saves it + WebSocket (in-app)
                                   └─ push.Service (background) ─────▶ delivers to every
                                                                        registered device
4. on sign-out:
   DELETE /api/push/tokens ────▶ removes this device
```

Nothing else in the backend calls Firebase: any feature that creates a notification gets push
for free.

## API (all require the normal session: `km_auth_token` cookie or `Authorization: Bearer <JWT>`)

The user is always taken from the session, never from the body.

### Register this device — `POST /api/push/tokens`

```json
{ "token": "<FCM registration token>", "platform": "android" }
```

- `platform`: `web`, `android` or `ios` (defaults to `web`).
- Idempotent. **Call it on every app start / sign-in** and whenever the FCM SDK reports a new
  token (`onNewToken` on Android, `messaging:didReceiveRegistrationToken` on iOS). This keeps
  the token fresh and ties it to the current session.
- A token that was registered by another account (shared device, account switch) moves to the
  signed-in user.
- Response: `200 { "registered": true, "push_enabled": true|false }`
  (`push_enabled` is false until the server has Firebase credentials).
- Errors: `400` invalid token or platform, `401` not signed in, `403 ACCOUNT_INACTIVE`.

### Remove this device — `DELETE /api/push/tokens`

```json
{ "token": "<FCM registration token>" }
```

- Call it **before** clearing the session on sign-out (afterwards the request is unauthenticated).
- Only removes the token if it belongs to the signed-in user.
- Response: `200 { "unregistered": true }`

### Send a test push to my devices — `POST /api/push/test`

- Sends a real push to the signed-in user's own registered devices.
- Response: `200 { "devices": 2, "sent": 2, "failed": 0 }`
- `429` if called again within 30 s; `503` when the server has no Firebase credentials yet.

## Who receives a push

A device gets the push only when **all** of these hold:

1. The account is active (not deactivated / pending deletion / deleted).
2. `settings.push_notifications` is `true` for the user (`PUT /api/user/settings`; the website
   turns it on when the user enables push. Mobile apps should do the same in their own
   "enable notifications" flow — note that `PUT /api/user/settings` replaces the whole settings
   object, so send the current settings with only `push_notifications` changed).
3. The token was registered in the user's **current session**. "Sign out of all other devices",
   a password change/reset and deactivation start a new session; devices from older sessions stop
   receiving pushes until they sign in again (and re-register).

Tokens are removed automatically when Firebase reports them as unregistered, when a device hasn't
re-registered for 60 days, and when the account is deleted. A user keeps at most 20 devices.

## Message format

Each push contains a display notification plus data:

| Field | Value |
|---|---|
| `notification.title` | Notification title (falls back to the sender's name), max 80 chars |
| `notification.body` | Notification text, max 180 chars |
| `data.notification_id` | ID of the in-app notification (mark as read with `PUT /api/notifications/{id}/read`) |
| `data.type` | e.g. `chat_message`, `application_status`, `interview_scheduled`, `connection_accepted` |
| `data.category` | `messages`, `jobs`, `network`, `system` |
| `data.link` | In-site path to open, e.g. `/chat?user=…`, `/applications/123` (always starts with `/`) |

Platform specifics already set by the backend:

- **Web**: shown by `public/firebase-messaging-sw.js`. On click it opens `link` on the site the
  worker runs on (localhost, staging or kaammilega.com); if a KaamMilega tab is open it focuses it,
  navigates there and marks the notification read. FCM only accepts https links, so the backend
  adds `fcm_options.link` only when `FRONTEND_URL` is https.
- **Android**: `priority` high for chat, normal otherwise; TTL 24 h; `tag` so repeated chat
  messages from one person replace each other. Map `data.link` to the matching app screen in
  your notification-tap handler. If the app defines a notification channel, tell the backend
  developer the channel id so it can be set in `AndroidNotification.ChannelID`.
- **iOS**: `aps.sound = default`, `thread-id` per conversation. The app must request
  notification permission and upload its **APNs Authentication Key** in Firebase (below).

Chat pushes from the same person share a tag (`km-chat-<senderId>`), so a burst of messages shows
as one updated notification. When the website is open and visible, the browser hands the message
to the page instead of showing it; the site's live in-app alert covers it.

## Server configuration (backend environment, e.g. Dokploy)

| Variable | Required | Value |
|---|---|---|
| `FIREBASE_CREDENTIALS_JSON` | yes (or `_FILE`) | The service-account key JSON, raw or base64 |
| `FIREBASE_CREDENTIALS_FILE` | alternative | Path to the key file on the server |
| `FIREBASE_PROJECT_ID` | no | Defaults to `kaammilega-7a667`; a key for another project is refused |
| `FRONTEND_URL` | no | Defaults to `https://kaammilega.com` (links inside web pushes) |

Without credentials the backend logs `[push] off: …` and everything else keeps working; devices can
still register. With them it logs `[push] Firebase Cloud Messaging ready`.

**The service-account key is a secret.** Never commit it, paste it in chat, or put it in frontend
or mobile code. If it leaks, delete it in Google Cloud Console → IAM → Service accounts → Keys and
create a new one.

## Firebase Console checklist

- **Web**: Project settings → Cloud Messaging → Web Push certificates → key pair generated (its
  public key is in `km-frontend/src/lib/push/config.ts`). ✅
- **Server**: Project settings → Service accounts → *Generate new private key* → put it in the
  backend environment as above.
- **Android**: app registered, `google-services.json` in the app.
- **iOS**: app registered, `GoogleService-Info.plist` in the app, and Project settings → Cloud
  Messaging → Apple app configuration → upload the **APNs Authentication Key** (.p8) from the
  Apple Developer account. Without it iOS pushes fail.

## Rollback

- Turn push off without a deploy: remove `FIREBASE_CREDENTIALS_JSON`/`_FILE` and restart the
  backend. Nothing is sent; the site and apps work as before.
- Full rollback: revert the push commits. The `push_tokens` collection can be dropped safely.
