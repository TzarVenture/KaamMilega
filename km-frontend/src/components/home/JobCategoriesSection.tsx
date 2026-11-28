'use client';

import React, { useState } from 'react';
import Link from 'next/link';
// import Image from 'next/image'; // trade photos replaced by drawn graphics (TradeArt)
import {
    ArrowRightIcon, BriefcaseIcon, BroomIcon, CalculatorIcon, ChalkboardTeacherIcon, ChartLineUpIcon, CodeIcon,
    FirstAidKitIcon, ForkKnifeIcon, GearIcon, HeadsetIcon, LightningIcon, MegaphoneIcon, MopedIcon, PaintRollerIcon,
    ShieldCheckIcon, SnowflakeIcon, SteeringWheelIcon, StorefrontIcon, UsersThreeIcon, WarehouseIcon, WrenchIcon,
    type Icon,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { FEATURES } from '@/config/features';
import { useJobCounts, useOpeningsLabel } from '@/lib/jobCounts';
import SectionHeader from './SectionHeader';

type Tab = 'jobs' | 'gigs';
type Tone = 'blue' | 'navy' | 'violet' | 'green' | 'teal' | 'orange' | 'amber' | 'red' | 'pink' | 'slate';

// Solid colours per tone: tile and icon for job categories, card gradient for trades
const TONE: Record<Tone, { tile: string; icon: string; from: string; to: string }> = {
    blue: { tile: 'bg-[#E8F0FE] dark:bg-[#14357F]', icon: 'text-[#0B5ED7] dark:text-[#93C5FD]', from: '#0B5ED7', to: '#073B8C' },
    navy: { tile: 'bg-[#E6EAF5] dark:bg-[#1E2A4D]', icon: 'text-[#071A4D] dark:text-[#C7D2FE]', from: '#1E3A8A', to: '#071A4D' },
    violet: { tile: 'bg-[#F1EBFE] dark:bg-[#24164A]', icon: 'text-[#7C3AED] dark:text-[#C4B5FD]', from: '#7C3AED', to: '#4C1D95' },
    green: { tile: 'bg-[#E7F7EE] dark:bg-[#0B2E22]', icon: 'text-[#16A34A] dark:text-emerald-300', from: '#16A34A', to: '#14532D' },
    teal: { tile: 'bg-[#E3F6F5] dark:bg-[#0B2E2E]', icon: 'text-[#0F9488] dark:text-teal-300', from: '#0D9488', to: '#134E4A' },
    orange: { tile: 'bg-[#FFF1E6] dark:bg-[#3A1F0B]', icon: 'text-[#FF6B00] dark:text-[#FDBA74]', from: '#FF6B00', to: '#9A3412' },
    amber: { tile: 'bg-[#FEF6E0] dark:bg-[#3A2A0B]', icon: 'text-[#B45309] dark:text-amber-300', from: '#D97706', to: '#78350F' },
    red: { tile: 'bg-[#FDECEC] dark:bg-[#3B1414]', icon: 'text-[#DC2626] dark:text-red-300', from: '#DC2626', to: '#7F1D1D' },
    pink: { tile: 'bg-[#FDECF4] dark:bg-[#3B1428]', icon: 'text-[#DB2777] dark:text-pink-300', from: '#DB2777', to: '#831843' },
    slate: { tile: 'bg-[#EEF1F5] dark:bg-slate-800', icon: 'text-[#475569] dark:text-slate-300', from: '#475569', to: '#1E293B' },
};

// Office and skilled job categories. `q` is the jobs search, and counts use the same term so the
// number matches what the visitor sees after clicking.
const JOB_CATEGORIES: { key: string; q: string; icon: Icon; tone: Tone }[] = [
    { key: 'sales', q: 'sales', icon: ChartLineUpIcon, tone: 'blue' },
    { key: 'support', q: 'customer', icon: HeadsetIcon, tone: 'violet' },
    { key: 'accounts', q: 'account', icon: CalculatorIcon, tone: 'green' },
    { key: 'software', q: 'software', icon: CodeIcon, tone: 'navy' },
    { key: 'marketing', q: 'marketing', icon: MegaphoneIcon, tone: 'orange' },
    { key: 'hr', q: 'recruit', icon: UsersThreeIcon, tone: 'teal' },
    { key: 'teaching', q: 'teacher', icon: ChalkboardTeacherIcon, tone: 'amber' },
    { key: 'healthcare', q: 'nurse', icon: FirstAidKitIcon, tone: 'red' },
    { key: 'admin', q: 'admin', icon: BriefcaseIcon, tone: 'slate' },
    { key: 'retail', q: 'retail', icon: StorefrontIcon, tone: 'pink' },
    { key: 'hospitality', q: 'hotel', icon: ForkKnifeIcon, tone: 'orange' },
    { key: 'engineering', q: 'engineer', icon: GearIcon, tone: 'blue' },
];

// Trades booked through Instant Milega. `q` is the English trade, used as the search term.
// The old photos are kept in the comments in case they come back.
const GIG_TRADES: { key: string; q: string; icon: Icon; tone: Tone }[] = [
    { key: 'delivery', q: 'Delivery', icon: MopedIcon, tone: 'orange' }, // img: '/asset/trades/delivery.jpg'
    { key: 'driver', q: 'Driver', icon: SteeringWheelIcon, tone: 'navy' }, // img: '/asset/trades/driver.jpg'
    { key: 'warehouse', q: 'Warehouse', icon: WarehouseIcon, tone: 'amber' }, // img: '/asset/trades/warehouse.jpg'
    { key: 'electrician', q: 'Electrician', icon: LightningIcon, tone: 'blue' }, // img: '/asset/trades/electrician.jpg'
    { key: 'security', q: 'Security guard', icon: ShieldCheckIcon, tone: 'slate' }, // img: '/asset/trades/security.jpg'
    { key: 'plumber', q: 'Plumber', icon: WrenchIcon, tone: 'teal' }, // img: '/asset/trades/plumber.jpg'
    { key: 'painter', q: 'Painter', icon: PaintRollerIcon, tone: 'pink' }, // img: '/asset/trades/painter.jpg'
    { key: 'ac', q: 'AC technician', icon: SnowflakeIcon, tone: 'violet' }, // img: '/asset/trades/ac.jpg'
    { key: 'housekeeping', q: 'Housekeeping', icon: BroomIcon, tone: 'green' }, // img: '/asset/trades/labour.jpg'
    { key: 'office', q: 'Office assistant', icon: BriefcaseIcon, tone: 'red' }, // img: '/asset/trades/office-executive.jpg'
];

const gigHref = (q: string) =>
    FEATURES.INSTANT_MILEGA ? `/instant-milega?role=${encodeURIComponent(q)}` : `/jobs?q=${encodeURIComponent(q)}`;

/** A trade card's art: tone gradient, rings, a ground curve and a large duotone tool icon */
function TradeArt({ icon: TradeIcon, tone }: { icon: Icon; tone: Tone }) {
    const c = TONE[tone];
    return (
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${c.from} 0%, ${c.to} 100%)` }} aria-hidden="true">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 240" preserveAspectRatio="xMidYMid slice">
                <circle cx="150" cy="70" r="90" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="18" />
                <circle cx="150" cy="70" r="46" fill="#fff" fillOpacity="0.08" />
                <path d="M0 190 Q60 160 120 185 T200 175 V240 H0Z" fill="#000" fillOpacity="0.16" />
                <g fill="#fff" fillOpacity="0.25">
                    <circle cx="26" cy="34" r="3" />
                    <circle cx="44" cy="22" r="2" />
                    <circle cx="38" cy="52" r="1.6" />
                </g>
            </svg>
            <TradeIcon size={84} weight="duotone" className="absolute right-4 top-6 text-white sm:right-5 sm:top-8" />
        </div>
    );
}

/** Home job categories: regular jobs in one tab, Instant Milega trades in the other */
export default function JobCategoriesSection() {
    const t = useTranslations('home.categories');
    const tr = useTranslations('home.roles');
    const [tab, setTab] = useState<Tab>('jobs');
    const openingsLabel = useOpeningsLabel();
    const counts = useJobCounts(JOB_CATEGORIES.map((c) => `search=${encodeURIComponent(c.q)}`));

    const tabs: { value: Tab; label: string }[] = [
        { value: 'jobs', label: t('tabJobs') },
        { value: 'gigs', label: FEATURES.INSTANT_MILEGA ? t('tabGigs') : t('tabTrades') },
    ];

    return (
        <section id="job-categories" className="scroll-mt-24 py-8 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-labelledby="categories-title">
            <SectionHeader id="categories-title" title={t('title')} description={tab === 'jobs' ? t('textJobs') : t('textGigs')} />

            <div role="tablist" aria-label={t('title')} className="mb-6 flex justify-center gap-2">
                {tabs.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.value}
                        onClick={() => setTab(item.value)}
                        className={`km-press h-10 rounded-xl border px-5 text-sm font-semibold ${
                            tab === item.value
                                ? 'border-km-primary bg-km-primary text-white'
                                : 'border-km-border bg-km-surface-card text-km-text-secondary hover:text-km-heading'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'jobs' ? (
                <div role="tabpanel" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                    {JOB_CATEGORIES.map(({ key, q, icon: CategoryIcon, tone }) => (
                        <Link
                            key={key}
                            href={`/jobs?q=${encodeURIComponent(q)}`}
                            className="km-press-card flex items-center gap-3 rounded-2xl border border-km-border bg-km-surface-card p-3 sm:p-4 transition-colors hover:border-km-link"
                        >
                            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONE[tone].tile}`} aria-hidden="true">
                                <CategoryIcon size={26} weight="duotone" className={TONE[tone].icon} />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[15px] font-semibold leading-snug text-km-heading">{t(`job.${key}`)}</span>
                                <span className={`${counts[`search=${encodeURIComponent(q)}`] ? 'block' : 'hidden sm:block'} text-sm tabular-nums text-km-text-secondary`}>{openingsLabel(counts[`search=${encodeURIComponent(q)}`])}</span>
                            </span>
                        </Link>
                    ))}
                </div>
            ) : (
                <div role="tabpanel" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 sm:gap-6">
                    {GIG_TRADES.map((trade) => (
                        <Link key={trade.key} href={gigHref(trade.q)} className="km-press-card block rounded-2xl">
                            <div className="km-on-dark relative h-48 sm:h-56 rounded-2xl overflow-hidden group border border-km-border shadow-2xs">
                                {/* <Image src={trade.img} alt={tr(trade.key)} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover object-top" /> */}
                                <TradeArt icon={trade.icon} tone={trade.tone} />
                                <div className="absolute bottom-3.5 left-3.5 right-3.5 z-20 text-white">
                                    <h3 className="font-bold text-sm sm:text-base leading-snug">{tr(trade.key)}</h3>
                                    <p className="text-xs text-white/80 font-semibold mt-0.5">{FEATURES.INSTANT_MILEGA ? t('gigCta') : t('tradeCta')}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <div className="text-center mt-8 sm:mt-10">
                <Link
                    href={tab === 'jobs' || !FEATURES.INSTANT_MILEGA ? '/jobs' : '/instant-milega'}
                    className="km-press inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-km-primary text-km-heading hover:bg-km-primary hover:text-white text-sm font-semibold transition-colors"
                >
                    {tab === 'jobs' || !FEATURES.INSTANT_MILEGA ? t('viewJobs') : t('viewGigs')}
                    <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                </Link>
            </div>
        </section>
    );
}
