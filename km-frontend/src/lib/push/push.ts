'use client';

import api from '@/lib/axios';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY, PUSH_SW_SCOPE, PUSH_SW_URL } from './config';

/**
 * Browser push for KaamMilega (Firebase Cloud Messaging).
 *
 * Flow: the user turns push on (a click) → the browser asks for permission → Firebase gives this
 * browser a token → we register it with our backend (POST /api/push/tokens), which then sends
 * every new notification to it. Firebase is loaded lazily and only in the browser.
 *
 * Per-browser state: "on" means the user turned push on in this browser and hasn't turned it off
 * or signed out. It is a local preference only; delivery itself is decided by the backend.
 */

export type PushStatus =
    | 'unsupported' // browser can't do web push (or not a secure context)
    | 'denied' // the user blocked notifications for kaammilega.com in browser settings
    | 'off'
    | 'on';

const PREF_KEY = 'km-push';
export const PUSH_CHANGE_EVENT = 'km-push-change';

function readPref(): 'on' | 'off' {
    try {
        return localStorage.getItem(PREF_KEY) === 'on' ? 'on' : 'off';
    } catch {
        return 'off';
    }
}

function writePref(v: 'on' | 'off') {
    try {
        localStorage.setItem(PREF_KEY, v);
    } catch {
        // Storage blocked: the preference lasts for this page view
    }
    window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
}

let supportPromise: Promise<boolean> | null = null;

/** True when this browser can receive web push from Firebase */
export function isPushSupported(): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (!supportPromise) {
        supportPromise = (async () => {
            if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
                return false;
            }
            try {
                const { isSupported } = await import('firebase/messaging');
                return await isSupported();
            } catch {
                return false;
            }
        })();
    }
    return supportPromise;
}

export async function getPushStatus(): Promise<PushStatus> {
    if (!(await isPushSupported())) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' && readPref() === 'on' ? 'on' : 'off';
}

async function messaging() {
    const [{ initializeApp, getApps, getApp }, { getMessaging }] = await Promise.all([
        import('firebase/app'),
        import('firebase/messaging'),
    ]);
    // One Firebase app for the whole site
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    return getMessaging(app);
}

async function serviceWorker(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
    if (existing?.active?.scriptURL.endsWith(PUSH_SW_URL)) return existing;
    const reg = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE });
    await waitUntilActive(reg);
    return reg;
}

// Push subscriptions need an active worker. (navigator.serviceWorker.ready can't be used: it
// waits for a worker that controls this page, and the push worker deliberately controls none.)
function waitUntilActive(reg: ServiceWorkerRegistration, timeoutMs = 10000): Promise<void> {
    if (reg.active) return Promise.resolve();
    const worker = reg.installing || reg.waiting;
    if (!worker) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The notification service did not start. Please try again.')), timeoutMs);
        worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') {
                clearTimeout(timer);
                resolve();
            } else if (worker.state === 'redundant') {
                clearTimeout(timer);
                reject(new Error('The notification service failed to start.'));
            }
        });
    });
}

/** This browser's FCM token (creates or refreshes the subscription as needed) */
async function currentToken(): Promise<string> {
    const [{ getToken }, m, registration] = await Promise.all([import('firebase/messaging'), messaging(), serviceWorker()]);
    const token = await getToken(m, { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) throw new Error('This browser did not provide a notification token.');
    return token;
}

async function registerWithServer(token: string) {
    await api.post('/push/tokens', { token, platform: 'web' });
}

/** Account-level switch read by the backend; saving settings replaces the whole object */
async function ensureAccountPushOn() {
    const s = (await api.get('/user/settings')) as Record<string, unknown> | null;
    if (s && s.push_notifications === true) return;
    await api.put('/user/settings', { ...(s ?? {}), push_notifications: true });
}

export class PushPermissionError extends Error {}

/**
 * Turn push on in this browser. Must run from a click (browsers only show the permission
 * prompt after a user gesture).
 */
export async function enablePush(): Promise<void> {
    if (!(await isPushSupported())) throw new PushPermissionError('This browser does not support notifications.');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') {
        window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
        throw new PushPermissionError(
            permission === 'denied'
                ? 'Notifications are blocked for KaamMilega. Allow them in your browser’s site settings, then try again.'
                : 'Notifications were not allowed.',
        );
    }
    const token = await currentToken();
    await registerWithServer(token);
    await ensureAccountPushOn();
    writePref('on');
}

/** Stop push in this browser only (phones and other browsers keep theirs) */
export async function disablePush(): Promise<void> {
    await removeThisBrowser({ server: true });
    writePref('off');
}

async function removeThisBrowser({ server }: { server: boolean }) {
    if (!(await isPushSupported()) || Notification.permission !== 'granted') return;
    try {
        const [{ deleteToken, getToken }, m, registration] = await Promise.all([import('firebase/messaging'), messaging(), serviceWorker()]);
        const token = await getToken(m, { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => '');
        if (token && server) await api.delete('/push/tokens', { data: { token } }).catch(() => undefined);
        // Invalidates the token at Firebase too, so nothing can reach this browser any more
        await deleteToken(m).catch(() => undefined);
    } catch {
        // Best effort: the backend also drops tokens Firebase reports as dead
    }
}

/**
 * Called on sign-out, before the session cookie is cleared: removes this browser so the next
 * person using it doesn't get the previous account's notifications.
 */
export async function unregisterPushOnSignOut(): Promise<void> {
    if (readPref() !== 'on') return;
    await removeThisBrowser({ server: true });
    writePref('off');
}

/**
 * Runs once per page load for signed-in users with push on: re-registers the token (it can
 * rotate, and the backend needs it tied to the current session). If the user revoked the
 * permission in the browser, push is switched off here too.
 */
export async function syncPush(signedIn: boolean): Promise<void> {
    if (readPref() !== 'on' || !(await isPushSupported())) return;
    if (Notification.permission !== 'granted') {
        writePref('off');
        return;
    }
    if (!signedIn) {
        // Signed out without a clean logout (e.g. session expired): stop this browser locally
        await removeThisBrowser({ server: false });
        writePref('off');
        return;
    }
    try {
        await registerWithServer(await currentToken());
    } catch {
        // Offline or temporary failure: next page load tries again
    }
}
