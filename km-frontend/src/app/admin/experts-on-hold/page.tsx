'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowsClockwiseIcon, PauseCircleIcon, StarIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime } from '@/lib/money';
import { AdminModal, AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, btn, table } from '@/components/admin/ui';

interface HeldExpert {
    id: string;
    name: string;
    profile_image?: string;
    held_at: string;
    low_reviews: number;
    rating_average: number;
    rating_count: number;
}

export default function AdminExpertsOnHoldPage() {
    const [items, setItems] = useState<HeldExpert[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<HeldExpert | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<unknown, { experts: HeldExpert[] }>('/admin/mentorship/experts-on-hold');
            setItems(res.experts || []);
        } catch (err) {
            notify.error(err, "Couldn't load Experts on hold");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const lift = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            await api.post(`/admin/mentorship/experts-on-hold/${selected.id}/lift`);
            notify.success(`${selected.name}'s sessions are live again`);
            setSelected(null);
            load();
        } catch (err) {
            notify.error(err, "Couldn't lift the hold");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Experts on hold"
                description="Experts with 10 reviews of 2 stars or less. Their sessions are hidden and can't be booked until you lift the hold"
                actions={<button type="button" onClick={load} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <AdminPanel>
                {loading ? <SkeletonRows rows={4} /> : items.length === 0 ? (
                    <EmptyState icon={PauseCircleIcon} title="No Experts on hold" />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Expert</th>
                                    <th className={table.th}>On hold since</th>
                                    <th className={`${table.th} text-right`}>Low reviews</th>
                                    <th className={`${table.th} text-right`}>Rating</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((e) => (
                                    <tr key={e.id} className={table.row}>
                                        <td className={table.td}>
                                            <Link href={`/profile/${e.id}`} className="font-medium text-km-heading hover:text-km-link">{e.name}</Link>
                                        </td>
                                        <td className={`${table.td} font-inter`}>{dateTime(e.held_at)}</td>
                                        <td className={`${table.td} text-right font-inter tabular-nums`}>{e.low_reviews}</td>
                                        <td className={`${table.td} text-right font-inter tabular-nums`}>
                                            <span className="inline-flex items-center gap-1">
                                                <StarIcon size={14} weight="fill" className="text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                                                {e.rating_average.toFixed(1)} ({e.rating_count})
                                            </span>
                                        </td>
                                        <td className={`${table.td} text-right`}>
                                            <button type="button" onClick={() => setSelected(e)} className={`${btn.primary} h-9 px-3`}>Lift hold</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdminModal isOpen={!!selected} onClose={() => !busy && setSelected(null)} title={selected ? `Lift the hold on ${selected.name}?` : 'Lift hold'}>
                {selected && (
                    <div className="space-y-4">
                        <p className="text-sm text-km-text-primary">
                            Their sessions will show again and can be booked. The {selected.low_reviews} low reviews so far stop counting; another 10 would put them on hold again.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setSelected(null)} disabled={busy} className={btn.secondary}>Cancel</button>
                            <button type="button" onClick={lift} disabled={busy} className={btn.primary}>Lift hold</button>
                        </div>
                    </div>
                )}
            </AdminModal>
        </div>
    );
}
