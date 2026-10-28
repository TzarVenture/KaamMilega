'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setErrorTranslator } from '@/lib/notify';

/**
 * Mounted once in the root layout. Renders nothing.
 * Lets errorText / notify.error show API errors in the user's language: the API sends a stable
 * code with each error, and the messages live under "errors" in messages/<locale>.json.
 */
export default function ErrorTranslator() {
    const locale = useLocale();
    const t = useTranslations('errors');

    useEffect(() => {
        setErrorTranslator({ locale, translate: (code) => (t.has(code) ? t(code) : undefined) });
        return () => setErrorTranslator(null);
    }, [locale, t]);

    return null;
}
