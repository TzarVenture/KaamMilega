'use client';

import React, { useState } from 'react';
import Link from 'next/link';
// import Image from 'next/image'; // trade photos replaced by drawn illustrations (CategoryScene)
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

// Office and skilled job categories. `q` is the jobs search, and counts use the same term so the
// number matches what the visitor sees after clicking.
const JOB_CATEGORIES: { key: string; q: string; icon: Icon }[] = [
    { key: 'sales', q: 'sales', icon: ChartLineUpIcon },
    { key: 'support', q: 'customer', icon: HeadsetIcon },
    { key: 'accounts', q: 'account', icon: CalculatorIcon },
    { key: 'software', q: 'software', icon: CodeIcon },
    { key: 'marketing', q: 'marketing', icon: MegaphoneIcon },
    { key: 'hr', q: 'recruit', icon: UsersThreeIcon },
    { key: 'teaching', q: 'teacher', icon: ChalkboardTeacherIcon },
    { key: 'healthcare', q: 'nurse', icon: FirstAidKitIcon },
    { key: 'admin', q: 'admin', icon: BriefcaseIcon },
    { key: 'retail', q: 'retail', icon: StorefrontIcon },
    { key: 'hospitality', q: 'hotel', icon: ForkKnifeIcon },
    { key: 'engineering', q: 'engineer', icon: GearIcon },
];

// Trades booked through Instant Milega. `q` is the English trade, used as the search term.
// The old photos are kept in the comments in case they come back.
const GIG_TRADES: { key: string; q: string; icon: Icon }[] = [
    { key: 'delivery', q: 'Delivery', icon: MopedIcon }, // img: '/asset/trades/delivery.jpg'
    { key: 'driver', q: 'Driver', icon: SteeringWheelIcon }, // img: '/asset/trades/driver.jpg'
    { key: 'warehouse', q: 'Warehouse', icon: WarehouseIcon }, // img: '/asset/trades/warehouse.jpg'
    { key: 'electrician', q: 'Electrician', icon: LightningIcon }, // img: '/asset/trades/electrician.jpg'
    { key: 'security', q: 'Security guard', icon: ShieldCheckIcon }, // img: '/asset/trades/security.jpg'
    { key: 'plumber', q: 'Plumber', icon: WrenchIcon }, // img: '/asset/trades/plumber.jpg'
    { key: 'painter', q: 'Painter', icon: PaintRollerIcon }, // img: '/asset/trades/painter.jpg'
    { key: 'ac', q: 'AC technician', icon: SnowflakeIcon }, // img: '/asset/trades/ac.jpg'
    { key: 'housekeeping', q: 'Housekeeping', icon: BroomIcon }, // img: '/asset/trades/labour.jpg'
    { key: 'office', q: 'Office assistant', icon: BriefcaseIcon }, // img: '/asset/trades/office-executive.jpg'
];

const gigHref = (q: string) =>
    FEATURES.INSTANT_MILEGA ? `/instant-milega?role=${encodeURIComponent(q)}` : `/jobs?q=${encodeURIComponent(q)}`;

// Gentle motion for the scenes; switched off for people who ask for less motion
const SCENE_CSS = `
@keyframes km-cat-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes km-cat-spin { to { transform: rotate(360deg) } }
@keyframes km-cat-twinkle { 0%,100% { opacity: .25; transform: scale(.8) } 50% { opacity: 1; transform: scale(1) } }
@keyframes km-cat-shadow { 0%,100% { transform: scaleX(1); opacity: .18 } 50% { transform: scaleX(.86); opacity: .1 } }
.km-cat-float { animation: km-cat-float 3.6s ease-in-out infinite }
.km-cat-spin { animation: km-cat-spin 18s linear infinite; transform-box: fill-box; transform-origin: center }
.km-cat-twinkle { animation: km-cat-twinkle 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
.km-cat-shadow { animation: km-cat-shadow 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
@media (prefers-reduced-motion: reduce) { .km-cat-float, .km-cat-spin, .km-cat-twinkle, .km-cat-shadow { animation: none } }
`;

/**
 * A small illustrated scene in KaamMilega colours: a soft blue backdrop with a dotted orbit, a
 * floating white tile holding the category's tool, an orange accent and sparkles. Each card's
 * timing is offset so a row moves gently rather than in step.
 */
