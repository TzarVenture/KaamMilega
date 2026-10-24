'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import { syncPush } from '@/lib/push/push';

interface PushOpenMessage {
    type: 'km-push-open';
    link: string;
    notificationId?: string;
}

const isPushOpen = (d: unknown): d is PushOpenMessage =>
    typeof d === 'object' && d !== null && (d as { type?: unknown }).type === 'km-push-open' && typeof (d as { link?: unknown }).link === 'string';

/**
 * Mounted once in the root layout. Renders nothing.
 * - On each visit it refreshes this browser's push registration when push is on (tokens rotate,
 *   and the backend ties them to the current session).
 * - When a push notification is clicked while a KaamMilega tab is open, the service worker
 *   focuses that tab and asks it to open the notification's page; this handles that request.
 */
export default function PushSync() {
    const router = useRouter();

    useEffect(() => {
        // After first paint and idle time, so it never competes with the page
        const id = window.setTimeout(() => void syncPush(isAuthenticated()), 3000);
        return () => window.clearTimeout(id);
    }, []);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        const onMessage = (event: MessageEvent) => {
            if (event.origin && event.origin !== window.location.origin) return;
            if (!isPushOpen(event.data)) return;
            const { link, notificationId } = event.data;
            // In-site paths only
            const path = link.startsWith('/') && !link.startsWith('//') ? link : '/notifications';
            if (notificationId && /^[a-f0-9]{24}$/i.test(notificationId)) {
                api.put(`/notifications/${notificationId}/read`).catch(() => undefined);
            }
            router.push(path);
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [router]);

    return null;
}
