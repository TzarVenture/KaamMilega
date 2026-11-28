'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, SparkleIcon } from '@phosphor-icons/react';
import { AdminPanel, btn, cx, EmptyState, SkeletonRows } from '@/components/admin/ui';
import { recruiterApi, type TalentCard } from '@/lib/api/recruiter';
import TalentCardItem from './TalentCardItem';

/** Job seekers whose skills or wanted roles match this job, people in the job's city first */
export default function SuggestedCandidates({ jobId }: { jobId: string }) {
    const t = useTranslations('recruiterJobs.suggested');
    const [people, setPeople] = useState<TalentCard[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let alive = true;
        recruiterApi.suggested(jobId)
            .then((res) => { if (alive) { setPeople(res.items || []); setFailed(false); } })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [jobId, reload]);

    return (
        <AdminPanel
            title={t('title')}
            description={t('hint')}
            className="mt-6 min-w-0"
            actions={<Link href="/recruiter/people" className="inline-flex items-center gap-1 text-sm text-km-link hover:underline">{t('searchAll')}<ArrowRightIcon size={14} aria-hidden="true" /></Link>}
            bodyClassName="p-4"
        >
            {failed ? (
                <div className="p-4 text-center" role="alert">
                    <p className="text-sm text-km-text-secondary">{t('failed')}</p>
                    <button type="button" onClick={() => { setFailed(false); setPeople(null); setReload((n) => n + 1); }} className={cx(btn.secondary, 'mt-3')}>{t('retry')}</button>
                </div>
            ) : people === null ? (
                <SkeletonRows rows={3} />
            ) : people.length === 0 ? (
                <EmptyState icon={SparkleIcon} title={t('noneTitle')} description={t('noneHint')} />
            ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {people.map((p) => <TalentCardItem key={p.id} person={p} />)}
                </ul>
            )}
        </AdminPanel>
    );
}
