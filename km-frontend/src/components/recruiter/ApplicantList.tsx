'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { StarIcon } from '@phosphor-icons/react';
import { cx, LogoTile } from '@/components/admin/ui';
import { STAGE_COLOR, type Applicant, type AppStatus } from '@/lib/api/recruiter';

export function StageChip({ stage }: { stage: AppStatus }) {
    const t = useTranslations('recruiterApplicants');
    const c = STAGE_COLOR[stage] ?? STAGE_COLOR.Applied;
    return (
        <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap', c.chip)}>
            <span className={cx('w-1.5 h-1.5 rounded-full', c.dot)} aria-hidden="true" />
            {t(`stage.${stage}`)}
        </span>
    );
}

export function SmallStars({ value }: { value: number }) {
    const t = useTranslations('recruiterApplicants');
    if (!value) return null;
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={t('list.ratingAria', { value })}>
            {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} size={12} weight={n <= value ? 'fill' : 'regular'} className={n <= value ? 'text-amber-500' : 'text-km-text-muted'} aria-hidden="true" />
            ))}
        </span>
    );
}

export default function ApplicantList({ items, selectedId, checked, now, showJob, onOpen, onToggle, onToggleAll }: {
    items: Applicant[];
    selectedId: string | null;
    checked: Set<string>;
    now: number;
    showJob: boolean;
    onOpen: (id: string) => void;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
}) {
    const t = useTranslations('recruiterApplicants');
    const format = useFormatter();
    const allChecked = items.length > 0 && items.every((a) => checked.has(a.id));
    const someChecked = !allChecked && items.some((a) => checked.has(a.id));

    return (
        <div>
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-km-border bg-km-surface text-xs font-semibold text-km-text-secondary">
                <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={onToggleAll}
                    aria-label={t('list.selectAll')}
                    className="w-4 h-4 accent-km-accent cursor-pointer"
                />
                <span>{t('list.selectAll')}</span>
            </div>
            <ul className="divide-y divide-km-border-subtle">
                {items.map((a) => {
                    const name = a.candidate?.name || t('list.unnamed');
                    const sub = a.candidate?.headline || a.candidate?.city || '';
                    const selected = a.id === selectedId;
                    return (
                        <li
                            key={a.id}
                            tabIndex={0}
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => onOpen(a.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onOpen(a.id); } }}
                            className={cx(
                                'flex items-start gap-3 px-4 py-3 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-km-blue',
                                selected ? 'bg-blue-50 dark:bg-[#131D3D] border-l-2 border-l-[#0B5ED7]' : 'hover:bg-km-surface border-l-2 border-l-transparent',
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={checked.has(a.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => onToggle(a.id)}
                                aria-label={t('list.selectOne', { name })}
                                className="mt-2.5 w-4 h-4 accent-km-accent cursor-pointer shrink-0"
                            />
                            <LogoTile src={a.candidate?.profile_image} name={name} rounded="rounded-full" size="w-10 h-10" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-sm text-km-heading truncate">{name}</p>
                                    <span className="text-xs text-km-text-secondary shrink-0 whitespace-nowrap">
                                        {now ? format.relativeTime(new Date(a.created_at), now) : ''}
                                    </span>
                                </div>
                                {sub && <p className="text-xs text-km-text-secondary truncate">{sub}</p>}
                                {showJob && a.job?.title && <p className="text-xs text-km-text-secondary truncate mt-0.5">{t('list.forJob', { job: a.job.title })}</p>}
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <StageChip stage={a.status} />
                                    <SmallStars value={a.rating || 0} />
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
