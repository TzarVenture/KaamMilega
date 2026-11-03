'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, ArrowSquareOutIcon, ChatCircleIcon, FlagIcon, HeartIcon, ImageIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import Pagination from '@/components/ui/Pagination';
import {
    moderationApi,
    type ModeratedPost,
    type ModeratedPostStatus,
    type ModerationItem,
    type ModerationReport,
    type ReportOutcome,
} from '@/lib/api/feed';
import { REPORT_REASONS, type FeedAuthor, type ReportReason } from '@/components/feed/feedTypes';
import {
    AdminModal,
    AdminPageHeader,
    AdminPanel,
    BadgeTone,
    ConfirmDialog,
    EmptyState,
    FilterTabs,
    LogoTile,
    SkeletonRows,
    StatusBadge,
    btn,
    cx,
    field,
    table,
} from '@/components/admin/ui';

type Tab = 'open' | 'closed';

const PAGE_SIZE = 15;

const REASON_LABELS: Record<ReportReason, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    misleading: 'Misleading',
    inappropriate: 'Inappropriate',
    other: 'Other',
};

const POST_STATUS: Record<ModeratedPostStatus, { label: string; tone: BadgeTone }> = {
    active: { label: 'In the feed', tone: 'blue' },
    hidden: { label: 'Hidden', tone: 'amber' },
    removed: { label: 'Removed', tone: 'red' },
};

const OUTCOME: Record<ReportOutcome, { label: string; tone: BadgeTone }> = {
    dismissed: { label: 'Kept', tone: 'green' },
    removed: { label: 'Removed', tone: 'red' },
};

const ROLE_LABELS: Record<FeedAuthor['role'], string> = { user: 'Jobseeker', recruiter: 'Recruiter', expert: 'Expert' };

function formatDate(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "Spam 2, Harassment 1", most common first */
function reasonSummary(reasons: ModerationItem['reasons']) {
    return REPORT_REASONS.filter((r) => reasons[r])
        .sort((a, b) => (reasons[b] ?? 0) - (reasons[a] ?? 0))
        .map((r) => `${REASON_LABELS[r]} ${reasons[r]}`)
        .join(', ');
}

function Author({ author }: { author: FeedAuthor | null }) {
    if (!author) return <p className="text-sm text-km-text-secondary">Closed account</p>;
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <LogoTile src={author.avatar} name={author.name} rounded="rounded-full" size="w-8 h-8" />
            <div className="min-w-0">
                <p className="font-medium text-km-heading truncate">{author.name}</p>
                <p className="text-xs text-km-text-secondary truncate">{ROLE_LABELS[author.role] ?? 'Member'}</p>
            </div>
        </div>
    );
}

