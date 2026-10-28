'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { formatLocale, type Locale } from './config';

/**
 * Number and date formatting in the visitor's language with 0-9 digits (see formatLocale).
 * Pass the results into messages; messages never format numbers themselves.
 */
export function useFormat() {
    const locale = formatLocale(useLocale() as Locale);
    return useMemo(() => {
        const numbers = new Intl.NumberFormat(locale);
        return {
            number: (n: number) => numbers.format(n),
            date: (d: Date, options: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, options),
        };
    }, [locale]);
}
