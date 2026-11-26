'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleNotchIcon, ImageIcon, UploadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { errorText } from '@/lib/notify';
import { inr } from '@/lib/money';
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';
import { AdPreview } from '@/components/ads/AdSlot';
import { AdminModal, btn, cx, field } from '@/components/admin/ui';
import type { AdAudience } from '@/lib/api/ads';
import { previewOf, recruiterAdsApi, type AdContent, type AdPackage, type RecruiterAd } from '@/lib/api/recruiterAds';

const EMPTY: AdContent = { advertiser: '', headline: '', body: '', cta_label: '', image_url: '', link_url: 'https://', cities: [], audiences: [] };

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Called with the saved ad. A new or unpaid ad goes on to payment. */
    onSaved: (ad: RecruiterAd) => void;
    ad: RecruiterAd | null;
    packages: AdPackage[];
    audiences: AdAudience[];
    /** Name to start a new ad with (the recruiter's company) */
    companyName?: string;
}

/** Writes a recruiter ad, or changes one. A change to a running ad waits for an admin. */
export default function RecruiterAdFormModal({ isOpen, onClose, onSaved, ad, packages, audiences, companyName }: Props) {
    const t = useTranslations('recruiterAds');
    const [packageId, setPackageId] = useState('');
    const [content, setContent] = useState<AdContent>(EMPTY);
    const [cityDraft, setCityDraft] = useState('');
    const [cities, setCities] = useState<string[]>([]);
    const [uploading, setUploading] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const running = ad?.state === 'running';
    const paid = !!ad && ad.status !== 'unpaid';

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        setCityDraft('');
        // A change waiting for review is what the recruiter edits next
        const start = ad ? (ad.revision ?? ad) : { ...EMPTY, advertiser: companyName ?? '' };
        setContent({
            advertiser: start.advertiser, headline: start.headline, body: start.body ?? '', cta_label: start.cta_label ?? '',
            image_url: start.image_url, link_url: start.link_url, cities: ad?.cities ?? [], audiences: ad?.audiences ?? [],
        });
        setPackageId(ad?.package_id ?? packages[0]?.id ?? '');
    }, [isOpen, ad, packages, companyName]);

    // City names for the targeting picker
    useEffect(() => {
        if (!isOpen || cities.length > 0) return;
        api.get<unknown, { name: string }[] | { data?: { name: string }[] }>('/cities')
            .then((res) => {
                const list = Array.isArray(res) ? res : res?.data || [];
                setCities([...new Set(list.map((c) => c.name?.trim()).filter(Boolean))].sort());
            })
            .catch(() => setCities([]));
    }, [isOpen, cities.length]);

    const set = <K extends keyof AdContent>(key: K, value: AdContent[K]) => setContent((c) => ({ ...c, [key]: value }));

    const addCity = (raw: string) => {
        const c = raw.trim();
        if (c && content.cities.length < 20 && !content.cities.some((x) => x.toLowerCase() === c.toLowerCase())) set('cities', [...content.cities, c]);
        setCityDraft('');
    };

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            setError(t('imageType'));
            return;
        }
        if (file.size > UPLOAD_LIMITS.ad_image) {
            setError(t('imageSize'));
            return;
        }
        setError('');
        setUploading(0);
        try {
            const res = await uploadFile(file, 'ad_image', { moduleName: 'ads', onProgress: setUploading });
            set('image_url', res.url);
        } catch (err) {
            setError(errorText(err, t('uploadFailed')));
        } finally {
            setUploading(null);
        }
    };

    const pkg = packages.find((p) => p.id === packageId);
    // Inline slots show a wide card, side columns a box
    const placements = pkg?.placements ?? ad?.placements ?? [];
    const inlinePreview = placements.length > 0 && placements.every((p) => p.endsWith('_inline'));
    const preview = useMemo(() => previewOf(content, { advertiser: t('previewAdvertiser'), headline: t('previewHeadline') }), [content, t]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.image_url) { setError(t('imageRequired')); return; }
        if (!paid && !packageId) { setError(t('packageRequired')); return; }
        setSaving(true);
        setError('');
        try {
            const saved = ad
                ? await recruiterAdsApi.update(ad.id, paid ? '' : packageId, content)
                : await recruiterAdsApi.create(packageId, content);
            onSaved(saved);
        } catch (err) {
            setError(errorText(err, t('saveFailed')));
        } finally {
            setSaving(false);
        }
    };

    const section = 'space-y-4 pt-6 first:pt-0';
    const sectionTitle = 'text-sm font-semibold text-km-heading';
    const checkRow = (checked: boolean, disabled = false) => cx(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'border-km-blue bg-blue-50 text-km-heading dark:bg-km-surface' : 'border-km-border text-km-text-primary hover:bg-km-surface',
    );

    return (
        <AdminModal isOpen={isOpen} onClose={() => !saving && uploading === null && onClose()} title={ad ? t('editTitle') : t('newTitle')} size="xl">
            <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <div className="divide-y divide-km-border-subtle space-y-0">
                    {running && <p className="pb-4 text-sm text-km-text-secondary">{t('runningEditNote')}</p>}

                    <fieldset className={section}>
                        <legend className={sectionTitle}>{t('packageTitle')}</legend>
                        {paid ? (
                            <p className="text-sm text-km-text-primary">{t('packageFixed', { name: ad!.package_name, days: ad!.days })}</p>
                        ) : packages.length === 0 ? (
                            <p className="text-sm text-km-text-secondary">{t('noPackages')}</p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {packages.map((p) => (
                                    <label key={p.id} className={checkRow(packageId === p.id)}>
                                        <input type="radio" name="ad-package" checked={packageId === p.id} onChange={() => setPackageId(p.id)} className="mt-0.5 accent-km-blue" />
                                        <span className="min-w-0">
                                            <span className="block font-semibold text-km-heading">{p.name}</span>
                                            <span className="block text-km-text-secondary">{t('packageLine', { price: inr(p.price), days: p.days })}</span>
                                            {p.description && <span className="block text-xs text-km-text-secondary mt-0.5">{p.description}</span>}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {placements.length > 0 && (
                            <p className={field.hint}>{t('showsIn', { places: placements.map((id) => t(`placement.${id}`)).join(', ') })}</p>
                        )}
                    </fieldset>

                    <section className={section}>
                        <h3 className={sectionTitle}>{t('adTitle')}</h3>
                        <div>
                            <span className={field.label}>{t('image')}</span>
                            <label className={cx(
                                'flex items-center gap-3 rounded-xl border border-dashed border-km-border px-4 py-3 text-sm cursor-pointer hover:bg-km-surface',
                                uploading !== null && 'pointer-events-none opacity-70',
                            )}>
                                {uploading !== null
                                    ? <CircleNotchIcon size={20} className="animate-spin text-km-link shrink-0" aria-hidden="true" />
                                    : content.image_url ? <ImageIcon size={20} className="text-km-link shrink-0" aria-hidden="true" /> : <UploadSimpleIcon size={20} className="text-km-text-secondary shrink-0" aria-hidden="true" />}
                                <span className="text-km-text-primary">
                                    {uploading !== null ? t('uploading', { percent: Math.round(uploading * 100) }) : content.image_url ? t('imageChosen') : t('chooseImage')}
                                </span>
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                            </label>
                            <span className={field.hint}>{t('imageHint')}</span>
                        </div>
                        <label className="block">
                            <span className={field.label}>{t('advertiser')}</span>
                            <input value={content.advertiser} onChange={(e) => set('advertiser', e.target.value)} maxLength={80} required className={field.input} />
                        </label>
                        <label className="block">
                            <span className={field.label}>{t('headline')}</span>
                            <input value={content.headline} onChange={(e) => set('headline', e.target.value)} maxLength={80} required className={field.input} />
                        </label>
                        <label className="block">
                            <span className={field.label}>{t('body')} <span className="font-normal text-km-text-secondary">{t('optional')}</span></span>
                            <textarea value={content.body} onChange={(e) => set('body', e.target.value)} maxLength={160} rows={2} className={cx(field.textarea, 'resize-none')} />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className={field.label}>{t('link')}</span>
                                <input type="url" value={content.link_url} onChange={(e) => set('link_url', e.target.value)} maxLength={1000} required className={field.input} />
                            </label>
                            <label className="block">
                                <span className={field.label}>{t('cta')} <span className="font-normal text-km-text-secondary">{t('optional')}</span></span>
                                <input value={content.cta_label} onChange={(e) => set('cta_label', e.target.value)} maxLength={24} placeholder={t('ctaPlaceholder')} className={field.input} />
                            </label>
                        </div>
                    </section>

                    <section className={section}>
                        <h3 className={sectionTitle}>{t('whoTitle')}</h3>
                        {running && <p className={field.hint}>{t('whoFixed')}</p>}
                        <fieldset>
                            <legend className={field.label}>{t('audiences')} <span className="font-normal text-km-text-secondary">{t('audiencesHint')}</span></legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {audiences.map((a) => {
                                    const checked = content.audiences.includes(a);
                                    return (
                                        <label key={a} className={checkRow(checked, running)}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={running}
                                                onChange={() => set('audiences', checked ? content.audiences.filter((x) => x !== a) : [...content.audiences, a])}
                                                className="mt-0.5 accent-km-blue"
                                            />
                                            {t(`audience.${a}`)}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                        <div>
                            <label htmlFor="recruiter-ad-city" className={field.label}>{t('cities')} <span className="font-normal text-km-text-secondary">{t('optional')}</span></label>
                            <div className="flex gap-2">
                                <input
                                    id="recruiter-ad-city"
                                    list="recruiter-ad-city-options"
                                    value={cityDraft}
                                    disabled={running}
                                    onChange={(e) => setCityDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCity(cityDraft); } }}
                                    className={field.input}
                                    placeholder={t('cityPlaceholder')}
                                />
                                <button type="button" onClick={() => addCity(cityDraft)} disabled={running || !cityDraft.trim()} className={btn.secondary}>{t('add')}</button>
                            </div>
                            <datalist id="recruiter-ad-city-options">
                                {cities.map((c) => <option key={c} value={c} />)}
                            </datalist>
                            {content.cities.length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-1.5">
                                    {content.cities.map((c) => (
                                        <li key={c}>
                                            <button
                                                type="button"
                                                disabled={running}
                                                onClick={() => set('cities', content.cities.filter((x) => x !== c))}
                                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-km-surface border border-km-border text-sm text-km-text-primary hover:border-red-300 cursor-pointer disabled:cursor-not-allowed"
                                                aria-label={t('removeCity', { city: c })}
                                            >
                                                {c} <span aria-hidden="true" className="text-km-text-muted">×</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <span className={field.hint}>{t('citiesHint')}</span>
                        </div>
                    </section>

                    {error && (
                        <p role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                            <WarningCircleIcon size={18} className="shrink-0 mt-px" aria-hidden="true" />
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-6">
                        <button type="button" onClick={onClose} disabled={saving} className={btn.secondary}>{t('cancel')}</button>
                        <button type="submit" disabled={saving || uploading !== null || (!paid && packages.length === 0)} className={btn.primary}>
                            {saving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {running ? t('sendForReview') : paid ? t('save') : t('saveAndPay')}
                        </button>
                    </div>
                </div>

                <aside className="lg:sticky lg:top-0 self-start">
                    <p className={field.label}>{t('preview')}</p>
                    {content.image_url
                        ? <AdPreview ad={preview} inline={inlinePreview} />
                        : <div className="flex aspect-[6/5] items-center justify-center rounded-2xl border border-dashed border-km-border text-sm text-km-text-secondary">{t('previewEmpty')}</div>}
                </aside>
            </form>
        </AdminModal>
    );
}
