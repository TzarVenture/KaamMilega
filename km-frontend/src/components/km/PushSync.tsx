'use client';

import { useEffect } from 'react';
import { isAuthenticated } from '@/lib/auth';
import { syncPush } from '@/lib/push/push';

/**
 * Mounted once in the root layout. On each visit it refreshes this browser's push registration
 * when push is on (tokens rotate, and the backend ties them to the current session). Renders nothing.
 */
export default function PushSync() {
    useEffect(() => {
        // After first paint and idle time, so it never competes with the page
        const id = window.setTimeout(() => void syncPush(isAuthenticated()), 3000);
        return () => window.clearTimeout(id);
    }, []);
    return null;
}
