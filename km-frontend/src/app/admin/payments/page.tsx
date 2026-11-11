'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, CircleNotchIcon, CreditCardIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { AdminModal, AdminPageHeader, AdminPanel, BadgeTone, EmptyState, FilterTabs, SearchInput, SkeletonRows, StatusBadge, btn, field, table } from '@/components/admin/ui';

type Status = 'created' | 'paid' | 'expired' | 'refund_due' | 'refunded';

interface Payment {
    id: string;
    razorpay_order_id: string;
    razorpay_payment_id?: string;
    purpose: string;
    amount: number;
    description?: string;
    status: Status;
    refund_error?: string;
    refundable: boolean;
    created_at: string;
}

const STATUS_META: Record<Status, { label: string; tone: BadgeTone }> = {
    created: { label: 'Not paid yet', tone: 'neutral' },
    paid: { label: 'Paid', tone: 'green' },
    expired: { label: 'Abandoned', tone: 'neutral' },
    refund_due: { label: 'Refund pending', tone: 'amber' },
    refunded: { label: 'Refunded', tone: 'blue' },
};

const PURPOSE: Record<string, string> = {
    wallet_topup: 'Wallet top-up',
    event_ticket: 'Event ticket',
    mentorship_booking: 'Session',
    subscription: 'Subscription',
    instant_pass: 'InstantPass',
};

export default function AdminPaymentsPage() {
    const [items, setItems] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Status | 'all'>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [refunding, setRefunding] = useState<Payment | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<unknown, { orders: Payment[]; total_pages: number }>('/admin/payments', {
                params: { page, limit: 20, ...(filter !== 'all' && { status: filter }), ...(search.trim() && { search: search.trim() }) },
            });
            setItems(res.orders || []);
            setTotalPages(res.total_pages || 1);
        } catch (err) {
            notify.error(err, "Couldn't load payments");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [page, filter, search]);

    useEffect(() => {
        const timer = setTimeout(load, 300);
        return () => clearTimeout(timer);
    }, [load]);

    const refund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!refunding || !reason.trim()) return;
        setBusy(true);
        try {
            await api.post(`/admin/payments/${refunding.id}/refund`, { reason: reason.trim() });
            notify.success('Refund sent to the original payment method');
            setRefunding(null);
            setReason('');
            load();
        } catch (err) {
            notify.error(err, "Couldn't refund this payment");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Payments"
                description="Every online payment made through Razorpay"
                actions={<button type="button" onClick={load} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <AdminPanel>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <div className="overflow-x-auto">
                        <FilterTabs
                            value={filter}
                            onChange={(next) => { setFilter(next); setPage(1); }}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'paid', label: 'Paid' },
                                { value: 'refund_due', label: 'Refund pending' },
                                { value: 'refunded', label: 'Refunded' },
                                { value: 'created', label: 'Not paid' },
                            ]}
                        />
                    </div>
                    <SearchInput value={search} onChange={(next) => { setSearch(next); setPage(1); }} placeholder="Order or payment id" className="w-full lg:w-72" />
                </div>

                {loading ? <SkeletonRows rows={6} /> : items.length === 0 ? (
                    <EmptyState icon={CreditCardIcon} title="No payments here" />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Payment</th>
                                    <th className={table.th}>For</th>
                                    <th className={`${table.th} text-right`}>Amount</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((p) => (
                                    <tr key={p.id} className={table.row}>
                                        <td className={`${table.td} whitespace-nowrap`}>
                                            <p className="font-medium text-km-heading font-inter">{p.razorpay_payment_id || p.razorpay_order_id}</p>
                                            <p className="text-xs text-km-text-secondary font-inter">{dateTime(p.created_at)}</p>
                                        </td>
                                        <td className={`${table.td} max-w-xs`}>
                                            <p className="text-km-heading">{PURPOSE[p.purpose] || p.purpose}</p>
                                            {p.description && <p className="text-xs text-km-text-secondary truncate">{p.description}</p>}
                                        </td>
                                        <td className={`${table.td} text-right font-medium text-km-heading font-inter tabular-nums whitespace-nowrap`}>{inr(p.amount)}</td>
                                        <td className={table.td}>
                                            <StatusBadge tone={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</StatusBadge>
                                            {p.refund_error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{p.refund_error}</p>}
                                        </td>
                                        <td className={`${table.td} text-right`}>
                                            {p.refundable && <button type="button" onClick={() => { setRefunding(p); setReason(''); }} className={`${btn.secondary} h-9 px-3`}>Refund</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
            </AdminPanel>

            <AdminModal isOpen={!!refunding} onClose={() => !busy && setRefunding(null)} title={refunding ? `Refund ${inr(refunding.amount)}` : ''}>
                <form onSubmit={refund} className="space-y-4">
                    <p className="text-sm text-km-text-secondary">The money returns to the original payment method and what it bought is cancelled.</p>
                    <label className="block">
                        <span className={field.label}>Reason</span>
                        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={field.textarea} required />
                    </label>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setRefunding(null)} disabled={busy} className={btn.secondary}>Cancel</button>
                        <button type="submit" disabled={busy || !reason.trim()} className={btn.danger}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            Refund
                        </button>
                    </div>
                </form>
            </AdminModal>
        </div>
    );
}
