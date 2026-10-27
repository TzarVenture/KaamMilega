'use client';

import { useCallback, useEffect, useState } from 'react';
import { disablePush, enablePush, getPushStatus, PUSH_CHANGE_EVENT, type PushStatus } from './push';

/** Push status for this browser, kept current across tabs, focus changes and permission changes */
export function usePush() {
    const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
        getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
    }, []);

    useEffect(() => {
        refresh();
        // Permission can change in browser settings while the page is open
        window.addEventListener(PUSH_CHANGE_EVENT, refresh);
        window.addEventListener('focus', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(PUSH_CHANGE_EVENT, refresh);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh]);

    const run = useCallback(
        async (action: () => Promise<void>) => {
            setBusy(true);
            try {
                await action();
            } finally {
                setBusy(false);
                refresh();
            }
        },
        [refresh],
    );

    return {
        status,
        busy,
        enable: () => run(enablePush),
        disable: () => run(disablePush),
    };
}
