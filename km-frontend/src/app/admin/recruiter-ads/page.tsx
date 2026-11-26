'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwiseIcon, CircleNotchIcon, PlusIcon, StorefrontIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import Pagination from '@/components/ui/Pagination';
import { AdPreview } from '@/components/ads/AdSlot';
import { adsApi, type AdPlacement, type AdPlacementInfo } from '@/lib/api/ads';
import {
    previewOf, recruiterAdsApi,
    type AdminAdFilter, type AdPackage, type AdPackageInput, type RecruiterAd, type RecruiterAdState,
} from '@/lib/api/recruiterAds';
import { AdminModal, AdminPageHeader, AdminPanel, BadgeTone, EmptyState, FilterTabs, SkeletonRows, StatusBadge, btn, cx, field, table } from '@/components/admin/ui';

const STATE_META: Record<RecruiterAdState, { label: string; tone: BadgeTone }> = {
    unpaid: { label: 'Not paid', tone: 'neutral' },
    pending: { label: 'Waiting', tone: 'amber' },
    running: { label: 'Running', tone: 'green' },
    ended: { label: 'Ended', tone: 'neutral' },
    rejected: { label: 'Rejected', tone: 'red' },
    refunded: { label: 'Refunded', tone: 'neutral' },
};

const AUDIENCE_LABELS: Record<string, string> = { guest: 'Signed-out visitors', user: 'Jobseekers', recruiter: 'Recruiters', expert: 'Experts' };

const EMPTY_PACKAGE: AdPackageInput = { name: '', description: '', days: 7, price: 0, placements: [], sort_order: 0, is_active: true };

