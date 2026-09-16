'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export type ProfileModalKey =
    | 'education'
    | 'experience'
    | 'skill'
    | 'intro'
    | 'about'
    | 'photo'
    | 'background'
    | 'contact'
    | 'emailVerify';

interface ProfileStrengthCardProps {
    user: any;
    onOpenModal: (modalKey: ProfileModalKey) => void;
}

interface CriteriaItem {
    id: string;
    title: string;
    weight: number;
    modalKey: ProfileModalKey;
    isCompleted: boolean;
    missingHint: string;
}

export default function ProfileStrengthCard({ user, onOpenModal }: ProfileStrengthCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // ─── Evaluate Completeness Criteria ─────────────────────────
    const criteria: CriteriaItem[] = useMemo(() => {
        if (!user) return [];

        const hasExperience = Array.isArray(user.experience) && user.experience.length > 0;
        const hasPhoto = Boolean(user.profile_image && typeof user.profile_image === 'string' && user.profile_image.trim().length > 0);
        const hasEducation = Array.isArray(user.education) && user.education.length > 0;
        const hasSkills = Array.isArray(user.skills) && user.skills.length >= 3;
        const hasAbout = Boolean(user.about && typeof user.about === 'string' && user.about.trim().length >= 15);
        const hasHeadlineAndLocation = Boolean(
            (user.headline || user.designation) && (user.city || user.state || user.location)
        );
        const hasEmailVerified = Boolean(user.is_email_verified);

        return [
            {
                id: 'experience',
                title: 'Work Experience',
                weight: 20,
                modalKey: 'experience',
                isCompleted: hasExperience,
                missingHint: 'Add your past or current roles to highlight your career',
            },
            {
                id: 'photo',
                title: 'Profile Photo',
                weight: 15,
                modalKey: 'photo',
                isCompleted: hasPhoto,
                missingHint: 'Upload a clear profile picture to be easily recognized',
            },
            {
                id: 'education',
                title: 'Education',
                weight: 15,
                modalKey: 'education',
                isCompleted: hasEducation,
                missingHint: 'Add your degree, college or certifications',
            },
            {
                id: 'skills',
                title: 'Skills (3+)',
                weight: 15,
                modalKey: 'skill',
                isCompleted: hasSkills,
                missingHint: `Add at least 3 skills (current: ${user.skills?.length || 0})`,
            },
            {
                id: 'about',
                title: 'About Summary',
                weight: 15,
                modalKey: 'about',
                isCompleted: hasAbout,
                missingHint: 'Write a brief professional summary of your background',
            },
            {
                id: 'intro',
                title: 'Headline & Location',
                weight: 10,
                modalKey: 'intro',
                isCompleted: hasHeadlineAndLocation,
                missingHint: 'Specify your job title/designation and city',
            },
            {
                id: 'emailVerify',
                title: 'Email Verification',
                weight: 10,
                modalKey: 'emailVerify',
                isCompleted: hasEmailVerified,
                missingHint: 'Verify your registered email for direct recruiter messages',
            },
        ];
    }, [user]);

    // ─── Calculate Total Score ──────────────────────────────────
    const score = useMemo(() => {
        return criteria.reduce((acc, item) => (item.isCompleted ? acc + item.weight : acc), 0);
    }, [criteria]);

    const pendingItems = useMemo(() => {
        return criteria.filter((item) => !item.isCompleted);
    }, [criteria]);

    const completedItems = useMemo(() => {
        return criteria.filter((item) => item.isCompleted);
    }, [criteria]);

    if (!user) return null;

    const isFullyComplete = score === 100;

    return (
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 shadow-sm transition-all duration-300">
            {/* Header: Title, Description & Percentage */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                            Profile Completeness
                        </h2>
                        {isFullyComplete && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                100% Complete
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {isFullyComplete
                            ? 'All essential details added. Your profile has optimal visibility in recruiter searches.'
                            : 'Complete the recommended sections below to help recruiters discover and evaluate your profile.'}
                    </p>
                </div>

                {/* Score Number Display */}
                <div className="flex items-baseline sm:items-center gap-1.5 shrink-0">
                    <span className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
                        {score}%
                    </span>
                    <span className="text-xs font-semibold text-gray-400">completed</span>
                </div>
            </div>

            {/* Visual Animated Progress Bar Track */}
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-3.5 mb-4 shadow-inner">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isFullyComplete
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600'
                    }`}
                    style={{ width: `${Math.max(score, 4)}%` }}
                />
            </div>

            {/* Action Items (Incomplete Steps) */}
            {!isFullyComplete && pendingItems.length > 0 && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Suggested steps to reach 100%:
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-[11px] font-bold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            {isExpanded ? (
                                <>
                                    Hide Details <ChevronUp size={13} />
                                </>
                            ) : (
                                <>
                                    View All Checklist ({completedItems.length}/{criteria.length}) <ChevronDown size={13} />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Quick Action Chips */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        {pendingItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onOpenModal(item.modalKey)}
                                className="group inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 hover:border-purple-300 rounded-xl text-xs font-bold text-purple-900 transition-all duration-200 shadow-xs hover:shadow cursor-pointer active:scale-98"
                            >
                                <span>Add {item.title}</span>
                                <Plus size={14} className="text-purple-500 group-hover:text-purple-700 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 100% Celebration Banner */}
            {isFullyComplete && (
                <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <div>
                        <p className="font-bold text-emerald-900">Your profile is 100% complete!</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                            Recruiters are 3x more likely to view and shortlist candidates with full profiles.
                        </p>
                    </div>
                </div>
            )}

            {/* Expandable Full Checklist */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
                    <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                        Completeness Breakdown:
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                        {criteria.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => !item.isCompleted && onOpenModal(item.modalKey)}
                                className={`flex items-center sm:items-start gap-1.5 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl border transition-all ${
                                    item.isCompleted
                                        ? 'bg-gray-50/70 border-gray-200 text-gray-700'
                                        : 'bg-purple-50/40 border-purple-100 text-purple-950 hover:bg-purple-50 hover:border-purple-200 cursor-pointer'
                                }`}
                            >
                                {item.isCompleted ? (
                                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                ) : (
                                    <AlertCircle size={15} className="text-amber-500 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <p
                                            title={item.title}
                                            className="text-[11px] sm:text-xs font-bold leading-none truncate"
                                        >
                                            {item.title}
                                        </p>
                                        <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-tight ${
                                            item.isCompleted
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {item.isCompleted ? 'Completed' : 'Pending'}
                                        </span>
                                    </div>
                                    {/* Description: removed from mobile only */}
                                    <p className="hidden sm:block text-[11px] text-gray-500 mt-1 line-clamp-1">
                                        {item.isCompleted ? 'Completed' : item.missingHint}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
