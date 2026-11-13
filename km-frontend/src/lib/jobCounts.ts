'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { useFormat } from '@/i18n/useFormat';

/**
 * Real open-job counts for cards. Each query is "search=<word>" or "education=<level>"; all of them go
 * in one GET /jobs/counts request. While loading, or with no matches, cards say "Browse jobs".
 */
export function useJobCounts(queries: string[]): Record<string, number> {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const key = queries.join("\n");
    useEffect(() => {
        let alive = true;
        const list = key.split("\n").filter(Boolean);
        api.get(`/jobs/counts?${list.join("&")}`)
            .then((res) => {
                const body = res as unknown as { search?: Record<string, number>; education?: Record<string, number> };
                const out: Record<string, number> = {};
                for (const q of list) {
                    const at = q.indexOf("=");
                    const kind = q.slice(0, at) as "search" | "education";
                    const value = decodeURIComponent(q.slice(at + 1));
                    out[q] = body?.[kind]?.[value] ?? 0;
                }
                if (alive) setCounts(out);
            })
            .catch(() => {}); // cards fall back to "Browse jobs"
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
