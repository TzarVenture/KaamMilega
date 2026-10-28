'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Icon } from '@phosphor-icons/react';
import { BriefcaseIcon, BuildingOfficeIcon, CaretRightIcon, GraduationCapIcon, LightningIcon, MagnifyingGlassIcon, MapPinIcon, PhoneCallIcon, TrendUpIcon, UsersIcon } from '@phosphor-icons/react';

import CitySelector from '@/components/km/CitySelector';
import { FEATURES } from '@/config/features';
import { useInViewOnce } from '@/lib/useInViewOnce';
import { useFormat } from '@/i18n/useFormat';

interface HeroSectionProps {
    cities?: unknown[];
    stats?: { total_users?: number; cities?: number } | null;
}

type Tab = 'jobs' | 'instant' | 'skills' | 'mentors';

// Label key in home.hero.tags, and the English term that is searched (job data is in English)
const POPULAR_SEARCHES: [string, string][] = [
    ['fresher', 'Fresher Jobs'],
    ['wfh', 'Work From Home'],
    ['delivery', 'Delivery Partner'],
    ['electrician', 'Electrician'],
    ['plumber', 'Plumber'],
    ['warehouse', 'Warehouse'],
    ['retail', 'Retail'],
    ['support', 'Customer Support'],
];

const TAB_CLASS = (active: boolean) =>
    `flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-t-xl sm:rounded-t-2xl font-bold text-sm transition-all shrink-0 cursor-pointer ${
        active
            ? 'bg-km-accent text-white shadow-md'
            : 'bg-km-surface-card/70 hover:bg-km-surface-card text-slate-700 border border-b-0 border-slate-200/80 hover:text-km-heading'
    }`;

const FIELD_CLASS =
    'flex-1 flex items-center h-12 bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 focus-within:bg-km-surface-card focus-within:border-km-primary focus-within:ring-2 focus-within:ring-km-primary/10 transition-all';
const INPUT_CLASS = 'w-full bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none';
const SUBMIT_CLASS =
    'bg-km-accent hover:bg-km-accent-light text-white text-sm font-bold px-7 sm:px-8 h-12 rounded-xl transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95';

