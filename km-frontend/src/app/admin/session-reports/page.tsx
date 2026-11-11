'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, ChatsCircleIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import { AdminModal, AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, btn, field, table } from '@/components/admin/ui';

interface ReportedBooking {
    id: string;
    amount: number;
    scheduled_at: string;
    report_reason: string;
    reported_at?: string;
    mentorship_title?: string;
    mentee_name?: string;
    mentee_email?: string;
    expert_name?: string;
}

export default function AdminSessionReportsPage() {
    const [items, setItems] = useState<ReportedBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<ReportedBooking | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<unknown, { bookings: ReportedBooking[] }>('/admin/mentorship/reports');
            setItems(res.bookings || []);
        } catch (err) {
            notify.error(err, "Couldn't load session reports");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const resolve = async (action: 'release' | 'refund') => {
        if (!selected) return;
        setBusy(true);
        try {
            await api.post(`/admin/mentorship/reports/${selected.id}/resolve`, { action, note: note.trim() });
            notify.success(action === 'release' ? 'The mentor has been paid' : 'The mentee is being refunded');
            setSelected(null);
            setNote('');
            load();
        } catch (err) {
            notify.error(err, "Couldn't save the decision");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Session reports"
                description="Sessions a mentee reported. Payment stays on hold until you decide"
                actions={<button type="button" onClick={load} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <AdminPanel>
                {loading ? <SkeletonRows rows={4} /> : items.length === 0 ? (
                    <EmptyState icon={ChatsCircleIcon} title="No reported sessions" />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Session</th>
                                    <th className={table.th}>Mentee</th>
                                    <th className={table.th}>Mentor</th>
                                    <th className={`${table.th} text-right`}>Amount</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((b) => (
                                    <tr key={b.id} className={table.row}>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading truncate max-w-[240px]">{b.mentorship_title || 'Session'}</p>
                                            <p className="text-xs text-km-text-secondary font-inter">{dateTime(b.scheduled_at)}</p>
                                        </td>
                                        <td className={table.td}>
                                            <p className="text-km-heading">{b.mentee_name}</p>
                                            <p className="text-xs text-km-text-secondary">{b.mentee_email}</p>
                                        </td>
                                        <td className={table.td}>{b.expert_name}</td>
                                        <td className={`${table.td} text-right font-medium text-km-heading font-inter tabular-nums`}>{inr(b.amount)}</td>
                                        <td className={`${table.td} text-right`}><button type="button" onClick={() => { setSelected(b); setNote(''); }} className={`${btn.primary} h-9 px-3`}>Decide</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdminModal isOpen={!!selected} onClose={() => !busy && setSelected(null)} title={selected?.mentorship_title || 'Session report'}>
                {selected && (
                    <div className="space-y-4">
                        <div>
                            <p className={field.label}>What the mentee said</p>
                            <p className="text-sm text-km-text-primary whitespace-pre-line">{selected.report_reason}</p>
                        </div>
                        <label className="block">
                            <span className={field.label}>Note for your records</span>
                            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={field.textarea} />
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => resolve('refund')} disabled={busy} className={btn.danger}>Refund the mentee {inr(selected.amount)}</button>
                            <button type="button" onClick={() => resolve('release')} disabled={busy} className={btn.primary}>Pay the mentor {inr(selected.amount)}</button>
                        </div>
                    </div>
                )}
            </AdminModal>
        </div>
    );
}
