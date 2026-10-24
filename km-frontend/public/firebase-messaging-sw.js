/* KaamMilega push service worker (Firebase Cloud Messaging).
 *
 * Shows notifications when KaamMilega isn't the active tab. The backend sends each push with
 * webpush.notification + fcm_options.link, so the Firebase SDK displays it and opens the link
 * on click by itself. When a KaamMilega tab is visible, Firebase hands the message to the page
 * instead and nothing is shown here: the site's live in-app alert covers it (no duplicates).
 *
 * Keep the version and config in sync with src/lib/push/config.ts and package.json.
 */
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
