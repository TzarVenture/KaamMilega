'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import CompanyCard from '@/components/company/CompanyCard';
import { companiesFromApi, type HiringCompany } from '@/lib/constants/companies';
import { useCompanyFollows } from '@/lib/useCompanyFollows';

/**
 * "Companies to follow" on /network: ranked by where your connections work, your field, your
 * city and who is hiring. New jobs from followed companies go into your job alerts.
 * Renders nothing when there's nothing to suggest.
 */
export default function CompaniesToFollow() {
    const t = useTranslations('company');
    const follows = useCompanyFollows();
    const [companies, setCompanies] = useState<HiringCompany[] | null>(null);

    useEffect(() => {
        let alive = true;
        api.get('/network/companies/suggestions?limit=6')
            .then((res) => alive && setCompanies(companiesFromApi(res)))
            .catch(() => alive && setCompanies([]));
        return () => {
            alive = false;
        };
    }, []);

    if (!companies || companies.length === 0) return null;

    return (
        <section className="bg-km-surface-card rounded-2xl shadow-xs p-5 sm:p-6 border border-km-border">
            <div className="mb-4 pb-4 border-b border-km-border/70">
                <h2 className="text-base sm:text-lg font-bold text-km-text-primary">{t('toFollowTitle')}</h2>
                <p className="text-xs text-km-text-secondary font-medium mt-0.5">{t('toFollowSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {companies.map((company) => (
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