/** Ads recruiters buy: the packages for sale, and the ads and changes waiting for approval */
export default function AdminRecruiterAdsPage() {
    const [placements, setPlacements] = useState<AdPlacementInfo[]>([]);
    const [packages, setPackages] = useState<AdPackage[]>([]);
    const [packagesLoading, setPackagesLoading] = useState(true);
    const [editingPackage, setEditingPackage] = useState<AdPackage | 'new' | null>(null);
    const [pkgForm, setPkgForm] = useState<AdPackageInput>(EMPTY_PACKAGE);
    const [pkgSaving, setPkgSaving] = useState(false);

    const [ads, setAds] = useState<RecruiterAd[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<AdminAdFilter>('review');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selected, setSelected] = useState<RecruiterAd | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const placementLabel = useMemo(() => Object.fromEntries(placements.map((p) => [p.id, p.label])), [placements]);

    const loadPackages = useCallback(async () => {
        setPackagesLoading(true);
        try {
            const res = await recruiterAdsApi.adminPackages();
            setPackages(res.packages || []);
        } catch (err) {
            notify.error(err, "Couldn't load ad packages");
        } finally {
            setPackagesLoading(false);
        }
    }, []);

    const loadAds = useCallback(async () => {
        setLoading(true);
        try {
            const res = await recruiterAdsApi.adminAds(filter, page);
            setAds(res.ads || []);
            setTotalPages(res.total_pages || 1);
        } catch (err) {
            notify.error(err, "Couldn't load recruiter ads");
            setAds([]);
        } finally {
            setLoading(false);
        }
    }, [filter, page]);

    useEffect(() => { void loadPackages(); }, [loadPackages]);
    useEffect(() => { void loadAds(); }, [loadAds]);
    // The slot names come with the admin's campaign list
    useEffect(() => {
        adsApi.list().then((res) => setPlacements(res.placements || [])).catch(() => setPlacements([]));
    }, []);

    const openPackage = (p: AdPackage | 'new') => {
        setEditingPackage(p);
        setPkgForm(p === 'new' ? EMPTY_PACKAGE : {
            name: p.name, description: p.description, days: p.days, price: p.price,
            placements: p.placements, sort_order: p.sort_order, is_active: p.is_active,
        });
    };

    const savePackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pkgForm.placements.length === 0) { notify.error('Pick at least one place on the site.'); return; }
        setPkgSaving(true);
        try {
            if (editingPackage === 'new') await recruiterAdsApi.createPackage(pkgForm);
            else if (editingPackage) await recruiterAdsApi.updatePackage(editingPackage.id, pkgForm);
            notify.success('Package saved');
            setEditingPackage(null);
            void loadPackages();
        } catch (err) {
            notify.error(err, "Couldn't save the package");
        } finally {
            setPkgSaving(false);
        }
    };

    const togglePlacement = (id: AdPlacement) => setPkgForm((f) => ({
        ...f, placements: f.placements.includes(id) ? f.placements.filter((x) => x !== id) : [...f.placements, id],
    }));

    const open = (ad: RecruiterAd) => { setSelected(ad); setReason(''); };

    const decide = async (action: 'approve' | 'reject' | 'approveChange' | 'rejectChange') => {
        if (!selected) return;
        setBusy(true);
        try {
            if (action === 'approve') {
                await recruiterAdsApi.approve(selected.id, selected.updated_at);
                notify.success('Approved. The ad is live.');
            } else if (action === 'reject') {
                const ad = await recruiterAdsApi.reject(selected.id, reason.trim());
                notify.info(ad.refunded > 0 ? `Rejected. ${inr(ad.refunded)} is back in their wallet.` : 'Rejected.');
            } else if (action === 'approveChange') {
                await recruiterAdsApi.approveChange(selected.id, selected.revision_at ?? '');
                notify.success('The change is live.');
            } else {
                await recruiterAdsApi.rejectChange(selected.id, reason.trim());
                notify.info('Change refused. The ad keeps running as it was.');
            }
            setSelected(null);
            void loadAds();
        } catch (err) {
            notify.error(err, "Couldn't update the ad");
            // Changed while the admin was looking: close it so the fresh version is reviewed
            if ((err as { code?: string }).code === 'RECRUITER_AD_CHANGED') {
                setSelected(null);
                void loadAds();
            }
        } finally {
            setBusy(false);
        }
    };

    const waitingChange = selected?.state === 'running' && !!selected.revision;
    const shown = selected ? (waitingChange ? selected.revision! : selected) : null;
    const inlinePreview = !!selected && selected.placements.every((p) => p.endsWith('_inline'));

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Recruiter ads"
                description="Ads recruiters buy. They pay for a package, you approve each ad, and it runs for the package's days from approval. A rejected ad is refunded to their wallet."
                actions={<button type="button" onClick={() => { void loadAds(); void loadPackages(); }} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <AdminPanel>
                <div className="px-5 py-4 border-b border-km-border-subtle flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-km-heading">Packages</h2>
                        <p className="text-sm text-km-text-secondary">What recruiters can buy. Changes apply to new purchases only.</p>
                    </div>
                    <button type="button" onClick={() => openPackage('new')} className={cx(btn.primary, 'shrink-0')}><PlusIcon size={16} weight="bold" aria-hidden="true" />New package</button>
                </div>
                {packagesLoading ? <SkeletonRows rows={2} /> : packages.length === 0 ? (
                    <EmptyState icon={StorefrontIcon} title="No packages yet" description="Recruiters can't buy ads until you add a package." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Package</th>
                                    <th className={`${table.th} text-right`}>Price</th>
                                    <th className={table.th}>Days</th>
                                    <th className={table.th}>Shows in</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {packages.map((p) => (
                                    <tr key={p.id} className={table.row}>
                                        <td className={table.td}><p className="font-medium text-km-heading">{p.name}</p>{p.description && <p className="text-xs text-km-text-secondary max-w-[260px] truncate">{p.description}</p>}</td>
                                        <td className={`${table.td} text-right font-medium text-km-heading font-inter tabular-nums`}>{inr(p.price)}</td>
                                        <td className={`${table.td} font-inter tabular-nums`}>{p.days}</td>
                                        <td className={`${table.td} text-xs text-km-text-secondary max-w-[280px]`}>{p.placements.map((id) => placementLabel[id] ?? id).join(', ')}</td>
                                        <td className={table.td}><StatusBadge tone={p.is_active ? 'green' : 'neutral'}>{p.is_active ? 'On sale' : 'Off'}</StatusBadge></td>
                                        <td className={`${table.td} text-right`}><button type="button" onClick={() => openPackage(p)} className={`${btn.secondary} h-9 px-3`}>Edit</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdminPanel>
                <div className="px-5 py-4 border-b border-km-border-subtle overflow-x-auto">
                    <FilterTabs
                        value={filter}
                        onChange={(next) => { setFilter(next); setPage(1); }}
                        options={[
                            { value: 'review', label: 'To review' },
                            { value: 'running', label: 'Running' },
                            { value: 'ended', label: 'Ended' },
                            { value: 'rejected', label: 'Rejected' },
                            { value: 'refunded', label: 'Refunded' },
                            { value: 'all', label: 'All' },
                        ]}
                    />
                </div>
                {loading ? <SkeletonRows rows={5} /> : ads.length === 0 ? (
                    <EmptyState icon={StorefrontIcon} title="No ads here" description="Paid ads from recruiters appear here." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Ad</th>
                                    <th className={table.th}>Recruiter</th>
                                    <th className={`${table.th} text-right`}>Paid</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}>Paid on</th>
                                    <th className={table.th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {ads.map((ad) => (
                                    <tr key={ad.id} className={table.row}>
                                        <td className={table.td}>
                                            <div className="flex items-center gap-3">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={ad.image_url} alt="" className="w-12 h-10 rounded-lg object-cover bg-km-surface shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-medium text-km-heading truncate max-w-[220px]">{ad.headline}</p>
                                                    <p className="text-xs text-km-text-secondary">{ad.package_name} · {ad.days} days</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading truncate max-w-[200px]">{ad.user_name || ad.advertiser}</p>
                                            {ad.user_email && <p className="text-xs text-km-text-secondary truncate max-w-[200px]">{ad.user_email}</p>}
                                        </td>
                                        <td className={`${table.td} text-right font-medium text-km-heading font-inter tabular-nums whitespace-nowrap`}>{inr(ad.price)}</td>
                                        <td className={table.td}>
                                            <div className="flex flex-wrap gap-1.5">
                                                <StatusBadge tone={STATE_META[ad.state].tone}>{STATE_META[ad.state].label}</StatusBadge>
                                                {ad.revision && <StatusBadge tone="amber">Change waiting</StatusBadge>}
                                            </div>
                                        </td>
                                        <td className={`${table.td} text-xs text-km-text-secondary font-inter whitespace-nowrap`}>{ad.paid_at ? dateTime(ad.paid_at) : ''}</td>
                                        <td className={`${table.td} text-right`}><button type="button" onClick={() => open(ad)} className={`${btn.secondary} h-9 px-3`}>Open</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {totalPages > 1 && <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle"><Pagination current={page} total={totalPages} onPageChange={setPage} /></div>}
            </AdminPanel>

            <AdminModal isOpen={!!selected} onClose={() => !busy && setSelected(null)} title={waitingChange ? 'Change to a running ad' : 'Recruiter ad'} size="xl">
                {selected && shown && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                        <div className="space-y-4">
                            <dl className="rounded-xl border border-km-border-subtle divide-y divide-km-border-subtle text-sm">
                                {[
                                    ['Status', <StatusBadge key="s" tone={STATE_META[selected.state].tone}>{STATE_META[selected.state].label}</StatusBadge>],
                                    ['Recruiter', [selected.user_name, selected.user_email].filter(Boolean).join(' · ') || '—'],
                                    ['Package', `${selected.package_name}, ${selected.days} days, ${inr(selected.price)} (${selected.channel === 'online' ? 'paid online' : 'paid from wallet'})`],
                                    ['Shows in', selected.placements.map((id) => placementLabel[id] ?? id).join(', ')],
                                    ['Audience', selected.audiences.length ? selected.audiences.map((a) => AUDIENCE_LABELS[a] ?? a).join(', ') : 'Everyone'],
                                    ['Cities', selected.cities.length ? selected.cities.join(', ') : 'All cities'],
                                    ['Link', <a key="l" href={shown.link_url} target="_blank" rel="noopener noreferrer nofollow" className="text-km-link hover:underline break-all">{shown.link_url}</a>],
                                    ...(selected.starts_at && selected.ends_at ? [['Runs', `${dateTime(selected.starts_at)} to ${dateTime(selected.ends_at)}`]] : []),
                                    ...(selected.state === 'running' || selected.state === 'ended' ? [['Views, clicks', `${selected.impressions}, ${selected.clicks}`]] : []),
                                    ...(selected.reject_reason ? [['Why rejected', selected.reject_reason]] : []),
                                    ...(selected.refunded > 0 ? [['Refunded to wallet', inr(selected.refunded)]] : []),
                                ].map(([label, value]) => (
                                    <div key={label as string} className="flex justify-between gap-4 px-4 py-2.5">
                                        <dt className="text-km-text-secondary shrink-0">{label}</dt>
                                        <dd className="text-right text-km-text-primary break-words min-w-0">{value}</dd>
                                    </div>
                                ))}
                            </dl>

                            {waitingChange && (
                                <p className="text-sm text-km-text-secondary">
                                    The preview shows the new version. Until you approve it, the ad keeps running as: &ldquo;{selected.headline}&rdquo;.
                                </p>
                            )}

                            {(selected.state === 'pending' || waitingChange) && (
                                <>
                                    <button type="button" onClick={() => decide(waitingChange ? 'approveChange' : 'approve')} disabled={busy} className={`${btn.primary} w-full`}>
                                        {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                        {waitingChange ? 'Approve the change' : `Approve and run for ${selected.days} days`}
                                    </button>
                                    <label className="block">
                                        <span className={field.label}>{waitingChange ? 'Reason to refuse the change' : 'Reason to reject'}</span>
                                        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={field.input} />
                                        <span className={field.hint}>
                                            {waitingChange
                                                ? 'The recruiter sees this. The ad keeps running as it was.'
                                                : `The recruiter sees this, and ${inr(selected.price)} goes back to their KaamMilega wallet.`}
                                        </span>
                                    </label>
                                    <button type="button" onClick={() => decide(waitingChange ? 'rejectChange' : 'reject')} disabled={busy || !reason.trim()} className={`${btn.danger} w-full`}>
                                        {waitingChange ? 'Refuse the change' : 'Reject and refund'}
                                    </button>
                                </>
                            )}
                        </div>
                        <aside>
                            <p className={field.label}>Preview</p>
                            <AdPreview ad={previewOf(shown, { advertiser: shown.advertiser, headline: shown.headline })} inline={inlinePreview} />
                            {shown.body && <p className="mt-2 text-xs text-km-text-secondary">Text: {shown.body}</p>}
                        </aside>
                    </div>
                )}
            </AdminModal>

            <AdminModal isOpen={!!editingPackage} onClose={() => !pkgSaving && setEditingPackage(null)} title={editingPackage === 'new' ? 'New ad package' : 'Edit ad package'} size="lg">
                <form onSubmit={savePackage} className="space-y-4">
                    <label className="block">
                        <span className={field.label}>Name</span>
                        <input value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} maxLength={60} required className={field.input} placeholder="1 week" />
                    </label>
                    <label className="block">
                        <span className={field.label}>Description <span className="font-normal text-km-text-secondary">(optional)</span></span>
                        <input value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} maxLength={300} className={field.input} />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                            <span className={field.label}>Price (₹)</span>
                            <input type="number" min={1} max={100000} step="0.01" value={pkgForm.price || ''} onChange={(e) => setPkgForm({ ...pkgForm, price: Number(e.target.value) })} required className={field.input} />
                        </label>
                        <label className="block">
                            <span className={field.label}>Days</span>
                            <input type="number" min={1} max={366} value={pkgForm.days || ''} onChange={(e) => setPkgForm({ ...pkgForm, days: Number(e.target.value) })} required className={field.input} />
                        </label>
                        <label className="block">
                            <span className={field.label}>Order</span>
                            <input type="number" value={pkgForm.sort_order} onChange={(e) => setPkgForm({ ...pkgForm, sort_order: Number(e.target.value) })} className={field.input} />
                        </label>
                    </div>
                    <fieldset>
                        <legend className={field.label}>Shows in</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {placements.map((p) => (
                                <label key={p.id} className="flex items-center gap-2 text-sm text-km-text-primary cursor-pointer">
                                    <input type="checkbox" checked={pkgForm.placements.includes(p.id)} onChange={() => togglePlacement(p.id)} className="accent-km-blue" />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <label className="flex items-center gap-2 text-sm text-km-text-primary cursor-pointer">
                        <input type="checkbox" checked={pkgForm.is_active} onChange={(e) => setPkgForm({ ...pkgForm, is_active: e.target.checked })} className="accent-km-blue" />
                        On sale
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setEditingPackage(null)} disabled={pkgSaving} className={btn.secondary}>Cancel</button>
                        <button type="submit" disabled={pkgSaving} className={btn.primary}>
                            {pkgSaving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            Save
                        </button>
                    </div>
                </form>
            </AdminModal>
        </div>
    );
}
