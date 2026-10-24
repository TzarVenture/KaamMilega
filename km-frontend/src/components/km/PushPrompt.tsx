'use client';

import { useState } from 'react';
import { BellRingingIcon, XIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import { PushPermissionError } from '@/lib/push/push';
import { usePush } from '@/lib/push/usePush';

const DISMISS_KEY = 'km-push-prompt-dismissed';

/**
 * Invites the user to turn on browser notifications. Shown only when the browser supports push,
 * the user hasn't decided yet in this browser, and hasn't dismissed it. The browser's permission
 * prompt only appears after the click on "Turn on", never on its own.
 */
export default function PushPrompt() {
    const { status, busy, enable } = usePush();
    // Safe to read during render: nothing is rendered until the push status has loaded on the
    // client, so server and first client render match either way
    const [dismissed, setDismissed] = useState(() => {
        try {
            return typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
        } catch {
            return false;
        }
    });

    if (dismissed || status !== 'off' || (typeof Notification !== 'undefined' && Notification.permission !== 'default')) {
        return null;
    }

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Storage blocked: hidden for this page view
        }
    };

    const turnOn = async () => {
        try {
            await enable();
            notify.success('Notifications are on', 'We’ll let you know about new messages and application updates.');
        } catch (err) {
            if (err instanceof PushPermissionError) notify.warning(err.message);
            else notify.error(err, 'Could not turn on notifications. Please try again.');
        }
    };

    return (
        <section
            aria-label="Turn on notifications"
            className="relative bg-km-surface-card rounded-2xl border border-km-border shadow-xs p-4 pr-11 flex items-start gap-3"
        >
            <span className="shrink-0 w-10 h-10 rounded-full bg-[#FF6B00]/12 text-[#C2410C] dark:text-[#FF9A4D] flex items-center justify-center" aria-hidden="true">
                <BellRingingIcon size={20} weight="bold" />
            </span>
            <div className="min-w-0">
                <h2 className="text-sm font-bold text-km-heading">Never miss a reply</h2>
                <p className="mt-0.5 text-xs text-km-text-secondary leading-relaxed">
                    Get a notification when an employer messages you or your application moves forward, even when KaamMilega is closed.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void turnOn()}
                        disabled={busy}
                        className="h-9 px-4 rounded-xl bg-[#071A4D] hover:bg-[#0B1F52] dark:bg-km-primary text-white text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                        {busy ? 'Turning on…' : 'Turn on notifications'}
                    </button>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="h-9 px-3 rounded-xl text-xs font-semibold text-km-text-secondary hover:bg-km-surface transition-colors"
                    >
                        Not now
                    </button>
                </div>
            </div>
            <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute top-3 right-3 p-1.5 rounded-lg text-km-text-secondary hover:bg-km-surface hover:text-km-text-primary"
            >
                <XIcon size={14} weight="bold" />
            </button>
        </section>
    );
}
