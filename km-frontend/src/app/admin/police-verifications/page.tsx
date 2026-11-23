'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckIcon, FileTextIcon, ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { AdminModal, AdminPageHeader, AdminPanel, EmptyState, FilterTabs, SkeletonRows, StatusBadge, btn, cx, field, type BadgeTone } from '@/components/admin/ui';
import FileLink from '@/components/ui/FileLink';
import UserAvatar from '@/components/ui/UserAvatar';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';

type Status = 'pending' | 'approved' | 'rejected';

interface QueueItem {
    member: { id: string; name: string; avatar?: string; city?: string; roles: string[] };
    verification: {
        status: Status;
        file_id: string;
        issued_on: string;
        expires_at: string;
        submitted_at: string;
        reviewed_at?: string;
        rejection_reason?: string;
    };
}

interface QueuePage {
    items: QueueItem[];
    total: number;
    page: number;
    limit: number;
}

const TONE: Record<Status, { tone: BadgeTone; label: string }> = {
    pending: { tone: 'amber', label: 'Waiting' },
    approved: { tone: 'green', label: 'Approved' },
    rejected: { tone: 'red', label: 'Rejected' },
};

const LIMIT = 20;

const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Members' police verification certificates. Approving gives the Police checked badge until the certificate expires. */
export default function PoliceVerificationsAdminPage() {
    const [tab, setTab] = useState<Status>('pending');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<QueuePage | null>(null);
    const [rejecting, setRejecting] = useState<QueueItem | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setData(null);
        try {
            const res = (await api.get('/admin/police-verifications', { params: { status: tab, page, limit: LIMIT } })) as unknown as QueuePage;
            setData(res);
        } catch (err) {
            notify.error(err, "Couldn't load police certificates");
            setData({ items: [], total: 0, page, limit: LIMIT });
        }
    }, [tab, page]);

    useEffect(() => {
        void load();
    }, [load]);

    const changeTab = (next: Status) => {
        setTab(next);
        setPage(1);
    };

    const decide = async (item: QueueItem, status: 'approved' | 'rejected', why = '') => {
        setBusy(item.member.id);
        try {
            await api.post(`/admin/police-verifications/${item.member.id}/review`, { status, reason: why, file_id: item.verification.file_id });
            notify.success(status === 'approved' ? `${item.member.name} approved` : `${item.member.name} rejected`);
            setData((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.member.id !== item.member.id), total: prev.total - 1 } : prev));
            setRejecting(null);
            setReason('');
        } catch (err) {
            notify.error(err, "Couldn't save the decision");
            // Someone else may have reviewed it, or the member sent a new file
            void load();
        } finally {
            setBusy(null);
        }
    };

    const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
    const now = Date.now();

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Police verification"
                description="Check each certificate is from a police station, names the member and is under 12 months old. Approving gives the Police checked badge until 12 months after the issue date."
            />

            <AdminPanel
                actions={
                    <FilterTabs<Status>
                        value={tab}
                        onChange={changeTab}
                        options={[
                            { value: 'pending', label: 'Waiting' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'rejected', label: 'Rejected' },
                        ]}
                    />
                }
            >
                {data === null ? (
                    <SkeletonRows rows={4} />
                ) : data.items.length === 0 ? (
                    <EmptyState icon={ShieldCheckIcon} title={tab === 'pending' ? 'Nothing waiting for review' : 'No certificates here'} />
                ) : (
                    <ul className="divide-y divide-km-border-subtle">
                        {data.items.map((item) => {
                            const v = item.verification;
                            const expired = new Date(v.expires_at).getTime() <= now;
                            return (
                                <li key={item.member.id} className="flex flex-col lg:flex-row lg:items-start gap-4 px-5 py-4">
                                    <Link href={`/profile/${item.member.id}`} target="_blank" className="flex items-center gap-3 lg:w-56 shrink-0 min-w-0">
                                        <span className="w-9 h-9 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0">
                                            <UserAvatar src={item.member.avatar} name={item.member.name} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-km-heading hover:text-km-link">{item.member.name}</span>
                                            {item.member.city && <span className="block truncate text-xs text-km-text-secondary">{item.member.city}</span>}
                                        </span>
                                    </Link>

                                    <div className="flex-1 min-w-0 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge tone={TONE[v.status].tone}>{TONE[v.status].label}</StatusBadge>
                                            {expired && <StatusBadge tone="neutral">Expired</StatusBadge>}
                                        </div>
                                        <p className="mt-1 text-km-text-primary">
                                            Issued {day(v.issued_on)}, valid until {day(v.expires_at)}
                                        </p>
                                        <p className="text-xs text-km-text-secondary mt-0.5">
                                            Sent {day(v.submitted_at)}
                                            {v.reviewed_at && `, reviewed ${day(v.reviewed_at)}`}
                                        </p>
                                        {v.rejection_reason && <p className="text-xs text-red-600 mt-1 dark:text-red-400">Reason given: {v.rejection_reason}</p>}
                                        <FileLink
                                            href={`/api/files/${v.file_id}`}
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-km-link hover:underline"
                                        >
                                            <FileTextIcon size={14} aria-hidden="true" /> Open certificate
                                        </FileLink>
                                    </div>

                                    {v.status === 'pending' && (
                                        <div className="flex gap-2 shrink-0">
                                            <button type="button" onClick={() => { setRejecting(item); setReason(''); }} disabled={busy === item.member.id} className={cx(btn.secondary, 'h-9 px-3')}>
                                                <XIcon size={15} aria-hidden="true" /> Reject
                                            </button>
                                            <button type="button" onClick={() => void decide(item, 'approved')} disabled={busy === item.member.id} className={cx(btn.primary, 'h-9 px-3')}>
                                                <CheckIcon size={15} aria-hidden="true" /> Approve
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {data && pages > 1 && (
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-km-border-subtle text-sm">
                        <span className="text-km-text-secondary font-inter">Page {page} of {pages}</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className={cx(btn.secondary, 'h-9 px-3')}>Previous</button>
                            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className={cx(btn.secondary, 'h-9 px-3')}>Next</button>
                        </div>
                    </div>
                )}
            </AdminPanel>

            <AdminModal isOpen={!!rejecting} onClose={() => !busy && setRejecting(null)} title={`Reject ${rejecting?.member.name ?? ''}'s certificate`}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (rejecting && reason.trim().length >= 5) void decide(rejecting, 'rejected', reason.trim());
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label htmlFor="police-reject-reason" className={field.label}>Reason the member will see</label>
                        <textarea
                            id="police-reject-reason"
                            rows={3}
                            maxLength={300}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="For example: the name on the certificate doesn't match your profile"
                            className={field.textarea}
                        />
                        <p className={field.hint}>At least 5 characters. They can upload a new certificate after this.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setRejecting(null)} disabled={!!busy} className={btn.secondary}>Cancel</button>
                        <button type="submit" disabled={!!busy || reason.trim().length < 5} className={cx(btn.danger, 'disabled:opacity-50 disabled:cursor-not-allowed')}>
                            Reject
                        </button>
                    </div>
                </form>
            </AdminModal>
        </div>
    );
}
