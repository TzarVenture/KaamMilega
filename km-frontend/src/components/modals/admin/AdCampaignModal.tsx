'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CircleNotchIcon, ImageIcon, UploadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { AdminModal, btn, cx, field } from '@/components/admin/ui';
import { AdPreview } from '@/components/ads/AdSlot';
import { adsApi, type AdAudience, type AdCampaign, type AdCampaignInput, type AdPlacement, type AdPlacementInfo } from '@/lib/api/ads';
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';
import { errorText, notify } from '@/lib/notify';

const AUDIENCE_LABELS: Record<AdAudience, string> = {
    guest: 'Signed-out visitors',
    user: 'Jobseekers',
    recruiter: 'Recruiters',
    expert: 'Experts',
};

const CREATIVE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm';

/** ISO time to the value a datetime-local input wants, in the browser's time zone */
function toLocalInput(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (campaign: AdCampaign) => void;
    campaign: AdCampaign | null;
    placements: AdPlacementInfo[];
    audiences: AdAudience[];
    cities: string[];
}

export default function AdCampaignModal({ isOpen, onClose, onSaved, campaign, placements, audiences, cities }: Props) {
    const [name, setName] = useState('');
    const [advertiser, setAdvertiser] = useState('');
    const [headline, setHeadline] = useState('');
    const [body, setBody] = useState('');
    const [ctaLabel, setCtaLabel] = useState('');
    const [creativeType, setCreativeType] = useState<'image' | 'video'>('image');
    const [creativeUrl, setCreativeUrl] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [chosenPlacements, setChosenPlacements] = useState<AdPlacement[]>([]);
    const [chosenAudiences, setChosenAudiences] = useState<AdAudience[]>([]);
    const [chosenCities, setChosenCities] = useState<string[]>([]);
    const [cityDraft, setCityDraft] = useState('');
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [priority, setPriority] = useState(5);
    const [freqCap, setFreqCap] = useState(3);
    const [paused, setPaused] = useState(false);

    const [uploading, setUploading] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setName(campaign?.name ?? '');
        setAdvertiser(campaign?.advertiser ?? '');
        setHeadline(campaign?.headline ?? '');
        setBody(campaign?.body ?? '');
        setCtaLabel(campaign?.cta_label ?? '');
        setCreativeType(campaign?.creative_type ?? 'image');
        setCreativeUrl(campaign?.creative_url ?? '');
        setLinkUrl(campaign?.link_url ?? '');
        setChosenPlacements(campaign?.placements ?? []);
        setChosenAudiences(campaign?.audiences ?? []);
        setChosenCities(campaign?.cities ?? []);
        setCityDraft('');
        setStartAt(toLocalInput(campaign?.start_at));
        setEndAt(toLocalInput(campaign?.end_at));
        setPriority(campaign?.priority ?? 5);
        setFreqCap(campaign?.frequency_cap ?? 3);
        setPaused(campaign?.status === 'paused');
        setError('');
    }, [isOpen, campaign]);

    const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

    const addCity = (raw: string) => {
        const c = raw.trim();
        if (c && !chosenCities.some((x) => x.toLowerCase() === c.toLowerCase())) setChosenCities([...chosenCities, c]);
        setCityDraft('');
    };

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (file.size > UPLOAD_LIMITS.ad_creative) {
            setError('The file is over 10 MB. Use a smaller image or a shorter video.');
            return;
        }
        setError('');
        setIsUploading(true);
        setUploading(0);
        try {
            const res = await uploadFile(file, 'ad_creative', { moduleName: 'ads', onProgress: setUploading });
            setCreativeUrl(res.url);
            setCreativeType(res.mime_type.startsWith('video/') ? 'video' : 'image');
        } catch (err) {
            setError(errorText(err, "Couldn't upload the file. Try again."));
        } finally {
            setIsUploading(false);
        }
    };

    const rails = placements.filter((p) => p.format === 'rail');
    const inlines = placements.filter((p) => p.format === 'inline');
    const previewInline = chosenPlacements.length > 0 && chosenPlacements.every((p) => p.endsWith('_inline'));

    const preview = useMemo(() => ({
        id: 'preview',
        advertiser: advertiser || 'Advertiser',
        headline: headline || 'Your headline shows here',
        body: body || undefined,
        cta_label: ctaLabel || undefined,
        creative_type: creativeType,
        creative_url: creativeUrl,
        domain: (() => {
            try { return new URL(linkUrl).hostname.replace(/^www\./, ''); } catch { return 'example.com'; }
        })(),
    }), [advertiser, headline, body, ctaLabel, creativeType, creativeUrl, linkUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!creativeUrl) { setError('Upload an image or a video.'); return; }
        if (chosenPlacements.length === 0) { setError('Pick at least one place on the site.'); return; }
        const input: AdCampaignInput = {
            name, advertiser, headline, body, cta_label: ctaLabel,
            creative_type: creativeType, creative_url: creativeUrl, link_url: linkUrl,
            placements: chosenPlacements, audiences: chosenAudiences, cities: chosenCities,
            start_at: fromLocalInput(startAt), end_at: fromLocalInput(endAt) ?? null,
            priority, frequency_cap: freqCap, status: paused ? 'paused' : 'active',
        };
        setSaving(true);
        setError('');
        try {
            const saved = campaign ? await adsApi.update(campaign.id, input) : await adsApi.create(input);
            notify.success(campaign ? 'Campaign updated' : 'Campaign created');
            onSaved(saved);
            onClose();
        } catch (err) {
            setError(errorText(err, "Couldn't save the campaign."));
        } finally {
            setSaving(false);
        }
    };

    const section = 'space-y-4 pt-6 first:pt-0';
    const sectionTitle = 'text-sm font-semibold text-km-heading';
    const checkRow = (checked: boolean) => cx(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors',
        checked ? 'border-km-blue bg-blue-50 text-km-heading' : 'border-km-border text-km-text-primary hover:bg-km-surface',
    );

    return (
        <AdminModal isOpen={isOpen} onClose={() => !saving && onClose()} title={campaign ? 'Edit campaign' : 'New campaign'} size="xl">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
                <div className="divide-y divide-km-border-subtle [&>*]:pb-6 [&>*:last-child]:pb-0">
                    <section className={section}>
                        <h3 className={sectionTitle}>Campaign</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block">
                                <span className={field.label}>Name</span>
                                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={field.input} placeholder="For example: Acme Diwali hiring" />
                                <span className={field.hint}>Only admins see this.</span>
                            </label>
                            <label className="block">
                                <span className={field.label}>Advertiser</span>
                                <input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} required maxLength={80} className={field.input} placeholder="For example: Acme Logistics" />
                                <span className={field.hint}>Shown next to &ldquo;Sponsored&rdquo;.</span>
                            </label>
                        </div>
                    </section>

                    <section className={section}>
                        <h3 className={sectionTitle}>Ad</h3>
                        <div>
                            <span className={field.label}>Image or video</span>
                            <label className={cx(
                                'flex items-center gap-3 rounded-xl border border-dashed border-km-border px-4 py-3 cursor-pointer hover:bg-km-surface',
                                isUploading && 'pointer-events-none opacity-70',
                            )}>
                                {isUploading
                                    ? <CircleNotchIcon size={20} className="animate-spin text-km-link shrink-0" aria-hidden="true" />
                                    : creativeUrl ? <ImageIcon size={20} className="text-km-link shrink-0" aria-hidden="true" /> : <UploadSimpleIcon size={20} className="text-km-text-secondary shrink-0" aria-hidden="true" />}
                                <span className="min-w-0 text-sm">
                                    <span className="block font-medium text-km-heading">
                                        {isUploading ? `Uploading ${Math.round(uploading * 100)}%` : creativeUrl ? `${creativeType === 'video' ? 'Video' : 'Image'} uploaded, choose another` : 'Choose a file'}
                                    </span>
                                    <span className="block text-xs text-km-text-secondary">1200 × 628 px works everywhere. JPG, PNG, WebP, GIF, MP4 or WebM, up to 10 MB. Videos play muted.</span>
                                </span>
                                <input type="file" accept={CREATIVE_ACCEPT} className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                            </label>
                        </div>
                        <label className="block">
                            <span className={field.label}>Headline</span>
                            <input value={headline} onChange={(e) => setHeadline(e.target.value)} required maxLength={80} className={field.input} placeholder="For example: Delivery partners wanted in Pune" />
                            <span className={field.hint}>{headline.length}/80</span>
                        </label>
                        <label className="block">
                            <span className={field.label}>Text <span className="font-normal text-km-text-secondary">(optional)</span></span>
                            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={160} rows={2} className={`${field.textarea} resize-none`} placeholder="One or two short sentences" />
                            <span className={field.hint}>{body.length}/160</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_200px] gap-4">
                            <label className="block">
                                <span className={field.label}>Link</span>
                                <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required className={field.input} placeholder="https://" />
                            </label>
                            <label className="block">
                                <span className={field.label}>Button text</span>
                                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={24} className={field.input} placeholder="Learn more" />
                            </label>
                        </div>
                    </section>

                    <section className={section}>
                        <h3 className={sectionTitle}>Where it shows</h3>
                        {[{ title: 'Side columns', list: rails }, { title: 'Between items in lists', list: inlines }].map((group) => (
                            <fieldset key={group.title}>
                                <legend className="mb-2 text-xs font-medium text-km-text-secondary">{group.title}</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {group.list.map((p) => {
                                        const checked = chosenPlacements.includes(p.id);
                                        return (
                                            <label key={p.id} className={checkRow(checked)}>
                                                <input type="checkbox" checked={checked} onChange={() => setChosenPlacements(toggle(chosenPlacements, p.id))} className="mt-0.5 accent-km-blue" />
                                                {p.label}
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        ))}
                    </section>

                    <section className={section}>
                        <h3 className={sectionTitle}>Who sees it</h3>
                        <fieldset>
                            <legend className="mb-2 text-xs font-medium text-km-text-secondary">Audience. Leave all unticked for everyone.</legend>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {audiences.map((a) => {
                                    const checked = chosenAudiences.includes(a);
                                    return (
                                        <label key={a} className={checkRow(checked)}>
                                            <input type="checkbox" checked={checked} onChange={() => setChosenAudiences(toggle(chosenAudiences, a))} className="mt-0.5 accent-km-blue" />
                                            {AUDIENCE_LABELS[a] ?? a}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                        <div>
                            <label htmlFor="ad-city" className={field.label}>Cities <span className="font-normal text-km-text-secondary">(optional)</span></label>
                            <div className="flex gap-2">
                                <input
                                    id="ad-city"
                                    list="ad-city-options"
                                    value={cityDraft}
                                    onChange={(e) => setCityDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCity(cityDraft); } }}
                                    className={field.input}
                                    placeholder="Type a city and press Enter"
                                />
                                <button type="button" onClick={() => addCity(cityDraft)} disabled={!cityDraft.trim()} className={btn.secondary}>Add</button>
                            </div>
                            <datalist id="ad-city-options">
                                {cities.map((c) => <option key={c} value={c} />)}
                            </datalist>
                            {chosenCities.length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-1.5">
                                    {chosenCities.map((c) => (
                                        <li key={c}>
                                            <button type="button" onClick={() => setChosenCities(chosenCities.filter((x) => x !== c))} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-km-surface border border-km-border text-sm text-km-text-primary hover:border-red-300 cursor-pointer" aria-label={`Remove ${c}`}>
                                                {c} <span aria-hidden="true" className="text-km-text-muted">×</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <span className={field.hint}>With cities set, the ad only shows to members whose profile city matches. Signed-out visitors won&apos;t see it.</span>
                        </div>
                    </section>

                    <section className={section}>
                        <h3 className={sectionTitle}>Schedule and delivery</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block">
                                <span className={field.label}>Starts</span>
                                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={field.input} />
                                <span className={field.hint}>Leave empty to start now.</span>
                            </label>
                            <label className="block">
                                <span className={field.label}>Ends <span className="font-normal text-km-text-secondary">(optional)</span></span>
                                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={field.input} />
                            </label>
                            <label className="block">
                                <span className={field.label}>Priority</span>
                                <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={`${field.input} cursor-pointer`}>
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                        <option key={n} value={n}>{n}{n === 1 ? ', lowest' : n === 10 ? ', highest' : ''}</option>
                                    ))}
                                </select>
                                <span className={field.hint}>When several ads fit a slot, higher priority shows more often.</span>
                            </label>
                            <label className="block">
                                <span className={field.label}>Times a day per person</span>
                                <input type="number" min={0} max={50} value={freqCap} onChange={(e) => setFreqCap(Math.max(0, Math.min(50, Number(e.target.value) || 0)))} className={`${field.input} font-inter`} />
                                <span className={field.hint}>0 means no limit.</span>
                            </label>
                        </div>
                        <label className="flex items-center gap-2.5 text-sm text-km-text-primary cursor-pointer">
                            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} className="accent-km-blue" />
                            Save as paused
                        </label>
                    </section>
                </div>

                <div className="lg:sticky lg:top-0 self-start space-y-3">
                    <p className="text-sm font-semibold text-km-heading">Preview</p>
                    {creativeUrl ? (
                        <AdPreview ad={preview} inline={previewInline} />
                    ) : (
                        <div className="flex aspect-[1.91/1] items-center justify-center rounded-2xl border border-dashed border-km-border text-sm text-km-text-muted">
                            Upload an image or video to preview
                        </div>
                    )}
                    <p className="text-xs text-km-text-secondary">
                        {previewInline ? 'As a card between items in a list.' : 'As a box in a side column.'} Every ad is labelled &ldquo;Sponsored&rdquo;.
                    </p>

                    {error && (
                        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                            <WarningCircleIcon size={18} className="shrink-0 mt-px" aria-hidden="true" />
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} disabled={saving} className={`${btn.secondary} flex-1`}>Cancel</button>
                        <button type="submit" disabled={saving || isUploading} className={`${btn.primary} flex-1`}>
                            {saving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {campaign ? 'Save' : 'Create'}
                        </button>
                    </div>
                </div>
            </form>
        </AdminModal>
    );
}
