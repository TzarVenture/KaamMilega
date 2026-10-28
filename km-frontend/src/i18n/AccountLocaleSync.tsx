'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getCurrentUser, isAuthenticated } from '@/lib/auth';
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';
import { saveLocaleCookie } from './useChangeLocale';

const SYNCED_KEY = 'km_locale_synced';

/**
 * Mounted once in the root layout (when languages are on). Renders nothing.
 * Makes the language follow the account: after sign-in on a new device, the language saved in
 * Settings is applied here. Accounts start on English, so when the account is on English and this
 * browser already has another language chosen (picked before signing in), that choice is saved to
 * the account instead. Runs once per user per browser session.
 */
export default function AccountLocaleSync() {
    const router = useRouter();
    const pathname = usePathname();
    const current = useLocale() as Locale;

    useEffect(() => {
        if (!isAuthenticated()) return;
        const user = getCurrentUser();
        const userId = user?.id || user?._id;
        if (!userId) return;
        try {
            if (sessionStorage.getItem(SYNCED_KEY) === userId) return;
        } catch {
            // Storage unavailable (private mode): sync anyway, it is a single request
        }

        let cancelled = false;
        api.get('/user/settings')
            .then((res: unknown) => {
                if (cancelled) return;
                const settings = (res || {}) as Record<string, unknown>;
                const saved = settings.language;
                if (isLocale(saved) && saved !== DEFAULT_LOCALE) {
                    if (saved !== current) {
                        saveLocaleCookie(saved);
                        router.refresh();
                    }
                } else if (current !== DEFAULT_LOCALE) {
                    // PUT /user/settings takes the whole settings object
                    return api.put('/user/settings', { ...settings, language: current }).then(() => undefined);
                }
            })
            .then(() => {
                try {
                    sessionStorage.setItem(SYNCED_KEY, userId);
                } catch {
                    // ignore
                }
            })
            .catch(() => {
                // Try again on the next page; the site keeps working in the current language
            });
        return () => {
            cancelled = true;
        };
        // pathname: sign-in finishes with a client-side navigation, so re-check on each page
    }, [pathname, current, router]);

    return null;
}
