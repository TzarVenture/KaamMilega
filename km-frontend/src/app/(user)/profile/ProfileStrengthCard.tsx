'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CaretDownIcon, CaretUpIcon, CheckCircleIcon, CircleDashedIcon, CircleIcon } from '@phosphor-icons/react';
import {
    CRITERION_META,
    fetchProfileCompletion,
    PROFILE_UPDATED_EVENT,
    type ProfileCompletion,
    type ProfileCriterion,
    type ProfileModalKey,
} from '@/lib/profileStrength';

export type { ProfileModalKey };

interface ProfileStrengthCardProps {
    // Any change to the profile object triggers a fresh score from the backend
    user: object | null | undefined;
    onOpenModal: (modalKey: ProfileModalKey) => void;
}

// Levels from docs/client_queries_deep_analysis.md §1.1
const MILESTONES = [
    { score: 30, name: 'Basic', unlocks: 'get found for local jobs and chat with up to 3 people' },
    { score: 70, name: 'Professional', unlocks: '1-click apply and appear in recruiter search' },
    { score: 100, name: 'Complete', unlocks: 'take Instant Milega gigs and apply as an Expert' },
];

const remaining = (c: ProfileCriterion) => c.weight - c.earned;

export default function ProfileStrengthCard({ user, onOpenModal }: ProfileStrengthCardProps) {
    const [showCompleted, setShowCompleted] = useState(false);
    const [completion, setCompletion] = useState<ProfileCompletion | null>(null);

    useEffect(() => {
        if (!user) return;
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
    }, [user]);

    if (!user || !completion) return null;

    const { score, criteria = [] } = completion;
    const known = criteria.filter((c) => CRITERION_META[c.id]);
    // Biggest gains first, so the top of the list is always the quickest way up
    const pending = known.filter((c) => !c.completed).sort((a, b) => remaining(b) - remaining(a));
    const completed = known.filter((c) => c.completed);
    const nextMilestone = MILESTONES.find((m) => score < m.score);

    // Fewest items (largest gains first) that reach the next level
    let stepsToNext = 0;
    if (nextMilestone) {
        let projected = score;
        for (const c of pending) {
            if (projected >= nextMilestone.score) break;
            projected += remaining(c);
            stepsToNext += 1;
        }
    }

    return (
        <section aria-labelledby="profile-strength-title" className="bg-km-surface-card rounded-2xl p-5 sm:p-6 border border-km-border shadow-xs font-sans">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 id="profile-strength-title" className="text-base sm:text-lg font-semibold text-km-text-primary">
                        {score >= 100 ? 'Your profile is complete' : 'Complete your profile'}
                    </h2>
                    <p className="text-sm text-km-text-secondary mt-1">
                        {nextMilestone ? (
                            <>
                                Add {stepsToNext} more {stepsToNext === 1 ? 'detail' : 'details'} to reach{' '}
                                <span className="font-semibold text-km-text-primary">
                                    {nextMilestone.name} ({nextMilestone.score}%)
                                </span>{' '}
                                and {nextMilestone.unlocks}.
                            </>
                        ) : completion.expert_eligible ? (
                            <>
                                You can take Instant Milega gigs and{' '}
                                <Link href="/expert/apply" className="font-semibold text-km-link hover:underline">
                                    apply as an Expert
                                </Link>
                                .
                            </>
                        ) : (
                            'You can take Instant Milega gigs. Expert status needs at least 2 years of work experience.'
                        )}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-2xl sm:text-3xl font-bold text-km-heading leading-none">{score}%</p>
                    <p className="text-xs font-medium text-km-text-secondary mt-1">{completion.tier_name}</p>
                </div>
            </div>

            {/* Progress bar with level markers */}
            <div className="mt-5">
                <div
                    className="relative h-2 bg-km-surface border border-km-border rounded-full"
                    role="progressbar"
                    aria-valuenow={score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Profile completeness"
                >
                    <div className="h-full rounded-full bg-[#071A4D]" style={{ width: `${Math.max(score, 3)}%` }} />
                    {MILESTONES.slice(0, 2).map((m) => (
                        <span
                            key={m.score}
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                score >= m.score ? 'bg-[#071A4D]' : 'bg-[#D9E0EA]'
                            }`}
                            style={{ left: `${m.score}%` }}
                        />
                    ))}
                </div>
                <div className="relative h-4 mt-1.5 text-xs text-km-text-secondary">
                    {MILESTONES.map((m) => (
                        <span
                            key={m.score}
                            className={`absolute ${m.score === 100 ? 'right-0' : '-translate-x-1/2'} ${
                                score >= m.score ? 'font-semibold text-km-heading' : ''
                            }`}
                            style={m.score === 100 ? undefined : { left: `${m.score}%` }}
                        >
                            {m.name}
                        </span>
                    ))}
                </div>
            </div>

            {/* What is left */}
            {pending.length > 0 && (
                <ul className="mt-5 divide-y divide-km-border border border-km-border rounded-xl">
                    {pending.map((item) => {
                        const meta = CRITERION_META[item.id];
                        const partial = item.earned > 0;
                        return (
                            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                                {partial ? (
                                    <CircleDashedIcon weight="bold" size={18} className="text-[#FF6B00] shrink-0" aria-label="Partly done" />
                                ) : (
                                    <CircleIcon weight="bold" size={18} className="text-[#D9E0EA] shrink-0" aria-hidden="true" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-km-text-primary">{meta.title}</p>
                                    <p className="text-xs text-km-text-secondary mt-0.5">{meta.hint}</p>
                                </div>
                                <span className="text-xs font-semibold text-[#16A34A] shrink-0">+{remaining(item)}%</span>
                                {meta.modalKey && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenModal(meta.modalKey as ProfileModalKey)}
                                        className="shrink-0 px-3 py-1.5 rounded-lg border border-km-border text-xs font-semibold text-km-heading hover:bg-km-surface cursor-pointer"
                                    >
                                        {partial ? 'Finish' : 'Add'}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Done items, collapsed */}
            {completed.length > 0 && (
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={() => setShowCompleted(!showCompleted)}
                        aria-expanded={showCompleted}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-km-text-secondary hover:text-km-heading cursor-pointer"
                    >
                        {showCompleted ? 'Hide' : 'Show'} {completed.length} completed
                        {showCompleted ? <CaretUpIcon weight="bold" size={14} /> : <CaretDownIcon weight="bold" size={14} />}
                    </button>
                    {showCompleted && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                            {completed.map((item) => (
                                <li
                                    key={item.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-km-surface text-xs font-medium text-km-text-primary"
                                >
                                    <CheckCircleIcon weight="bold" size={13} className="text-[#16A34A]" />
                                    {CRITERION_META[item.id].title}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}
