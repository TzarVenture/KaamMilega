'use client';

import React, { useEffect, useState } from 'react';
import { BankIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { BadgeTone, EmptyState, SkeletonRows, StatusBadge } from '@/components/admin/ui';

interface WithdrawalItem {
    id: string;
    amount: number;
    status: 'requested' | 'processing' | 'paid' | 'failed';
    payout_method: 'bank' | 'upi';
    account_last4?: string;
    upi_id?: string;
    bank_reference?: string;
    failure_reason?: string;
    created_at: string;
}

const TONE: Record<WithdrawalItem['status'], BadgeTone> = { requested: 'amber', processing: 'blue', paid: 'green', failed: 'red' };

export default function WalletWithdrawalsList({ refreshKey = 0 }: { refreshKey?: number }) {
    const t = useTranslations('walletPage');
    const locale = useLocale();
    const [items, setItems] = useState<WithdrawalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        api.get<unknown, { withdrawals: WithdrawalItem[]; total_pages: number }>('/wallet/withdrawals', { params: { page, limit: 10 } })
            .then((res) => { setItems(res.withdrawals || []); setTotalPages(res.total_pages || 1); })
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [page, refreshKey]);

    if (loading) return <SkeletonRows rows={3} />;
    if (items.length === 0) return <EmptyState icon={BankIcon} title={t('noWithdrawals')} description={t('noWithdrawalsHint')} />;

    return (
        <>
            <ul className="divide-y divide-km-border-subtle">
                {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-km-heading">
                                {item.payout_method === 'upi' ? item.upi_id : t('bankEnding', { last4: item.account_last4 ?? '' })}
                            </p>
                            <p className="mt-0.5 text-xs text-km-text-secondary font-inter">{dateTime(item.created_at, locale)}</p>
                            {item.bank_reference && <p className="mt-1 text-xs text-km-text-secondary font-inter">{t('bankReference', { reference: item.bank_reference })}</p>}
                            {item.failure_reason && <p className="mt-1 text-sm text-km-text-primary">{item.failure_reason}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-sm font-semibold text-km-heading font-inter tabular-nums">{inr(item.amount)}</span>
                            <StatusBadge tone={TONE[item.status]}>{t(`withdrawalStatus.${item.status}`)}</StatusBadge>
                        </div>
                    </li>
                ))}
            </ul>
            {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
        </>
    );
}
