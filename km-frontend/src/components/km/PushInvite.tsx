'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { canInvite } from '@/lib/push/prompt';
import PushPrompt from './PushPrompt';

// Never interrupt sign-in/sign-up, places that already offer it, or screens where a bottom card
// would cover the main action (the chat composer on phones)
const EXCLUDED = ['/login', '/signup', '/register', '/forgot-password', '/recruiter/login', '/recruiter/register', '/recruiter/forgot-password', '/account', '/settings', '/recruiter/settings', '/notifications', '/chat', '/admin', '/dev'];
const SHOW_AFTER_MS = 4000;

const excluded = (path: string) => EXCLUDED.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Mounted once in the root layout. After sign-in or sign-up, once the user has landed on a
 * regular page for a few seconds, offers to turn on browser notifications (floating card).
 * Only cheap checks run here; the Firebase-backed card mounts only when it may actually show.
 */
export default function PushInvite() {
    const pathname = usePathname() || '/';
    const [open, setOpen] = useState(false);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        if (closed || open || excluded(pathname)) return;
        const id = window.setTimeout(() => {
            const permissionUndecided = typeof Notification !== 'undefined' && Notification.permission === 'default';
            if (isAuthenticated() && permissionUndecided && canInvite() && !excluded(window.location.pathname)) {
                setOpen(true);
            }
        }, SHOW_AFTER_MS);
        return () => window.clearTimeout(id);
    }, [pathname, closed, open]);

    if (!open || closed || excluded(pathname)) return null;
    return <PushPrompt variant="floating" onClose={() => setClosed(true)} />;
}
