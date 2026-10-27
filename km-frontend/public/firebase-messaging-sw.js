/* KaamMilega push service worker (Firebase Cloud Messaging).
 *
 * Shows notifications when KaamMilega isn't on screen. The backend sends each push with
 * webpush.notification, so the Firebase SDK displays it. When a KaamMilega tab is visible,
 * Firebase hands the message to the page instead and nothing is shown here: the site's live
 * in-app alert covers it (no duplicates).
 *
 * Keep the version and config in sync with src/lib/push/config.ts and package.json.
 */

// Clicks are handled here, registered before Firebase's own handler so this one runs first.
// It opens data.link on this site's origin (works on localhost and kaammilega.com alike) and,
// when a KaamMilega tab is already open, focuses it and asks the page to navigate there; the
// SDK's handler would only focus the tab.
self.addEventListener('notificationclick', (event) => {
  const payload = event.notification && event.notification.data && event.notification.data.FCM_MSG;
  if (!payload || event.action) return;
  event.stopImmediatePropagation();
  event.notification.close();

  const data = payload.data || {};
  const raw = typeof data.link === 'string' ? data.link : '';
  // In-site paths only
  const path = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/notifications';
  const url = new URL(path, self.location.origin).href;
  const message = { type: 'km-push-open', link: path, notificationId: data.notification_id || '' };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const sameSite = windows.filter((w) => new URL(w.url).origin === self.location.origin);
      const target = sameSite.find((w) => w.focused) || sameSite.find((w) => w.visibilityState === 'visible') || sameSite[0];
      if (target) {
        return target.focus().then((w) => (w || target).postMessage(message));
      }
      return self.clients.openWindow(url);
    }),
  );
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAwQHIIYl2aV3MO38X_jOCz7yxuQFbcfOw',
  authDomain: 'kaammilega-7a667.firebaseapp.com',
  projectId: 'kaammilega-7a667',
  storageBucket: 'kaammilega-7a667.firebasestorage.app',
  messagingSenderId: '153052265105',
  appId: '1:153052265105:web:b8324cb4b5d00fdd5a1d30',
});

firebase.messaging();
