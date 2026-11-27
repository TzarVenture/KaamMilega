'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import {
    ArrowSquareOutIcon,
    ChatCircleTextIcon,
    CheckCircleIcon,
    MapPinIcon,
    PencilSimpleIcon,
    PhoneIcon,
    TrashIcon,
    VideoCameraIcon,
    XCircleIcon,
} from '@phosphor-icons/react';
import { btn, cx, StatusBadge } from '@/components/admin/ui';
import UserAvatar from '@/components/ui/UserAvatar';
import type { Interview } from '@/lib/api/recruiter';

const TZ = 'Asia/Kolkata';

/** A location that is a web address, so it can be opened as a meeting link */
export function meetingUrl(location?: string): string | null {
    const v = (location || '').trim();
    if (/^https?:\/\/\S+$/i.test(v)) return v;
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(v) || /^(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\S*$/i.test(v)) return `https://${v}`;
    return null;
}

function TypeGlyph({ type }: { type: string }) {
    const cls = "shrink-0 text-km-link";
    if (type === "Phone") return <PhoneIcon size={16} weight="duotone" className={cls} aria-hidden="true" />;
    if (type === "In-person") return <MapPinIcon size={16} weight="duotone" className={cls} aria-hidden="true" />;
    return <VideoCameraIcon size={16} weight="duotone" className={cls} aria-hidden="true" />;
}


export default function InterviewAgendaItem({ item, overdue, busy, onEdit, onComplete, onCancel, onDelete }: {
    item: Interview;
    overdue?: boolean;
    busy?: boolean;
    onEdit: () => void;
    onComplete: () => void;
    onCancel: () => void;
    onDelete: () => void;
}) {
    const t = useTranslations('recruiterInterviews');
    const format = useFormatter();
    const when = new Date(item.scheduled_at);
    const candidateId = item.candidate?.id || item.candidate_id;
    const name = item.candidate?.name || t('candidate');
    const link = meetingUrl(item.location);
    const scheduled = item.status === 'Scheduled';
    const typeLabel = item.type === 'Phone' ? t('typePhone') : item.type === 'In-person' ? t('typeInPerson') : t('typeVideo');

    return (
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex shrink-0 items-center gap-2 sm:w-24 sm:flex-col sm:items-start sm:gap-0.5">
                <span className={cx(
                    'inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-semibold font-inter tabular-nums',
                    overdue ? 'bg-[#F4F7FB] dark:bg-[#0B1F52] text-amber-700 dark:text-amber-300' : 'bg-[#F4F7FB] dark:bg-[#0B1F52] text-[#0B5ED7] dark:text-[#93C5FD]',
                )}>
                    {format.dateTime(when, { hour: 'numeric', minute: '2-digit', timeZone: TZ })}
                </span>
                {!scheduled || overdue ? (
                    <span className="text-xs text-km-text-secondary">{format.dateTime(when, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })}</span>
                ) : null}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-km-border">
                        <UserAvatar src={item.candidate?.profile_image} name={name} sizeClass="w-full h-full" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {candidateId ? (
                                <Link href={`/profile/${candidateId}`} className="truncate text-sm font-semibold text-km-heading hover:text-km-link">{name}</Link>
                            ) : (
                                <span className="truncate text-sm font-semibold text-km-heading">{name}</span>
                            )}
                            {item.status === 'Completed' && <StatusBadge tone="green">{t('statusCompleted')}</StatusBadge>}
                            {item.status === 'Cancelled' && <StatusBadge tone="neutral">{t('statusCancelled')}</StatusBadge>}
                            {overdue && <StatusBadge tone="amber">{t('statusNeedsUpdate')}</StatusBadge>}
                        </div>
                        {item.job?.title && <p className="mt-0.5 truncate text-sm text-km-text-secondary">{item.job.title}</p>}
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-km-text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                        <TypeGlyph type={item.type} />
                        {typeLabel}
                    </span>
                    {item.location && !link && <span className="min-w-0 break-words">{item.location}</span>}
                    {link && scheduled && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-km-primary px-3 text-xs font-semibold text-white hover:bg-km-primary-dark">
                            {t('join')}
                            <ArrowSquareOutIcon size={14} weight="bold" aria-hidden="true" />
                        </a>
                    )}
                    {link && !scheduled && <span className="min-w-0 truncate">{link}</span>}
                </div>
                {item.notes && <p className="mt-2 line-clamp-2 text-sm text-km-text-secondary">{item.notes}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                    {candidateId && (
                        <Link href={`/chat?userId=${encodeURIComponent(candidateId)}`} className={cx(btn.secondary, 'h-9 px-3')}>
                            <ChatCircleTextIcon size={16} aria-hidden="true" />
                            {t('message')}
                        </Link>
                    )}
                    {scheduled && (
                        <>
                            <button type="button" onClick={onEdit} disabled={busy} className={cx(btn.secondary, 'h-9 px-3')}>
                                <PencilSimpleIcon size={16} aria-hidden="true" />
                                {t('reschedule')}
                            </button>
                            <button type="button" onClick={onComplete} disabled={busy} className={cx(btn.secondary, 'h-9 px-3')}>
                                <CheckCircleIcon size={16} className="text-[#16A34A]" aria-hidden="true" />
                                {t('markCompleted')}
                            </button>
                            <button type="button" onClick={onCancel} disabled={busy} className={cx(btn.ghost, 'h-9 px-3 text-red-600 hover:text-red-700')}>
                                <XCircleIcon size={16} aria-hidden="true" />
                                {t('cancel')}
                            </button>
                        </>
                    )}
                    {!scheduled && (
                        <button type="button" onClick={onDelete} disabled={busy} className={cx(btn.ghost, 'h-9 px-3')}>
                            <TrashIcon size={16} aria-hidden="true" />
                            {t('delete')}
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}
