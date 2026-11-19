'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BriefcaseIcon } from '@phosphor-icons/react';
import { useCompany } from "../CompanyContext";
import api from '@/lib/axios';
import JobCard, { type JobCardJob, type JobTag } from '@/components/jobs/JobCard';

/** The company's jobs, listed under the same rules as the main jobs page */
export default function CompanyJobsPage() {
    const t = useTranslations('company');
    const router = useRouter();
    const { company } = useCompany();
    const [jobs, setJobs] = useState<JobCardJob[] | null>(null);

    useEffect(() => {
        if (!company?.id) return;
        let alive = true;
        api.get('/jobs', { params: { recruiter_id: company.id, limit: 30 } })
            .then((res) => {
                const list = (res as { jobs?: JobCardJob[] } | null)?.jobs;
                if (alive) setJobs(Array.isArray(list) ? list : []);
            })
            .catch(() => alive && setJobs([]));
        return () => {
            alive = false;
        };
    }, [company?.id]);

    // A tag opens the main jobs page with that filter (only the city carries over in the link)
    const onTag = (tag: JobTag) =>
        router.push(tag.kind === 'city' ? `/jobs?city=${encodeURIComponent(tag.value)}` : '/jobs');

    if (jobs === null) {
        return (
            <div className="space-y-4" aria-busy="true">
                {[1, 2, 3].map((n) => <div key={n} className="h-36 bg-km-surface-card border border-km-border rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <section className="bg-km-surface-card border border-km-border rounded-2xl p-10 text-center">
                <BriefcaseIcon size={32} weight="duotone" className="text-km-heading mx-auto mb-3" aria-hidden="true" />
                <h2 className="text-base font-bold text-km-text-primary">{t('noJobs')}</h2>
                <p className="text-sm text-km-text-secondary mt-1">{t('noJobsText')}</p>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            {jobs.map((job) => (
                <JobCard key={job.id} job={job} onTag={onTag} isTagActive={() => false} qualifications={[]} />
            ))}
        </section>
    );
}
