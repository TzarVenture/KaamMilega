/**
 * Store links for the KaamMilega mobile app (Android + iOS). InstantMilega runs in the app only:
 * it needs live location and tracking.
 *
 * Until a link is set the site shows "Coming soon" with a notify-me form instead of a store badge.
 * Set NEXT_PUBLIC_PLAY_STORE_URL / NEXT_PUBLIC_APP_STORE_URL as build-time arguments when the
 * app is published; nothing else needs to change.
 */
export const APP_LINKS = {
    PLAY_STORE: process.env.NEXT_PUBLIC_PLAY_STORE_URL || '',
    APP_STORE: process.env.NEXT_PUBLIC_APP_STORE_URL || '',
} as const;

export const APP_AVAILABLE = Boolean(APP_LINKS.PLAY_STORE || APP_LINKS.APP_STORE);
