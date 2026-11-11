'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRightIcon, BookmarkSimpleIcon, BriefcaseIcon, CheckCircleIcon, GraduationCapIcon, MapPinIcon, SealCheckIcon } from '@phosphor-icons/react';
import ChatWithHRButton from '@/components/jobs/ChatWithHRButton';
import { applicantText, salaryText } from '@/lib/jobFormat';

export interface JobCardJob {
    id: string;
    title: string;
    company: string;
    city_name: string;
    location: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    experience_min: number;
    education?: string;
    created_at: string;
    recruiter_id?: string;
    applicant_count?: number;
    employer_verified?: boolean;
    company_logo?: string;
}

/** Which filter a tag on the card applies when clicked */
export type JobTag =
    | { kind: 'jobType'; value: string }
    | { kind: 'experience'; value: string }
    | { kind: 'city'; value: string }
    | { kind: 'qualification'; value: string };

interface Props {
    job: JobCardJob;
    hasApplied?: boolean;
    isBookmarked?: boolean;
    onToggleBookmark?: (e: React.MouseEvent) => void;
    onTag: (tag: JobTag) => void;
    isTagActive: (tag: JobTag) => boolean;
    /** Qualifications the filter panel knows; other values show as plain text */
    qualifications: string[];
}

const DAY = 24 * 60 * 60 * 1000;

function postedText(createdAt: string, now: number) {
    const days = Math.floor((now - new Date(createdAt).getTime()) / DAY);
    if (Number.isNaN(days)) return '';
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    if (days < 30) return `Posted ${days} days ago`;
    return 'Posted 30+ days ago';
}

/** Experience filter bucket a job belongs to (matches the filter panel values) */
function experienceTag(min: number): { value: string; label: string } {
    if (!min) return { value: '0', label: 'Fresher' };
    if (min === 1) return { value: '1', label: '1+ yr exp' };
    return { value: min >= 5 ? '5' : '4', label: `${min}+ yrs exp` };
}

export default function JobCard({ job, hasApplied, isBookmarked, onToggleBookmark, onTag, isTagActive, qualifications }: Props) {
    const exp = experienceTag(job.experience_min);
    // Read the clock once per card, not on every render
    const [now] = useState(Date.now);
    const isNew = now - new Date(job.created_at).getTime() < 2 * DAY;
    const meta = [postedText(job.created_at, now), applicantText(job.applicant_count)].filter(Boolean);

    const tags: { tag: JobTag; label: string; Icon?: typeof MapPinIcon; hint: string }[] = [];
    if (job.job_type) tags.push({ tag: { kind: 'jobType', value: job.job_type }, label: job.job_type, hint: `Show ${job.job_type.toLowerCase()} jobs` });
    tags.push({ tag: { kind: 'experience', value: exp.value }, label: exp.label, Icon: BriefcaseIcon, hint: `Show jobs for ${exp.label.toLowerCase()}` });
    if (job.city_name) tags.push({ tag: { kind: 'city', value: job.city_name }, label: job.city_name, Icon: MapPinIcon, hint: `Show jobs in ${job.city_name}` });
    if (job.education && qualifications.includes(job.education)) {
        tags.push({ tag: { kind: 'qualification', value: job.education }, label: job.education, Icon: GraduationCapIcon, hint: `Show jobs for ${job.education}` });
    }

    return (
        <article className="relative bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 hover:border-km-link/40 transition-colors">
            <div className="flex items-start gap-3.5">
                {job.company_logo ? (
                    // Recruiter uploads come from our own storage; next/image would need every host configured
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.company_logo} alt="" className="w-12 h-12 rounded-xl object-cover border border-km-border shrink-0 bg-white" loading="lazy" />
                ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#071A4D] text-white font-bold text-lg flex items-center justify-center shrink-0 dark:bg-km-primary" aria-hidden="true">
                        {(job.company || 'C').charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-km-heading leading-snug line-clamp-2">
                                {/* The link stretches over the whole card; buttons and tags sit above it */}
                                <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-2xl hover:text-km-link">
                                    {job.title}
                                </Link>
                            </h3>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-km-text-secondary">
                                <span className="truncate">{job.company}</span>
                                {job.employer_verified && (
                                    <span className="inline-flex items-center gap-0.5 text-km-link font-medium" title="KaamMilega checked this employer's documents">
                                        <SealCheckIcon weight="fill" size={16} aria-hidden="true" />
                                        Verified
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onToggleBookmark}
                            aria-label={isBookmarked ? 'Remove from saved jobs' : 'Save job'}
                            aria-pressed={isBookmarked}
                            className={`relative z-10 -mr-1 -mt-1 p-2 rounded-lg cursor-pointer hover:bg-km-surface ${isBookmarked ? 'text-km-link' : 'text-km-text-secondary'}`}
                        >
                            <BookmarkSimpleIcon weight={isBookmarked ? 'fill' : 'regular'} size={20} />
                        </button>
                    </div>

                    <p className="mt-2.5 text-sm font-semibold text-km-heading">{salaryText(job.salary_min, job.salary_max)}</p>
                    {job.location && job.location !== job.city_name && (
                        <p className="mt-0.5 text-sm text-km-text-secondary truncate">{job.location}</p>
                    )}

                    <div className="relative z-10 mt-3 flex flex-wrap gap-2">
                        {tags.map(({ tag, label, Icon, hint }) => {
                            const active = isTagActive(tag);
                            return (
                                <button
                                    key={tag.kind}
                                    type="button"
                                    onClick={() => onTag(tag)}
                                    title={active ? 'Remove this filter' : hint}
                                    aria-pressed={active}
                                    className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                        active
                                            ? 'border-[#BFDBFE] bg-[#EBF3FE] text-km-link dark:bg-[#172A50] dark:border-blue-500/30'
                                            : 'border-km-border bg-km-surface text-km-text-secondary hover:border-km-link/50 hover:text-km-link'
                                    }`}
                                >
                                    {Icon && <Icon size={13} aria-hidden="true" />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-km-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-km-text-secondary flex flex-wrap items-center gap-x-2">
                    {isNew && <span className="font-semibold text-emerald-700 dark:text-emerald-400">New</span>}
                    {meta.map((m, i) => (
                        <span key={m}>{i > 0 && <span aria-hidden="true">· </span>}{m}</span>
                    ))}
                </p>

                <div className="relative z-10 flex items-center gap-2">
                    <ChatWithHRButton
                        recruiterId={job.recruiter_id}
                        jobTitle={job.title}
                        className="h-9 px-3.5 rounded-xl text-xs font-semibold border border-km-border bg-km-surface-card text-km-heading hover:bg-km-surface transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer flex-1 sm:flex-initial"
                    />
                    {hasApplied ? (
                        <Link
                            href="/applications"
                            className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap flex-1 sm:flex-initial dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                        >
                            <CheckCircleIcon weight="bold" size={14} />
                            Applied · Track
                        </Link>
                    ) : (
                        <Link
                            href={`/jobs/${job.id}`}
                            className="h-9 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center justify-center gap-1.5 whitespace-nowrap flex-1 sm:flex-initial"
                        >
                            View & apply
                            <ArrowUpRightIcon weight="bold" size={14} />
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
}
