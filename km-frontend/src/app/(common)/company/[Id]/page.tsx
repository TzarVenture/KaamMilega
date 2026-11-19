'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCompany, websiteHref } from "./CompanyContext";
import { getCurrentUser } from '@/lib/auth';

export default function CompanyAboutPage() {
    const t = useTranslations('company');
    const { company } = useCompany();
    if (!company) return null;

    const me = getCurrentUser();
    const isOwner = Boolean(me && (me.id || me._id) === company.id);
    const website = websiteHref(company.website);
    const facts = [
        { label: t('industry'), value: company.industry },
        { label: t('size'), value: company.size ? t('sizeValue', { size: company.size }) : '' },
        { label: t('location'), value: company.location },
    ].filter((f) => f.value);

    return (
        <section className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs p-6 sm:p-8">
            <h2 className="text-lg font-bold text-km-text-primary mb-3">{t('overview')}</h2>

            {company.about ? (
                <p className="text-sm leading-relaxed text-km-text-primary whitespace-pre-line break-words mb-6">{company.about}</p>
            ) : isOwner ? (
                // Only the company itself is nudged; visitors just see the facts
                <p className="text-sm text-km-text-secondary mb-6">
                    {t('aboutEmpty')}{' '}
                    <Link href="/recruiter/company" className="font-semibold text-km-link hover:underline">{t('editPage')}</Link>
                </p>
            ) : null}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {website && (
                    <div className="sm:col-span-2">
                        <dt className="text-sm font-semibold text-km-text-primary">{t('website')}</dt>
                        <dd>
                            <a href={website} target="_blank" rel="noopener noreferrer" className="text-sm text-km-link hover:underline break-all">
                                {company.website}
                            </a>
                        </dd>
                    </div>
                )}
                {facts.map((f) => (
                    <div key={f.label}>
                        <dt className="text-sm font-semibold text-km-text-primary">{f.label}</dt>
                        <dd className="text-sm text-km-text-secondary">{f.value}</dd>
                    </div>
                ))}
            </dl>

            <p className="mt-6 pt-5 border-t border-km-border-subtle text-sm text-km-text-secondary">
                {t('jobsHint')}{' '}
                <Link href={`/company/${company.id}/jobs`} className="font-semibold text-km-heading hover:underline">
                    {t('tabJobs')}
                </Link>
            </p>
        </section>
    );
}
