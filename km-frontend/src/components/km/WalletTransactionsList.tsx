'use client';

import React, { useEffect, useState } from 'react';
import { ReceiptIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { BadgeTone, EmptyState, FilterTabs, SkeletonRows, StatusBadge } from '@/components/admin/ui';

export interface TransactionItem {
    id: string;
    type: 'credit' | 'debit';
    target_balance: 'main' | 'earnings' | 'locked' | 'bonus';
    category: string;
    amount: number;
    balance_after: number;
    status: 'completed' | 'pending' | 'failed' | 'reversed';
    description: string;
    disputable: boolean;
    created_at: string;
}

type Filter = 'all' | 'credit' | 'debit' | 'earnings';

const CATEGORIES = ['topup', 'pass_purchase', 'session_booking', 'session_payout', 'gig_payout', 'withdrawal', 'bonus_reward', 'refund', 'subscription', 'event_ticket'];
const STATUS_TONE: Record<TransactionItem['status'], BadgeTone> = { completed: 'green', pending: 'amber', failed: 'red', reversed: 'neutral' };

function filterParams(filter: Filter) {
    if (filter === 'credit' || filter === 'debit') return { type: filter };
    if (filter === 'earnings') return { target_balance: 'earnings' };
    return {};
}

interface Props {
    refreshKey?: number;
    onRaiseDispute: (transaction: TransactionItem) => void;
}

export default function WalletTransactionsList({ refreshKey = 0, onRaiseDispute }: Props) {
    const t = useTranslations('walletPage');
    const locale = useLocale();
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        api.get<unknown, { transactions: TransactionItem[]; total_pages: number }>('/wallet/transactions', { params: { page, limit: 10, ...filterParams(filter) } })
            .then((res) => { setItems(res.transactions || []); setTotalPages(res.total_pages || 1); })
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [page, filter, refreshKey]);

    return (
        <>
            <div className="px-5 py-4 border-b border-km-border-subtle overflow-x-auto">
                <FilterTabs
                    value={filter}
                    onChange={(next) => { setFilter(next); setPage(1); }}
                    options={[
                        { value: 'all', label: t('filter.all') },
                        { value: 'credit', label: t('filter.in') },
                        { value: 'debit', label: t('filter.out') },
                        { value: 'earnings', label: t('filter.earnings') },
                    ]}
                />
            </div>

            {loading ? (
                <SkeletonRows rows={5} />
            ) : items.length === 0 ? (
                <EmptyState icon={ReceiptIcon} title={t('noActivity')} description={filter === 'all' ? t('noActivityHint') : undefined} />
            ) : (
                <ul className="divide-y divide-km-border-subtle">
                    {items.map((tx) => {
                        const credit = tx.type === 'credit';
                        return (
                            <li key={tx.id} className="flex items-start justify-between gap-4 px-5 py-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-km-heading">{CATEGORIES.includes(tx.category) ? t(`category.${tx.category}`) : t('category.other')}</p>
                                    {tx.description && <p className="mt-0.5 text-sm text-km-text-secondary truncate">{tx.description}</p>}
                                    <p className="mt-0.5 text-xs text-km-text-secondary font-inter">
                                        {dateTime(tx.created_at, locale)} · {t(`balanceName.${tx.target_balance}`)}
                                    </p>
                                    {tx.disputable && (
                                        <button type="button" onClick={() => onRaiseDispute(tx)} className="mt-1 text-sm font-medium text-km-link hover:underline cursor-pointer">
                                            {t('requestRefund')}
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className={`text-sm font-semibold font-inter tabular-nums ${credit ? 'text-emerald-700 dark:text-emerald-400' : 'text-km-heading'}`}>
                                        {credit ? '+' : '-'}{inr(tx.amount)}
                                    </span>
                                    {tx.status !== 'completed' && <StatusBadge tone={STATUS_TONE[tx.status]}>{t(`transactionStatus.${tx.status}`)}</StatusBadge>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
        </>
    );
}
