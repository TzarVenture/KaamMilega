'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CheckIcon, CircleNotchIcon, ClockIcon, TagIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr } from '@/lib/money';
import { getCurrentUser } from '@/lib/auth';
import { useCheckout } from '@/lib/razorpay';
import PaymentMethodPicker, { type PaymentMethod } from '@/components/km/PaymentMethodPicker';
import { CashbackNote, CouponField, CouponPrice, useCouponQuote } from '@/components/km/CouponCheckout';
import type { CouponReceipt } from '@/lib/api/coupons';
import { AdminModal, btn, cx } from '@/components/admin/ui';
import { recruiterPlansApi, type Allowance, type Limit, type PlanOverview, type RecruiterPlan } from '@/lib/api/recruiterPlans';

/** One limited thing: what's used against the period's limit */
function Meter({ label, allowance, text }: { label: string; allowance: Allowance; text: string }) {
    const { used, limit } = allowance;
    const share = limit === null || limit === 0 ? (limit === 0 ? 1 : 0) : Math.min(1, used / limit);
    const full = limit !== null && used >= limit;
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-km-text-primary">{label}</span>
                <span className={cx('font-inter tabular-nums', full ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-km-text-secondary')}>
                    {text}
                </span>
            </div>
            {limit !== null && (
                <div className="mt-1.5 h-1.5 rounded-full bg-km-border-subtle overflow-hidden" aria-hidden="true">
                    <div
                        className={cx('h-full rounded-full', full ? 'bg-red-600' : share >= 0.8 ? 'bg-amber-500' : 'bg-km-link')}
                        style={{ width: `${Math.max(share * 100, used > 0 ? 4 : 0)}%` }}
                    />
                </div>
            )}
        </div>
    );
}

/** A recruiter's hiring plan: what's left this period, and plans to buy */
export default function RecruiterPlanPage() {
    const t = useTranslations('recruiterPlan');
    const format = useFormatter();
    const pay = useCheckout();

    const [data, setData] = useState<PlanOverview | null>(null);
    const [failed, setFailed] = useState(false);
    const [buying, setBuying] = useState<RecruiterPlan | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [bonus, setBonus] = useState(0);
    const [method, setMethod] = useState<PaymentMethod>('razorpay');
    const coupon = useCouponQuote('recruiter_plan', !!buying, buying?.id);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await recruiterPlansApi.overview());
            setFailed(false);
        } catch (err) {
            setFailed(true);
            notify.error(err, t('loadFailed'));
        }
    }, [t]);

    useEffect(() => {
        void load();
    }, [load]);

    const date = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const meterText = (a: Allowance) => (a.limit === null ? t('usedNoLimit', { used: a.used }) : t('usedOf', { used: a.used, limit: a.limit }));
    const jobsText = (n: Limit) => (n === null ? t('featureJobsUnlimited') : t('featureJobs', { count: n }));
    const chatsText = (n: Limit) => (n === null ? t('featureChatsUnlimited') : t('featureChats', { count: n }));
    const resumesText = (n: Limit) => (n === null ? t('featureResumesUnlimited') : t('featureResumes', { count: n }));

    const openBuy = (plan: RecruiterPlan) => {
        setBuying(plan);
        setBalance(null);
        setBonus(0);
        api.get<unknown, { main_balance?: number; bonus_balance?: number }>('/wallet/balance')
            .then((w) => {
                const main = w?.main_balance ?? 0;
                const credit = w?.bonus_balance ?? 0;
                setBalance(main);
                setBonus(credit);
                setMethod(main + credit >= plan.price ? 'wallet' : 'razorpay');
            })
            .catch(() => setMethod('razorpay'));
    };

    const price = coupon.quote?.price ?? buying?.price ?? 0;
    const free = !!coupon.quote?.free;
    // A free plan (a 100% coupon) goes through the wallet with nothing charged
    const payWith: PaymentMethod = free ? 'wallet' : method;

    const bought = (receipt?: CouponReceipt) => {
        notify.success(t('bought'), receipt && receipt.cashback > 0 ? t('cashbackAdded', { amount: inr(receipt.cashback) }) : undefined);
        setBuying(null);
        void load();
    };

    const buy = async () => {
        if (!buying) return;
        setBusy(true);
        try {
            if (payWith === 'wallet') {
                const res = await recruiterPlansApi.buyWithWallet(buying.id, coupon.code);
                bought(res?.receipt);
                return;
            }
            const user = getCurrentUser();
            const order = await recruiterPlansApi.createOrder(buying.id, coupon.code);
            const outcome = await pay({
                order,
                description: buying.name,
                prefill: { name: user?.name || '', contact: user?.mobile || '', email: user?.email || '' },
                verify: (signed) => recruiterPlansApi.verify(signed),
            });
            if (outcome.status === 'paid') bought();
            else if (outcome.status !== 'cancelled') {
                setBuying(null);
                void load();
            }
        } catch (err) {
            notify.error(err, t('buyFailed'));
        } finally {
            setBusy(false);
        }
    };

    const current = data?.current ?? null;
    const queueFull = (data?.queued.length ?? 0) > 0;
    // A plan bought now starts when the last bought one ends
    const startsAt = data ? [current, ...data.queued].reduce<string | null>((end, s) => (s && (!end || s.expires_at > end) ? s.expires_at : end), null) : null;
    const walletShort = payWith === 'wallet' && buying !== null && !free && (balance ?? 0) + bonus < price;

    return (
        <div className="max-w-5xl mx-auto pb-16">
            <div className="pb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-km-heading">{t('title')}</h1>
                <p className="mt-1 text-sm text-km-text-secondary">{t('subtitle')}</p>
            </div>

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
                    <section className="bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6" aria-labelledby="current-plan">
                        <div className="grid gap-6 md:grid-cols-[1fr_1.3fr] md:items-start">
                            <div>
                                <h2 id="current-plan" className="text-lg font-semibold text-km-heading">{current ? current.plan_name : t('free')}</h2>
                                <p className="mt-1 text-sm text-km-text-secondary">
                                    {current ? t('runsUntil', { date: date(current.expires_at) }) : t('freeResets', { date: date(data.period_ends_at) })}
                                </p>
                                {data.queued.map((q) => (
                                    <p key={q.id} className="mt-3 inline-flex items-center gap-1.5 text-sm text-km-text-primary">
                                        <ClockIcon size={16} className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                        {t('next', { plan: q.plan_name, date: date(q.starts_at) })}
                                    </p>
                                ))}
                            </div>
                            <div className="space-y-4">
                                <Meter label={t('jobPosts')} allowance={data.usage.job_posts} text={meterText(data.usage.job_posts)} />
                                <Meter label={t('newChats')} allowance={data.usage.new_chats} text={meterText(data.usage.new_chats)} />
                                {!data.enforced && <p className="text-xs text-km-text-secondary">{t('notEnforced')}</p>}
                            </div>
                        </div>
                    </section>

                    <h2 className="mt-8 mb-3 text-base font-semibold text-km-heading">{t('plansTitle')}</h2>
                    {data.plans.length === 0 ? (
                        <div className="bg-km-surface-card border border-km-border rounded-2xl p-8 text-center">
                            <TagIcon size={28} className="mx-auto text-km-text-muted" aria-hidden="true" />
                            <p className="mt-2 text-sm text-km-text-secondary">{t('noPlans')}</p>
                        </div>
                    ) : (
                        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {data.plans.map((plan) => {
                                const features = [
                                    { text: jobsText(plan.job_posts), soon: false },
                                    { text: chatsText(plan.new_chats), soon: false },
                                    ...(plan.resume_downloads !== 0 ? [{ text: resumesText(plan.resume_downloads), soon: true }] : []),
                                    ...(plan.ai_job_writer ? [{ text: t('featureAi'), soon: true }] : []),
                                ];
                                return (
                                    <li key={plan.id} className="flex flex-col bg-km-surface-card border border-km-border rounded-2xl p-5">
                                        <h3 className="text-base font-semibold text-km-heading">{plan.name}</h3>
                                        {plan.description && <p className="mt-1 text-sm text-km-text-secondary">{plan.description}</p>}
                                        <p className="mt-4">
                                            <span className="text-3xl font-bold text-km-heading font-inter tabular-nums">{inr(plan.price)}</span>
                                            <span className="ml-1.5 text-sm text-km-text-secondary">{t('forDays', { days: plan.period_days })}</span>
                                        </p>
                                        <ul className="mt-4 space-y-2 flex-1">
                                            {features.map((f) => (
                                                <li key={f.text} className="flex items-start gap-2 text-sm text-km-text-primary">
                                                    <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-km-link" aria-hidden="true" />
                                                    <span>
                                                        {f.text}
                                                        {f.soon && <span className="ml-1.5 text-xs text-km-text-secondary">{t('soon')}</span>}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <button type="button" onClick={() => openBuy(plan)} disabled={queueFull} className={cx(current ? btn.secondary : btn.primary, 'mt-5 w-full')}>
                                            {current ? t('buyNext') : t('buy')}
                                        </button>
                                        {queueFull && <p className="mt-2 text-xs text-km-text-secondary">{t('queueFull')}</p>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}

            <AdminModal isOpen={!!buying} onClose={() => !busy && setBuying(null)} title={buying ? t('buyTitle', { plan: buying.name }) : ''}>
                {buying && (
                    <div className="space-y-5">
                        <div>
                            <CouponPrice quote={coupon.quote} fallback={buying.price} />
                            <p className="mt-1 text-sm text-km-text-secondary">
                                {startsAt ? t('startsOn', { date: date(startsAt), days: buying.period_days }) : t('startsNow', { days: buying.period_days })}
                            </p>
                        </div>
                        <CouponField state={coupon} disabled={busy} />
                        {free ? (
                            <p className="text-sm font-medium text-km-text-primary">{t('freeWithCode')}</p>
                        ) : (
                            <PaymentMethodPicker value={method} onChange={setMethod} balance={balance} bonus={bonus} price={price} disabled={busy} />
                        )}
                        <CashbackNote quote={coupon.quote} method={payWith} />
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setBuying(null)} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                            <button type="button" onClick={buy} disabled={busy || walletShort || coupon.applying || (payWith === 'wallet' && balance === null)} className={btn.primary}>
                                {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                {free ? t('getFree') : t('pay', { amount: inr(price) })}
                            </button>
                        </div>
                    </div>
                )}
            </AdminModal>
        </div>
    );
}
