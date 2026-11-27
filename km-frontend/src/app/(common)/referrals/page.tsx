'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    CheckCircleIcon, CheckIcon, ClockCountdownIcon, CopyIcon, HandCoinsIcon, ShareNetworkIcon,
    UserPlusIcon, UsersThreeIcon, WalletIcon, WhatsappLogoIcon,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import PageHero, { HeroAccent } from '@/components/km/PageHero';
import { EmptyState, StatCard, StatusBadge, btn, cx, type BadgeTone } from '@/components/admin/ui';
import { inr } from '@/lib/money';
import { notify } from '@/lib/notify';
import { inviteLink, referralsApi, type InvitedPerson, type ReferralOverview } from '@/lib/api/referrals';

/** Rupees without the .00 on whole amounts (₹2,500, ₹49.50) */
const rs = (n: number) => (Number.isInteger(n) ? inr(n).replace(/\.00$/, '') : inr(n));

const TONE: Record<InvitedPerson['status'], BadgeTone> = {
    pending: 'neutral',
    paid: 'amber',
    released: 'green',
    cancelled: 'red',
};

/** Avatar tiles for people without a photo: one of the service colours, picked from the name */
const AVATAR = ['bg-[#0B5ED7]', 'bg-[#FF6B00]', 'bg-[#16A34A]', 'bg-[#7C3AED]', 'bg-[#0F9D8A]', 'bg-[#F59E0B]'];
function avatarColour(name: string) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR[h % AVATAR.length];
}

/** Ring showing how many paid invites count towards the next group reward */
function ProgressRing({ value, max, label }: { value: number; max: number; label: string }) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const done = Math.min(1, value / Math.max(1, max));
    return (
        <div className="relative w-36 h-36 shrink-0" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-km-surface" />
                <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-km-accent"
                    strokeDasharray={c} strokeDashoffset={c * (1 - done)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-inter tabular-nums text-km-heading">{value}</span>
                <span className="text-xs text-km-text-secondary">{label}</span>
            </div>
        </div>
    );
}

