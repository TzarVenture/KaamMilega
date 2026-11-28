'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BookmarkSimpleIcon, BriefcaseIcon, ChatCircleTextIcon, CheckCircleIcon, DownloadSimpleIcon, MapPinIcon, SealCheckIcon, UserIcon } from '@phosphor-icons/react';
import { btn, cx } from '@/components/admin/ui';
import UserAvatar from '@/components/ui/UserAvatar';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { openFile } from '@/lib/upload';
import type { TalentCard } from '@/lib/api/recruiter';

const MAX_SKILLS = 5;

type Props = {
    person: TalentCard;
    /** Whether the employer saved this person; leave out onToggleSave to hide the button */
    saved?: boolean;
    onToggleSave?: (person: TalentCard) => void;
};

export default function TalentCardItem({ person, saved, onToggleSave }: Props) {
    const t = useTranslations('recruiterTalent');
    const [downloading, setDownloading] = useState(false);
    const name = person.name || t('member');
    const firstName = name.split(/\s+/)[0];
    const role = person.current_title
        ? (person.current_company ? t('titleAt', { title: person.current_title, company: person.current_company }) : person.current_title)
        : person.headline;
    const skills = person.skills || [];
    const extra = skills.length - MAX_SKILLS;
    const invite = t('inviteMessage', { name: firstName });

    const downloadResume = async () => {
        setDownloading(true);
        try {
            const res = await api.post<unknown, { resume?: { url?: string } }>(`/recruiter/candidates/${person.id}/resume`);
            const url = res?.resume?.url;
            if (!url) throw new Error('no resume');
            await openFile(url);
        } catch (err) {
            notify.error(err, t('resumeFailed'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <li className="flex flex-col rounded-2xl border border-km-border bg-km-surface-card p-5">
            <div className="flex items-start gap-3">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-km-border">
                    <UserAvatar src={person.profile_image} name={name} sizeClass="w-full h-full" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                        <Link href={`/profile/${person.id}`} className="truncate text-base font-semibold text-km-heading hover:text-km-link">{name}</Link>
                        {person.verified && (
                            <SealCheckIcon size={18} weight="fill" className="shrink-0 text-[#0B5ED7]" aria-label={t('verified')} />
                        )}
                    </p>
                    {role && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-km-text-secondary">
                            <BriefcaseIcon size={14} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{role}</span>
                        </p>
                    )}
                    {person.city && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-km-text-secondary">
                            <MapPinIcon size={14} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{person.city}</span>
                        </p>
                    )}
                </div>
                {onToggleSave && (
                    <button
                        type="button"
                        onClick={() => onToggleSave(person)}
                        aria-pressed={!!saved}
                        aria-label={saved ? t('unsaveLabel', { name }) : t('saveLabel', { name })}
                        title={saved ? t('unsave') : t('save')}
                        className={cx(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                            saved
                                ? 'border-[#0B5ED7] bg-[#F4F7FB] text-[#0B5ED7] dark:border-[#93C5FD] dark:bg-[#0B1F52] dark:text-[#93C5FD]'
                                : 'border-km-border text-km-text-secondary hover:text-km-heading',
                        )}
                    >
                        <BookmarkSimpleIcon size={18} weight={saved ? 'fill' : 'regular'} aria-hidden="true" />
                    </button>
                )}
            </div>

            {person.open_to_work && (
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-[#0B2E22] dark:text-emerald-300">
                        <CheckCircleIcon size={14} weight="bold" aria-hidden="true" />
                        {t('openToWork')}
                    </span>
                    {person.wanted_roles && person.wanted_roles.length > 0 && (
                        <span className="min-w-0 text-km-text-secondary">{person.wanted_roles.slice(0, 3).join(', ')}</span>
                    )}
                </p>
            )}

            {skills.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('skills')}>
                    {skills.slice(0, MAX_SKILLS).map((s) => (
                        <li key={s} className="rounded-md bg-km-surface px-2 py-0.5 text-xs font-medium text-km-text-primary border border-km-border-subtle">{s}</li>
                    ))}
                    {extra > 0 && <li className="px-1 py-0.5 text-xs text-km-text-secondary">{t('moreSkills', { count: extra })}</li>}
                </ul>
            )}

            <div className="mt-auto pt-4">
                <div className="flex flex-wrap gap-2">
                    <Link href={`/profile/${person.id}`} className={cx(btn.secondary, 'h-9 px-3')}>
                        <UserIcon size={16} aria-hidden="true" />
                        {t('viewProfile')}
                    </Link>
                    <Link href={`/chat?userId=${encodeURIComponent(person.id)}&text=${encodeURIComponent(invite)}`} className={cx(btn.primary, 'h-9 px-3')}>
                        <ChatCircleTextIcon size={16} aria-hidden="true" />
                        {t('message')}
                    </Link>
                    {person.resume_shared && (
                        <button type="button" onClick={downloadResume} disabled={downloading} title={t('resumeHint')} className={cx(btn.secondary, 'h-9 px-3')}>
                            <DownloadSimpleIcon size={16} aria-hidden="true" />
                            {downloading ? t('downloading') : t('resume')}
                        </button>
                    )}
                </div>
                {person.resume_shared && <p className="mt-2 text-xs text-km-text-secondary">{t('resumeHint')}</p>}
            </div>
        </li>
    );
}
