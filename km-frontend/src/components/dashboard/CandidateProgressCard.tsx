'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, BriefcaseIcon, CheckCircleIcon, LightningIcon, LockIcon, PlusIcon, UserCheckIcon } from '@phosphor-icons/react';
import { CRITERION_META, fetchProfileCompletion, PROFILE_UPDATED_EVENT, type ProfileCompletion } from '@/lib/profileStrength';
import { useInViewOnce } from '@/lib/useInViewOnce';
import ProfileProgressArt from '@/components/home/illustrations/ProfileProgressArt';

interface CandidateProgressCardProps {
    userName?: string;
}

interface Milestone {
    threshold: number;
    /** profileProgress.<key>.title / .text in the messages */
    key: 'basic' | 'professional' | 'expert';
    icon: React.ReactNode;
}

// Milestones from docs/client_queries_deep_analysis.md §1.1
const MILESTONES: Milestone[] = [
    { threshold: 30, key: 'basic', icon: <UserCheckIcon weight="bold" size={16} className="text-km-heading" /> },
    { threshold: 70, key: 'professional', icon: <BriefcaseIcon weight="bold" size={16} className="text-km-link" /> },
    { threshold: 100, key: 'expert', icon: <LightningIcon weight="bold" size={16} className="text-[#FF6B00]" /> },
];

// Orange running into white: solid brand orange at the leading edge, no glow
const BAR_FILL = 'linear-gradient(90deg, #FFE7D3 0%, #FFB36E 45%, #FF6B00 100%)';
const MAX_NEXT_STEPS = 3;

export default function CandidateProgressCard({ userName }: CandidateProgressCardProps) {
    const [completion, setCompletion] = useState<ProfileCompletion | null>(null);

    useEffect(() => {
        let isMounted = true;
        const load = () => {
            fetchProfileCompletion()
                .then((res) => {
                    if (isMounted && typeof res?.score === 'number') setCompletion(res);
                })
                .catch(() => {});
        };

        load();
        window.addEventListener(PROFILE_UPDATED_EVENT, load);
        return () => {
            isMounted = false;
            window.removeEventListener(PROFILE_UPDATED_EVENT, load);
        };
    }, []);

    // Render nothing until the backend score is known, so the card never shows a guessed number
    if (!completion) return null;
    return <ProgressCardView completion={completion} userName={userName} />;
}

