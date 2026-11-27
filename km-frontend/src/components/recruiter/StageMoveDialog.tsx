'use client';

import { useTranslations } from 'next-intl';
import { AdminModal, btn } from '@/components/admin/ui';
import type { Stage } from '@/lib/api/recruiter';

/** Asks before moving one or more applicants to a stage; every real move emails the candidate */
export default function StageMoveDialog({ stage, count, name, busy, onCancel, onConfirm }: {
    stage: Stage | null;
    count: number;
    /** The candidate's name when moving one applicant */
    name?: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const t = useTranslations('recruiterApplicants');
    if (!stage) return null;
    const stageLabel = t(`stage.${stage}`);
    const who = name || t('move.theseCandidates', { count });
    const strong = stage === 'Hired' || stage === 'Rejected';

    return (
        <AdminModal isOpen onClose={() => { if (!busy) onCancel(); }} title={t('move.title', { stage: stageLabel, count })}>
            <div className="space-y-3 text-sm text-km-text-secondary">
                {stage === 'Hired' && <p className="text-km-heading font-medium">{t('move.hiredBody', { who, count })}</p>}
                {stage === 'Rejected' && <p className="text-km-heading font-medium">{t('move.rejectedBody', { who, count })}</p>}
                {!strong && <p>{t('move.body', { who, stage: stageLabel, count })}</p>}
                <p>{t('move.emailNote', { count })}</p>
            </div>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={onCancel} disabled={busy} className={btn.secondary}>{t('move.cancel')}</button>
                <button type="button" onClick={onConfirm} disabled={busy} className={stage === 'Rejected' ? btn.danger : btn.accent}>
                    {busy ? t('move.working') : t('move.confirm', { stage: stageLabel })}
                </button>
            </div>
        </AdminModal>
    );
}
