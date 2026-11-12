'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowSquareOutIcon, CertificateIcon, CheckIcon, FileTextIcon, XIcon } from '@phosphor-icons/react';
import { AdminModal, AdminPageHeader, AdminPanel, EmptyState, FilterTabs, SkeletonRows, StatusBadge, btn, cx, field, type BadgeTone } from '@/components/admin/ui';
import FileLink from '@/components/ui/FileLink';
import UserAvatar from '@/components/ui/UserAvatar';
import { credentialsApi, monthLabel, type CertStatus, type ReviewItem } from '@/lib/api/credentials';
import { notify } from '@/lib/notify';

type Tab = 'pending' | 'verified' | 'rejected' | 'unverified';

const TONE: Record<CertStatus, { tone: BadgeTone; label: string }> = {
    pending: { tone: 'amber', label: 'Waiting' },
    verified: { tone: 'green', label: 'Verified' },
    rejected: { tone: 'red', label: 'Rejected' },
    unverified: { tone: 'neutral', label: 'No evidence' },
};

/** Members' certificates: check the evidence, then verify or reject with a reason */
export default function CertificationsAdminPage() {
    const [tab, setTab] = useState<Tab>('pending');
    const [items, setItems] = useState<ReviewItem[] | null>(null);
    const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setItems(null);
        try {
            const res = await credentialsApi.reviewQueue(tab);
            setItems(res.certifications);
        } catch (err) {
            notify.error(err, "Couldn't load certificates");
            setItems([]);
        }
    }, [tab]);

    useEffect(() => {
        void load();
    }, [load]);

    const decide = async (item: ReviewItem, decision: 'verify' | 'reject', reason = '') => {
        setBusy(item.id);
        try {
            await credentialsApi.review(item.id, decision, reason);
            notify.success(decision === 'verify' ? `${item.name} verified` : `${item.name} rejected`);
            setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
            setRejecting(null);
            setNote('');
        } catch (err) {
            notify.error(err, "Couldn't save the decision");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Certificates"
                description="Check each certificate against its file, link or ID. Verified ones show a badge on the member's profile and on the skills they cover."
            />

            <AdminPanel
                actions={
                    <FilterTabs<Tab>
                        value={tab}
                        onChange={setTab}
                        options={[
                            { value: 'pending', label: 'Waiting' },
                            { value: 'verified', label: 'Verified' },
                            { value: 'rejected', label: 'Rejected' },
                            { value: 'unverified', label: 'No evidence' },
                        ]}
                    />
                }
            >
                {items === null ? (
                    <SkeletonRows rows={4} />
                ) : items.length === 0 ? (
                    <EmptyState icon={CertificateIcon} title={tab === 'pending' ? 'Nothing waiting for review' : 'No certificates here'} />
                ) : (
                    <ul className="divide-y divide-km-border-subtle">
                        {items.map((c) => (
                            <li key={c.id} className="flex flex-col lg:flex-row lg:items-start gap-4 px-5 py-4">
                                <Link href={`/profile/${c.owner.id}`} target="_blank" className="flex items-center gap-3 lg:w-56 shrink-0 min-w-0">
                                    <span className="w-9 h-9 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0">
                                        <UserAvatar src={c.owner.avatar} name={c.owner.name} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-km-heading hover:text-km-link">{c.owner.name}</span>
                                        {c.owner.headline && <span className="block truncate text-xs text-km-text-secondary">{c.owner.headline}</span>}
                                    </span>
                                </Link>

                                <div className="flex-1 min-w-0 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-km-heading">{c.name}</p>
                                        <StatusBadge tone={TONE[c.status].tone}>{TONE[c.status].label}</StatusBadge>
                                        {c.expired && <StatusBadge tone="neutral">Expired</StatusBadge>}
                                    </div>
                                    <p className="text-km-text-primary">{c.issuer}</p>
                                    <p className="text-xs text-km-text-secondary mt-0.5">
                                        Issued {monthLabel(c.issued_on)}
                                        {c.expires_on && ` · Expires ${monthLabel(c.expires_on)}`}
                                        {c.credential_id && ` · ID ${c.credential_id}`}
                                    </p>
                                    {c.skills.length > 0 && <p className="text-xs text-km-text-secondary mt-0.5">Skills: {c.skills.join(', ')}</p>}
                                    {c.review_note && <p className="text-xs text-red-600 mt-1 dark:text-red-400">Reason given: {c.review_note}</p>}
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                        {c.file_url && (
                                            <FileLink href={c.file_url} className="inline-flex items-center gap-1 text-xs font-semibold text-km-link hover:underline">
                                                <FileTextIcon size={14} aria-hidden="true" /> Open file
                                            </FileLink>
                                        )}
                                        {c.credential_url && (
                                            <a href={c.credential_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-semibold text-km-link hover:underline">
                                                Open credential link <ArrowSquareOutIcon size={12} aria-hidden="true" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {c.status === 'pending' && (
                                    <div className="flex gap-2 shrink-0">
                                        <button type="button" onClick={() => { setRejecting(c); setNote(''); }} disabled={busy === c.id} className={cx(btn.secondary, 'h-9 px-3')}>
                                            <XIcon size={15} aria-hidden="true" /> Reject
                                        </button>
                                        <button type="button" onClick={() => void decide(c, 'verify')} disabled={busy === c.id} className={cx(btn.primary, 'h-9 px-3')}>
                                            <CheckIcon size={15} aria-hidden="true" /> Verify
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </AdminPanel>

            <AdminModal isOpen={!!rejecting} onClose={() => !busy && setRejecting(null)} title={`Reject ${rejecting?.name ?? ''}`}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (rejecting && note.trim().length >= 5) void decide(rejecting, 'reject', note.trim());
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label htmlFor="reject-note" className={field.label}>Reason the member will see</label>
                        <textarea
                            id="reject-note"
                            rows={3}
                            maxLength={300}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="For example: the file is unreadable, please upload a clearer scan"
                            className={field.textarea}
                        />
                        <p className={field.hint}>At least 5 characters. They can edit the certificate and send it again.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setRejecting(null)} disabled={!!busy} className={btn.secondary}>Cancel</button>
                        <button type="submit" disabled={!!busy || note.trim().length < 5} className={cx(btn.danger, 'disabled:opacity-50 disabled:cursor-not-allowed')}>
                            Reject
                        </button>
                    </div>
                </form>
            </AdminModal>
        </div>
    );
}