/** Presentational card for a known completion result (kept separate from data loading) */
export function ProgressCardView({ completion, userName }: { completion: ProfileCompletion; userName?: string }) {
    const t = useTranslations('profileProgress');
    const tc = useTranslations('profileCriteria');
    const { ref: artRef, inView: artInView } = useInViewOnce<HTMLDivElement>(0.3);
    const score = Math.max(0, Math.min(100, completion.score));
    const isFull = score >= 100;
    const next = MILESTONES.find((m) => score < m.threshold);

    const headline = isFull
        ? completion.expert_eligible
            ? t('completeExpert')
            : t('completeNeedsExperience')
        : next
            ? t('toUnlock', { n: String(next.threshold - score), milestone: t(`${next.key}.title`) })
            : t('keepUpdated');

    // Biggest remaining gains first
    const nextSteps = completion.criteria
        .filter((c) => !c.completed && CRITERION_META[c.id])
        .map((c) => ({ id: c.id, gain: Math.max(0, c.weight - c.earned), title: tc(`${c.id}.hint`) }))
        .sort((a, b) => b.gain - a.gain)
        .slice(0, MAX_NEXT_STEPS);

    const statusFor = (m: Milestone) => {
        if (score < m.threshold) return { unlocked: false, label: t('needed', { n: String(m.threshold) }) };
        if (m.threshold === 100 && !completion.expert_eligible) return { unlocked: true, label: t('gigsUnlocked') };
        return { unlocked: true, label: t('unlocked') };
    };

    return (
        <section aria-label={t('label')} className="w-full bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6 shadow-xs font-sans">
            {/* Header: illustration, greeting, next milestone, action */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div ref={artRef} data-inview={artInView} className="hidden sm:block shrink-0">
                    <ProfileProgressArt className="h-20 w-auto -ml-2" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-km-text-secondary">
                        {t.rich('strength', {
                            score: (chunks) => <span className="font-semibold text-[#FF6B00]">{chunks}</span>,
                            value: String(score),
                        })}
                    </p>
                    <h3 className="text-lg sm:text-xl font-semibold text-km-text-primary mt-0.5 truncate">
                        {userName ? t('welcome', { name: userName }) : t('yourProfile')}
                    </h3>
                    <p className="text-sm text-km-text-secondary mt-1">{headline}</p>
                </div>
                <Link
                    href="/profile"
                    className="inline-flex items-center justify-center gap-2 px-5 h-11 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-sm font-semibold shrink-0 dark:bg-km-primary dark:hover:bg-km-primary-dark"
                >
                    <span>{isFull ? t('viewProfile') : t('completeProfile')}</span>
                    <ArrowRightIcon weight="bold" size={15} />
                </Link>
            </div>

            {/* Progress bar with milestone markers */}
            <div className="mt-5">
                <div
                    className="relative h-2.5 rounded-full bg-[#E3E9F1] dark:bg-white/10 overflow-hidden"
                    role="progressbar"
                    aria-label={t('completion')}
                    aria-valuenow={score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.max(4, score)}%`, backgroundImage: BAR_FILL }}
                    />
                    {/* Segment gaps at the 30% and 70% milestones */}
                    {MILESTONES.filter((m) => m.threshold < 100).map((m) => (
                        <span
                            key={m.threshold}
                            className="absolute inset-y-0 w-0.5 bg-km-surface-card"
                            style={{ left: `${m.threshold}%` }}
                            aria-hidden="true"
                        />
                    ))}
                </div>
                <div className="relative h-5 mt-1.5 text-xs" aria-hidden="true">
                    {MILESTONES.map((m) => {
                        const reached = score >= m.threshold;
                        const last = m.threshold === 100;
                        return (
                            <span
                                key={m.threshold}
                                className={`absolute top-0 whitespace-nowrap font-medium ${reached ? 'text-km-text-primary' : 'text-km-text-secondary'} ${last ? 'right-0' : '-translate-x-1/2'}`}
                                style={last ? undefined : { left: `${m.threshold}%` }}
                            >
                                {t('marker', { title: m.key === 'expert' ? t('expert.short') : t(`${m.key}.title`), n: String(m.threshold) })}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Quick wins: the biggest missing items */}
            {nextSteps.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-km-text-secondary mr-1">{t('nextSteps')}</span>
                    {nextSteps.map((s) => (
                        <Link
                            key={s.id}
                            href="/profile"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-km-border bg-km-surface text-xs font-medium text-km-text-primary hover:border-[#FF6B00]/50 hover:text-[#FF6B00] transition-colors"
                        >
                            <PlusIcon weight="bold" size={12} aria-hidden="true" />
                            {s.title}
                            {s.gain > 0 && <span className="font-semibold text-[#FF6B00]">+{s.gain}%</span>}
                        </Link>
                    ))}
                </div>
            )}

            {/* What each milestone unlocks */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                {MILESTONES.map((m) => {
                    const status = statusFor(m);
                    return (
                        <div
                            key={m.threshold}
                            className={`p-3.5 rounded-xl border ${status.unlocked ? 'border-emerald-200 bg-km-surface' : 'border-km-border bg-km-surface-card'}`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    {m.icon}
                                    <span className="text-sm font-semibold text-km-text-primary truncate">{t(`${m.key}.title`)}</span>
                                </div>
                                <span
                                    className={`inline-flex items-center gap-1 text-xs font-medium shrink-0 ${status.unlocked ? 'text-emerald-700' : 'text-km-text-secondary'}`}
                                >
                                    {status.unlocked ? <CheckCircleIcon weight="bold" size={12} /> : <LockIcon weight="bold" size={12} />}
                                    {status.label}
                                </span>
                            </div>
                            <p className="text-xs text-km-text-secondary leading-relaxed">{t(`${m.key}.text`)}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