export default function AdminPostReportsPage() {
    const [tab, setTab] = useState<Tab>('open');
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<ModerationItem[]>([]);
    const [counts, setCounts] = useState({ open: 0, closed: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await moderationApi.queue(tab, page, PAGE_SIZE);
            setItems(res.items ?? []);
            setCounts({ open: res.open_total, closed: res.closed_total, total: res.total });
        } catch (err) {
            notify.error(err, "Couldn't load reported posts");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [tab, page]);

    useEffect(() => {
        load();
    }, [load]);

    const changeTab = (next: Tab) => {
        setTab(next);
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(counts.total / PAGE_SIZE));

    return (
        <div>
            <AdminPageHeader
                title="Post reports"
                description="Feed posts people reported. A post with 3 open reports is hidden from the feed until you decide."
                actions={
                    <button type="button" onClick={load} disabled={loading} className={btn.secondary}>
                        <ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            />

            <AdminPanel>
                <div className="px-5 py-4 border-b border-km-border-subtle overflow-x-auto">
                    <FilterTabs
                        value={tab}
                        onChange={changeTab}
                        options={[
                            { value: 'open', label: 'Needs review', count: counts.open },
                            { value: 'closed', label: 'Decided', count: counts.closed },
                        ]}
                    />
                </div>

                {loading ? (
                    <SkeletonRows rows={6} />
                ) : items.length === 0 ? (
                    <EmptyState
                        icon={FlagIcon}
                        title={tab === 'open' ? 'Nothing to review' : 'No decisions yet'}
                        description={tab === 'open' ? 'Posts people report appear here.' : 'Posts you keep or remove appear here.'}
                    />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Post</th>
                                    <th className={table.th}>Author</th>
                                    <th className={table.th}>Reasons</th>
                                    <th className={`${table.th} text-right`}>Reports</th>
                                    <th className={table.th}>{tab === 'open' ? 'Last reported' : 'Decided'}</th>
                                    <th className={table.th}>Status</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const status = tab === 'open'
                                        ? POST_STATUS[item.post.status]
                                        : OUTCOME[item.outcome ?? 'dismissed'];
                                    return (
                                        <tr key={item.post.id} className={table.row}>
                                            <td className={`${table.td} max-w-sm`}>
                                                <p className="text-km-heading line-clamp-2 whitespace-pre-line">
                                                    {item.post.content || <span className="text-km-text-secondary">Photo only</span>}
                                                </p>
                                                {item.post.media.length > 0 && (
                                                    <p className="mt-1 flex items-center gap-1 text-xs text-km-text-secondary">
                                                        <ImageIcon size={14} aria-hidden="true" />
                                                        {item.post.media.length} photo{item.post.media.length > 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </td>
                                            <td className={`${table.td} max-w-[14rem]`}><Author author={item.post.author} /></td>
                                            <td className={`${table.td} text-km-text-secondary`}>{reasonSummary(item.reasons)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{item.reports}</td>
                                            <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>
                                                {formatDate(tab === 'open' ? item.last_reported_at : item.resolved_at)}
                                            </td>
                                            <td className={table.td}><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                                            <td className={`${table.td} text-right`}>
                                                <button type="button" onClick={() => setReviewing(item.post.id)} className={`${btn.secondary} h-9 px-3`}>
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
                    postId={reviewing}
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

function ReviewDialog({ postId, onClose, onDecided }: { postId: string; onClose: () => void; onDecided: () => void }) {
    const [data, setData] = useState<{ post: ModeratedPost; reports: ModerationReport[] } | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);

    useEffect(() => {
        let live = true;
        moderationApi
            .detail(postId)
            .then((res) => live && setData(res))
            .catch((err) => {
                if (!live) return;
                notify.error(err, "Couldn't load the post");
                setFailed(true);
            });
        return () => {
            live = false;
        };
    }, [postId]);

    const decide = async (action: 'keep' | 'remove') => {
        setBusy(true);
        try {
            await moderationApi.decide(postId, action);
            notify.success(action === 'keep' ? 'Post kept and back in the feed' : 'Post removed and the author told');
            onDecided();
        } catch (err) {
            notify.error(err, "Couldn't save the decision");
            setBusy(false);
            setConfirmRemove(false);
        }
    };

    const post = data?.post;
    const open = data?.reports.filter((r) => r.status === 'pending').length ?? 0;

    return (
        <>
            <AdminModal isOpen onClose={() => !busy && !confirmRemove && onClose()} title="Review reported post" size="lg">
                {!data ? (
                    failed ? (
                        <p className="py-8 text-center text-sm text-km-text-secondary">This post couldn&apos;t be loaded. It may have been deleted by its author.</p>
                    ) : (
                        <SkeletonRows rows={4} />
                    )
                ) : (
                    <div className="space-y-6">
                        <section aria-label="The post">
                            <div className="flex items-start justify-between gap-3">
                                <Author author={post!.author} />
                                <StatusBadge tone={POST_STATUS[post!.status].tone}>{POST_STATUS[post!.status].label}</StatusBadge>
                            </div>
                            <p className="mt-1 text-xs text-km-text-muted font-inter">
                                Posted {formatDate(post!.created_at)}{post!.edited_at ? ', edited' : ''}
                            </p>
                            {post!.content && (
                                <p className="mt-3 text-sm text-km-text-primary leading-relaxed whitespace-pre-line break-words">{post!.content}</p>
                            )}
                            {post!.media.length > 0 && (
                                <div className={cx('mt-3 grid gap-2', post!.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                                    {post!.media.map((m) => (
                                        <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-km-border bg-km-surface">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- user photos from the CDN, shown as uploaded */}
                                            <img src={m.url} alt="Photo in the reported post" className="w-full max-h-72 object-contain" />
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-km-text-secondary">
                                <span className="inline-flex items-center gap-1"><HeartIcon size={14} aria-hidden="true" />{post!.reactions_total} reactions</span>
                                <span className="inline-flex items-center gap-1"><ChatCircleIcon size={14} aria-hidden="true" />{post!.comments_count} comments</span>
                                {post!.status !== 'removed' && (
                                    <a href={`/feed/${post!.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-km-link hover:underline">
                                        Open in the feed
                                        <ArrowSquareOutIcon size={14} aria-hidden="true" />
                                    </a>
                                )}
                            </div>
                        </section>

                        <section aria-label="Reports">
                            <p className={field.label}>Reports ({data.reports.length})</p>
                            <ul className="divide-y divide-km-border-subtle rounded-xl border border-km-border-subtle">
                                {data.reports.map((r) => (
                                    <li key={r.id} className="p-3 text-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-medium text-km-heading">{REASON_LABELS[r.reason] ?? r.reason}</p>
                                            {r.status !== 'pending' && <StatusBadge tone={OUTCOME[r.status].tone}>{OUTCOME[r.status].label}</StatusBadge>}
                                        </div>
                                        {r.details && <p className="mt-1 text-km-text-primary whitespace-pre-line break-words">{r.details}</p>}
                                        <p className="mt-1 text-xs text-km-text-secondary">
                                            {r.reporter?.name ?? 'Closed account'} · <span className="font-inter">{formatDate(r.created_at)}</span>
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-km-border-subtle bg-km-surface-raised px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                            <p className="text-xs text-km-text-secondary sm:mr-auto">
                                {open > 0 ? `${open} open report${open > 1 ? 's' : ''} will be closed.` : 'No open reports.'}
                            </p>
                            {post!.status !== 'active' && (
                                <button type="button" disabled={busy} onClick={() => decide('keep')} className={btn.secondary}>
                                    {post!.status === 'removed' ? 'Restore post' : 'Keep post'}
                                </button>
                            )}
                            {post!.status === 'active' && open > 0 && (
                                <button type="button" disabled={busy} onClick={() => decide('keep')} className={btn.secondary}>
                                    Keep post
                                </button>
                            )}
                            {post!.status !== 'removed' && (
                                <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className={btn.danger}>
                                    Remove post
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </AdminModal>

            {confirmRemove && (
                <ConfirmDialog
                    title="Remove this post?"
                    description="It comes out of the feed for everyone and the author gets a notification. You can restore it from the Decided tab."
                    confirmLabel="Remove post"
                    busy={busy}
                    onCancel={() => setConfirmRemove(false)}
                    onConfirm={() => decide('remove')}
                />
            )}
        </>
    );
}
