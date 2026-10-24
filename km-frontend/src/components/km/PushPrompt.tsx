'use client';

import { useState } from 'react';
import { BellRingingIcon, XIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import { canInvite, snoozeInvite } from '@/lib/push/prompt';
import { PushPermissionError } from '@/lib/push/push';
import { usePush } from '@/lib/push/usePush';

/**
 * Invites the user to turn on browser notifications. Shown only when the browser supports push,
 * the user hasn't decided yet in this browser, and the invitation isn't snoozed (lib/push/prompt).
 * The browser's own permission dialog only appears after a click on "Turn on".
 *
 * - inline: a card in the page flow (notifications page)
 * - floating: bottom-right card on desktop, bottom sheet on phones (shown after sign-in)
 */
export default function PushPrompt({ variant = 'inline', onClose }: { variant?: 'inline' | 'floating'; onClose?: () => void }) {
    const { status, busy, enable } = usePush();
    // Safe to read during render: nothing is rendered until the push status has loaded on the
    // client, so server and first client render match either way
    const [hidden, setHidden] = useState(() => !canInvite());

    if (hidden || status !== 'off' || (typeof Notification !== 'undefined' && Notification.permission !== 'default')) {
        return null;
    }

    const close = () => {
        setHidden(true);
        onClose?.();
    };

    const notNow = () => {
        snoozeInvite();
        close();
    };

    const turnOn = async () => {
        try {
            await enable();
            notify.success('Notifications are on', 'We’ll let you know about new messages and application updates.');
            close();
        } catch (err) {
            if (err instanceof PushPermissionError) {
                notify.warning(err.message);
                close();
            } else {
                notify.error(err, 'Could not turn on notifications. Please try again.');
            }
        }
    };

    const floating = variant === 'floating';

    return (
        <section
            role={floating ? 'dialog' : undefined}
            aria-label="Turn on notifications"
            className={
                floating
                    ? 'fixed z-60 inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] bg-km-surface-raised rounded-2xl border border-km-border shadow-[0_18px_44px_-16px_rgba(7,26,77,0.45)] p-4 pr-11 flex items-start gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none'
                    : 'relative bg-km-surface-card rounded-2xl border border-km-border shadow-xs p-4 pr-11 flex items-start gap-3'
            }
        >
            {/* icons.md: no icon containers; the glyph sits directly in the layout */}
            <BellRingingIcon size={24} weight="duotone" className="shrink-0 mt-0.5 text-km-heading dark:text-km-link" aria-hidden="true" />
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
                        className="h-10 sm:h-9 px-4 rounded-xl bg-[#071A4D] hover:bg-[#0B1F52] dark:bg-km-primary text-white text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                        {busy ? 'Turning on…' : 'Turn on notifications'}
                    </button>
                    <button
                        type="button"
                        onClick={notNow}
                        className="h-10 sm:h-9 px-3 rounded-xl text-xs font-semibold text-km-text-secondary hover:bg-km-surface transition-colors"
                    >
                        Not now
                    </button>
                </div>
            </div>
            <button
                type="button"
                onClick={notNow}
                aria-label="Dismiss"
                className="absolute top-3 right-3 p-2 rounded-lg text-km-text-secondary hover:bg-km-surface hover:text-km-text-primary"
            >
                <XIcon size={14} weight="bold" />
            </button>
        </section>
    );
}
