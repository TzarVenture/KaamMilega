'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, BriefcaseIcon, CheckCircleIcon, LightningIcon, LockIcon, UserCheckIcon } from '@phosphor-icons/react';
import { fetchProfileCompletion, PROFILE_UPDATED_EVENT, type ProfileCompletion } from '@/lib/profileStrength';

interface CandidateProgressCardProps {
    userName?: string;
}

interface Milestone {
    threshold: number;
    title: string;
    description: string;
    icon: React.ReactNode;
}

// Milestones from docs/client_queries_deep_analysis.md §1.1
const MILESTONES: Milestone[] = [
    {
        threshold: 30,
        title: 'Basic',
        description: 'Browse local jobs, see wage benchmarks and chat with up to 3 people.',
        icon: <UserCheckIcon weight="bold" size={16} className="text-km-heading" />,
    },
    {
        threshold: 70,
        title: 'Professional',
        description: '1-click job applications and visibility in recruiter search.',
        icon: <BriefcaseIcon weight="bold" size={16} className="text-km-link" />,
    },
    {
        threshold: 100,
        title: 'Expert & Instant Milega',
        description: 'Take Instant Milega gigs. Expert status also needs 2+ years of experience.',
        icon: <LightningIcon weight="bold" size={16} className="text-[#FF6B00]" />,
    },
];

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

    const { score } = completion;
    const isFull = score >= 100;

    const statusFor = (m: Milestone) => {
        if (score < m.threshold) return { unlocked: false, label: `${m.threshold}% needed` };
        if (m.threshold === 100 && !completion.expert_eligible) return { unlocked: true, label: 'Gigs unlocked' };
        return { unlocked: true, label: 'Unlocked' };
    };

    return (
        <section aria-label="Profile strength" className="w-full bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6 shadow-xs font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-km-border">
                <div>
                    <p className="text-sm font-medium text-km-text-secondary">
                        Profile strength <span className="font-semibold text-[#FF6B00]">{score}%</span>
                    </p>
                    <h3 className="text-lg sm:text-xl font-semibold text-km-text-primary mt-0.5">
                        {userName ? `Welcome, ${userName}` : 'Your profile'}
                    </h3>
                </div>
                <Link
                    href="/profile"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-sm font-semibold shrink-0"
                >
                    <span>{isFull ? 'View profile' : 'Complete profile'}</span>
                    <ArrowRightIcon weight="bold" size={15} />
                </Link>
            </div>

            <div
                className="h-2 bg-km-surface border border-km-border rounded-full overflow-hidden mt-4 mb-5"
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div className="h-full bg-[#071A4D] rounded-full" style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MILESTONES.map((m) => {
                    const status = statusFor(m);
                    return (
                        <div
                            key={m.threshold}
                            className={`p-3.5 rounded-xl border ${status.unlocked ? 'border-emerald-200 bg-km-surface' : 'border-km-border bg-km-surface-card'}`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    {m.icon}
                                    <span className="text-sm font-semibold text-km-text-primary">{m.title}</span>
                                </div>
                                <span
                                    className={`inline-flex items-center gap-1 text-xs font-medium ${status.unlocked ? 'text-emerald-700' : 'text-km-text-secondary'}`}
                                >
                                    {status.unlocked ? <CheckCircleIcon weight="bold" size={12} /> : <LockIcon weight="bold" size={12} />}
                                    {status.label}
                                </span>
                            </div>
                            <p className="text-xs text-km-text-secondary leading-relaxed">{m.description}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
