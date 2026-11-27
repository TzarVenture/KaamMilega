'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowCounterClockwiseIcon, CircleNotchIcon, CursorClickIcon, EyeIcon, MapPinAreaIcon, MegaphoneIcon, PencilSimpleLineIcon, PercentIcon, PlayCircleIcon, PlusIcon, SealCheckIcon, WalletIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr } from '@/lib/money';
import { getCurrentUser } from '@/lib/auth';
import { useCheckout } from '@/lib/razorpay';
import PaymentMethodPicker, { type PaymentMethod } from '@/components/km/PaymentMethodPicker';
import { CashbackNote, CouponField, CouponPrice, useCouponQuote } from '@/components/km/CouponCheckout';
import RecruiterAdFormModal from '@/components/km/RecruiterAdFormModal';
import type { CouponReceipt } from '@/lib/api/coupons';
import { AdminModal, BadgeTone, StatCard, StatusBadge, btn, cx } from '@/components/admin/ui';
import RecruiterBanner, { HeroAccent } from '@/components/km/RecruiterBanner';
import { recruiterAdsApi, type RecruiterAd, type RecruiterAdState, type RecruiterAdsOverview } from '@/lib/api/recruiterAds';

const STATE_TONE: Record<RecruiterAdState, BadgeTone> = {
    unpaid: 'neutral',
    pending: 'amber',
    running: 'green',
    ended: 'neutral',
    rejected: 'red',
    refunded: 'neutral',
};

const DAY = 86_400_000;

