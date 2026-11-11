'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { useFormat } from '@/i18n/useFormat';

/**
 * Real open-job counts: GET /jobs?…&limit=1 returns the matching `total`. Cards show these instead
 * of invented totals; while loading, or with no matches, they say "Browse jobs".
 */
export function useJobCounts(queries: string[]): Record<string, number> {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const key = queries.join('\n');
    useEffect(() => {
        let alive = true;
        Promise.all(
            key.split('\n').map((q) =>
                api
                    .get(`/jobs?limit=1&${q}`)
                    .then((res) => {
                        const total = (res as unknown as { total?: unknown })?.total;
                        return [q, typeof total === 'number' ? total : 0] as const;
                    })
                    .catch(() => [q, 0] as const),
            ),
        ).then((entries) => alive && setCounts(Object.fromEntries(entries)));
        return () => {
            alive = false;
        };
    }, [key]);
    return counts;
}

/** "12 open jobs" in the visitor's language, or "Browse jobs" when there are none */
export function useOpeningsLabel() {
    const tc = useTranslations('common');
    const { number } = useFormat();
    return (n?: number) => (n && n > 0 ? tc('openJobs', { count: n, n: number(n) }) : tc('browseJobs'));
}