/** Joined → paid → counted, for one invited person */
function Timeline({ status, labels }: { status: InvitedPerson['status']; labels: [string, string, string] }) {
    const reached = status === 'released' ? 3 : status === 'paid' ? 2 : 1;
    return (
        <ol className="flex items-center" aria-label={labels.slice(0, reached).join(', ')}>
            {labels.map((label, i) => {
                const on = i < reached;
                return (
                    <li key={label} className="flex items-center">
                        {i > 0 && <span className={cx('w-6 sm:w-10 h-0.5', on ? 'bg-[#16A34A]' : 'bg-km-border')} aria-hidden="true" />}
                        <span className="flex flex-col items-center gap-1">
                            <span className={cx('w-3 h-3 rounded-full border-2', on ? 'bg-[#16A34A] border-[#16A34A]' : 'bg-km-surface-card border-km-border')} />
                            <span className={cx('text-[11px] leading-none', on ? 'text-km-heading font-medium' : 'text-km-text-secondary')}>{label}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export default function ReferralsPage() {
    const t = useTranslations('referralsPage');
    const locale = useLocale();
    const [data, setData] = useState<ReferralOverview | null>(null);
    const [failed, setFailed] = useState(false);
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<number | undefined>(undefined);

    const load = useCallback(() => {
        referralsApi.overview()
            .then((o) => { setData(o); setFailed(false); })
            .catch(() => setFailed(true));
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

    const day = (iso?: string) =>
        iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-IN' : `${locale}-IN`, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';

    const link = data ? inviteLink(data.code) : '';
    const agg = data?.aggregator;
    const days = data?.wait_days ?? 30;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
        } catch {
            notify.error(null, t('copyFailed'));
        }
    };

    const whatsapp = `https://wa.me/?text=${encodeURIComponent(t('shareText', { link }))}`;
    const accent = (chunks: React.ReactNode) => <HeroAccent>{chunks}</HeroAccent>;

    const title = agg
        ? t.rich('heroTitleGroup', { accent, total: rs(agg.credit + agg.cash), size: agg.group_size })
        : data && data.member_reward > 0
            ? t.rich('heroTitleReward', { accent, amount: rs(data.member_reward) })
            : t.rich('heroTitle', { accent });

    const rewardStep = agg
        ? t('step3Group', { credit: rs(agg.credit), cash: rs(agg.cash), size: agg.group_size })
        : data && data.member_reward > 0
            ? t('step3Reward', { amount: rs(data.member_reward), days })
            : t('step3None');

    const steps = [
        { Icon: ShareNetworkIcon, title: t('step1Title'), text: t('step1Text') },
        { Icon: UserPlusIcon, title: t('step2Title'), text: t('step2Text') },
        { Icon: HandCoinsIcon, title: t('step3Title'), text: rewardStep },
    ];

    const timeline: [string, string, string] = [t('tlJoined'), t('tlPaid'), t('tlCounted')];

    return (
        <main className="min-h-screen bg-km-surface pb-16">
            <PageHero
                overlap
                width="max-w-5xl"
                kicker={{ label: t('title'), Icon: UsersThreeIcon, tone: 'p2p' }}
                title={title}
                description={t('heroText')}
                highlights={[
                    { Icon: WhatsappLogoIcon, label: t('proofShare') },
                    { Icon: ClockCountdownIcon, label: t('proofWait', { days }) },
                    { Icon: CheckCircleIcon, label: t('proofTrack') },
                ]}
                art={{ src: '/referrals-hero-art.svg', alt: t('artAlt') }}
            />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 lg:-mt-10 relative z-20 space-y-6">
                {failed ? (
                    <div className="bg-km-surface-card border border-km-border rounded-2xl shadow-sm">
                        <EmptyState icon={UsersThreeIcon} title={t('loadFailed')}
                            action={<button type="button" onClick={load} className={btn.secondary}>{t('retry')}</button>} />
                    </div>
                ) : !data ? (
                    <div className="h-36 rounded-2xl bg-km-surface-card border border-km-border shadow-sm animate-shimmer" />
                ) : (
                    <>
                        {/* Invite card: the code as a ticket, then the share actions */}
                        <section className="bg-km-surface-card border border-km-border rounded-2xl shadow-sm p-4 sm:p-6">
                            {!data.enabled && <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">{t('paused')}</p>}
                            <div className="flex flex-col gap-5 md:flex-row md:items-center">
                                <div className="relative flex-1 min-w-0 rounded-xl border-2 border-dashed border-km-blue bg-km-surface px-5 py-4">
                                    {/* Ticket notches */}
                                    <span className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-km-surface-card border-2 border-dashed border-km-blue [clip-path:inset(0_0_0_50%)]" aria-hidden="true" />
                                    <span className="absolute -right-[11px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-km-surface-card border-2 border-dashed border-km-blue [clip-path:inset(0_50%_0_0)]" aria-hidden="true" />
                                    <p className="text-xs font-semibold text-km-text-secondary">{t('yourCode')}</p>
                                    <p className="mt-1 text-2xl sm:text-3xl font-bold font-inter tracking-[0.2em] text-km-heading">{data.code}</p>
                                    <p className="mt-1 text-xs sm:text-sm text-km-text-secondary truncate font-inter">{link}</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 md:flex md:flex-col md:w-52">
                                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={btn.accent}>
                                        <WhatsappLogoIcon size={18} weight="bold" aria-hidden="true" /> {t('shareWhatsApp')}
                                    </a>
                                    <button type="button" onClick={copy} className={btn.secondary} aria-live="polite">
                                        {copied
                                            ? <><CheckIcon size={18} weight="bold" className="text-[#16A34A]" aria-hidden="true" /> {t('copied')}</>
                                            : <><CopyIcon size={18} aria-hidden="true" /> {t('copyLink')}</>}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* How it works */}
                        <section className="bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6">
                            <h2 className="text-lg font-semibold text-km-heading">{t('howTitle')}</h2>
                            <ol className="mt-5 grid gap-6 sm:grid-cols-3 sm:gap-4">
                                {steps.map(({ Icon, title: stepTitle, text }, i) => (
                                    <li key={i} className="relative flex gap-4 sm:flex-col sm:gap-3">
                                        {/* Dashed link to the next step */}
                                        {i < steps.length - 1 && (
                                            <span className="hidden sm:block absolute top-[18px] left-[52px] right-0 border-t-2 border-dashed border-km-border" aria-hidden="true" />
                                        )}
                                        <span className="relative flex items-center gap-2 shrink-0 bg-km-surface-card pr-2 self-start">
                                            <Icon size={36} weight="duotone" className="text-[#0F9D8A]" aria-hidden="true" />
                                        </span>
                                        <div>
                                            <p className="text-xs font-semibold text-km-text-secondary">{t('stepLabel', { n: i + 1 })}</p>
                                            <p className="mt-0.5 font-semibold text-km-heading">{stepTitle}</p>
                                            <p className="mt-1 text-sm text-km-text-secondary">{text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <StatCard label={t('joined')} value={data.counts.joined + data.counts.waiting + data.counts.released}
                                icon={UsersThreeIcon} iconClassName="text-km-blue" />
                            <StatCard label={t('waiting')} value={data.counts.waiting} icon={ClockCountdownIcon} iconClassName="text-amber-600" />
                            <StatCard label={t('counted')} value={data.counts.released} icon={CheckCircleIcon} iconClassName="text-[#16A34A]" />
                            <StatCard label={t('earned')} value={rs(data.earned)} icon={WalletIcon} iconClassName="text-km-accent" />
                        </div>

                        {agg && (
                            <section className="bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6">
                                <h2 className="text-lg font-semibold text-km-heading">{t('groupTitle')}</h2>
                                <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                                    <ProgressRing value={agg.towards_next} max={agg.group_size} label={t('ofSize', { size: agg.group_size })} />
                                    <div className="flex-1 w-full space-y-4">
                                        <p className="text-sm text-km-text-primary">
                                            {t('towardsNextLeft', { left: Math.max(0, agg.group_size - agg.towards_next), credit: rs(agg.credit), cash: rs(agg.cash) })}
                                        </p>
                                        <dl className="grid grid-cols-3 gap-3 border-t border-km-border pt-4 text-sm">
                                            <div>
                                                <dt className="text-km-text-secondary">{t('rewardsEarned')}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold font-inter tabular-nums text-km-heading">{agg.groups}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-km-text-secondary">{t('cashOwed')}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold font-inter tabular-nums text-km-heading">{rs(agg.cash_owed)}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-km-text-secondary">{t('cashReceived')}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold font-inter tabular-nums text-km-heading">{rs(agg.cash_received)}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="bg-km-surface-card border border-km-border rounded-2xl">
                            <h2 className="px-5 sm:px-6 pt-5 text-lg font-semibold text-km-heading">{t('peopleTitle')}</h2>
                            {data.people.length === 0 ? (
                                <EmptyState icon={UsersThreeIcon} title={t('peopleEmpty')} description={t('peopleEmptyHint')}
                                    action={<a href={whatsapp} target="_blank" rel="noopener noreferrer" className={btn.accent}>
                                        <WhatsappLogoIcon size={18} weight="bold" aria-hidden="true" /> {t('shareWhatsApp')}
                                    </a>} />
                            ) : (
                                <ul className="divide-y divide-km-border mt-3">
                                    {data.people.map((p, i) => {
                                        const name = p.first_name || t('someone');
                                        return (
                                            <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 sm:px-6 py-4">
                                                <span className={cx('w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0', avatarColour(name))} aria-hidden="true">
                                                    {name.charAt(0).toUpperCase()}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-km-heading truncate">{name}</p>
                                                    <p className="text-xs text-km-text-secondary">
                                                        {p.status === 'paid' ? t('status.paid', { date: day(p.release_at) }) : t('joinedOn', { date: day(p.joined_at) })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                                    {p.status === 'cancelled'
                                                        ? <StatusBadge tone={TONE.cancelled}>{t('status.cancelled')}</StatusBadge>
                                                        : <Timeline status={p.status} labels={timeline} />}
                                                    {p.reward > 0 && <span className="text-sm font-semibold font-inter text-[#16A34A]">+{rs(p.reward)}</span>}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        <p className="text-xs text-km-text-secondary px-1">
                            {agg
                                ? t('aggregatorRule', { size: agg.group_size, credit: rs(agg.credit), cash: rs(agg.cash), days })
                                : data.member_reward > 0
                                    ? t('memberRule', { amount: rs(data.member_reward), days })
                                    : t('noReward')}
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
