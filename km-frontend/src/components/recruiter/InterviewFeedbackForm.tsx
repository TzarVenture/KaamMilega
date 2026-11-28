'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { LockSimpleIcon } from '@phosphor-icons/react';
import { btn, cx, field } from '@/components/admin/ui';
import { FEEDBACK_OUTCOMES, recruiterApi, type FeedbackOutcome, type Interview } from '@/lib/api/recruiter';
import { notify } from '@/lib/notify';

const NOTE_MAX = 500;

export const OUTCOME_CHIP: Record<FeedbackOutcome, string> = {
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#0B2E22] dark:text-emerald-300 dark:border-emerald-900',
    okay: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#14357F] dark:text-[#93C5FD] dark:border-blue-900',
    poor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-[#3A2A0B] dark:text-amber-300 dark:border-amber-900',
    no_show: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

/** Whether feedback can be given: the interview time has passed and it wasn't cancelled */
export function canGiveFeedback(iv: Interview, now: number) {
    return iv.status !== 'Cancelled' && new Date(iv.scheduled_at).getTime() <= now;
}

/** How an interview went: shows saved feedback, or lets the employer give it. Private to them. */
export default function InterviewFeedbackForm({ interview, onSaved, compact }: {
    interview: Interview;
    onSaved: (iv: Interview) => void;
    compact?: boolean;
}) {
    const t = useTranslations('recruiterFeedback');
    const format = useFormatter();
    const fb = interview.feedback;
    const [editing, setEditing] = useState(!fb);
    const [outcome, setOutcome] = useState<FeedbackOutcome | ''>(fb?.outcome || '');
    const [note, setNote] = useState(fb?.note || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!outcome || saving) return;
        setSaving(true);
        try {
            const saved = await recruiterApi.saveFeedback(interview.id, { outcome, note: note.trim() });
            onSaved({ ...interview, ...saved, status: 'Completed', feedback: saved?.feedback || { outcome, note: note.trim(), at: new Date().toISOString() } });
            setEditing(false);
            notify.success(t('saved'));
        } catch (err) {
            notify.error(err, t('saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (fb && !editing) {
        return (
            <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('px-2 py-0.5 rounded-md border text-xs font-semibold', OUTCOME_CHIP[fb.outcome])}>{t(`outcome.${fb.outcome}`)}</span>
                    <span className="text-xs text-km-text-secondary">{format.dateTime(new Date(fb.at), { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
                    <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-km-link hover:underline cursor-pointer">{t('edit')}</button>
                </div>
                {fb.note && <p className="text-sm text-km-text-primary whitespace-pre-line break-words">{fb.note}</p>}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {!compact && (
                <p className="text-xs text-km-text-secondary flex items-center gap-1">
                    <LockSimpleIcon size={14} aria-hidden="true" />{t('private')}
                </p>
            )}
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('howItWent')}>
                {FEEDBACK_OUTCOMES.map((o) => (
                    <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={outcome === o}
                        onClick={() => setOutcome(o)}
                        className={cx(
                            'h-8 px-3 rounded-full border text-sm font-medium cursor-pointer transition-colors',
                            outcome === o ? OUTCOME_CHIP[o] : 'border-km-border bg-km-surface-card text-km-text-secondary hover:text-km-heading',
                        )}
                    >
                        {t(`outcome.${o}`)}
                    </button>
                ))}
            </div>
            <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={NOTE_MAX}
                rows={2}
                placeholder={t('notePlaceholder')}
                aria-label={t('note')}
                className={field.textarea}
            />
            <div className="flex justify-end gap-2">
                {fb && <button type="button" onClick={() => { setEditing(false); setOutcome(fb.outcome); setNote(fb.note || ''); }} disabled={saving} className={cx(btn.secondary, 'h-9')}>{t('cancel')}</button>}
                <button type="button" onClick={save} disabled={!outcome || saving} className={cx(btn.primary, 'h-9')}>{saving ? t('saving') : t('save')}</button>
            </div>
        </div>
    );
}
