'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';

/**
 * The one way to show a toast in KaamMilega. Pages never import the toast library directly,
 * so the library (sonner) can be swapped by editing this file and AppToaster only.
 *
 *   notify.success('Profile updated')
 *   notify.error(err, 'Could not save your profile')   // shows the server's message when there is one
 *   notify.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Could not save' })
 */

type Kind = 'success' | 'error' | 'warning' | 'info';

const DURATION: Record<Kind, number> = { success: 4000, info: 5000, warning: 6000, error: 7000 };

function clean(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function show(kind: Kind, message: string, description?: string): string | number | undefined {
    const text = clean(message);
    if (!text || typeof window === 'undefined') return undefined;
    const extra = description ? clean(description) : undefined;
    // A stable id makes a repeat of the same toast (double clicks, effects re-running) refresh
    // the visible one instead of stacking copies
    return toast[kind](text, { id: `${kind}:${text}:${extra ?? ''}`, description: extra, duration: DURATION[kind] });
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

    /** Loading toast that turns into success or error when the promise settles; returns the original promise */
    promise<T>(promise: Promise<T> | (() => Promise<T>), m: PromiseMessages<T>): Promise<T> {
        const p = typeof promise === 'function' ? promise() : promise;
        toast.promise(p, {
            loading: m.loading,
            success: (data: T) => (typeof m.success === 'function' ? m.success(data) : m.success),
            error: (err: unknown) => (typeof m.error === 'function' ? m.error(err) : errorText(err, m.error)),
        });
        return p;
    },

    /**
     * Live activity (new message, job update...): neutral card with the sender's avatar or a
     * category icon and an action button. Same toaster, so it stacks with everything else.
     */
    alert(a: { id: string; title: string; description?: string; icon?: ReactNode; actionLabel: string; onAction: () => void }) {
        if (typeof window === 'undefined') return undefined;
        return toast(clean(a.title), {
            id: `alert:${a.id}`,
            description: a.description ? clean(a.description) : undefined,
            icon: a.icon,
            duration: 6000,
            action: { label: a.actionLabel, onClick: a.onAction },
        });
    },

    dismiss: (id?: string | number) => toast.dismiss(id),
};
