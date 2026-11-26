'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowCounterClockwiseIcon, ArrowsClockwiseIcon, CircleNotchIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { AdminModal, AdminPageHeader, AdminPanel, BadgeTone, EmptyState, FilterTabs, SkeletonRows, StatusBadge, btn, field, table } from '@/components/admin/ui';

type Status = 'requested' | 'refunded' | 'rejected';

interface Part {
    razorpay_order_id: string;
    amount: number;
}

interface TopupRefund {
    id: string;
    amount: number;
    refunded: number;
    status: Status;
    reason?: string;
    reject_reason?: string;
    parts: Part[];
    user_name?: string;
    user_email?: string;
    created_at: string;
    decided_at?: string;
}

const STATUS_META: Record<Status, { label: string; tone: BadgeTone }> = {
    requested: { label: 'Waiting', tone: 'amber' },
    refunded: { label: 'Refunded', tone: 'green' },
    rejected: { label: 'Declined', tone: 'red' },
};

/** Members asking for their unspent top-up money back. Approving sends it to their original payments. */
export default function AdminTopupRefundsPage() {
    const [items, setItems] = useState<TopupRefund[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Status | 'all'>('requested');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [selected, setSelected] = useState<TopupRefund | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<unknown, { refunds: TopupRefund[]; total_pages: number }>('/admin/topup-refunds', {
                params: { page, limit: 20, ...(filter !== 'all' && { status: filter }) },
            });
            setItems(res.refunds || []);
            setTotalPages(res.total_pages || 1);
        } catch (err) {
            notify.error(err, "Couldn't load refund requests");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [page, filter]);

    useEffect(() => { load(); }, [load]);

    const open = (r: TopupRefund) => {
        setSelected(r);
        setReason('');
    };

    const close = () => { if (!busy) setSelected(null); };

    const decide = async (action: 'approve' | 'reject') => {
        if (!selected) return;
        setBusy(true);
        try {
            const updated = await api.post<unknown, TopupRefund>(
                `/admin/topup-refunds/${selected.id}/${action}`,
                action === 'reject' ? { reason: reason.trim() } : undefined,
            );
            if (updated.status === 'refunded') notify.success(`${inr(updated.refunded)} is being refunded`);
            else notify.info('Declined. The money is back in their wallet.');
            setSelected(null);
            load();
        } catch (err) {
            notify.error(err, "Couldn't update the request");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Top-up refunds"
                description="Members asking for their unspent wallet money back. Approving sends it to their original payments through Razorpay."
                actions={<button type="button" onClick={load} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <AdminPanel>
                <div className="px-5 py-4 border-b border-km-border-subtle overflow-x-auto">
                    <FilterTabs
                        value={filter}
                        onChange={(next) => { setFilter(next); setPage(1); }}
                        options={[
                            { value: 'requested', label: 'Waiting' },
                            { value: 'refunded', label: 'Refunded' },
                            { value: 'rejected', label: 'Declined' },
                            { value: 'all', label: 'All' },
                        ]}
                    />
                </div>

                {loading ? <SkeletonRows rows={5} /> : items.length === 0 ? (
                    <EmptyState icon={ArrowCounterClockwiseIcon} title="No refund requests here" description="Requests from members appear here." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Person</th>
                                    <th className={`${table.th} text-right`}>Amount</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}>Requested</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((r) => (
                                    <tr key={r.id} className={table.row}>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading truncate max-w-[220px]">{r.user_name || 'Member'}</p>
                                            {r.user_email && <p className="text-xs text-km-text-secondary truncate max-w-[220px]">{r.user_email}</p>}
                                        </td>
                                        <td className={`${table.td} text-right font-medium text-km-heading font-inter tabular-nums whitespace-nowrap`}>{inr(r.amount)}</td>
                                        <td className={table.td}><StatusBadge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</StatusBadge></td>
                                        <td className={`${table.td} text-xs text-km-text-secondary font-inter whitespace-nowrap`}>{dateTime(r.created_at)}</td>
                                        <td className={`${table.td} text-right`}><button type="button" onClick={() => open(r)} className={`${btn.secondary} h-9 px-3`}>Open</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
            </AdminPanel>

            <AdminModal isOpen={!!selected} onClose={close} title={selected ? `Refund of ${inr(selected.amount)}` : ''}>
                {selected && (
                    <div className="space-y-4">
                        <dl className="rounded-xl border border-km-border-subtle divide-y divide-km-border-subtle text-sm">
                            {[
                                ['Status', <StatusBadge key="s" tone={STATUS_META[selected.status].tone}>{STATUS_META[selected.status].label}</StatusBadge>],
                                ['Person', selected.user_name || selected.user_email || 'Member'],
                                ['Requested', dateTime(selected.created_at)],
                                ...(selected.reason ? [['Their reason', selected.reason]] : []),
                                ...(selected.status === 'refunded' ? [['Sent back', inr(selected.refunded)]] : []),
                                ...(selected.reject_reason ? [['Why declined', selected.reject_reason]] : []),
                                ...(selected.decided_at ? [['Decided', dateTime(selected.decided_at)]] : []),
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex justify-between gap-4 px-4 py-2.5">
                                    <dt className="text-km-text-secondary shrink-0">{label}</dt>
                                    <dd className="text-right text-km-text-primary break-words">{value}</dd>
                                </div>
                            ))}
                        </dl>

                        {selected.parts.length > 0 && (
                            <div>
                                <p className={field.label}>Razorpay refunds</p>
                                <ul className="rounded-xl border border-km-border-subtle divide-y divide-km-border-subtle text-sm">
                                    {selected.parts.map((p) => (
                                        <li key={p.razorpay_order_id} className="flex justify-between gap-4 px-4 py-2.5">
                                            <span className="text-km-text-secondary font-inter break-all">{p.razorpay_order_id}</span>
                                            <span className="font-medium text-km-heading font-inter tabular-nums">{inr(p.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {selected.status === 'requested' && (
                            <>
                                <button type="button" onClick={() => decide('approve')} disabled={busy} className={`${btn.primary} w-full`}>
                                    {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                    Approve and refund {inr(selected.amount)}
                                </button>
                                <p className={field.hint}>
                                    The money goes back to their top-up payments, newest first. The company pays Razorpay&apos;s fee. Banks usually take 5 to 7 working days.
                                </p>

                                <label className="block">
                                    <span className={field.label}>Reason to decline</span>
                                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={field.input} />
                                    <span className={field.hint}>The person sees this, and the money goes back to their wallet.</span>
                                </label>
                                <button type="button" onClick={() => decide('reject')} disabled={busy || !reason.trim()} className={`${btn.danger} w-full`}>Decline</button>
                            </>
                        )}
                    </div>
                )}
            </AdminModal>
        </div>
    );
}
