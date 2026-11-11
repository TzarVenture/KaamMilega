'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { WalletIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { inr } from '@/lib/money';
import { EmptyState, FilterTabs, StatCard, btn, cx } from '@/components/admin/ui';
import WalletTransactionsList, { TransactionItem } from '@/components/km/WalletTransactionsList';
import WalletWithdrawalsList from '@/components/km/WalletWithdrawalsList';
import WalletDisputesList from '@/components/km/WalletDisputesList';
import WalletDisputeModal from '@/components/km/WalletDisputeModal';
import AddMoneyModal from '@/components/km/AddMoneyModal';
import WithdrawModal from '@/components/km/WithdrawModal';
import InstantPassCard from '@/components/instant-milega/InstantPassCard';

export interface WalletSummary {
    total_balance: number;
    withdrawable_balance: number;
    main_balance: number;
    earnings_balance: number;
    locked_balance: number;
    bonus_balance: number;
    status: string;
}

type Tab = 'activity' | 'withdrawals' | 'disputes';

export default function WalletPage() {
    const t = useTranslations('walletPage');
    const [wallet, setWallet] = useState<WalletSummary | null>(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState<Tab>('activity');
    const [refreshKey, setRefreshKey] = useState(0);
    const [adding, setAdding] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [disputing, setDisputing] = useState<TransactionItem | null>(null);

    const load = useCallback(() => {
        api.get<unknown, WalletSummary>('/wallet/balance')
            .then((summary) => { setWallet(summary); setFailed(false); })
            .catch(() => setFailed(true));
    }, []);

    useEffect(() => { load(); }, [load]);

    const refresh = useCallback(() => {
        load();
        setRefreshKey((key) => key + 1);
    }, [load]);

    const closeWithdraw = useCallback(() => setWithdrawing(false), []);

    const onHold = wallet !== null && wallet.status !== 'active';
    const value = (amount: number | undefined) => (wallet ? inr(amount) : '…');

    return (
        <main className="min-h-screen bg-km-surface px-4 py-6 sm:px-6 lg:py-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-2xl font-bold text-km-heading tracking-tight">{t('title')}</h1>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setAdding(true)} disabled={!wallet || onHold} className={cx(btn.accent, 'flex-1 sm:flex-none')}>{t('addMoney')}</button>
                        <button type="button" onClick={() => setWithdrawing(true)} disabled={!wallet || onHold} className={cx(btn.secondary, 'flex-1 sm:flex-none')}>{t('withdraw')}</button>
                    </div>
                </div>

                {onHold && (
                    <p className="flex items-start gap-2 rounded-xl border border-km-border bg-km-surface-card px-4 py-3 text-sm text-km-text-primary">
                        <WarningCircleIcon size={20} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        {t('onHold')}
                    </p>
                )}

                {failed ? (
                    <div className="bg-km-surface-card border border-km-border rounded-2xl">
                        <EmptyState
                            icon={WalletIcon}
                            title={t('loadFailed')}
                            action={<button type="button" onClick={load} className={btn.secondary}>{t('tryAgain')}</button>}
                        />
                    </div>
                ) : (
                    <div className={cx('grid gap-4 sm:grid-cols-3', (wallet?.bonus_balance ?? 0) > 0 && 'lg:grid-cols-4')}>
                        <StatCard label={t('spending')} value={value(wallet?.main_balance)} hint={t('spendingHint')} />
                        <StatCard label={t('earnings')} value={value(wallet?.earnings_balance)} hint={t('earningsHint')} />
                        <StatCard label={t('held')} value={value(wallet?.locked_balance)} hint={t('heldHint')} />
                        {(wallet?.bonus_balance ?? 0) > 0 && <StatCard label={t('bonus')} value={value(wallet?.bonus_balance)} />}
                    </div>
                )}

                {!failed && <InstantPassCard onBought={refresh} />}

                <section className="bg-km-surface-card border border-km-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-km-border-subtle overflow-x-auto">
                        <FilterTabs
                            value={tab}
                            onChange={setTab}
                            options={[
                                { value: 'activity', label: t('tabs.activity') },
                                { value: 'withdrawals', label: t('tabs.withdrawals') },
                                { value: 'disputes', label: t('tabs.refunds') },
                            ]}
                        />
                    </div>
                    {tab === 'activity' && <WalletTransactionsList refreshKey={refreshKey} onRaiseDispute={setDisputing} />}
                    {tab === 'withdrawals' && <WalletWithdrawalsList refreshKey={refreshKey} />}
                    {tab === 'disputes' && <WalletDisputesList refreshKey={refreshKey} />}
                </section>
            </div>

            <AddMoneyModal isOpen={adding} onClose={() => setAdding(false)} onAdded={refresh} />
            <WithdrawModal isOpen={withdrawing} available={wallet?.withdrawable_balance ?? 0} onClose={closeWithdraw} onRequested={() => { refresh(); setTab('withdrawals'); }} />
            <WalletDisputeModal transaction={disputing} onClose={() => setDisputing(null)} onCreated={() => { refresh(); setTab('disputes'); }} />
        </main>
    );
}
