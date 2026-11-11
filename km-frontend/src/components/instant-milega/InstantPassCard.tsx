'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { inr } from '@/lib/money';
import { btn } from '@/components/admin/ui';
import InstantPassModal, { PASS_PRICE, PassStatus, fetchPassStatus, passDate } from './InstantPassModal';

/** Shows the user's InstantPass credits and expiry, with a way to buy one */
export default function InstantPassCard({ onBought }: { onBought?: () => void }) {
    const t = useTranslations('instantPass');
    const locale = useLocale();
    const [status, setStatus] = useState<PassStatus | null>(null);
    const [buying, setBuying] = useState(false);

    const load = useCallback(() => {
        fetchPassStatus().then(setStatus).catch(() => setStatus(null));
    }, []);
    useEffect(() => { load(); }, [load]);

    if (!status) return null;

    const active = status.has_active_pass;
    const hasCredits = active && status.quota_remaining > 0;
    const until = passDate(status.pass_expires_at, locale);

    let detail: string;
    if (hasCredits) detail = `${t('creditsLeft', { count: status.quota_remaining, total: status.quota_total })} · ${t('validUntil', { date: until })}`;
    else if (active) detail = t('usedUp', { date: until });
    else detail = t('none', { price: inr(PASS_PRICE) });

    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-km-border bg-km-surface-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="text-base font-semibold text-km-heading">{t('title')}</h2>
                <p className="mt-0.5 text-sm text-km-text-secondary">{detail}</p>
            </div>
            {!hasCredits && (
                <button type="button" onClick={() => setBuying(true)} className={btn.secondary}>
                    {active ? t('buyAgain') : t('buy')}
                </button>
            )}
            <InstantPassModal
                isOpen={buying}
                onClose={() => setBuying(false)}
                onSuccess={() => { load(); onBought?.(); }}
            />
        </section>
    );
}
