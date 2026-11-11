'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { inr } from '@/lib/money';
import { btn, cx } from '@/components/admin/ui';
import AddMoneyModal from './AddMoneyModal';

interface Balances {
    main_balance: number;
    earnings_balance: number;
    status: string;
}

/** The wallet at a glance, for sidebars. The full view lives at /wallet. */
export default function WalletSummaryCard() {
    const t = useTranslations('walletPage');
    const [wallet, setWallet] = useState<Balances | null>(null);
    const [adding, setAdding] = useState(false);

    const load = useCallback(() => {
        api.get<unknown, Balances>('/wallet/balance').then(setWallet).catch(() => setWallet(null));
    }, []);

    useEffect(() => { load(); }, [load]);

    const rows = [
        { label: t('spending'), amount: wallet?.main_balance },
        { label: t('earnings'), amount: wallet?.earnings_balance },
    ];

    return (
        <section className="bg-km-surface-card border border-km-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-km-heading">{t('title')}</h2>
                <Link href="/wallet" className="text-sm font-medium text-km-link hover:underline">{t('viewWallet')}</Link>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4">
                {rows.map((row) => (
                    <div key={row.label}>
                        <dt className="text-sm text-km-text-secondary">{row.label}</dt>
                        <dd className="mt-0.5 text-xl font-semibold text-km-heading font-inter tabular-nums">{wallet ? inr(row.amount) : '…'}</dd>
                    </div>
                ))}
            </dl>

            <button type="button" onClick={() => setAdding(true)} disabled={!wallet || wallet.status !== 'active'} className={cx(btn.accent, 'mt-4 w-full')}>
                {t('addMoney')}
            </button>

            <AddMoneyModal isOpen={adding} onClose={() => setAdding(false)} onAdded={load} />
        </section>
    );
}