function CategoryScene({ icon: CategoryIcon, index }: { icon: Icon; index: number }) {
    const delay = `${(index % 6) * -0.6}s`;
    return (
        <div className="relative h-24 sm:h-28 overflow-hidden bg-[#F2F6FE] dark:bg-[#0F2552]" aria-hidden="true">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice">
                {/* Backdrop: soft blob and a dotted orbit */}
                <ellipse cx="80" cy="50" rx="46" ry="34" className="fill-[#DCE8FD] dark:fill-[#14357F]" />
                <g className="km-cat-spin" style={{ animationDelay: delay }}>
                    <ellipse cx="80" cy="50" rx="58" ry="40" fill="none" className="stroke-[#0B5ED7]/25 dark:stroke-[#93C5FD]/25" strokeWidth="1" strokeDasharray="2 5" />
                    <circle cx="138" cy="50" r="3" fill="#FF6B00" />
                </g>
                {/* Ground shadow under the floating tile */}
                <ellipse cx="80" cy="80" rx="20" ry="3.5" className="km-cat-shadow fill-[#071A4D] dark:fill-black" style={{ animationDelay: delay }} />
                {/* Sparkles */}
                <path d="M30 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FF6B00" className="km-cat-twinkle" style={{ animationDelay: delay }} />
                <circle cx="128" cy="20" r="2.2" fill="#0B5ED7" className="km-cat-twinkle" style={{ animationDelay: `calc(${delay} - 1.2s)` }} />
                <circle cx="24" cy="70" r="1.6" fill="#0B5ED7" className="km-cat-twinkle" style={{ animationDelay: `calc(${delay} - .6s)` }} />
                <path d="M134 70 h6 M137 67 v6" stroke="#071A4D" strokeWidth="1.4" strokeLinecap="round" className="km-cat-twinkle dark:stroke-white" style={{ animationDelay: `calc(${delay} - 1.8s)` }} />
            </svg>
            {/* The tool on a floating tile, with an orange corner dot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%]">
                <div className="km-cat-float relative" style={{ animationDelay: delay }}>
                    <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white shadow-[0_8px_18px_-6px_rgba(7,26,77,0.35)] dark:bg-[#071A4D]">
                        <CategoryIcon size={28} weight="duotone" className="text-[#0B5ED7] dark:text-[#93C5FD]" />
                    </span>
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#FF6B00] dark:border-[#071A4D]" />
                </div>
            </div>
        </div>
    );
}

/** One category card: scene on top, name and a short line below. Same size on both tabs. */
function CategoryCard({ href, icon, index, title, sub }: { href: string; icon: Icon; index: number; title: string; sub: string }) {
    return (
        <Link
            href={href}
            className="km-press-card group flex flex-col overflow-hidden rounded-2xl border border-km-border bg-km-surface-card transition-colors hover:border-km-link"
        >
            <CategoryScene icon={icon} index={index} />
            <span className="px-3 py-2.5">
                <span className="block text-sm font-semibold leading-snug text-km-heading group-hover:text-km-link">{title}</span>
                <span className="block truncate text-xs tabular-nums text-km-text-secondary">{sub}</span>
            </span>
        </Link>
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
        <section id="job-categories" className="scroll-mt-24 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-labelledby="categories-title">
            <style>{SCENE_CSS}</style>
            <SectionHeader id="categories-title" title={t('title')} description={tab === 'jobs' ? t('textJobs') : t('textGigs')} />

            <div role="tablist" aria-label={t('title')} className="mb-5 flex justify-center gap-2">
                {tabs.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.value}
                        onClick={() => setTab(item.value)}
                        className={`km-press h-9 rounded-xl border px-4 text-sm font-semibold ${
                            tab === item.value
                                ? 'border-km-primary bg-km-primary text-white'
                                : 'border-km-border bg-km-surface-card text-km-text-secondary hover:text-km-heading'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {tab === 'jobs'
                    ? JOB_CATEGORIES.map(({ key, q, icon }, i) => (
                        <CategoryCard
                            key={key}
                            href={`/jobs?q=${encodeURIComponent(q)}`}
                            icon={icon}
                            index={i}
                            title={t(`job.${key}`)}
                            sub={openingsLabel(counts[`search=${encodeURIComponent(q)}`])}
                        />
                    ))
                    : GIG_TRADES.map((trade, i) => (
                        <CategoryCard
                            key={trade.key}
                            href={gigHref(trade.q)}
                            icon={trade.icon}
                            index={i}
                            title={tr(trade.key)}
                            sub={FEATURES.INSTANT_MILEGA ? t('gigCta') : t('tradeCta')}
                        />
                    ))}
            </div>

            <div className="text-center mt-6">
                <Link
                    href={tab === 'jobs' || !FEATURES.INSTANT_MILEGA ? '/jobs' : '/instant-milega'}
                    className="km-press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-km-primary text-km-heading hover:bg-km-primary hover:text-white text-sm font-semibold transition-colors"
                >
                    {tab === 'jobs' || !FEATURES.INSTANT_MILEGA ? t('viewJobs') : t('viewGigs')}
                    <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                </Link>
            </div>
        </section>
    );
}
