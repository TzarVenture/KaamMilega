/**
 * Firebase web app settings for browser push (project kaammilega-7a667).
 *
 * These values are public by design: Firebase web config and the VAPID key ship to every
 * browser and only identify the project. The server-side service-account key is the secret,
 * and it lives only in the backend environment.
 *
 * public/firebase-messaging-sw.js repeats FIREBASE_CONFIG (service workers can't import app
 * modules) and loads the Firebase SDK from gstatic at FIREBASE_SDK_VERSION: keep both in sync
 * with this file and with "firebase" in package.json.
 */
export const FIREBASE_SDK_VERSION = '12.19.0';

export const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAwQHIIYl2aV3MO38X_jOCz7yxuQFbcfOw',
    authDomain: 'kaammilega-7a667.firebaseapp.com',
    projectId: 'kaammilega-7a667',
    storageBucket: 'kaammilega-7a667.firebasestorage.app',
    messagingSenderId: '153052265105',
    appId: '1:153052265105:web:b8324cb4b5d00fdd5a1d30',
} as const;

/** Public key from Firebase Console → Project settings → Cloud Messaging → Web Push certificates */
export const FIREBASE_VAPID_KEY = 'BCk1wMB5tIel6NUEMgaS_DfJ4SgMQIMQbR2F3ftW6h4AZojJbw3RK8FDxdC9u6AV2BZCxDlHh399porIF96F50U';

/** The push worker gets its own scope so it never takes control of pages (no PWA side effects) */
export const PUSH_SW_URL = '/firebase-messaging-sw.js';
export const PUSH_SW_SCOPE = '/firebase-cloud-messaging-push-scope';
