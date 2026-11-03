'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowSquareOutIcon, ClockCounterClockwiseIcon, PencilSimpleIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { errorText, notify } from '@/lib/notify';
import PolicyContent from '@/components/policies/PolicyContent';
import { policiesAdminApi, policyPath, type AdminPolicy, type Policy, type PolicySlug, type PolicyVersion } from '@/lib/api/policies';
import {
    AdminModal,
    AdminPageHeader,
    AdminPanel,
    ConfirmDialog,
    EmptyState,
    MenuItem,
    RowMenu,
    SkeletonRows,
    StatusBadge,
    btn,
    cx,
    field,
    table,
} from '@/components/admin/ui';

const MAX_TITLE = 120;
const MAX_CONTENT = 100_000;

function formatDate(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PoliciesPage() {
    const [policies, setPolicies] = useState<AdminPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<PolicySlug | null>(null);
    const [history, setHistory] = useState<AdminPolicy | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setPolicies((await policiesAdminApi.list()) ?? []);
        } catch (err) {
            notify.error(err, "Couldn't load policies");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Stable, so the editor doesn't reload (and lose edits) when this page re-renders
    const closeEditor = useCallback(() => setEditing(null), []);
    const published = useCallback(() => {
        setEditing(null);
        load();
    }, [load]);

    return (
        <div>
            <AdminPageHeader
                title="Policies"
                description="Terms, privacy and community rules shown on the site. Every publish is kept as a version."
            />

            <AdminPanel>
                {loading ? (
                    <SkeletonRows rows={4} />
                ) : policies.length === 0 ? (
                    <EmptyState icon={ShieldCheckIcon} title="No policies" description="Policies couldn't be loaded. Try again in a moment." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Policy</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}>Last published</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {policies.map((p) => (
                                    <tr key={p.slug} className={table.row}>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading">{p.title}</p>
                                            <p className="text-xs text-km-text-secondary">For {p.audience.charAt(0).toLowerCase() + p.audience.slice(1)}</p>
                                        </td>
                                        <td className={table.td}>
                                            {p.published
                                                ? <StatusBadge tone="green">Published, version {p.version}</StatusBadge>
                                                : <StatusBadge tone="amber">Not published</StatusBadge>}
                                        </td>
                                        <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>
                                            {p.published_at ? formatDate(p.published_at) : '–'}
                                        </td>
                                        <td className={`${table.td} text-right`}>
                                            <div className="inline-flex items-center gap-1">
                                                <button type="button" onClick={() => setEditing(p.slug)} className={`${btn.secondary} h-9 px-3`}>
                                                    <PencilSimpleIcon size={16} aria-hidden="true" />
                                                    {p.published ? 'Edit' : 'Write'}
                                                </button>
                                                <RowMenu label={`More for ${p.title}`}>
                                                    {() => (
                                                        <>
                                                            <MenuItem icon={ArrowSquareOutIcon} onClick={() => window.open(policyPath(p.slug), '_blank', 'noopener')}>
                                                                View on the site
                                                            </MenuItem>
                                                            {p.published && (
                                                                <MenuItem icon={ClockCounterClockwiseIcon} onClick={() => setHistory(p)}>
                                                                    Version history
                                                                </MenuItem>
                                                            )}
                                                        </>
                                                    )}
                                                </RowMenu>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            {editing && (
                <PolicyEditor slug={editing} onClose={closeEditor} onPublished={published} />
            )}
            {history && <HistoryDialog policy={history} onClose={() => setHistory(null)} />}
        </div>
    );
}

function PolicyEditor({ slug, onClose, onPublished }: { slug: PolicySlug; onClose: () => void; onPublished: () => void }) {
    const [base, setBase] = useState<Policy | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [view, setView] = useState<'write' | 'preview'>('write');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    useEffect(() => {
        let live = true;
        policiesAdminApi
            .get(slug)
            .then((p) => {
                if (!live) return;
                setBase(p);
                setTitle(p.title);
                setContent(p.content ?? '');
            })
            .catch((err) => {
                if (!live) return;
                notify.error(err, "Couldn't load the policy");
                onClose();
            });
        return () => {
            live = false;
        };
    }, [slug, onClose]);

    const dirty = !!base && (title !== base.title || content !== (base.content ?? ''));
    const close = () => {
        if (busy) return;
        if (dirty) setConfirmDiscard(true);
        else onClose();
    };

    const publish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!base) return;
        setBusy(true);
        setError('');
        try {
            const p = await policiesAdminApi.publish(slug, { title, content, base_version: base.version });
            notify.success(`Published version ${p.version}`);
            onPublished();
        } catch (err) {
            setError(errorText(err, "Couldn't publish. Try again."));
            setBusy(false);
        }
    };

    const tooLong = content.length > MAX_CONTENT;

    return (
        <>
            <AdminModal isOpen onClose={() => !confirmDiscard && close()} title={base ? `${base.version ? 'Edit' : 'Write'} ${base.title.toLowerCase()}` : 'Policy'} size="xl">
                {!base ? (
                    <SkeletonRows rows={5} />
                ) : (
                    <form onSubmit={publish} className="space-y-5">
                        <label className="block">
                            <span className={field.label}>Title</span>
                            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TITLE} required className={field.input} />
                        </label>

                        <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                                <span id="policy-content-label" className={field.label + ' mb-0'}>Text</span>
                                <div role="tablist" aria-label="Editor view" className="inline-flex rounded-lg border border-km-border p-0.5 lg:hidden">
                                    {(['write', 'preview'] as const).map((v) => (
                                        <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                                            className={cx('rounded-md px-3 py-1 text-sm font-medium', view === v ? 'bg-km-surface text-km-heading' : 'text-km-text-secondary hover:text-km-heading')}>
                                            {v === 'write' ? 'Write' : 'Preview'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className={cx(view === 'preview' && 'hidden lg:block')}>
                                    <textarea
                                        aria-labelledby="policy-content-label"
                                        aria-describedby="policy-format-hint"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        rows={22}
                                        className={cx(field.textarea, 'font-mono text-[13px] leading-relaxed')}
                                        placeholder={'## 1. Who we are\nKaamMilega is run by …\n\n## 2. What we collect\n- Your name and phone number\n- …'}
                                    />
                                    <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
                                        <p id="policy-format-hint" className="text-km-text-secondary">
                                            <code>## Heading</code>, <code>### Subheading</code>, <code>- list item</code>, <code>1. numbered item</code>,{' '}
                                            <code>**bold**</code>, <code>[link text](https://…)</code>. A blank line starts a new paragraph.
                                        </p>
                                        <span className={cx('shrink-0 font-inter tabular-nums', tooLong ? 'text-red-600' : 'text-km-text-muted')}>
                                            {content.length.toLocaleString('en-IN')} / {MAX_CONTENT.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>
                                <div className={cx('rounded-xl border border-km-border bg-km-surface p-5 lg:max-h-[34rem] lg:overflow-y-auto', view === 'write' && 'hidden lg:block')}>
                                    <p className="mb-3 text-xs font-medium text-km-text-muted">Preview</p>
                                    <h3 className="text-xl font-semibold text-km-heading">{title || 'Untitled'}</h3>
                                    {content.trim()
                                        ? <PolicyContent source={content} className="mt-4" />
                                        : <p className="mt-4 text-sm text-km-text-secondary">The text appears here as it will on the site.</p>}
                                </div>
                            </div>
                        </div>

                        {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

                        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-km-border-subtle bg-km-surface-raised px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                            <p className="text-xs text-km-text-secondary sm:mr-auto">
                                {base.version
                                    ? `Version ${base.version} is live. Publishing makes version ${base.version + 1} live straight away.`
                                    : 'Publishing puts this on the site straight away.'}
                            </p>
                            <button type="button" onClick={close} disabled={busy} className={btn.secondary}>Cancel</button>
                            <button type="submit" disabled={busy || !dirty || !title.trim() || !content.trim() || tooLong} className={btn.primary}>
                                {busy ? 'Publishing…' : `Publish version ${base.version + 1}`}
                            </button>
                        </div>
                    </form>
                )}
            </AdminModal>

            {confirmDiscard && (
                <ConfirmDialog
                    title="Discard your changes?"
                    description="What you've written since opening the editor will be lost."
                    confirmLabel="Discard"
                    onCancel={() => setConfirmDiscard(false)}
                    onConfirm={onClose}
                />
            )}
        </>
    );
}

function HistoryDialog({ policy, onClose }: { policy: AdminPolicy; onClose: () => void }) {
    const [versions, setVersions] = useState<PolicyVersion[] | null>(null);
    const [shown, setShown] = useState<PolicyVersion | null>(null);
    const [loadingVersion, setLoadingVersion] = useState<number | null>(null);

    const open = useCallback(async (n: number) => {
        setLoadingVersion(n);
        try {
            setShown(await policiesAdminApi.version(policy.slug, n));
        } catch (err) {
            notify.error(err, "Couldn't load that version");
        } finally {
            setLoadingVersion(null);
        }
    }, [policy.slug]);

    useEffect(() => {
        let live = true;
        policiesAdminApi
            .versions(policy.slug)
            .then((list) => {
                if (!live) return;
                setVersions(list ?? []);
                if (list?.[0]) open(list[0].version);
            })
            .catch((err) => {
                if (!live) return;
                notify.error(err, "Couldn't load the history");
                setVersions([]);
            });
        return () => {
            live = false;
        };
    }, [policy.slug, open]);

    return (
        <AdminModal isOpen onClose={onClose} title={`${policy.title}: version history`} size="xl">
            {!versions ? (
                <SkeletonRows rows={4} />
            ) : (
                <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
                    <ul className="space-y-1" aria-label="Versions">
                        {versions.map((v, i) => (
                            <li key={v.version}>
                                <button
                                    type="button"
                                    onClick={() => open(v.version)}
                                    aria-current={shown?.version === v.version}
                                    className={cx(
                                        'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                                        shown?.version === v.version ? 'border-km-blue bg-km-surface' : 'border-km-border hover:bg-km-surface',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-km-heading">Version {v.version}</span>
                                        {i === 0 && <StatusBadge tone="green" dot={false}>Live</StatusBadge>}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-km-text-secondary font-inter">
                                        {loadingVersion === v.version ? 'Loading…' : formatDate(v.published_at)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="min-w-0 rounded-xl border border-km-border bg-km-surface p-5">
                        {shown ? (
                            <>
                                <p className="text-xs text-km-text-muted">Version {shown.version}, published {formatDate(shown.published_at)}</p>
                                <h3 className="mt-2 text-xl font-semibold text-km-heading">{shown.title}</h3>
                                <PolicyContent source={shown.content ?? ''} className="mt-4" />
                            </>
                        ) : (
                            <p className="text-sm text-km-text-secondary">Choose a version to read it.</p>
                        )}
                    </div>
                </div>
            )}
        </AdminModal>
    );
}
