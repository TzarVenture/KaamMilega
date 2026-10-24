'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { PushPermissionError } from '@/lib/push/push';
import { usePush } from '@/lib/push/usePush';
import { Badge, SettingRow, Toggle, buttonSecondary } from './SettingsPrimitives';

const TEST_DELAY_SECONDS = 5;

/**
 * "Push notifications on this browser". The switch is per browser: turning it off here leaves
 * the user's phone and other browsers untouched. Turning it on also switches on the account's
 * push setting, which the backend checks before sending; `onEnabled` lets the settings page
 * keep its copy in sync so a later save doesn't switch it back off.
 */
export default function PushSettingRow({ onEnabled }: { onEnabled: () => void }) {
    const { status, busy, enable, disable } = usePush();
    const [testing, setTesting] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const change = async (next: boolean) => {
        try {
            if (next) {
                await enable();
                onEnabled();
                notify.success('Notifications are on for this browser');
            } else {
                await disable();
                notify.info('Notifications are off for this browser');
            }
        } catch (err) {
            if (err instanceof PushPermissionError) notify.warning(err.message);
            else notify.error(err, 'Could not change notifications. Please try again.');
        }
    };

    // A real push to the user's own devices, to check delivery end to end. Browsers only show a
    // system notification while KaamMilega isn't on screen, so it's sent after a short countdown
    // that gives the user time to switch to another tab or app.
    const sendTest = async () => {
        setTesting(true);
        try {
            for (let s = TEST_DELAY_SECONDS; s > 0; s--) {
                setCountdown(s);
                await new Promise((r) => setTimeout(r, 1000));
            }
            setCountdown(0);
            const res = (await api.post('/push/test')) as { devices: number; sent: number };
            if (res.sent > 0) {
                notify.success(
                    'Test notification sent',
                    `Sent to ${res.sent} device${res.sent === 1 ? '' : 's'}. It appears as a system notification while KaamMilega isn’t the tab or app you’re looking at.`,
                );
            } else {
                notify.warning('No device received it', 'Turn notifications off and on again in this browser, then retry.');
            }
        } catch (err) {
            notify.error(err, 'Could not send a test notification.');
        } finally {
            setCountdown(0);
            setTesting(false);
        }
    };

    const description =
        status === 'unsupported'
            ? 'This browser can’t show notifications. Use a recent Chrome, Edge, Firefox or Safari (on iPhone, add KaamMilega to your Home Screen first).'
            : status === 'denied'
              ? 'Notifications are blocked for KaamMilega in this browser. Click the lock icon next to the address, allow Notifications, then switch this on.'
              : 'New messages, application updates and interviews, even when KaamMilega isn’t open. Only on this browser; your phone has its own setting.';

    return (
        <>
            <SettingRow
                title="Push notifications on this browser"
                badge={status === 'denied' ? <Badge tone="warn">Blocked</Badge> : status === 'on' ? <Badge tone="ok">On</Badge> : undefined}
                description={description}
                control={
                    <Toggle
                        checked={status === 'on'}
                        onChange={(v) => void change(v)}
                        label="Push notifications on this browser"
                        disabled={busy || status === 'loading' || status === 'unsupported' || status === 'denied'}
                    />
                }
            />
            {status === 'on' && (
                <SettingRow
                    title="Test notification"
                    description={countdown > 0
                        ? `Sending in ${countdown}s. Switch to another tab or app now to see it arrive.`
                        : "Sends one 5 seconds after you click, so you can switch to another tab or app and see it arrive."}
                    control={
                        <button type="button" onClick={() => void sendTest()} disabled={testing} className={buttonSecondary}>
                            {countdown > 0 ? `Sending in ${countdown}…` : testing ? 'Sending…' : 'Send test'}
                        </button>
                    }
                />
            )}
        </>
    );
}
