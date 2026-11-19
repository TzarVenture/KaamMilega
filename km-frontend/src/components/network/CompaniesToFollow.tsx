'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import CompanyCard from '@/components/company/CompanyCard';
import { companiesFromApi, type HiringCompany } from '@/lib/constants/companies';
import { useCompanyFollows } from '@/lib/useCompanyFollows';

interface Props {
    /** "page": a wide grid (/network); "sidebar": one column (company pages) */
    layout?: 'page' | 'sidebar';
    /** Leave this company out (the page being viewed) */
    excludeId?: string;
}

/**
 * "Companies to follow": ranked by where your connections work, your field, your city and who
 * is hiring. New jobs from followed companies go into your job alerts. Signed-in members only;
 * renders nothing when there's nothing to suggest.
 */
export default function CompaniesToFollow({ layout = 'page', excludeId }: Props) {
    const t = useTranslations('company');
    const follows = useCompanyFollows();
    const [companies, setCompanies] = useState<HiringCompany[] | null>(null);

    useEffect(() => {
        let alive = true;
        api.get(`/network/companies/suggestions?limit=${layout === 'sidebar' ? 4 : 6}`)
            .then((res) => alive && setCompanies(companiesFromApi(res)))
            .catch(() => alive && setCompanies([]));
        return () => {
            alive = false;
        };
    }, [layout]);

    const list = (companies ?? []).filter((c) => c.id !== excludeId).slice(0, layout === 'sidebar' ? 3 : 6);
    if (list.length === 0) return null;

    return (
        <section className="bg-km-surface-card rounded-2xl shadow-xs p-5 sm:p-6 border border-km-border">
            <div className="mb-4 pb-4 border-b border-km-border/70">
                <h2 className="text-base sm:text-lg font-bold text-km-text-primary">{t('toFollowTitle')}</h2>
                <p className="text-xs text-km-text-secondary font-medium mt-0.5">{t('toFollowSubtitle')}</p>
            </div>
            <div className={layout === 'sidebar' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'}>
                {list.map((company) => (
                    <CompanyCard
                        key={company.id || company.name}
                        company={company}
                        variant="compact"
                        isFollowing={follows.isFollowing(company.id)}
                        onToggleFollow={follows.canFollow && company.id ? () => follows.toggle(company.id!) : undefined}
                    />
                ))}
            </div>
        </section>
    );
}
