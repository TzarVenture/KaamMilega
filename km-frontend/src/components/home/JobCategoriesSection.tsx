'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    ArrowRightIcon, BriefcaseIcon, CalculatorIcon, ChalkboardTeacherIcon, ChartLineUpIcon, CodeIcon,
    FirstAidKitIcon, ForkKnifeIcon, GearIcon, HeadsetIcon, MegaphoneIcon, StorefrontIcon, UsersThreeIcon,
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
const GIG_TRADES = [
    { key: 'delivery', q: 'Delivery', img: '/asset/trades/delivery.jpg' },
    { key: 'driver', q: 'Driver', img: '/asset/trades/driver.jpg' },
    { key: 'warehouse', q: 'Warehouse', img: '/asset/trades/warehouse.jpg' },
    { key: 'electrician', q: 'Electrician', img: '/asset/trades/electrician.jpg' },
    { key: 'security', q: 'Security guard', img: '/asset/trades/security.jpg' },
    { key: 'plumber', q: 'Plumber', img: '/asset/trades/plumber.jpg' },
    { key: 'painter', q: 'Painter', img: '/asset/trades/painter.jpg' },
    { key: 'ac', q: 'AC technician', img: '/asset/trades/ac.jpg' },
    { key: 'housekeeping', q: 'Housekeeping', img: '/asset/trades/labour.jpg' },
    { key: 'office', q: 'Office assistant', img: '/asset/trades/office-executive.jpg' },
];

const gigHref = (q: string) =>
    FEATURES.INSTANT_MILEGA ? `/instant-milega?role=${encodeURIComponent(q)}` : `/jobs?q=${encodeURIComponent(q)}`;

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
                        className={`h-10 rounded-xl border px-5 text-sm font-semibold transition-colors ${
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
                    {JOB_CATEGORIES.map(({ key, q, icon: CategoryIcon }) => (
                        <Link
                            key={key}
                            href={`/jobs?q=${encodeURIComponent(q)}`}
                            className="flex items-center gap-3 rounded-2xl border border-km-border bg-km-surface-card p-4 transition-colors hover:border-km-link"
                        >
                            <CategoryIcon size={28} className="shrink-0 text-km-link" aria-hidden="true" />
                            <span className="min-w-0">
                                <span className="block text-[15px] font-semibold leading-snug text-km-heading">{t(`job.${key}`)}</span>
                                <span className="block text-sm text-km-text-secondary">{openingsLabel(counts[`search=${encodeURIComponent(q)}`])}</span>
                            </span>
                        </Link>
                    ))}
                </div>
            ) : (
                <div role="tabpanel" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 sm:gap-6">
                    {GIG_TRADES.map((trade) => (
                        <Link key={trade.key} href={gigHref(trade.q)}>
                            <div className="km-on-dark relative h-48 sm:h-56 rounded-2xl overflow-hidden group border border-slate-200/90 shadow-2xs">
                                <Image src={trade.img} alt={tr(trade.key)} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover object-top" />
                                <div className="absolute inset-0 bg-linear-to-t from-[#020617]/90 via-[#020617]/30 to-transparent z-10" />
                                <div className="absolute bottom-3.5 left-3.5 right-3.5 z-20 text-white">
                                    <h3 className="font-bold text-sm sm:text-base leading-snug">{tr(trade.key)}</h3>
                                    <p className="text-xs text-slate-300 font-semibold mt-0.5">{FEATURES.INSTANT_MILEGA ? t('gigCta') : t('tradeCta')}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <div className="text-center mt-8 sm:mt-10">
                <Link
                    href={tab === 'jobs' || !FEATURES.INSTANT_MILEGA ? '/jobs' : '/instant-milega'}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-km-primary text-km-heading hover:bg-km-primary hover:text-white text-sm font-semibold transition-colors"
                >
                    {tab === 'jobs' || !FEATURES.INSTANT_MILEGA ? t('viewJobs') : t('viewGigs')}
                    <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                </Link>
            </div>
        </section>
    );
}
