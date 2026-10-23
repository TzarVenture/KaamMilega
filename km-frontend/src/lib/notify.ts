'use client';

import { sileo } from 'sileo';

/**
 * The one way to show a toast in KaamMilega. Pages never import the toast library directly,
 * so the library (sileo today) can be swapped by editing this file and AppToaster only.
 *
 *   notify.success('Profile updated')
 *   notify.error(err, 'Could not save your profile')   // shows the server's message when there is one
 *   notify.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Could not save' })
 */

type Kind = 'success' | 'error' | 'warning' | 'info';

// Short messages fit in the pill; longer ones go in the expanding body under a short heading
const MAX_TITLE = 38;
const HEADINGS: Record<Kind, string> = {
    success: 'Done',
    error: 'Something went wrong',
    warning: 'Heads up',
    info: 'For your information',
};
const DURATION: Record<Kind, number> = { success: 4000, info: 5000, warning: 6000, error: 7000 };

// Same toast fired twice in quick succession (double clicks, effects re-running) shows once
const DEDUPE_MS = 1500;
const recent = new Map<string, number>();

function isDuplicate(key: string): boolean {
    const now = Date.now();
    for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
    if (recent.has(key)) return true;
    recent.set(key, now);
    return false;
}

function clean(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function show(kind: Kind, message: string, description?: string): string | undefined {
    const text = clean(message);
    if (!text || typeof window === 'undefined') return undefined;
    if (isDuplicate(`${kind}:${text}:${description ?? ''}`)) return undefined;

    const fits = text.length <= MAX_TITLE;
    const extra = description ? clean(description) : '';
    return sileo[kind]({
        title: fits ? text : HEADINGS[kind],
        description: fits ? extra || undefined : [text, extra].filter(Boolean).join(' '),
        duration: DURATION[kind],
    });
}

/** Errors whose UI is handled elsewhere (e.g. the axios interceptor redirects) */
function isHandledElsewhere(err: unknown): boolean {
    const code = (err as { code?: unknown } | null)?.code;
    return code === 'ACCOUNT_INACTIVE';
}

/**
 * Best user-facing message from anything a catch block receives. Our axios interceptor rejects
 * with Error(message from the API), so err.message already holds the server's reason.
 */
export function errorText(err: unknown, fallback = 'Please try again.'): string {
    if (typeof err === 'string') return err || fallback;
    if (err && typeof err === 'object') {
        const e = err as { message?: unknown; error?: unknown; response?: { data?: { error?: unknown; message?: unknown } } };
        const candidates = [e.response?.data?.error, e.response?.data?.message, e.error, e.message];
        for (const c of candidates) {
            if (typeof c === 'string' && c.trim() && c !== 'Something went wrong') return c;
        }
    }
    return fallback;
}

interface PromiseMessages<T> {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: unknown) => string);
}

export const notify = {
    success: (message: string, description?: string) => show('success', message, description),
    info: (message: string, description?: string) => show('info', message, description),
    warning: (message: string, description?: string) => show('warning', message, description),

    /** Pass the caught error and a fallback; the server's own reason wins when there is one */
    error(errOrMessage: unknown, fallback?: string) {
        if (isHandledElsewhere(errOrMessage)) return undefined;
        return show('error', errorText(errOrMessage, fallback));
    },

    /** Loading toast that turns into success or error when the promise settles */
    promise<T>(promise: Promise<T> | (() => Promise<T>), m: PromiseMessages<T>): Promise<T> {
        const asOptions = (text: string) => {
            const t = clean(text);
            return t.length <= MAX_TITLE ? { title: t } : { title: t.slice(0, MAX_TITLE - 1) + '…', description: t };
        };
        return sileo.promise(promise, {
            loading: asOptions(m.loading),
            success: (data: T) => ({ ...asOptions(typeof m.success === 'function' ? m.success(data) : m.success), duration: DURATION.success }),
            error: (err: unknown) => ({
                ...asOptions(typeof m.error === 'function' ? m.error(err) : errorText(err, m.error)),
                duration: DURATION.error,
            }),
        });
    },

    dismiss: (id: string) => sileo.dismiss(id),
    clear: () => sileo.clear(),
};
