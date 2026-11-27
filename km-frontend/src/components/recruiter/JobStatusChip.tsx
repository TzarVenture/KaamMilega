'use client';

import { useTranslations } from 'next-intl';
import { jobStatus, type JobStatus } from '@/lib/api/recruiter';
import { cx } from '@/components/admin/ui';

const TONE: Record<JobStatus, string> = {
    Open: 'bg-emerald-50 text-emerald-700 dark:bg-[#0B2E22] dark:text-emerald-300',
    Paused: 'bg-amber-50 text-amber-700 dark:bg-[#3A2A0B] dark:text-amber-300',
    Closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/** A job's status as a pill: Open green, Paused amber, Closed slate */
export default function JobStatusChip({ status, className }: { status?: string; className?: string }) {
    const t = useTranslations('recruiterJobs.status');
    const s = jobStatus(status);
    return (
        <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap', TONE[s], className)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {t(s)}
        </span>
    );
}