export default function HeroSection({ cities = [], stats }: HeroSectionProps) {
    const t = useTranslations('home.hero');
    const { number } = useFormat();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<Tab>('jobs');
    // Slogan and floating card animate once, on first view
    const { ref: sloganRef, inView: sloganInView } = useInViewOnce<HTMLDivElement>(0.2);
    const { ref: featureCardRef, inView: featureCardInView } = useInViewOnce<HTMLDivElement>(0.2);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCity, setSelectedCity] = useState('');

    const go = (path: string, params: Record<string, string>) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
        router.push(`${path}?${q.toString()}`);
    };

    // Real numbers only; a stat without data is left out
    const userCount = typeof stats?.total_users === 'number' && stats.total_users > 0 ? stats.total_users : 0;
    const cityCount = (typeof stats?.cities === 'number' && stats.cities > 0 ? stats.cities : 0) || cities.length;
    const statItems: { Icon: Icon; value: string; label: string }[] = [
        ...(userCount ? [{ Icon: UsersIcon, value: t('users', { n: number(userCount) }), label: t('usersLabel') }] : []),
        ...(cityCount ? [{ Icon: MapPinIcon, value: t('cities', { n: number(cityCount) }), label: t('citiesLabel') }] : []),
        { Icon: BuildingOfficeIcon, value: t('free'), label: t('freeLabel') },
        { Icon: PhoneCallIcon, value: t('directCalls'), label: t('directLabel') },
    ];

    const tabs: { id: Tab; label: React.ReactNode; Icon: Icon }[] = [
        { id: 'jobs', label: t('tabJobs'), Icon: BriefcaseIcon },
        ...(FEATURES.INSTANT_MILEGA ? [{ id: 'instant' as Tab, label: t('tabInstant'), Icon: LightningIcon }] : []),
        { id: 'skills', label: t('tabSkills'), Icon: GraduationCapIcon },
        { id: 'mentors', label: t('tabMentors'), Icon: UsersIcon },
    ];

    return (
        <section className="relative overflow-hidden bg-linear-to-b from-[#EAF1FA] to-[#F4F7FB] pt-4 pb-6 sm:pt-10 sm:pb-12 lg:pt-12 lg:pb-14 border-b border-km-border-subtle font-sans dark:from-km-surface dark:to-km-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-6 items-center">

                    {/* Left: headline, search, popular searches */}
                    <div className="lg:col-span-7 flex flex-col justify-center z-10 py-2 sm:py-6">
                        {/* Category line with the Hindi brand line */}
                        <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm font-semibold tracking-wide text-slate-500 mb-3 sm:mb-4">
                            <span className="text-km-heading font-bold">{t('catSkills')}</span>
                            <span className="text-slate-300" aria-hidden="true">•</span>
                            <span className="text-km-accent font-bold">{t('catJobs')}</span>
                            <span className="text-slate-300" aria-hidden="true">•</span>
                            <span className="text-km-blue font-bold">{t('catOpportunities')}</span>
                            <span className="text-slate-300" aria-hidden="true">•</span>
                            <span lang="hi" className="font-devanagari font-bold text-slate-700 tracking-normal">हर काम, हर मौका</span>
                        </div>

                        <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-bold text-slate-900 tracking-tight leading-[1.12] mb-3 sm:mb-4">
                            {t.rich('title', {
                                accent: (chunks) => <span className="text-km-accent block sm:inline">{chunks}</span>,
                            })}
                        </h1>
                        <p className="text-sm sm:text-base text-slate-600 mb-6 sm:mb-8 max-w-xl leading-relaxed">{t('text')}</p>

                        <div>
                            {/* Tabs */}
                            <div role="tablist" className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
                                {tabs.map(({ id, label, Icon: TabIcon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === id}
                                        onClick={() => setActiveTab(id)}
                                        className={TAB_CLASS(activeTab === id)}
                                    >
                                        <TabIcon weight={id === 'instant' ? 'fill' : 'bold'} size={16} aria-hidden="true" />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Search box */}
                            <div className="bg-km-surface-card rounded-b-2xl rounded-tr-2xl sm:rounded-b-3xl sm:rounded-tr-3xl border border-slate-200 shadow-xl shadow-blue-950/5 p-3 sm:p-4">
                                {activeTab === 'jobs' && (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            go('/jobs', { q: searchQuery.trim(), city: selectedCity });
                                        }}
                                        className="flex flex-col sm:flex-row gap-3"
                                    >
                                        <div className={FIELD_CLASS}>
                                            <MagnifyingGlassIcon weight="bold" size={18} className="text-slate-400 mr-2.5 shrink-0" aria-hidden="true" />
                                            <input
                                                type="text"
                                                aria-label={t('jobPlaceholder')}
                                                placeholder={t('jobPlaceholder')}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className={INPUT_CLASS}
                                            />
                                        </div>
                                        <CitySelector
                                            selectedCity={selectedCity}
                                            onCityChange={(city) => setSelectedCity(city === 'All' ? '' : city)}
                                            variant="hero"
                                            cities={cities as { name: string }[]}
                                        />
                                        <button type="submit" className={SUBMIT_CLASS}>
                                            {t('searchJobs')}
                                        </button>
                                    </form>
                                )}

                                {/* InstantMilega runs in the app: send people to its page in the right mode */}
                                {FEATURES.INSTANT_MILEGA && activeTab === 'instant' && (
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <p className="flex-1 text-sm sm:text-base text-slate-700 font-medium">{t('instantText')}</p>
                                        <div className="flex gap-2 shrink-0">
                                            <Link href="/instant-milega?mode=hire" className={SUBMIT_CLASS}>
                                                {t('instantHire')}
                                            </Link>
                                            <Link
                                                href="/instant-milega?mode=work"
                                                className="h-12 px-6 rounded-xl border border-km-primary text-km-heading text-sm font-bold flex items-center justify-center hover:bg-km-surface transition-colors"
                                            >
                                                {t('instantWork')}
                                            </Link>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'skills' && (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            go('/resources', { q: searchQuery.trim() });
                                        }}
                                        className="flex flex-col sm:flex-row gap-3"
                                    >
                                        <div className={FIELD_CLASS}>
                                            <MagnifyingGlassIcon weight="bold" size={18} className="text-slate-400 mr-2.5 shrink-0" aria-hidden="true" />
                                            <input
                                                type="text"
                                                aria-label={t('skillPlaceholder')}
                                                placeholder={t('skillPlaceholder')}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className={INPUT_CLASS}
                                            />
                                        </div>
                                        <button type="submit" className={SUBMIT_CLASS}>
                                            <span>{t('exploreSkills')}</span>
                                            <CaretRightIcon weight="bold" size={16} aria-hidden="true" />
                                        </button>
                                    </form>
                                )}

                                {activeTab === 'mentors' && (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            go('/mentorship', { q: searchQuery.trim() });
                                        }}
                                        className="flex flex-col sm:flex-row gap-3"
                                    >
                                        <div className={FIELD_CLASS}>
                                            <MagnifyingGlassIcon weight="bold" size={18} className="text-slate-400 mr-2.5 shrink-0" aria-hidden="true" />
                                            <input
                                                type="text"
                                                aria-label={t('mentorPlaceholder')}
                                                placeholder={t('mentorPlaceholder')}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className={INPUT_CLASS}
                                            />
                                        </div>
                                        <button type="submit" className={SUBMIT_CLASS}>
                                            <span>{t('findMentors')}</span>
                                            <CaretRightIcon weight="bold" size={16} aria-hidden="true" />
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Popular searches */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-500">{t('popular')}</span>
                            {POPULAR_SEARCHES.map(([key, query]) => (
                                <Link
                                    key={key}
                                    href={`/jobs?q=${encodeURIComponent(query)}`}
                                    className="text-sm font-medium text-slate-600 bg-km-surface-card/80 hover:bg-km-surface-card hover:text-km-heading hover:border-km-primary px-3 py-1 rounded-full border border-slate-200/80 transition-all shadow-2xs"
                                >
                                    {t(`tags.${key}`)}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right: person with the KaamMilega K art */}
                    <div className="lg:col-span-5 relative flex items-end justify-center min-h-50 sm:min-h-75 lg:min-h-115">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
                            <div className="relative w-[70%] sm:w-[80%] lg:w-[95%] aspect-square max-w-120 translate-x-2 sm:translate-x-4 opacity-90">
                                <Image src="/kaammilega-logo-icon.png" alt="" fill priority className="object-contain" />
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
                        </div>

                        <div className="relative z-10 w-[50%] sm:w-[60%] lg:w-[75%] max-w-90 flex items-end justify-center">
                            <Image
                                src="/asset/hero/hero-worker-new-clean.png"
                                alt={t('imageAlt')}
                                width={1254}
                                height={1254}
                                priority
                                className="w-full h-auto object-contain object-bottom drop-shadow-2xl"
                            />
                        </div>

                        {/* Slogan accent */}
                        <div
                            ref={sloganRef}
                            data-inview={sloganInView}
                            aria-hidden="true"
                            className="absolute top-2 left-0 sm:-left-2 z-20 select-none hidden lg:block transform -rotate-6"
                        >
                            <p className="km-a-rise km-a-hide text-sm font-bold text-slate-800 tracking-tight leading-tight" style={{ animationDelay: '300ms' }}>
                                {t('sloganBetter')}
                            </p>
                            <p className="km-a-rise km-a-hide text-sm font-bold text-km-heading tracking-tight leading-tight" style={{ animationDelay: '500ms' }}>
                                {t('sloganBrighter')}
                            </p>
                            <svg className="w-28 h-3 text-km-accent mt-0.5 overflow-visible" viewBox="0 0 100 12" fill="none">
                                <path className="km-a-draw km-a-hide" pathLength={1} style={{ animationDelay: '800ms' }} d="M2 8C28 2 72 2 98 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>

                        {/* Floating card: rows slide in one by one and icons pop on first view */}
                        <div
                            ref={featureCardRef}
                            data-inview={featureCardInView}
                            aria-hidden="true"
                            className="absolute bottom-2 -right-1 sm:bottom-6 sm:-right-2 lg:-right-4 z-20 bg-km-surface-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-lg sm:shadow-xl border border-slate-200/90 space-y-1.5 sm:space-y-2.5 min-w-32.5 sm:min-w-40 select-none"
                        >
                            {([
                                [BriefcaseIcon, t('cardJobs')],
                                [GraduationCapIcon, t('cardSkills')],
                                [UsersIcon, t('cardOpportunities')],
                                [TrendUpIcon, t('cardGrowth')],
                            ] as const).map(([RowIcon, label], i) => (
                                <div key={i} className="km-a-slide km-a-hide flex items-center gap-2 sm:gap-2.5" style={{ animationDelay: `${400 + i * 120}ms` }}>
                                    <span className="km-a-pop inline-flex" style={{ animationDelay: `${650 + i * 120}ms` }}>
                                        <RowIcon weight="duotone" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-km-heading" />
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-slate-800">{label}</span>
                                </div>
                            ))}

                            <div className="km-a-rise km-a-hide pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '950ms' }}>
                                <span className="text-xs font-semibold text-slate-500 shrink-0">{t('cardAllAt')}</span>
                                <div className="relative h-3 w-16 sm:h-4 sm:w-20">
                                    <Image src="/kaammilega-logo-text.png" alt="" fill className="object-contain object-left dark:hidden" />
                                    <Image src="/kaammilega-logo-text-dark.png" alt="" fill className="object-contain object-left hidden dark:block" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Platform facts: real numbers only */}
                <ul className="mt-6 pt-5 sm:mt-8 sm:pt-6 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
                    {statItems.map(({ Icon: StatIcon, value, label }) => (
                        <li key={label} className="flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-2.5 text-left">
                            <StatIcon weight="duotone" className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 text-km-heading" aria-hidden="true" />
                            <div>
                                <p className="text-base lg:text-lg font-bold text-slate-900 leading-tight">{value}</p>
                                <p className="text-sm text-slate-500 font-medium leading-tight mt-0.5">{label}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
