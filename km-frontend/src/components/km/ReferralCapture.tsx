'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getCurrentUser, isAuthenticated } from '@/lib/auth';
import { referralsApi } from '@/lib/api/referrals';

const KEY = 'km_ref';
const KEEP_FOR = 7 * 24 * 60 * 60 * 1000;

function read(): string | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
        if (!code || !at || Date.now() - at > KEEP_FOR) {
            localStorage.removeItem(KEY);
            return null;
        }
        return code;
    } catch {
        return null;
    }
}

function forget() {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // storage blocked: nothing to forget
    }
}

let sending = false;

/**
 * Mounted once in the root layout. Renders nothing.
 * - Any page opened with ?ref=CODE remembers the code in this browser for a week.
 * - Once someone is signed in, it sends the code once: a new account gets linked to the person who
 *   invited them. The server decides if it counts (own code, account older than a day, already
 *   paid…), so the code is dropped after any answer except a network failure.
 */
export default function ReferralCapture() {
    const pathname = usePathname();
    const params = useSearchParams();
    const ref = params.get('ref');

    useEffect(() => {
        const code = ref?.trim().toUpperCase();
        if (code && /^[A-Z0-9]{6,12}$/.test(code)) {
            try {
                localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
            } catch {
                // storage blocked: the invite just won't be linked
            }
        }
    }, [ref]);

    useEffect(() => {
        if (sending || !isAuthenticated()) return;
        // Mid sign-up: wait until the account is complete
        if (getCurrentUser()?.is_registered === false) return;
        const code = read();
        if (!code) return;
        sending = true;
        referralsApi.claim(code)
            .then(forget)
            .catch((err: { status?: number }) => {
                // Keep it only when the request never got an answer (offline, timeout)
                if (err?.status) forget();
            })
            .finally(() => { sending = false; });
    }, [pathname]);

    return null;
}
