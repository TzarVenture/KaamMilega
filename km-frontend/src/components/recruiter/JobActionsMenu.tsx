'use client';

import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowCounterClockwiseIcon,
    CopyIcon,
    LockSimpleIcon,
    PauseIcon,
    PencilSimpleIcon,
    PlayIcon,
    TrashIcon,
    UsersThreeIcon,
} from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import { jobStatus, recruiterApi, type JobStatus, type MyJob } from '@/lib/api/recruiter';
import { AdminModal, MenuItem, RowMenu, btn } from '@/components/admin/ui';

export type JobAction = 'pause' | 'resume' | 'close' | 'reopen' | 'duplicate' | 'delete';

type Pending = { action: 'pause' | 'close' | 'delete' } | { action: 'plan' } | null;

/**
 * Status changes, duplicate and delete for one of the recruiter's jobs, with the confirm dialogs.
 * Returns `run(action)` and the dialog to render. Pause, Close and Delete ask first.
 */
export function useJobActions(job: MyJob | null, { onUpdated, onDeleted }: {
    onUpdated?: (job: MyJob) => void;
    onDeleted?: (id: string) => void;
}) {
    const t = useTranslations('recruiterJobs.actions');
    const router = useRouter();
    const [pending, setPending] = useState<Pending>(null);
    const [busy, setBusy] = useState(false);

    const setStatus = useCallback(async (status: JobStatus) => {
        if (!job) return;
        setBusy(true);
        try {
            const updated = await recruiterApi.setJobStatus(job.id, status);
            // Keep the counts we already have when the response leaves them out
            onUpdated?.({ ...job, ...(updated || {}), status: updated?.status || status, stage_counts: updated?.stage_counts ?? job.stage_counts, applicant_count: updated?.applicant_count ?? job.applicant_count });
            notify.success(t(`done.${status}`));
            setPending(null);
        } catch (err) {
            notify.error(err, t('statusFailed'));
        } finally {
            setBusy(false);
        }
    }, [job, onUpdated, t]);

    const duplicate = useCallback(async () => {
        if (!job) return;
        setBusy(true);
        try {
            const copy = await recruiterApi.duplicateJob(job.id);
            notify.success(t('duplicated'));
            if (copy?.id) router.push(`/recruiter/jobs/${copy.id}`);
        } catch (err) {
            if ((err as { code?: string })?.code === 'PLAN_JOB_POSTS_USED_UP') setPending({ action: 'plan' });
            else notify.error(err, t('duplicateFailed'));
        } finally {
            setBusy(false);
        }
    }, [job, router, t]);

    const remove = useCallback(async () => {
        if (!job) return;
        setBusy(true);
        try {
            await recruiterApi.deleteJob(job.id);
            notify.success(t('deleted'));
            setPending(null);
            onDeleted?.(job.id);
        } catch (err) {
            notify.error(err, t('deleteFailed'));
        } finally {
            setBusy(false);
        }
    }, [job, onDeleted, t]);

    const run = useCallback((action: JobAction) => {
        if (action === 'pause' || action === 'close' || action === 'delete') setPending({ action });
        else if (action === 'resume' || action === 'reopen') void setStatus('Open');
        else if (action === 'duplicate') void duplicate();
    }, [setStatus, duplicate]);

    const close = useCallback(() => { if (!busy) setPending(null); }, [busy]);

    let dialog: ReactNode = null;
    if (pending && job) {
        const a = pending.action;
        const confirm = a === 'pause' ? () => setStatus('Paused') : a === 'close' ? () => setStatus('Closed') : a === 'delete' ? remove : close;
        dialog = (
            <AdminModal isOpen onClose={close} title={t(`confirm.${a}.title`)}>
                <p className="text-sm text-km-text-secondary">
                    {a === 'plan' ? t('confirm.plan.body') : t(`confirm.${a}.body`, { title: job.title })}
                </p>
                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button type="button" onClick={close} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                    {a === 'plan' ? (
                        <Link href="/recruiter/plan" className={btn.accent}>{t('confirm.plan.cta')}</Link>
                    ) : (
                        <button type="button" onClick={() => void confirm()} disabled={busy} className={a === 'delete' || a === 'close' ? btn.danger : btn.primary}>
                            {busy ? t('working') : t(`confirm.${a}.cta`)}
                        </button>
                    )}
                </div>
            </AdminModal>
        );
    }

    return { run, dialog, busy };
}

/** The "more actions" dropdown on a job row or the job hub */
export default function JobActionsMenu({ job, onUpdated, onDeleted, showView = true, showEdit = true }: {
    job: MyJob;
    onUpdated?: (job: MyJob) => void;
    onDeleted?: (id: string) => void;
    showView?: boolean;
    showEdit?: boolean;
}) {
    const t = useTranslations('recruiterJobs.actions');
    const router = useRouter();
    const { run, dialog } = useJobActions(job, { onUpdated, onDeleted });
    const s = jobStatus(job.status);

    return (
        <>
            <RowMenu label={t('menuLabel', { title: job.title })}>
                {() => (
                    <>
                        {showView && <MenuItem icon={UsersThreeIcon} onClick={() => router.push(`/recruiter/applications?job_id=${job.id}`)}>{t('viewApplicants')}</MenuItem>}
                        {showEdit && <MenuItem icon={PencilSimpleIcon} onClick={() => router.push(`/recruiter/jobs/${job.id}/edit`)}>{t('edit')}</MenuItem>}
                        {s === 'Open' && <MenuItem icon={PauseIcon} onClick={() => run('pause')}>{t('pause')}</MenuItem>}
                        {s === 'Paused' && <MenuItem icon={PlayIcon} onClick={() => run('resume')}>{t('resume')}</MenuItem>}
                        {s !== 'Closed'
                            ? <MenuItem icon={LockSimpleIcon} onClick={() => run('close')}>{t('close')}</MenuItem>
                            : <MenuItem icon={ArrowCounterClockwiseIcon} onClick={() => run('reopen')}>{t('reopen')}</MenuItem>}
                        <MenuItem icon={CopyIcon} onClick={() => run('duplicate')}>{t('duplicate')}</MenuItem>
                        <MenuItem icon={TrashIcon} danger onClick={() => run('delete')}>{t('delete')}</MenuItem>
                    </>
                )}
            </RowMenu>
            {dialog}
        </>
    );
}
