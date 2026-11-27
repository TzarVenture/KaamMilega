'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CopyIcon, UsersThreeIcon, WhatsappLogoIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState, StatCard, StatusBadge, btn, cx, type BadgeTone } from '@/components/admin/ui';
import { inr } from '@/lib/money';
import { notify } from '@/lib/notify';
import { inviteLink, referralsApi, type InvitedPerson, type ReferralOverview } from '@/lib/api/referrals';

const TONE: Record<InvitedPerson['status'], BadgeTone> = {
    pending: 'neutral',
    paid: 'amber',
    released: 'green',
    cancelled: 'red',
};

export default function ReferralsPage() {
    const t = useTranslations('referralsPage');
    const locale = useLocale();
    const [data, setData] = useState<ReferralOverview | null>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(() => {
        referralsApi.overview()
            .then((o) => { setData(o); setFailed(false); })
            .catch(() => setFailed(true));
    }, []);

    useEffect(() => { load(); }, [load]);

    const day = (iso?: string) =>
        iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-IN' : `${locale}-IN`, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';

    const link = data ? inviteLink(data.code) : '';

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            notify.success(t('copied'));
        } catch {
            notify.error(null, t('copyFailed'));
        }
    };

    const whatsapp = `https://wa.me/?text=${encodeURIComponent(t('shareText', { link }))}`;
    const agg = data?.aggregator;

    return (
        <main className="min-h-screen bg-km-surface px-4 py-6 sm:px-6 lg:py-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-km-heading tracking-tight">{t('title')}</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">{t('intro')}</p>
                </div>

                {failed ? (
                    <div className="bg-km-surface-card border border-km-border rounded-2xl">
                        <EmptyState icon={UsersThreeIcon} title={t('loadFailed')}
                            action={<button type="button" onClick={load} className={btn.secondary}>{t('retry')}</button>} />
                    </div>
                ) : !data ? (
                    <div className="h-40 rounded-2xl bg-km-surface-card border border-km-border animate-pulse" />
                ) : (
                    <>
                        <section className="rounded-2xl border border-km-border bg-km-surface-card p-5 space-y-4">
                            {!data.enabled && <p className="text-sm text-amber-700 dark:text-amber-400">{t('paused')}</p>}
                            <div>
                                <p className="text-xs font-semibold text-km-text-secondary">{t('yourCode')}</p>
                                <p className="mt-1 text-2xl font-bold font-inter tracking-widest text-km-heading">{data.code}</p>
                                <p className="mt-1 text-sm text-km-text-secondary break-all font-inter">{link}</p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button type="button" onClick={copy} className={cx(btn.secondary, 'sm:flex-none')}>
                                    <CopyIcon size={16} aria-hidden="true" /> {t('copyLink')}
                                </button>
                                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cx(btn.accent, 'sm:flex-none')}>
                                    <WhatsappLogoIcon size={16} aria-hidden="true" /> {t('shareWhatsApp')}
                                </a>
                            </div>
                            <p className="text-sm text-km-text-primary">
                                {agg
                                    ? t('aggregatorRule', { size: agg.group_size, credit: inr(agg.credit), cash: inr(agg.cash), days: data.wait_days })
                                    : data.member_reward > 0
                                        ? t('memberRule', { amount: inr(data.member_reward), days: data.wait_days })
                                        : t('noReward')}
                            </p>
                        </section>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard label={t('joined')} value={data.counts.joined + data.counts.waiting + data.counts.released} />
                            <StatCard label={t('waiting')} value={data.counts.waiting} />
                            <StatCard label={t('counted')} value={data.counts.released} />
                            <StatCard label={t('earned')} value={inr(data.earned)} />
                        </div>

                        {agg && (
                            <section className="rounded-2xl border border-km-border bg-km-surface-card p-5 space-y-3">
                                <h2 className="text-base font-semibold text-km-heading">{t('groupTitle')}</h2>
                                <div>
                                    <div className="flex justify-between text-sm text-km-text-primary">
                                        <span>{t('towardsNext', { n: agg.towards_next, size: agg.group_size })}</span>
                                        <span className="font-inter tabular-nums">{t('groupsDone', { n: agg.groups })}</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-km-surface overflow-hidden" role="progressbar"
                                        aria-valuemin={0} aria-valuemax={agg.group_size} aria-valuenow={agg.towards_next}>
                                        <div className="h-full bg-km-accent" style={{ width: `${Math.min(100, (agg.towards_next / Math.max(1, agg.group_size)) * 100)}%` }} />
                                    </div>
                                </div>
                                <dl className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <dt className="text-km-text-secondary">{t('cashOwed')}</dt>
                                        <dd className="font-semibold font-inter text-km-heading">{inr(agg.cash_owed)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-km-text-secondary">{t('cashReceived')}</dt>
                                        <dd className="font-semibold font-inter text-km-heading">{inr(agg.cash_received)}</dd>
                                    </div>
                                </dl>
                            </section>
                        )}

                        <section className="rounded-2xl border border-km-border bg-km-surface-card">
                            <h2 className="px-5 pt-5 text-base font-semibold text-km-heading">{t('peopleTitle')}</h2>
                            {data.people.length === 0 ? (
                                <EmptyState icon={UsersThreeIcon} title={t('peopleEmpty')} />
                            ) : (
                                <ul className="divide-y divide-km-border mt-3">
                                    {data.people.map((p, i) => (
                                        <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                                            <div className="min-w-0">
                                                <p className="font-medium text-km-heading truncate">{p.first_name || t('someone')}</p>
                                                <p className="text-xs text-km-text-secondary">{t('joinedOn', { date: day(p.joined_at) })}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <StatusBadge tone={TONE[p.status]}>
                                                    {p.status === 'paid' ? t('status.paid', { date: day(p.release_at) }) : t(`status.${p.status}`)}
                                                </StatusBadge>
                                                {p.reward > 0 && <p className="mt-1 text-xs font-inter text-km-text-secondary">+{inr(p.reward)}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
