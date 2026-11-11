'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, BankIcon, CircleNotchIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { AdminModal, AdminPageHeader, AdminPanel, BadgeTone, EmptyState, FilterTabs, SkeletonRows, StatusBadge, btn, field, table } from '@/components/admin/ui';

type Status = 'requested' | 'processing' | 'paid' | 'failed';

interface Withdrawal {
    id: string;
    amount: number;
    status: Status;
    payout_method: 'bank' | 'upi';
    account_holder: string;
    account_last4?: string;
    ifsc?: string;
    upi_id?: string;
    bank_reference?: string;
    failure_reason?: string;
    user_name?: string;
    user_email?: string;
    created_at: string;
}

interface RevealedAccount {
    method: string;
    account_holder: string;
    account_number?: string;
    ifsc?: string;
    upi_id?: string;
}

const STATUS_META: Record<Status, { label: string; tone: BadgeTone }> = {
    requested: { label: 'Requested', tone: 'amber' },
    processing: { label: 'Processing', tone: 'blue' },
    paid: { label: 'Paid', tone: 'green' },
    failed: { label: 'Failed', tone: 'red' },
};

function destination(w: Withdrawal) {
    return w.payout_method === 'upi' ? w.upi_id : `Bank ending ${w.account_last4}`;
}

export default function AdminPayoutsPage() {
    const [items, setItems] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Status | 'all'>('requested');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [selected, setSelected] = useState<Withdrawal | null>(null);
    const [revealed, setRevealed] = useState<RevealedAccount | null>(null);
    const [reference, setReference] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<unknown, { withdrawals: Withdrawal[]; total_pages: number }>('/admin/withdrawals', {
                params: { page, limit: 20, ...(filter !== 'all' && { status: filter }) },
            });
            setItems(res.withdrawals || []);
            setTotalPages(res.total_pages || 1);
        } catch (err) {
            notify.error(err, "Couldn't load payouts");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [page, filter]);

    useEffect(() => { load(); }, [load]);

    const open = (w: Withdrawal) => {
        setSelected(w);
        setRevealed(null);
        setReference('');
        setReason('');
    };

    const close = () => { if (!busy) setSelected(null); };

    const reveal = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            setRevealed(await api.post<unknown, RevealedAccount>(`/admin/withdrawals/${selected.id}/reveal-account`));
        } catch (err) {
            notify.error(err, "Couldn't show the account");
        } finally {
            setBusy(false);
        }
    };

    const update = async (status: Exclude<Status, 'requested'>) => {
        if (!selected) return;
        setBusy(true);
        try {
            const updated = await api.put<unknown, Withdrawal>(`/admin/withdrawals/${selected.id}`, {
                status,
                bank_reference: reference.trim(),
                failure_reason: reason.trim(),
            });
            notify.success(`Payout marked ${STATUS_META[status].label.toLowerCase()}`);
            if (status === 'processing') setSelected({ ...selected, ...updated, status });
            else setSelected(null);
            load();
        } catch (err) {
            notify.error(err, "Couldn't update the payout");
        } finally {
            setBusy(false);
        }
    };

    const isOpen = selected?.status === 'requested' || selected?.status === 'processing';

    return (
        <div>
            <AdminPageHeader
                title="Payouts"
                description="Send each payout from the bank, then record the result here"
                actions={<button type="button" onClick={load} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <AdminPanel>
                <div className="px-5 py-4 border-b border-km-border-subtle overflow-x-auto">
                    <FilterTabs
                        value={filter}
                        onChange={(next) => { setFilter(next); setPage(1); }}
                        options={[
                            { value: 'requested', label: 'Requested' },
                            { value: 'processing', label: 'Processing' },
                            { value: 'paid', label: 'Paid' },
                            { value: 'failed', label: 'Failed' },
                            { value: 'all', label: 'All' },
                        ]}
                    />
                </div>

                {loading ? <SkeletonRows rows={5} /> : items.length === 0 ? (
                    <EmptyState icon={BankIcon} title="No payouts here" description="Withdrawal requests appear here." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Person</th>
                                    <th className={table.th}>Send to</th>
                                    <th className={`${table.th} text-right`}>Amount</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}>Requested</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((w) => (
                                    <tr key={w.id} className={table.row}>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading truncate max-w-[200px]">{w.user_name || w.account_holder}</p>
                                            {w.user_email && <p className="text-xs text-km-text-secondary truncate max-w-[200px]">{w.user_email}</p>}
                                        </td>
                                        <td className={`${table.td} whitespace-nowrap`}>{destination(w)}</td>
                                        <td className={`${table.td} text-right font-medium text-km-heading font-inter tabular-nums whitespace-nowrap`}>{inr(w.amount)}</td>
                                        <td className={table.td}><StatusBadge tone={STATUS_META[w.status].tone}>{STATUS_META[w.status].label}</StatusBadge></td>
                                        <td className={`${table.td} text-xs text-km-text-secondary font-inter whitespace-nowrap`}>{dateTime(w.created_at)}</td>
                                        <td className={`${table.td} text-right`}><button type="button" onClick={() => open(w)} className={`${btn.secondary} h-9 px-3`}>Open</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
            </AdminPanel>

            <AdminModal isOpen={!!selected} onClose={close} title={selected ? `Payout of ${inr(selected.amount)}` : ''}>
                {selected && (
                    <div className="space-y-4">
                        <dl className="rounded-xl border border-km-border-subtle divide-y divide-km-border-subtle text-sm">
                            {[
                                ['Status', <StatusBadge key="s" tone={STATUS_META[selected.status].tone}>{STATUS_META[selected.status].label}</StatusBadge>],
                                ['Account holder', selected.account_holder],
                                ['Send to', destination(selected)],
                                ...(selected.ifsc ? [['IFSC', selected.ifsc]] : []),
                                ...(selected.bank_reference ? [['Bank reference', selected.bank_reference]] : []),
                                ...(selected.failure_reason ? [['Failure reason', selected.failure_reason]] : []),
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex justify-between gap-4 px-4 py-2.5">
                                    <dt className="text-km-text-secondary shrink-0">{label}</dt>
                                    <dd className="text-right text-km-text-primary break-all">{value}</dd>
                                </div>
                            ))}
                            {revealed?.account_number && (
                                <div className="flex justify-between gap-4 px-4 py-2.5">
                                    <dt className="text-km-text-secondary shrink-0">Full account number</dt>
                                    <dd className="text-right font-medium text-km-heading font-inter break-all">{revealed.account_number}</dd>
                                </div>
                            )}
                        </dl>

                        {isOpen && (
                            <>
                                {selected.payout_method === 'bank' && !revealed && (
                                    <button type="button" onClick={reveal} disabled={busy} className={btn.secondary}>Show full account number</button>
                                )}

                                {selected.status === 'requested' && (
                                    <button type="button" onClick={() => update('processing')} disabled={busy} className={`${btn.primary} w-full`}>
                                        {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                        Start processing
                                    </button>
                                )}

                                <label className="block">
                                    <span className={field.label}>Bank reference (UTR)</span>
                                    <input value={reference} onChange={(e) => setReference(e.target.value)} className={field.input} />
                                    <span className={field.hint}>Enter this only after the bank confirms the transfer.</span>
                                </label>
                                <button type="button" onClick={() => update('paid')} disabled={busy || !reference.trim()} className={`${btn.primary} w-full`}>Mark as paid</button>

                                <label className="block">
                                    <span className={field.label}>Reason it failed</span>
                                    <input value={reason} onChange={(e) => setReason(e.target.value)} className={field.input} />
                                    <span className={field.hint}>The person sees this, and the money goes back to their earnings.</span>
                                </label>
                                <button type="button" onClick={() => update('failed')} disabled={busy || !reason.trim()} className={`${btn.danger} w-full`}>Mark as failed</button>
                            </>
                        )}
                    </div>
                )}
            </AdminModal>
        </div>
    );
}
