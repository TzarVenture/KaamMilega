'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, EyeIcon, FlagIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import Pagination from '@/components/ui/Pagination';
import { storiesApi, type StoryModerationItem } from '@/lib/api/stories';
import { REPORT_REASONS, type FeedAuthor, type ReportReason } from '@/components/feed/feedTypes';
import {
    AdminModal,
    AdminPageHeader,
    AdminPanel,
    BadgeTone,
    ConfirmDialog,
    EmptyState,
    LogoTile,
    SkeletonRows,
    StatusBadge,
    btn,
    field,
    table,
} from '@/components/admin/ui';

// The server pages by 20
const PAGE_SIZE = 20;

const REASON_LABELS: Record<ReportReason, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    misleading: 'Misleading',
    inappropriate: 'Inappropriate',
    other: 'Other',
};

const ROLE_LABELS: Record<FeedAuthor['role'], string> = { user: 'Jobseeker', recruiter: 'Recruiter', expert: 'Expert' };

function formatDate(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function reasonSummary(reasons: Record<string, number>) {
    return REPORT_REASONS.filter((r) => reasons[r])
        .sort((a, b) => (reasons[b] ?? 0) - (reasons[a] ?? 0))
        .map((r) => `${REASON_LABELS[r]} ${reasons[r]}`)
        .join(', ');
}

/** Showing to members, hidden by reports, or past its 24 hours and kept only for review */
function statusOf(item: StoryModerationItem): { label: string; tone: BadgeTone } {
    if (item.deleted_by_owner) return { label: 'Deleted by owner', tone: 'neutral' };
    if (new Date(item.expires_at).getTime() <= Date.now()) return { label: 'Ended', tone: 'neutral' };
    if (item.status === 'hidden') return { label: 'Hidden', tone: 'amber' };
    return { label: 'Showing', tone: 'blue' };
}

function Owner({ owner }: { owner?: FeedAuthor }) {
    if (!owner) return <p className="text-sm text-km-text-secondary">Closed account</p>;
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <LogoTile src={owner.avatar} name={owner.name} rounded="rounded-full" size="w-8 h-8" />
            <div className="min-w-0">
                <p className="font-medium text-km-heading truncate">{owner.name}</p>
                <p className="text-xs text-km-text-secondary truncate">{ROLE_LABELS[owner.role] ?? 'Member'}</p>
            </div>
        </div>
    );
}

