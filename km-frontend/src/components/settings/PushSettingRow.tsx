'use client';

import { notify } from '@/lib/notify';
import { PushPermissionError } from '@/lib/push/push';
import { usePush } from '@/lib/push/usePush';
import { Badge, SettingRow, Toggle } from './SettingsPrimitives';

/**
 * "Browser notifications". The switch is per browser: turning it off here leaves the user's
 * phone and other browsers untouched. Turning it on also switches on the account's push
 * setting, which the backend checks before sending; `onEnabled` lets the settings page keep its
 * copy in sync so a later save doesn't switch it back off.
 */
export default function PushSettingRow({ onEnabled }: { onEnabled: () => void }) {
    const { status, busy, enable, disable } = usePush();

    const change = async (next: boolean) => {
        try {
            if (next) {
                await enable();
                onEnabled();
                notify.success('Browser notifications turned on');
            } else {
                await disable();
                notify.success('Browser notifications turned off');
            }
        } catch (err) {
            if (err instanceof PushPermissionError) notify.warning(err.message);
            else notify.error(err, 'Could not change notifications. Please try again.');
        }
    };

    const description =
        status === 'unsupported'
            ? 'This browser doesn’t support notifications. Try a recent version of Chrome, Edge, Firefox or Safari.'
            : status === 'denied'
              ? 'Notifications are blocked for KaamMilega. To allow them, click the icon to the left of the address bar, set Notifications to Allow, then reload the page.'
              : 'Get notified about new messages, application updates and interviews on this browser, even when KaamMilega is closed.';

    return (
        <SettingRow
            title="Browser notifications"
            badge={status === 'denied' ? <Badge tone="warn">Blocked</Badge> : undefined}
            description={description}
            control={
                <Toggle
                    checked={status === 'on'}
                    onChange={(v) => void change(v)}
                    label="Browser notifications"
                    disabled={busy || status === 'loading' || status === 'unsupported' || status === 'denied'}
                />
            }
        />
    );
}
