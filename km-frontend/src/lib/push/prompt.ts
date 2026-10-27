'use client';

/**
 * When to invite a user to turn on browser notifications (the in-app card, not the browser's
 * permission dialog). Shared by every place the invitation appears, so "Not now" anywhere
 * snoozes it everywhere: a week per "Not now", and never again after three.
 */
const KEY = 'km-push-invite';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 3;

interface InviteState {
    dismissals: number;
    nextAt: number;
}

function read(): InviteState {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<InviteState> | null;
        return { dismissals: Number(v?.dismissals) || 0, nextAt: Number(v?.nextAt) || 0 };
    } catch {
        return { dismissals: 0, nextAt: 0 };
    }
}

export function canInvite(now = Date.now()): boolean {
    if (typeof window === 'undefined') return false;
    const s = read();
    return s.dismissals < MAX_DISMISSALS && now >= s.nextAt;
}

export function snoozeInvite(now = Date.now()) {
    const s = read();
    try {
        localStorage.setItem(KEY, JSON.stringify({ dismissals: s.dismissals + 1, nextAt: now + SNOOZE_MS }));
    } catch {
        // Storage blocked: the card simply hides for this page view
    }
}
