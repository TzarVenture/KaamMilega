'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowsClockwiseIcon,
    ChartBarIcon,
    CursorClickIcon,
    EyeIcon,
    MegaphoneIcon,
    PauseIcon,
    PencilSimpleIcon,
    PercentIcon,
    PlayIcon,
    PlusIcon,
    TrashIcon,
    XIcon,
} from '@phosphor-icons/react';
import {
    AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, FilterTabs, MenuItem, RowMenu, SearchInput,
    SkeletonRows, StatCard, StatusBadge, btn, cx, table, type BadgeTone,
} from '@/components/admin/ui';
import AdCampaignModal from '@/components/modals/admin/AdCampaignModal';
import { adsApi, type AdAudience, type AdCampaign, type AdDay, type AdPlacementInfo, type AdState } from '@/lib/api/ads';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';

const STATE_META: Record<AdState, { label: string; tone: BadgeTone }> = {
    active: { label: 'Running', tone: 'green' },
    scheduled: { label: 'Scheduled', tone: 'blue' },
    paused: { label: 'Paused', tone: 'amber' },
    ended: { label: 'Ended', tone: 'neutral' },
};

const fmt = (n: number) => n.toLocaleString('en-IN');
const pct = (r: number) => `${(r * 100).toFixed(r > 0 && r < 0.001 ? 2 : 1)}%`;
const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function AdsPage() {
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [placements, setPlacements] = useState<AdPlacementInfo[]>([]);
    const [audiences, setAudiences] = useState<AdAudience[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | AdState>('all');
    const [search, setSearch] = useState('');

    const [editing, setEditing] = useState<AdCampaign | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdCampaign | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [statsFor, setStatsFor] = useState<AdCampaign | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adsApi.list();
            setCampaigns(res.campaigns || []);
            setPlacements(res.placements || []);
            setAudiences(res.audiences || []);
        } catch (err) {
            notify.error(err, "Couldn't load campaigns");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // City names for the targeting picker
    useEffect(() => {
        api.get<unknown, { name: string }[] | { data?: { name: string }[] }>('/cities')
            .then((res) => {
                const list = Array.isArray(res) ? res : res?.data || [];
                // Targeting matches on the name, and a name can repeat across states
                setCities([...new Set(list.map((c) => c.name?.trim()).filter(Boolean))].sort());
            })
            .catch(() => setCities([]));
    }, []);

    const placementLabel = useMemo(() => Object.fromEntries(placements.map((p) => [p.id, p.label])), [placements]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: campaigns.length, active: 0, scheduled: 0, paused: 0, ended: 0 };
        campaigns.forEach((x) => { c[x.state] = (c[x.state] || 0) + 1; });
        return c;
    }, [campaigns]);

    const totals = useMemo(() => {
        const impressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
        const clicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
        return { impressions, clicks, ctr: impressions ? clicks / impressions : 0 };
    }, [campaigns]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return campaigns.filter((c) =>
            (filter === 'all' || c.state === filter) &&
            (!q || [c.name, c.advertiser, c.headline].some((v) => v?.toLowerCase().includes(q))));
    }, [campaigns, filter, search]);

    const openNew = () => { setEditing(null); setFormOpen(true); };

    const onSaved = (saved: AdCampaign) => {
        setCampaigns((prev) => {
            const exists = prev.some((c) => c.id === saved.id);
            return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev];
        });
    };

    const toggleStatus = async (c: AdCampaign) => {
        const next = c.status === 'paused' ? 'active' : 'paused';
        try {
            await adsApi.setStatus(c.id, next);
            notify.success(next === 'paused' ? `${c.name} paused` : `${c.name} resumed`);
            load();
        } catch (err) {
            notify.error(err, "Couldn't update the campaign");
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await adsApi.remove(deleteTarget.id);
            setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            notify.success(`${deleteTarget.name} deleted`);
            setDeleteTarget(null);
        } catch (err) {
            notify.error(err, "Couldn't delete the campaign");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Ads"
                description="Campaigns shown in ad slots across the site"
                actions={
                    <>
                        <button type="button" onClick={load} disabled={loading} className={btn.icon} aria-label="Refresh">
                            <ArrowsClockwiseIcon size={18} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={openNew} className={btn.primary}>
                            <PlusIcon size={16} weight="bold" aria-hidden="true" />
                            New campaign
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Running now" value={loading ? '–' : counts.active} icon={MegaphoneIcon} />
                <StatCard label="Impressions" value={loading ? '–' : fmt(totals.impressions)} icon={EyeIcon} hint="All time, all campaigns" />
                <StatCard label="Clicks" value={loading ? '–' : fmt(totals.clicks)} icon={CursorClickIcon} />
                <StatCard label="Click-through rate" value={loading ? '–' : pct(totals.ctr)} icon={PercentIcon} />
            </div>

            <AdminPanel>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <div className="overflow-x-auto -mx-1 px-1">
                        <FilterTabs
                            value={filter}
                            onChange={setFilter}
                            options={[
                                { value: 'all', label: 'All', count: counts.all },
                                { value: 'active', label: 'Running', count: counts.active },
                                { value: 'scheduled', label: 'Scheduled', count: counts.scheduled },
                                { value: 'paused', label: 'Paused', count: counts.paused },
                                { value: 'ended', label: 'Ended', count: counts.ended },
                            ]}
                        />
                    </div>
                    <SearchInput value={search} onChange={setSearch} placeholder="Search campaign or advertiser" className="w-full lg:w-72" />
                </div>

                {loading ? (
                    <SkeletonRows rows={5} />
                ) : shown.length === 0 ? (
                    <EmptyState
                        icon={MegaphoneIcon}
                        title={campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
                        description={campaigns.length === 0
                            ? 'Create a campaign to fill the ad slots in the feed, job search, job pages and Learn. Empty slots stay hidden.'
                            : 'Try a different search or filter.'}
                        action={campaigns.length === 0 ? (
                            <button type="button" onClick={openNew} className={btn.primary}>
                                <PlusIcon size={16} weight="bold" aria-hidden="true" />
                                New campaign
                            </button>
                        ) : undefined}
                    />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Campaign</th>
                                    <th className={table.th}>Shows in</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}>Dates</th>
                                    <th className={`${table.th} text-right`}>Impressions</th>
                                    <th className={`${table.th} text-right`}>Clicks</th>
                                    <th className={`${table.th} text-right`}>CTR</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((c) => {
                                    const meta = STATE_META[c.state] ?? STATE_META.ended;
                                    return (
                                        <tr key={c.id} className={table.row}>
                                            <td className={table.td}>
                                                <div className="flex items-center gap-3 min-w-[220px]">
                                                    <span className="w-16 aspect-[1.91/1] shrink-0 overflow-hidden rounded-lg border border-km-border bg-km-surface">
                                                        {c.creative_type === 'video'
                                                            ? <video src={c.creative_url} muted preload="metadata" className="w-full h-full object-cover" aria-hidden="true" />
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            : <img src={c.creative_url} alt="" className="w-full h-full object-cover" />}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block font-medium text-km-heading truncate">{c.name}</span>
                                                        <span className="block text-xs text-km-text-secondary truncate">{c.advertiser}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`${table.td} text-km-text-secondary`}>
                                                <span title={c.placements.map((p) => placementLabel[p] ?? p).join('\n')}>
                                                    {c.placements.length === 1 ? placementLabel[c.placements[0]] ?? c.placements[0] : `${c.placements.length} places`}
                                                </span>
                                                {(c.audiences.length > 0 || c.cities.length > 0) && (
                                                    <span className="block text-xs text-km-text-muted">
                                                        {[c.audiences.length > 0 && `${c.audiences.length} audience${c.audiences.length > 1 ? 's' : ''}`,
                                                          c.cities.length > 0 && `${c.cities.length} cit${c.cities.length > 1 ? 'ies' : 'y'}`].filter(Boolean).join(', ')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={table.td}><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td>
                                            <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>
                                                {date(c.start_at)}
                                                <span className="block text-xs text-km-text-muted">{c.end_at ? `to ${date(c.end_at)}` : 'No end date'}</span>
                                            </td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{fmt(c.impressions)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{fmt(c.clicks)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{c.impressions ? pct(c.ctr) : '–'}</td>
                                            <td className={`${table.td} text-right`}>
                                                <RowMenu label={`Actions for ${c.name}`}>
                                                    {() => (
                                                        <>
                                                            <MenuItem icon={ChartBarIcon} onClick={() => setStatsFor(c)}>Daily numbers</MenuItem>
                                                            <MenuItem icon={PencilSimpleIcon} onClick={() => { setEditing(c); setFormOpen(true); }}>Edit</MenuItem>
                                                            {c.state !== 'ended' && (
                                                                <MenuItem icon={c.status === 'paused' ? PlayIcon : PauseIcon} onClick={() => toggleStatus(c)}>
                                                                    {c.status === 'paused' ? 'Resume' : 'Pause'}
                                                                </MenuItem>
                                                            )}
                                                            <MenuItem icon={TrashIcon} danger onClick={() => setDeleteTarget(c)}>Delete</MenuItem>
                                                        </>
                                                    )}
                                                </RowMenu>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdCampaignModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                onSaved={onSaved}
                campaign={editing}
                placements={placements}
                audiences={audiences}
                cities={cities}
            />

            {deleteTarget && (
                <ConfirmDialog
                    title={`Delete ${deleteTarget.name}?`}
                    description="The ad stops showing and its numbers are deleted. To keep the numbers, pause it instead."
                    confirmLabel="Delete campaign"
                    busy={deleting}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                />
            )}

            {statsFor && <StatsDialog campaign={statsFor} onClose={() => setStatsFor(null)} />}
        </div>
    );
}

/** A campaign's daily impressions and clicks */
function StatsDialog({ campaign, onClose }: { campaign: AdCampaign; onClose: () => void }) {
    const [range, setRange] = useState<'7' | '30' | '90'>('30');
    // Rows are kept with the range they belong to, so switching ranges shows loading until they arrive
    const [loaded, setLoaded] = useState<{ range: string; days: AdDay[] } | null>(null);
    const days = loaded?.range === range ? loaded.days : null;
    const [metric, setMetric] = useState<'impressions' | 'clicks' | 'reach'>('impressions');

    useEffect(() => {
        let live = true;
        adsApi.stats(campaign.id, Number(range) as 7 | 30 | 90)
            .then((res) => live && setLoaded({ range, days: res.days || [] }))
            .catch(() => live && setLoaded({ range, days: [] }));
        return () => { live = false; };
    }, [campaign.id, range]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const sum = (k: keyof Omit<AdDay, 'day'>) => (days || []).reduce((s, d) => s + d[k], 0);
    const impressions = sum('impressions');
    const clicks = sum('clicks');
    const max = Math.max(1, ...(days || []).map((d) => d[metric]));
    const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="ad-stats-title" className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-km-surface-raised rounded-2xl border border-km-border shadow-lg">
                <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-km-border-subtle">
                    <div className="min-w-0">
                        <h2 id="ad-stats-title" className="text-base font-semibold text-km-heading truncate">{campaign.name}</h2>
                        <p className="text-xs text-km-text-secondary mt-0.5">{campaign.advertiser}</p>
                    </div>
                    <button type="button" onClick={onClose} className={btn.icon} aria-label="Close">
                        <XIcon size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <FilterTabs
                            value={metric}
                            onChange={setMetric}
                            options={[
                                { value: 'impressions', label: 'Impressions' },
                                { value: 'reach', label: 'People reached' },
                                { value: 'clicks', label: 'Clicks' },
                            ]}
                        />
                        <FilterTabs
                            value={range}
                            onChange={setRange}
                            options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]}
                        />
                    </div>

                    <dl className="grid grid-cols-3 gap-3">
                        {[
                            ['Impressions', days ? fmt(impressions) : '–'],
                            ['Clicks', days ? fmt(clicks) : '–'],
                            ['Click-through rate', days ? (impressions ? pct(clicks / impressions) : '–') : '–'],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-km-border-subtle p-3">
                                <dt className="text-xs text-km-text-secondary">{label}</dt>
                                <dd className="mt-0.5 text-lg font-semibold text-km-heading font-inter tabular-nums">{value}</dd>
                            </div>
                        ))}
                    </dl>

                    {days === null ? (
                        <div className="h-48 rounded-xl bg-km-surface animate-pulse" aria-hidden="true" />
                    ) : (
                        <figure>
                            <div className="flex h-48 items-end gap-[2px] border-b border-km-border" role="img" aria-label={`${metric} per day`}>
                                {days.map((d) => (
                                    <div key={d.day} className="group relative flex h-full flex-1 items-end">
                                        <div
                                            className={cx('w-full rounded-t-[4px] bg-km-blue', d[metric] === 0 && 'bg-transparent')}
                                            style={{ height: `${(d[metric] / max) * 100}%` }}
                                        />
                                        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-km-primary px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 font-inter">
                                            {dayLabel(d.day)}: {fmt(d[metric])}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <figcaption className="mt-1.5 flex justify-between text-xs text-km-text-muted font-inter">
                                <span>{days[0] && dayLabel(days[0].day)}</span>
                                <span>{days.length > 0 && dayLabel(days[days.length - 1].day)}</span>
                            </figcaption>
                        </figure>
                    )}

                    <details className="text-sm">
                        <summary className="cursor-pointer text-km-link font-medium">Show as a table</summary>
                        <div className={`${table.wrap} mt-3 max-h-64 overflow-y-auto rounded-xl border border-km-border-subtle`}>
                            <table className={table.table}>
                                <thead>
                                    <tr>
                                        <th className={table.th}>Day</th>
                                        <th className={`${table.th} text-right`}>Impressions</th>
                                        <th className={`${table.th} text-right`}>People reached</th>
                                        <th className={`${table.th} text-right`}>Clicks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...(days || [])].reverse().map((d) => (
                                        <tr key={d.day}>
                                            <td className={`${table.td} font-inter`}>{dayLabel(d.day)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{fmt(d.impressions)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{fmt(d.reach)}</td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{fmt(d.clicks)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>

                    <p className="text-xs text-km-text-secondary">
                        An impression is counted when half the ad is on screen for a second. Each person&apos;s clicks count once a day. Admins and bots are never counted.
                    </p>
                </div>
            </div>
        </div>
    );
}
