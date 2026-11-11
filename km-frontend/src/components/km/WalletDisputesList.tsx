'use client';

import React, { useEffect, useState } from 'react';
import { ShieldWarningIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { BadgeTone, EmptyState, SkeletonRows, StatusBadge } from '@/components/admin/ui';

interface DisputeItem {
    id: string;
    amount: number;
    refund_amount?: number;
    reason: string;
    description: string;
    status: 'pending' | 'under_review' | 'approved' | 'rejected';
    admin_notes?: string;
    created_at: string;
}

const TONE: Record<DisputeItem['status'], BadgeTone> = { pending: 'amber', under_review: 'blue', approved: 'green', rejected: 'red' };

export default function WalletDisputesList({ refreshKey = 0 }: { refreshKey?: number }) {
    const t = useTranslations('walletPage');
    const locale = useLocale();
    const [items, setItems] = useState<DisputeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        api.get<unknown, { disputes: DisputeItem[]; total_pages: number }>('/wallet/my/disputes', { params: { page, limit: 10 } })
            .then((res) => { setItems(res.disputes || []); setTotalPages(res.total_pages || 1); })
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [page, refreshKey]);

    if (loading) return <SkeletonRows rows={3} />;
    if (items.length === 0) return <EmptyState icon={ShieldWarningIcon} title={t('noDisputes')} description={t('noDisputesHint')} />;

    return (
        <>
            <ul className="divide-y divide-km-border-subtle">
                {items.map((item) => (
                    <li key={item.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-km-heading">{t(`disputeReason.${item.reason}`)}</p>
                                <p className="mt-0.5 text-xs text-km-text-secondary font-inter">{dateTime(item.created_at, locale)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-sm font-semibold text-km-heading font-inter tabular-nums">{inr(item.amount)}</span>
                                <StatusBadge tone={TONE[item.status]}>{t(`disputeStatus.${item.status}`)}</StatusBadge>
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-km-text-primary whitespace-pre-line">{item.description}</p>
                        {item.status === 'approved' && (
                            <p className="mt-2 text-sm text-km-text-secondary">{t('disputeRefunded', { amount: inr(item.refund_amount || item.amount) })}</p>
                        )}
                        {item.admin_notes && <p className="mt-2 text-sm text-km-text-secondary"><span className="font-medium text-km-heading">{t('supportReply')}: </span>{item.admin_notes}</p>}
                    </li>
                ))}
            </ul>
            {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
        </>
    );
}
