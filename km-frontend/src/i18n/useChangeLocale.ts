'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, type Locale } from './config';

/** Remembers the language for a year (also read by the server, see request.ts) */
export function saveLocaleCookie(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Switch language: store the choice, then re-render the page on the server in that language */
export function useChangeLocale() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const change = (locale: Locale) => {
        saveLocaleCookie(locale);
        startTransition(() => router.refresh());
    };
    return { change, pending };
}
