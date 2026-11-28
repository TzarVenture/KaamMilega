'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import {
    ArrowLeftIcon, CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, ChatCircleIcon, EnvelopeSimpleIcon,
    FileTextIcon, LockSimpleIcon, MapPinIcon, PhoneIcon, StarIcon, UserIcon,
} from '@phosphor-icons/react';
import { btn, cx, field, LogoTile } from '@/components/admin/ui';
import { STAGES, STAGE_COLOR, recruiterApi, type Applicant, type Stage } from '@/lib/api/recruiter';
import { openFile } from '@/lib/upload';
import { notify } from '@/lib/notify';
import { StageChip } from './ApplicantList';

const TZ = 'Asia/Kolkata';

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
    return (
        <section className="px-5 py-4 border-t border-km-border-subtle">
            <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-km-heading">{title}</h3>
                {aside}
            </div>
            {children}
        </section>
    );
}

/** One applicant's details and actions. Remount (key) per applicant so local edits reset. */
export default function ApplicantPanel({ applicant: a, onBack, onPrev, onNext, onRequestMove, onSchedule, onPatch }: {
    applicant: Applicant;
    onBack: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onRequestMove: (stage: Stage) => void;
    onSchedule: () => void;
    onPatch: (id: string, patch: Partial<Applicant>) => void;
}) {
    const t = useTranslations('recruiterApplicants');
    const format = useFormatter();
    const name = a.candidate?.name || t('list.unnamed');
    const [note, setNote] = useState(a.note || '');
    const [savedNote, setSavedNote] = useState(a.note || '');
    const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle');

    const date = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
    const dateTime = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });

    const setRating = (value: number) => {
        const prev = a.rating || 0;
        if (value === prev) return;
        onPatch(a.id, { rating: value });
        recruiterApi.review(a.id, { rating: value }).catch((err) => {
            onPatch(a.id, { rating: prev });
            notify.error(err, t('panel.ratingError'));
        });
    };

    const saveNote = () => {
        if (note === savedNote || noteState === 'saving') return;
        const value = note;
        setNoteState('saving');
        recruiterApi.review(a.id, { note: value })
            .then(() => {
                setSavedNote(value);
                setNoteState('saved');
                onPatch(a.id, { note: value });
            })
            .catch((err) => {
                setNoteState('idle');
                notify.error(err, t('panel.noteError'));
            });
    };

    const openResume = () => {
        if (!a.resume_url) return;
        openFile(a.resume_url).catch((err) => notify.error(err, t('panel.resumeError')));
    };

    const created = new Date(a.created_at).getTime();
    const history = (a.history || [])
        .filter((h) => !(h.status === 'Applied' && Math.abs(new Date(h.at).getTime() - created) < 60_000))
        .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    const rating = a.rating || 0;
    const cid = a.candidate?.id || a.candidate_id;

    return (
        <div className="bg-km-surface-card lg:border lg:border-km-border lg:rounded-2xl min-h-full">
            {/* Top bar: back (phones) and previous/next */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-km-border-subtle">
                <button type="button" onClick={onBack} className={cx(btn.ghost, 'h-9 px-2 lg:hidden')}>
                    <ArrowLeftIcon size={18} aria-hidden="true" />{t('panel.back')}
                </button>
                <span className="hidden lg:block text-xs text-km-text-secondary px-2">{t('panel.title')}</span>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={onPrev} disabled={!onPrev} className={btn.icon} aria-label={t('panel.prev')}>
                        <CaretLeftIcon size={18} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={onNext} disabled={!onNext} className={btn.icon} aria-label={t('panel.next')}>
                        <CaretRightIcon size={18} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Header */}
            <div className="px-5 py-4 flex items-start gap-4">
                <LogoTile src={a.candidate?.profile_image} name={name} rounded="rounded-full" size="w-14 h-14" />
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-km-heading break-words">{name}</h2>
                    {a.candidate?.headline && <p className="text-sm text-km-text-secondary break-words">{a.candidate.headline}</p>}
                    {a.candidate?.city && (
                        <p className="text-sm text-km-text-secondary flex items-center gap-1 mt-0.5">
                            <MapPinIcon size={14} aria-hidden="true" />{a.candidate.city}
                        </p>
                    )}
                    <p className="text-xs text-km-text-secondary mt-1">
                        {t('panel.appliedFor', { job: a.job?.title || t('panel.unknownJob'), date: date(a.created_at) })}
                    </p>
                    <div className="mt-2"><StageChip stage={a.status} /></div>
                </div>
            </div>

            {/* Contact */}
            {(a.candidate?.email || a.candidate?.mobile) && (
                <div className="px-5 pb-3 flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1.5 text-sm">
                    {a.candidate?.email && (
                        <a href={`mailto:${a.candidate.email}`} className="text-km-link hover:underline inline-flex items-center gap-1.5 min-w-0 break-all">
                            <EnvelopeSimpleIcon size={16} className="shrink-0" aria-hidden="true" />{a.candidate.email}
                        </a>
                    )}
                    {a.candidate?.mobile && (
                        <a href={`tel:${a.candidate.mobile}`} className="text-km-link hover:underline inline-flex items-center gap-1.5">
                            <PhoneIcon size={16} className="shrink-0" aria-hidden="true" />{a.candidate.mobile}
                        </a>
                    )}
                </div>
            )}

            {a.status === 'Withdrawn' && (
                <p className="mx-5 mb-3 rounded-xl border border-km-border bg-km-surface px-4 py-3 text-sm text-km-text-secondary" role="status">
                    {t('panel.withdrawnNote')}
                </p>
            )}
            {/* Actions */}
            <div className="px-5 pb-4 flex flex-wrap gap-2">
                {a.status !== 'Withdrawn' && (<>
                <label className="sr-only" htmlFor={`move-${a.id}`}>{t('panel.moveTo')}</label>
                <select
                    id={`move-${a.id}`}
                    value=""
                    onChange={(e) => { if (e.target.value) onRequestMove(e.target.value as Stage); }}
                    className="h-10 px-3 rounded-xl border border-km-border bg-km-surface-card text-sm font-semibold text-km-heading cursor-pointer outline-none focus:border-km-blue"
                >
                    <option value="">{t('panel.moveTo')}</option>
                    {STAGES.map((s) => (
                        <option key={s} value={s} disabled={s === a.status}>{t(`stage.${s}`)}</option>
                    ))}
                </select>
                <button type="button" onClick={onSchedule} className={btn.accent}>
                    <CalendarBlankIcon size={18} aria-hidden="true" />{t('panel.schedule')}
                </button>
                </>)}
                <Link href={`/chat?userId=${cid}`} className={btn.secondary}>
                    <ChatCircleIcon size={18} aria-hidden="true" />{t('panel.message')}
                </Link>
                <Link href={`/profile/${cid}`} className={btn.secondary}>
                    <UserIcon size={18} aria-hidden="true" />{t('panel.profile')}
                </Link>
                {a.resume_url && (
                    <button type="button" onClick={openResume} className={btn.secondary}>
                        <FileTextIcon size={18} aria-hidden="true" />{t('panel.resume')}
                    </button>
                )}
            </div>

            <Section
                title={t('panel.rating')}
                aside={rating > 0 ? (
                    <button type="button" onClick={() => setRating(0)} className="text-xs text-km-link hover:underline cursor-pointer">{t('panel.clearRating')}</button>
                ) : undefined}
            >
                <div className="flex items-center gap-1" role="group" aria-label={t('panel.rating')}>
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            onClick={() => setRating(n)}
                            aria-label={t('panel.rateN', { n })}
                            aria-pressed={n <= rating}
                            className="p-1 rounded-md hover:bg-km-surface cursor-pointer"
                        >
                            <StarIcon size={22} weight={n <= rating ? 'fill' : 'regular'} className={n <= rating ? 'text-amber-500' : 'text-km-text-muted'} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            </Section>

            <Section title={t('panel.note')}>
                <p className="text-xs text-km-text-secondary flex items-center gap-1 mb-2">
                    <LockSimpleIcon size={14} aria-hidden="true" />{t('panel.notePrivate')}
                </p>
                <textarea
                    value={note}
                    onChange={(e) => { setNote(e.target.value); setNoteState('idle'); }}
                    onBlur={saveNote}
                    maxLength={2000}
                    rows={3}
                    placeholder={t('panel.notePlaceholder')}
                    className={field.textarea}
                    aria-label={t('panel.note')}
                />
                <div className="mt-2 flex items-center justify-end gap-3">
                    {noteState === 'saved' && note === savedNote && <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('panel.saved')}</span>}
                    <button type="button" onClick={saveNote} disabled={note === savedNote || noteState === 'saving'} className={cx(btn.secondary, 'h-9')}>
                        {noteState === 'saving' ? t('panel.saving') : t('panel.save')}
                    </button>
                </div>
            </Section>

            {a.cover_letter && (
                <Section title={t('panel.coverLetter')}>
                    <p className="text-sm text-km-text-primary whitespace-pre-line break-words">{a.cover_letter}</p>
                </Section>
            )}

            {!!a.candidate?.skills?.length && (
                <Section title={t('panel.skills')}>
                    <div className="flex flex-wrap gap-1.5">
                        {a.candidate.skills.map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded-md bg-km-surface border border-km-border text-xs text-km-text-primary">{s}</span>
                        ))}
                    </div>
                </Section>
            )}

            <Section title={t('panel.history')}>
                <ol className="space-y-3">
                    {history.map((h, i) => (
                        <li key={`${h.status}-${h.at}-${i}`} className="flex items-start gap-3">
                            <span className={cx('mt-1.5 w-2 h-2 rounded-full shrink-0', (STAGE_COLOR[h.status] ?? STAGE_COLOR.Applied).dot)} aria-hidden="true" />
                            <div>
                                <p className="text-sm text-km-heading">{t('panel.movedTo', { stage: t(`stage.${h.status}`) })}</p>
                                <p className="text-xs text-km-text-secondary">{dateTime(h.at)}</p>
                            </div>
                        </li>
                    ))}
                    <li className="flex items-start gap-3">
                        <span className={cx('mt-1.5 w-2 h-2 rounded-full shrink-0', STAGE_COLOR.Applied.dot)} aria-hidden="true" />
                        <div>
                            <p className="text-sm text-km-heading">{t('panel.applied')}</p>
                            <p className="text-xs text-km-text-secondary">{dateTime(a.created_at)}</p>
                        </div>
                    </li>
                </ol>
            </Section>
        </div>
    );
}