/** A recruiter's ads: write one, pay for a package, and see how it's doing */
export default function RecruiterAdsPage() {
    const t = useTranslations('recruiterAds');
    const format = useFormatter();
    const pay = useCheckout();

    const [data, setData] = useState<RecruiterAdsOverview | null>(null);
    const [failed, setFailed] = useState(false);
    const [editing, setEditing] = useState<RecruiterAd | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [paying, setPaying] = useState<RecruiterAd | null>(null);
    const [deleting, setDeleting] = useState<RecruiterAd | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [bonus, setBonus] = useState(0);
    const [method, setMethod] = useState<PaymentMethod>('razorpay');
    const [busy, setBusy] = useState(false);
    const [companyName, setCompanyName] = useState('');

    const payingPackage = data?.packages.find((p) => p.id === paying?.package_id);
    const coupon = useCouponQuote('recruiter_ad', !!paying, paying?.package_id);

    const load = useCallback(async () => {
        try {
            setData(await recruiterAdsApi.overview());
            setFailed(false);
        } catch (err) {
            setFailed(true);
            notify.error(err, t('loadFailed'));
        }
    }, [t]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        api.get<unknown, { company_name?: string; name?: string }>('/user/profile')
            .then((p) => setCompanyName(p?.company_name || ''))
            .catch(() => setCompanyName(''));
    }, []);

    const date = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

    const openPay = (ad: RecruiterAd) => {
        const pkg = data?.packages.find((p) => p.id === ad.package_id);
        if (!pkg) {
            notify.error(t('packageGone'));
            return;
        }
        setPaying(ad);
        setBalance(null);
        setBonus(0);
        api.get<unknown, { main_balance?: number; bonus_balance?: number }>('/wallet/balance')
            .then((w) => {
                const main = w?.main_balance ?? 0;
                const credit = w?.bonus_balance ?? 0;
                setBalance(main);
                setBonus(credit);
                setMethod(main + credit >= pkg.price ? 'wallet' : 'razorpay');
            })
            .catch(() => setMethod('razorpay'));
    };

    const saved = (ad: RecruiterAd) => {
        setFormOpen(false);
        void load();
        if (ad.status === 'unpaid') openPay(ad);
        else notify.success(ad.revision ? t('changeSent') : t('saved'));
    };

    const price = coupon.quote?.price ?? payingPackage?.price ?? 0;
    const free = !!coupon.quote?.free;
    const payWith: PaymentMethod = free ? 'wallet' : method;
    const walletShort = payWith === 'wallet' && !free && (balance ?? 0) + bonus < price;

    const paid = (receipt?: CouponReceipt) => {
        notify.success(t('paid'), receipt && receipt.cashback > 0 ? t('cashbackAdded', { amount: inr(receipt.cashback) }) : undefined);
        setPaying(null);
        void load();
    };

    const buy = async () => {
        if (!paying || !payingPackage) return;
        setBusy(true);
        try {
            if (payWith === 'wallet') {
                const res = await recruiterAdsApi.payWithWallet(paying.id, coupon.code);
                paid(res?.receipt);
                return;
            }
            const user = getCurrentUser();
            const order = await recruiterAdsApi.createOrder(paying.id, coupon.code);
            const outcome = await pay({
                order,
                description: t('payDescription', { name: payingPackage.name }),
                prefill: { name: user?.name || '', contact: user?.mobile || '', email: user?.email || '' },
                verify: (signed) => recruiterAdsApi.verify(signed),
            });
            if (outcome.status === 'paid') paid();
            else if (outcome.status !== 'cancelled') {
                setPaying(null);
                void load();
            }
        } catch (err) {
            notify.error(err, t('payFailed'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!deleting) return;
        setBusy(true);
        try {
            await recruiterAdsApi.remove(deleting.id);
            setDeleting(null);
            void load();
        } catch (err) {
            notify.error(err, t('deleteFailed'));
        } finally {
            setBusy(false);
        }
    };

    const statusLine = (ad: RecruiterAd): string => {
        switch (ad.state) {
            case 'unpaid': return t('stateLine.unpaid');
            case 'pending': return t('stateLine.pending');
            case 'running': {
                const left = Math.max(1, Math.ceil((new Date(ad.ends_at!).getTime() - Date.now()) / DAY));
                return t('stateLine.running', { date: date(ad.ends_at!), days: left });
            }
            case 'ended': return t('stateLine.ended', { date: date(ad.ends_at!) });
            case 'rejected': return t('stateLine.rejected', { reason: ad.reject_reason || '', amount: inr(ad.refunded) });
            default: return t('stateLine.refunded');
        }
    };

    const newAd = () => { setEditing(null); setFormOpen(true); };

    const ads = data?.ads ?? [];
    const running = ads.filter((a) => a.state === 'running').length;
    const views = ads.reduce((n, a) => n + a.impressions, 0);
    const clicks = ads.reduce((n, a) => n + a.clicks, 0);

    return (
        <div className="max-w-5xl mx-auto pb-16">
            <RecruiterBanner
                kicker={{ label: t('title'), Icon: MegaphoneIcon, tone: 'instant' }}
                title={t.rich('heroTitle', { accent: (c) => <HeroAccent>{c}</HeroAccent> })}
                description={t('subtitle')}
                highlights={[
                    { Icon: SealCheckIcon, label: t('proofChecked') },
                    { Icon: MapPinAreaIcon, label: t('proofCities') },
                    { Icon: ArrowCounterClockwiseIcon, label: t('proofRefund') },
                ]}
                art={{ src: '/recruiter-ads-art.svg', alt: t('artAlt') }}
            >
                {data && data.packages.length > 0 && (
                    <button type="button" onClick={newAd} className={btn.accent}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" />{t('newAd')}
                    </button>
                )}
            </RecruiterBanner>
            <div className="h-6" />

            {failed && !data && (
                <div className="bg-km-surface-card border border-km-border rounded-2xl p-6 text-sm text-km-text-secondary">
                    {t('loadFailed')}{' '}
                    <button type="button" onClick={() => void load()} className="font-semibold text-km-link hover:underline">{t('retry')}</button>
                </div>
            )}

            {!data && !failed && (
                <div className="bg-km-surface-card border border-km-border rounded-2xl p-6 animate-pulse space-y-4" aria-busy="true">
                    <div className="h-5 w-40 rounded bg-km-border-subtle" />
                    <div className="h-3 w-full rounded bg-km-border-subtle" />
                    <div className="h-3 w-2/3 rounded bg-km-border-subtle" />
                </div>
            )}

            {data && (
                <>
                    {data.ads.length === 0 ? (
                        <section className="bg-km-surface-card border border-km-border rounded-2xl p-6 sm:p-8" aria-labelledby="ads-empty">
                            <h2 id="ads-empty" className="text-lg font-semibold text-km-heading">{t('emptyTitle')}</h2>
                            <p className="mt-1 text-sm text-km-text-secondary">{data.packages.length > 0 ? t('emptyHint') : t('noPackages')}</p>
                            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
                                {[
                                    { Icon: PencilSimpleLineIcon, title: t('step1Title'), text: t('step1Text') },
                                    { Icon: WalletIcon, title: t('step2Title'), text: t('step2Text') },
                                    { Icon: PlayCircleIcon, title: t('step3Title'), text: t('step3Text') },
                                ].map(({ Icon, title, text }, i) => (
                                    <li key={i} className="relative">
                                        {i < 2 && <span className="hidden sm:block absolute top-[18px] left-12 -right-3 border-t-2 border-dashed border-km-border" aria-hidden="true" />}
                                        <Icon size={36} weight="duotone" className="relative text-[#FF6B00]" aria-hidden="true" />
                                        <p className="mt-3 text-xs font-medium text-km-text-secondary">{t('stepLabel', { n: i + 1 })}</p>
                                        <p className="mt-0.5 font-semibold text-km-heading">{title}</p>
                                        <p className="mt-1 text-sm text-km-text-secondary">{text}</p>
                                    </li>
                                ))}
                            </ol>
                            {data.packages.length > 0 && (
                                <button type="button" onClick={newAd} className={cx(btn.primary, 'mt-7')}>
                                    <PlusIcon size={16} weight="bold" aria-hidden="true" />{t('newAd')}
                                </button>
                            )}
                        </section>
                    ) : (
                        <>
                        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <StatCard label={t('statRunning')} value={format.number(running)} hint={t('statAll', { count: ads.length })} icon={PlayCircleIcon} iconClassName="text-[#16A34A]" />
                            <StatCard label={t('views')} value={format.number(views)} icon={EyeIcon} iconClassName="text-km-link" />
                            <StatCard label={t('clicks')} value={format.number(clicks)} icon={CursorClickIcon} iconClassName="text-[#FF6B00]" />
                            <StatCard label={t('statRate')} value={views > 0 ? format.number(clicks / views, { style: 'percent', maximumFractionDigits: 1 }) : '–'} hint={t('statRateHint')} icon={PercentIcon} iconClassName="text-[#0F9D8A]" />
                        </div>
                        <ul className="space-y-3">
                            {data.ads.map((ad) => (
                                <li key={ad.id} className="bg-km-surface-card border border-km-border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:flex-row">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={ad.image_url} alt="" className="w-full sm:w-40 aspect-[1.91/1] sm:aspect-[6/5] rounded-xl object-cover bg-km-surface shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge tone={STATE_TONE[ad.state]}>{t(`state.${ad.state}`)}</StatusBadge>
                                            <span className="text-xs text-km-text-secondary">{t('packageLine', { price: inr(ad.status === 'unpaid' ? (data.packages.find((p) => p.id === ad.package_id)?.price ?? 0) : ad.price), days: ad.days })} · {ad.package_name}</span>
                                        </div>
                                        <p className="mt-2 font-semibold text-km-heading break-words">{ad.headline}</p>
                                        <p className="mt-0.5 text-sm text-km-text-secondary">{statusLine(ad)}</p>
                                        {ad.revision && <p className="mt-1 text-sm text-km-text-primary">{t('changeWaiting')}</p>}
                                        {!ad.revision && ad.revision_note && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t('changeRefused', { reason: ad.revision_note })}</p>}
                                        {(ad.state === 'running' || ad.state === 'ended') && (
                                            <dl className="mt-3 flex gap-6 text-sm">
                                                <div><dt className="flex items-center gap-1 text-km-text-secondary"><EyeIcon size={14} aria-hidden="true" />{t('views')}</dt><dd className="font-semibold text-km-heading font-inter tabular-nums">{format.number(ad.impressions)}</dd></div>
                                                <div><dt className="flex items-center gap-1 text-km-text-secondary"><CursorClickIcon size={14} aria-hidden="true" />{t('clicks')}</dt><dd className="font-semibold text-km-heading font-inter tabular-nums">{format.number(ad.clicks)}</dd></div>
                                            </dl>
                                        )}
                                    </div>
                                    <div className="flex sm:flex-col gap-2 sm:items-end shrink-0">
                                        {ad.state === 'unpaid' && (
                                            <>
                                                <button type="button" onClick={() => openPay(ad)} className={cx(btn.primary, 'h-9 px-3')}>{t('payNow')}</button>
                                                <button type="button" onClick={() => { setEditing(ad); setFormOpen(true); }} className={cx(btn.secondary, 'h-9 px-3')}>{t('edit')}</button>
                                                <button type="button" onClick={() => setDeleting(ad)} className={cx(btn.secondary, 'h-9 px-3')}>{t('delete')}</button>
                                            </>
                                        )}
                                        {(ad.state === 'pending' || ad.state === 'running') && (
                                            <button type="button" onClick={() => { setEditing(ad); setFormOpen(true); }} className={cx(btn.secondary, 'h-9 px-3')}>{t('edit')}</button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        </>
                    )}
                    <p className="mt-6 text-xs text-km-text-secondary">{t('rules')}</p>
                </>
            )}

            {data && (
                <RecruiterAdFormModal
                    isOpen={formOpen}
                    onClose={() => setFormOpen(false)}
                    onSaved={saved}
                    ad={editing}
                    packages={data.packages}
                    audiences={data.audiences}
                    companyName={companyName}
                />
            )}

            <AdminModal isOpen={!!paying} onClose={() => !busy && setPaying(null)} title={payingPackage ? t('payTitle', { name: payingPackage.name }) : ''}>
                {paying && payingPackage && (
                    <div className="space-y-5">
                        <div>
                            <CouponPrice quote={coupon.quote} fallback={payingPackage.price} />
                            <p className="mt-1 text-sm text-km-text-secondary">{t('payNote', { days: payingPackage.days })}</p>
                        </div>
                        <CouponField state={coupon} disabled={busy} />
                        {free ? (
                            <p className="text-sm font-medium text-km-text-primary">{t('freeWithCode')}</p>
                        ) : (
                            <PaymentMethodPicker value={method} onChange={setMethod} balance={balance} bonus={bonus} price={price} disabled={busy} />
                        )}
                        <CashbackNote quote={coupon.quote} method={payWith} />
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setPaying(null)} disabled={busy} className={btn.secondary}>{t('later')}</button>
                            <button type="button" onClick={buy} disabled={busy || walletShort || coupon.applying || (payWith === 'wallet' && balance === null)} className={btn.primary}>
                                {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                {free ? t('getFree') : t('pay', { amount: inr(price) })}
                            </button>
                        </div>
                    </div>
                )}
            </AdminModal>

            <AdminModal isOpen={!!deleting} onClose={() => !busy && setDeleting(null)} title={t('deleteTitle')}>
                <p className="text-sm text-km-text-primary">{t('deleteBody')}</p>
                <div className="flex justify-end gap-2 pt-5">
                    <button type="button" onClick={() => setDeleting(null)} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                    <button type="button" onClick={remove} disabled={busy} className={btn.danger}>{t('delete')}</button>
                </div>
            </AdminModal>
        </div>
    );
}