function Thumb({ item }: { item: StoryModerationItem }) {
    const src = item.media.type === 'video' ? item.media.poster_url : item.media.url;
    return (
        <div className="relative w-12 aspect-[9/16] shrink-0 overflow-hidden rounded-lg border border-km-border bg-black">
            {src && (
                // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail
                <img src={src} alt="" className="h-full w-full object-cover" />
            )}
            {item.media.type === 'video' && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">Video</span>}
        </div>
    );
}

export default function AdminStoryReportsPage() {
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<StoryModerationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState<StoryModerationItem | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await storiesApi.reports(page);
            setItems(res.items ?? []);
            setTotal(res.total);
        } catch (err) {
            notify.error(err, "Couldn't load reported stories");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div>
            <AdminPageHeader
                title="Story reports"
                description="Stories people reported. 3 open reports hide a story until you decide. A reported story is kept up to 7 days past its 24 hours so you can review it; after that it is deleted and its reports close."
                actions={
                    <button type="button" onClick={load} disabled={loading} className={btn.secondary}>
                        <ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            />

            <AdminPanel>
                {loading ? (
                    <SkeletonRows rows={6} />
                ) : items.length === 0 ? (
                    <EmptyState icon={FlagIcon} title="Nothing to review" description="Stories people report appear here." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Story</th>
                                    <th className={table.th}>Shared by</th>
                                    <th className={table.th}>Reasons</th>
                                    <th className={`${table.th} text-right`}>Reports</th>
                                    <th className={table.th}>Last reported</th>
                                    <th className={table.th}>Status</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const status = statusOf(item);
                                    return (
                                        <tr key={item.id} className={table.row}>
                                            <td className={`${table.td} max-w-xs`}>
                                                <div className="flex items-center gap-3">
                                                    <Thumb item={item} />
                                                    <p className="text-km-heading line-clamp-3 break-words">
                                                        {item.caption || <span className="text-km-text-secondary">No caption</span>}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className={`${table.td} max-w-[14rem]`}><Owner owner={item.owner} /></td>
                                            <td className={`${table.td} text-km-text-secondary`}>{reasonSummary(item.reasons)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{item.reports}</td>
                                            <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>{formatDate(item.last_report)}</td>
                                            <td className={table.td}><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                                            <td className={`${table.td} text-right`}>
                                                <button type="button" onClick={() => setReviewing(item)} className={`${btn.secondary} h-9 px-3`}>
                                                    Review
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle">
                        <Pagination current={page} total={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </AdminPanel>

            {reviewing && (
                <ReviewDialog
                    item={reviewing}
                    onClose={() => setReviewing(null)}
                    onDecided={() => {
                        setReviewing(null);
                        load();
                    }}
                />
            )}
        </div>
    );
}

function ReviewDialog({ item, onClose, onDecided }: { item: StoryModerationItem; onClose: () => void; onDecided: () => void }) {
    const [busy, setBusy] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const status = statusOf(item);
    // Past its 24 hours, or deleted by its owner: it can't come back, so "keep" only closes the reports
    const ended = status.label === 'Ended' || !!item.deleted_by_owner;

    const decide = async (action: 'keep' | 'remove') => {
        setBusy(true);
        try {
            await storiesApi.decide(item.id, action);
            notify.success(
                action === 'remove' ? 'Story removed' : item.deleted_by_owner ? 'Reports closed and the story deleted' : ended ? 'Reports closed' : 'Story kept and showing again',
            );
            onDecided();
        } catch (err) {
            notify.error(err, "Couldn't save the decision");
            setBusy(false);
            setConfirmRemove(false);
        }
    };

    return (
        <>
            <AdminModal isOpen onClose={() => !busy && !confirmRemove && onClose()} title="Review reported story" size="lg">
                <div className="space-y-6">
                    <section aria-label="The story" className="flex flex-col sm:flex-row gap-5">
                        <div className="mx-auto sm:mx-0 w-full max-w-[220px] aspect-[9/16] shrink-0 overflow-hidden rounded-xl border border-km-border bg-black">
                            {item.media.type === 'video' ? (
                                <video src={item.media.url} poster={item.media.poster_url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element -- user photo from the CDN, shown as uploaded
                                <img src={item.media.url} alt="The reported story" className="h-full w-full object-contain" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <Owner owner={item.owner} />
                                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                            </div>
                            <p className="text-xs text-km-text-muted font-inter">
                                Shared {formatDate(item.created_at)} · {ended ? 'ended' : 'ends'} {formatDate(item.expires_at)}
                            </p>
                            {item.caption && <p className="text-sm text-km-text-primary leading-relaxed break-words">{item.caption}</p>}
                            <p className="inline-flex items-center gap-1 text-xs text-km-text-secondary">
                                <EyeIcon size={14} aria-hidden="true" />
                                {item.views} {item.views === 1 ? 'view' : 'views'}
                            </p>
                            <div>
                                <p className={field.label}>Open reports ({item.reports})</p>
                                <p className="text-sm text-km-text-primary">{reasonSummary(item.reasons)}</p>
                                {item.notes && item.notes.length > 0 && (
                                    <ul className="mt-2 divide-y divide-km-border-subtle rounded-xl border border-km-border-subtle">
                                        {item.notes.map((n, i) => (
                                            <li key={i} className="p-3 text-sm text-km-text-primary whitespace-pre-line break-words">{n}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </section>

                    <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-km-border-subtle bg-km-surface-raised px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                        <p className="text-xs text-km-text-secondary sm:mr-auto">
                            {item.reports} open report{item.reports > 1 ? 's' : ''} will be closed.
                        </p>
                        <button type="button" disabled={busy} onClick={() => decide('keep')} className={btn.secondary}>
                            {ended ? 'Close reports' : 'Keep story'}
                        </button>
                        <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className={btn.danger}>
                            Remove story
                        </button>
                    </div>
                </div>
            </AdminModal>

            {confirmRemove && (
                <ConfirmDialog
                    title="Remove this story?"
                    description="It is deleted for everyone, with its photo or video. This can't be undone."
                    confirmLabel="Remove story"
                    busy={busy}
                    onCancel={() => setConfirmRemove(false)}
                    onConfirm={() => decide('remove')}
                />
            )}
        </>
    );
}
