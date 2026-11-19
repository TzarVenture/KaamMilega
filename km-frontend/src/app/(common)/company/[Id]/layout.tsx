'use client'
import { BuildingOfficeIcon, CheckIcon, PencilSimpleIcon, PlusIcon, SealCheckIcon } from '@phosphor-icons/react';
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from 'next-intl';
import { CompanyProvider, useCompany, websiteHref } from "./CompanyContext";
import AdSlot from '@/components/ads/AdSlot';
import CompaniesToFollow from '@/components/network/CompaniesToFollow';
import CustomImage from '@/components/ui/CustomImage';
import CompanyLogo from '@/components/ui/CompanyLogo';
import { useCompanyFollows } from '@/lib/useCompanyFollows';
import { getCurrentUser, isAuthenticated } from '@/lib/auth';
import { loginPathFor } from '@/lib/authPaths';
import { useFormat } from '@/i18n/useFormat';

function CompanyLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { Id } = useParams();
    const t = useTranslations('company');
    const tc = useTranslations('common');
    const { number } = useFormat();
    const { company, loading, notFound, adjustFollowers } = useCompany();
    const follows = useCompanyFollows();

    if (loading) {
        return (
            <main className="min-h-screen bg-km-surface py-8 px-4 md:px-12 lg:px-24">
                <div className="max-w-7xl mx-auto h-56 rounded-2xl bg-km-surface-card border border-km-border animate-pulse" />
            </main>
        );
    }

    if (notFound || !company) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-km-surface gap-3 px-4 text-center">
                <BuildingOfficeIcon size={40} weight="duotone" className="text-km-heading" aria-hidden="true" />
                <h1 className="text-xl font-bold text-km-text-primary">{t('notFoundTitle')}</h1>
                <p className="text-sm text-km-text-secondary">{t('notFoundText')}</p>
                <Link href="/jobs" className="mt-2 px-5 py-2 bg-km-primary text-white rounded-xl text-sm font-semibold hover:bg-km-primary-dark transition-colors">
                    {t('browseJobs')}
                </Link>
            </main>
        );
    }

    const base = `/company/${Id}`;
    const tabs = [
        { href: base, label: t('tabAbout') },
        { href: `${base}/jobs`, label: t('tabJobs') },
        { href: `${base}/people`, label: t('tabPeople') },
    ];
    const website = websiteHref(company.website);
    const following = follows.isFollowing(company.id);
    const me = getCurrentUser();
    const isOwner = Boolean(me && (me.id || me._id) === company.id);
    const facts = [company.industry, company.location].filter(Boolean).join(' · ');

    const onFollow = async () => {
        adjustFollowers(following ? -1 : 1);
        const ok = await follows.toggle(company.id);
        if (!ok) adjustFollowers(following ? 1 : -1);
    };

    const followButtonClass = `inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
        following
            ? 'bg-km-surface text-km-text-primary border border-km-border hover:bg-km-surface-card'
            : 'bg-km-primary text-white hover:bg-km-primary-dark'
    }`;

    return (
        <main className="min-h-screen bg-km-surface py-8 px-4 md:px-12 lg:px-24">
            <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">

                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    <section className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden">
                        <div className="h-32 sm:h-44 bg-[#071A4D] relative">
                            {company.cover && (
                                <CustomImage src={company.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            )}
                            <div className="absolute -bottom-12 left-6 sm:left-8 p-1.5 bg-km-surface-card rounded-full shadow-md">
                                <CompanyLogo src={company.logo} name={company.name} className="w-24 h-24" textClass="text-3xl" />
                            </div>
                        </div>

                        <div className="pt-16 px-6 sm:px-8 pb-6">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-km-text-primary">{company.name}</h1>
                                {company.verified && (
                                    <SealCheckIcon weight="fill" size={20} className="text-km-link shrink-0" aria-label={t('verified')} role="img" />
                                )}
                            </div>
                            {facts && <p className="text-sm text-km-text-secondary mt-1">{facts}</p>}
                            <p className="text-sm text-km-text-secondary mt-1 tabular-nums">
                                {t('followers', { count: company.follower_count, n: number(company.follower_count) })}
                                {company.job_count > 0 && (
                                    <>
                                        {' · '}
                                        <span className="font-medium text-[#16A34A]">
                                            {tc('openJobs', { count: company.job_count, n: number(company.job_count) })}
                                        </span>
                                    </>
                                )}
                            </p>

                            <div className="mt-5 flex flex-wrap gap-3">
                                {follows.canFollow && !isOwner ? (
                                    <button type="button" onClick={onFollow} aria-pressed={following} className={`${followButtonClass} cursor-pointer`}>
                                        {following ? <CheckIcon weight="bold" size={16} aria-hidden="true" /> : <PlusIcon weight="bold" size={16} aria-hidden="true" />}
                                        {following ? t('following') : t('follow')}
                                    </button>
                                ) : !isAuthenticated() ? (
                                    // Visitors sign in first, then come back here
                                    <Link href={loginPathFor(pathname)} className={followButtonClass}>
                                        <PlusIcon weight="bold" size={16} aria-hidden="true" />
                                        {t('follow')}
                                    </Link>
                                ) : null}
                                {isOwner && (
                                    <Link href="/recruiter/company" className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold border border-km-border text-km-text-primary hover:bg-km-surface transition-colors">
                                        <PencilSimpleIcon weight="bold" size={16} aria-hidden="true" />
                                        {t('editPage')}
                                    </Link>
                                )}
                                {website && (
                                    <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-semibold border border-km-primary text-km-heading hover:bg-km-surface transition-colors">
                                        {t('visitWebsite')}
                                    </a>
                                )}
                            </div>
                        </div>

                        <nav className="flex border-t border-km-border px-6 sm:px-8 gap-8 overflow-x-auto" aria-label={company.name}>
                            {tabs.map((tab) => {
                                const isActive = pathname === tab.href;
                                return (
                                    <Link
                                        href={tab.href}
                                        key={tab.href}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`py-3.5 text-sm font-semibold transition-colors whitespace-nowrap border-b-2 ${isActive ? 'text-km-heading border-km-primary' : 'text-km-text-secondary border-transparent hover:text-km-text-primary'}`}
                                    >
                                        {tab.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </section>

                    {children}
                </div>

                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    <AdSlot placement="company_sidebar" />
                    {follows.canFollow && <CompaniesToFollow layout="sidebar" excludeId={company.id} />}
                </div>
            </div>
        </main>
    );
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
    return (
        <CompanyProvider>
            <CompanyLayoutContent>
                {children}
            </CompanyLayoutContent>
        </CompanyProvider>
    );
}
