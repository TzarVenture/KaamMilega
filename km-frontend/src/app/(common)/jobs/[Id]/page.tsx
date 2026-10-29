'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, ArrowUpRightIcon, BookmarkSimpleIcon, BriefcaseIcon, CalendarBlankIcon, ChatCircleIcon, CheckCircleIcon, ClockIcon, CloudArrowUpIcon, FileTextIcon, MapPinIcon, MedalIcon, ShareNetworkIcon, ShieldCheckIcon, TrashIcon, UserPlusIcon, XIcon } from '@phosphor-icons/react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { uploadFile } from '@/lib/upload';
import { notify, errorText } from "@/lib/notify";
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { HERO_SHELL } from '@/components/km/PageHero';

interface Job {
    id: string;
    recruiter_id?: string;
    title: string;
    company: string;
    city_name: string;
    location: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    experience_min: number;
    experience_max: number;
    description: string;
    requirements: string[];
    we_offer: string[];
    status: string;
    created_at: string;
    vacancies: number;
    education?: string;
    gender?: string;
    applicant_count?: number;
}

// ─── Design.md Shimmer Skeleton Loader ───
const JobDetailSkeleton = () => (
    <div className="bg-km-surface min-h-screen font-sans pb-20">
        <div className={`${HERO_SHELL} pt-8 sm:pt-10 lg:pt-12 pb-8 sm:pb-10 lg:pb-12`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
                <div className="h-4 bg-white/10 rounded-md w-32 animate-shimmer" />
                <div className="h-8 bg-white/10 rounded-lg w-2/3 animate-shimmer" />
                <div className="h-4 bg-white/10 rounded-md w-1/3 animate-shimmer" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                    <div className="h-16 bg-white/10 rounded-xl animate-shimmer" />
                    <div className="h-16 bg-white/10 rounded-xl animate-shimmer" />
                    <div className="h-16 bg-white/10 rounded-xl animate-shimmer" />
                    <div className="h-16 bg-white/10 rounded-xl animate-shimmer" />
                </div>
            </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
                <div className="h-48 bg-km-surface-card rounded-2xl border border-km-border animate-shimmer" />
                <div className="h-64 bg-km-surface-card rounded-2xl border border-km-border animate-shimmer" />
            </div>
            <div className="lg:col-span-4">
                <div className="h-80 bg-km-surface-card rounded-2xl border border-km-border animate-shimmer" />
            </div>
        </div>
    </div>
);

const JobDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const jobId = params.Id as string;

    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [coverLetter, setCoverLetter] = useState('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [hasApplied, setHasApplied] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Network / Recruiter Connection State
    const [connectionStatus, setConnectionStatus] = useState<string>(''); // '', 'pending', 'accepted'

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [jobData, userData] = await Promise.all([
                    api.get(`/jobs/${jobId}`) as Promise<Job>,
                    api.get('/user/profile').catch(() => null) as Promise<any>
                ]);
                setJob(jobData);
                setUser(userData);

                if (userData) {
                    if (Array.isArray(userData.bookmarked_jobs)) {
                        setIsBookmarked(userData.bookmarked_jobs.includes(jobId));
                    }
                    try {
                        const checkRes = (await api.get(`/applications/check/${jobId}`)) as { applied?: boolean };
                        if (checkRes?.applied) {
                            setHasApplied(true);
                        }
                    } catch {
                        // Continue
                    }
                }

                // Check connection status with recruiter
                if (userData && jobData?.recruiter_id) {
                    try {
                        const statusRes = (await api.get(`/network/status/${jobData.recruiter_id}`)) as { status?: string };
                        if (statusRes?.status) {
                            setConnectionStatus(statusRes.status);
                        }
                    } catch {
                        // Continue
                    }
                }
            } catch (error) {
                console.error('Failed to fetch job', error);
                notify.error('Job details not found');
                router.push('/jobs');
            } finally {
                setLoading(false);
            }
        };
        if (jobId) fetchData();
    }, [jobId, router]);

    const handleApplyClick = () => {
        if (!user) {
            notify.info('Please login to apply');
            router.push(`/login?redirect=${encodeURIComponent(`/jobs/${jobId}`)}`);
            return;
        }

        if (hasApplied) {
            notify.info('You have already applied for this job');
            return;
        }

        const roles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
        const isOnlyUser = roles.includes('user') && !roles.includes('recruiter') && !roles.includes('expert');

        if (!isOnlyUser) {
            notify.warning('Only candidates are allowed to apply for jobs.');
            return;
        }

        setIsApplyModalOpen(true);
    };

    const submitApplication = async () => {
        setIsApplying(true);
        try {
            // The resume is private: only the candidate and this job's recruiter can open it
            const resumeUrl = resumeFile ? (await uploadFile(resumeFile, 'resume')).url : '';
            await api.post('/applications', {
                job_id: job?.id,
                cover_letter: coverLetter,
                resume_url: resumeUrl
            });
            notify.success('Application submitted successfully! Track your status in My Applications.');
            setHasApplied(true);
            setIsApplyModalOpen(false);
        } catch (error: any) {
            if (error.response?.status === 409) {
                setHasApplied(true);
                setIsApplyModalOpen(false);
                notify.info(errorText(error, 'You have already applied for this job'));
            } else {
                notify.error(error, 'Failed to apply');
            }
        } finally {
            setIsApplying(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                notify.error('Resume file must be under 5MB');
                return;
            }
            setResumeFile(file);
        }
    };

    const handleRemoveFile = () => {
        setResumeFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleToggleBookmark = async () => {
        if (!user) {
            notify.info('Please login to save jobs');
            return;
        }
        const nextState = !isBookmarked;
        setIsBookmarked(nextState);
        try {
            await api.post(`/user/bookmark/${jobId}`);
            notify.success(nextState ? 'Job saved to your bookmarks' : 'Job removed from saved items');
        } catch {
            setIsBookmarked(!nextState);
            notify.error('Failed to update saved job');
        }
    };

    const handleShare = async () => {
        if (typeof window !== 'undefined') {
            try {
                await navigator.clipboard.writeText(window.location.href);
                notify.success('Job link copied to clipboard');
            } catch {
                notify.info('Share URL: ' + window.location.href);
            }
        }
    };

    const handleConnectOrChat = async () => {
        if (!user) {
            notify.info('Please sign in to connect with recruiter');
            router.push(`/login?redirect=${encodeURIComponent(`/jobs/${jobId}`)}`);
            return;
        }

        if (connectionStatus === 'accepted') {
            router.push(`/chat?userId=${job?.recruiter_id}`);
            return;
        }

        if (connectionStatus === 'pending') {
            notify.info('Connection request is pending recruiter acceptance.');
            return;
        }

        if (!job?.recruiter_id) {
            notify.info('Recruiter contact details will be shared once your application is reviewed.');
            return;
        }

        try {
            await api.post('/network/connect', { receiver_id: job.recruiter_id });
            notify.success('Connection request sent to recruiter. You can chat once accepted.');
            setConnectionStatus('pending');
        } catch (error: any) {
            const msg = errorText(error, '');
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('pending')) {
                setConnectionStatus('pending');
                notify.info('Connection request already sent.');
            } else {
                notify.error(msg || 'Failed to send connection request.');
            }
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return <JobDetailSkeleton />;
    }

    if (!job) return null;

    return (
        <div className="bg-km-surface min-h-screen pb-20 font-sans text-km-text-primary">

            {/* ─── Hero Section with Rounded Bottom ─── */}
            <section className={`${HERO_SHELL} pt-8 sm:pt-10 lg:pt-12 pb-8 sm:pb-10 lg:pb-12`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Back Link */}
                    <div className="mb-4">
                        <Link
                            href="/jobs"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
                        >
                            <ArrowLeftIcon weight="bold" size={14} />
                            <span>Back to All Jobs</span>
                        </Link>
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                        {/* Left Header Content */}
                        <div className="flex-1 min-w-0">
                            {/* Category Indicator */}
                            <div className="inline-flex items-center gap-2 bg-[#EBF3FE] text-km-link border border-[#BFDBFE] text-xs font-semibold px-3 py-1 rounded-full mb-3 dark:bg-[#172A50] dark:border-blue-500/30">
                                <BriefcaseIcon weight="bold" size={13} className="text-km-link fill-[#0B5ED7]/20 dark:fill-blue-400" />
                                <span>Verified Direct Job Opening</span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.2]">
                                {job.title}
                            </h1>

                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-white/80 font-medium">
                                <span className="text-white font-semibold text-sm">{job.company}</span>
                                <span className="w-1 h-1 rounded-full bg-white/40" />
                                <span className="flex items-center gap-1">
                                    <MapPinIcon weight="bold" size={13} className="text-km-link fill-[#0B5ED7] dark:fill-blue-400" />
                                    <span>
                                        {job.location ? `${job.location}, ` : ''}
                                        {job.city_name || 'All India'}
                                    </span>
                                </span>
                                {job.created_at && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/40" />
                                        <span className="flex items-center gap-1">
                                            <CalendarBlankIcon weight="fill" size={13} className="text-white/60 fill-white/20" />
                                            <span>Posted {formatDate(job.created_at)}</span>
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Key Metrics Chips Grid inside Hero */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-white/10">
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3 dark:bg-km-primary-dark">
                                    <p className="text-[11px] font-medium text-white/60">Monthly Salary</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        ₹{job.salary_min?.toLocaleString('en-IN') || 0} - ₹{job.salary_max?.toLocaleString('en-IN') || 0}
                                    </p>
                                </div>
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3 dark:bg-km-primary-dark">
                                    <p className="text-[11px] font-medium text-white/60">Job Type</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        {job.job_type}
                                    </p>
                                </div>
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3 dark:bg-km-primary-dark">
                                    <p className="text-[11px] font-medium text-white/60">Experience</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        {job.experience_min === 0 ? 'Fresher Friendly' : `${job.experience_min} - ${job.experience_max} Yrs`}
                                    </p>
                                </div>
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3 dark:bg-km-primary-dark">
                                    <p className="text-[11px] font-medium text-white/60">Openings</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        {job.vacancies || 1} Positions
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right Header Actions: Balanced, Symmetric Single Row */}
                        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0 self-start lg:self-center">
                            {/* Primary Apply Button */}
                            {hasApplied ? (
                                <Link
                                    href="/applications"
                                    className="h-11 px-5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <CheckCircleIcon weight="fill" size={15} className="fill-white text-emerald-600 dark:text-emerald-400" />
                                    <span>Application Submitted • Track Status</span>
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleApplyClick}
                                    className="h-11 px-6 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer btn-accent"
                                >
                                    <span>Apply for Position</span>
                                    <ArrowUpRightIcon weight="bold" size={14} />
                                </button>
                            )}

                            {/* Connect or Chat with Recruiter Button */}
                            {job.recruiter_id && (
                                <button
                                    type="button"
                                    onClick={handleConnectOrChat}
                                    disabled={connectionStatus === 'pending'}
                                    className={`h-11 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border ${
                                        connectionStatus === 'accepted'
                                            ? 'bg-[#0B5ED7] hover:bg-[#094bb3] text-white border-transparent'
                                            : connectionStatus === 'pending'
                                            ? 'bg-km-surface-card/10 text-white/70 border-white/20 cursor-default'
                                            : 'bg-[#0B1F52] hover:bg-white/10 text-white border-white/20 dark:bg-km-primary-dark'
                                    }`}
                                >
                                    {connectionStatus === 'accepted' ? (
                                        <>
                                            <ChatCircleIcon weight="fill" size={15} className="fill-white" />
                                            <span>Chat with HR</span>
                                        </>
                                    ) : connectionStatus === 'pending' ? (
                                        <>
                                            <ClockIcon weight="fill" size={15} className="fill-amber-400/20 text-amber-400" />
                                            <span>Connection Pending</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlusIcon weight="fill" size={15} className="fill-white/20" />
                                            <span>Connect with HR</span>
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Bookmark Button */}
                            <button
                                type="button"
                                onClick={handleToggleBookmark}
                                title={isBookmarked ? 'Remove from saved' : 'Save this job'}
                                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
                                    isBookmarked
                                        ? 'bg-[#EBF3FE] text-km-link border-[#BFDBFE] dark:bg-[#172A50] dark:border-blue-500/30'
                                        : 'bg-[#0B1F52] text-white/90 hover:text-white hover:bg-white/10 border-white/20 dark:bg-km-primary-dark'
                                }`}
                            >
                                {isBookmarked ? (
                                    <BookmarkSimpleIcon weight="fill" size={16} className="fill-[#0B5ED7] text-km-link dark:fill-blue-400" />
                                ) : (
                                    <BookmarkSimpleIcon weight="fill" size={16} className="fill-white/10 text-white/90" />
                                )}
                            </button>

                            {/* Share Button */}
                            <button
                                type="button"
                                onClick={handleShare}
                                title="Share this job"
                                className="w-11 h-11 rounded-xl bg-[#0B1F52] border border-white/20 text-white/90 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer shadow-xs dark:bg-km-primary-dark"
                            >
                                <ShareNetworkIcon weight="bold" size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Main Content Grid: Job Details + Unified Sticky Sidebar ─── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Job Details, Specifications, Requirements */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Job Specifications Card */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-xs">
                            <h2 className="text-base font-bold text-km-text-primary mb-4 pb-3 border-b border-km-border flex items-center gap-2">
                                <BriefcaseIcon weight="bold" size={16} className="text-km-link fill-[#0B5ED7]/20 dark:fill-blue-400" />
                                <span>Role Overview & Specifications</span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-km-text-secondary w-32 shrink-0">Employment Type:</span>
                                    <span className="font-bold text-km-text-primary">{job.job_type}</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-km-text-secondary w-32 shrink-0">Work Location:</span>
                                    <span className="font-bold text-km-text-primary">{job.city_name || 'All India'}</span>
                                </div>
                                {job.education && (
                                    <div className="flex items-start gap-2.5">
                                        <span className="font-semibold text-km-text-secondary w-32 shrink-0">Minimum Education:</span>
                                        <span className="font-bold text-km-text-primary">{job.education}</span>
                                    </div>
                                )}
                                {job.gender && (
                                    <div className="flex items-start gap-2.5">
                                        <span className="font-semibold text-km-text-secondary w-32 shrink-0">Gender Eligibility:</span>
                                        <span className="font-bold text-km-text-primary">{job.gender}</span>
                                    </div>
                                )}
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-km-text-secondary w-32 shrink-0">Experience:</span>
                                    <span className="font-bold text-km-text-primary">
                                        {job.experience_min === 0 ? 'Fresher Friendly (0 yrs)' : `${job.experience_min} to ${job.experience_max} Years`}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-km-text-secondary w-32 shrink-0">Available Vacancies:</span>
                                    <span className="font-bold text-km-text-primary">{job.vacancies || 1} Positions</span>
                                </div>
                                {typeof job.applicant_count === 'number' && job.applicant_count > 0 && (
                                    <div className="flex items-start gap-2.5">
                                        <span className="font-semibold text-km-text-secondary w-32 shrink-0">Applications:</span>
                                        <span className="font-bold text-km-link">{job.applicant_count} candidates applied</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description Card */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-xs">
                            <h2 className="text-base font-bold text-km-text-primary mb-4 pb-3 border-b border-km-border flex items-center gap-2">
                                <FileTextIcon weight="bold" size={16} className="text-km-link fill-[#0B5ED7]/20 dark:fill-blue-400" />
                                <span>Detailed Job Description</span>
                            </h2>
                            <div className="text-sm text-km-text-primary leading-relaxed whitespace-pre-wrap font-normal">
                                {job.description}
                            </div>
                        </div>

                        {/* Skills & Requirements Card (Only if present in database) */}
                        {job.requirements && job.requirements.length > 0 && (
                            <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-xs">
                                <h2 className="text-base font-bold text-km-text-primary mb-4 pb-3 border-b border-km-border flex items-center gap-2">
                                    <MedalIcon weight="bold" size={16} className="text-km-link fill-[#0B5ED7]/20 dark:fill-blue-400" />
                                    <span>Key Requirements & Skills</span>
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {job.requirements.map((skill) => (
                                        <span
                                            key={skill}
                                            className="px-3 py-1.5 bg-km-surface border border-km-border text-km-heading rounded-xl text-xs font-medium flex items-center gap-1.5"
                                        >
                                            <CheckCircleIcon weight="bold" size={13} className="fill-[#0B5ED7] text-white dark:fill-blue-400" />
                                            <span>{skill}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Benefits & Offerings Card (Only if present in database) */}
                        {job.we_offer && job.we_offer.length > 0 && (
                            <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-xs">
                                <h2 className="text-base font-bold text-km-text-primary mb-4 pb-3 border-b border-km-border flex items-center gap-2">
                                    <CheckCircleIcon weight="fill" size={16} className="fill-emerald-600 text-white" />
                                    <span>Compensation & Perks Offered</span>
                                </h2>
                                <ul className="space-y-2.5">
                                    {job.we_offer.map((offer, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-km-text-primary font-medium">
                                            <CheckCircleIcon weight="fill" size={15} className="fill-emerald-600 text-white shrink-0 mt-0.5" />
                                            <span>{offer}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Unified Sticky Sidebar (Cards move together, never overlap) */}
                    <aside className="lg:col-span-4 space-y-6 sticky top-24 self-start">
                        {/* Quick Action & Compensation Card */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 shadow-xs space-y-5">
                            <div>
                                <span className="text-xs font-semibold text-km-text-secondary">
                                    Offered Monthly Salary
                                </span>
                                <div className="text-2xl font-extrabold text-km-text-primary mt-0.5">
                                    ₹{job.salary_min?.toLocaleString('en-IN') || 0} - ₹{job.salary_max?.toLocaleString('en-IN') || 0}
                                </div>
                                <span className="text-xs text-km-text-secondary">Direct recruitment with zero agency deductions</span>
                            </div>

                            <div className="space-y-2.5 pt-2">
                                {hasApplied ? (
                                    <Link
                                        href="/applications"
                                        className="w-full h-11 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <CheckCircleIcon weight="fill" size={15} className="fill-white text-emerald-600 dark:text-emerald-400" />
                                        <span>Application Submitted • Track Status</span>
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleApplyClick}
                                        className="w-full h-11 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer btn-accent"
                                    >
                                        <span>Apply for Position</span>
                                        <ArrowUpRightIcon weight="bold" size={14} />
                                    </button>
                                )}

                                {job.recruiter_id && (
                                    <button
                                        type="button"
                                        onClick={handleConnectOrChat}
                                        disabled={connectionStatus === 'pending'}
                                        className={`w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
                                            connectionStatus === 'accepted'
                                                ? 'bg-[#0B5ED7] hover:bg-[#094bb3] text-white border-transparent'
                                                : connectionStatus === 'pending'
                                                ? 'bg-km-surface text-km-text-secondary border-km-border cursor-default'
                                                : 'btn-outline'
                                        }`}
                                    >
                                        {connectionStatus === 'accepted' ? (
                                            <>
                                                <ChatCircleIcon weight="fill" size={14} className="fill-current" />
                                                <span>Chat with Hiring Manager</span>
                                            </>
                                        ) : connectionStatus === 'pending' ? (
                                            <>
                                                <ClockIcon weight="fill" size={14} className="fill-amber-500/20 text-amber-500 dark:text-amber-400" />
                                                <span>Connection Pending</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserPlusIcon weight="fill" size={14} className="fill-current/20" />
                                                <span>Connect with Recruiter</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Direct Hiring Assurance Box */}
                            <div className="pt-4 border-t border-km-border space-y-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon weight="bold" size={16} className="text-[#10B981] fill-[#10B981]/20" />
                                    <span className="text-xs font-bold text-km-text-primary">Direct Hiring Guarantee</span>
                                </div>
                                <ul className="text-xs text-km-text-secondary space-y-2 font-medium">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                        <span>Zero placement fees or brokerage</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                        <span>Profile delivered directly to {job.company}</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                        <span>Real-time application status updates</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Company Info Box */}
                            <div className="pt-4 border-t border-km-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#071A4D] text-white font-bold text-sm flex items-center justify-center shrink-0 border border-[#0B1F52] dark:bg-km-primary dark:border-km-link">
                                        {job.company ? job.company.charAt(0).toUpperCase() : 'C'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-km-text-primary truncate">{job.company}</p>
                                        <p className="text-[11px] text-km-link font-semibold flex items-center gap-1">
                                            <CheckCircleIcon weight="bold" size={11} className="fill-[#0B5ED7] text-white dark:fill-blue-400" /> Verified Employer
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hiring Process Card */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 shadow-xs space-y-4">
                            <h3 className="text-xs font-bold text-km-text-primary">
                                Hiring Process
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-[#EBF3FE] text-km-link font-bold text-xs flex items-center justify-center shrink-0 dark:bg-[#172A50]">
                                        1
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-km-text-primary">Direct Application</p>
                                        <p className="text-[11px] text-km-text-secondary">Apply directly with your verified candidate credentials.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-[#EBF3FE] text-km-link font-bold text-xs flex items-center justify-center shrink-0 dark:bg-[#172A50]">
                                        2
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-km-text-primary">Direct HR Review</p>
                                        <p className="text-[11px] text-km-text-secondary">The employer reviews candidate profiles with zero agency filter.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-[#EBF3FE] text-km-link font-bold text-xs flex items-center justify-center shrink-0 dark:bg-[#172A50]">
                                        3
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-km-text-primary">Interview & Offer</p>
                                        <p className="text-[11px] text-km-text-secondary">Direct call or chat invitation to finalize your onboarding.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* ─── Streamlined Application Modal ─── */}
            <AnimatePresence>
                {isApplyModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsApplyModalOpen(false)}
                            className="fixed inset-0 bg-[#071A4D]/60 dark:bg-km-primary"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-km-surface-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-7 relative z-10 shadow-xl border border-km-border font-sans text-km-text-primary"
                        >
                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={() => setIsApplyModalOpen(false)}
                                className="absolute top-5 right-5 p-1.5 text-km-text-secondary hover:text-km-text-primary rounded-xl hover:bg-km-surface transition-colors cursor-pointer"
                                aria-label="Close modal"
                            >
                                <XIcon weight="bold" size={18} />
                            </button>

                            {/* Modal Header */}
                            <div className="mb-5 pr-8">
                                <h2 className="text-xl font-extrabold text-km-text-primary tracking-tight">Apply for Position</h2>
                                <p className="text-km-text-secondary text-xs mt-0.5">
                                    <span className="font-semibold text-km-text-primary">{job.title}</span> • {job.company}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* Compact Candidate Profile Strip */}
                                <div className="bg-km-surface border border-km-border rounded-xl p-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-[#071A4D] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#0B1F52] dark:bg-km-primary dark:border-km-link">
                                            {(user?.name || user?.first_name || 'C').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-bold text-km-text-primary truncate">
                                                    {user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Candidate'}
                                                </p>
                                                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                    <CheckCircleIcon weight="fill" size={10} className="fill-emerald-600 text-white" />
                                                    Verified
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-km-text-secondary truncate">
                                                {user?.mobile || user?.email || user?.city || 'Profile linked'}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href="/profile"
                                        target="_blank"
                                        className="text-[11px] font-semibold text-km-link hover:underline shrink-0"
                                    >
                                        Edit Profile
                                    </Link>
                                </div>

                                {/* Resume Upload Dropzone */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-km-text-primary flex items-center justify-between">
                                        <span>Attach Resume <span className="text-km-text-secondary font-normal">(Optional)</span></span>
                                        <span className="text-[10px] text-km-text-secondary">PDF, DOC, DOCX up to 5MB</span>
                                    </label>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".pdf,.doc,.docx"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    {!resumeFile ? (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-km-border hover:border-[#0B5ED7] hover:bg-[#EBF3FE]/30 rounded-xl p-4 text-center cursor-pointer transition-colors group dark:hover:bg-[#172A50]"
                                        >
                                            <CloudArrowUpIcon size={20} className="text-km-link mx-auto mb-1.5" aria-hidden="true" />
                                            <p className="text-xs font-semibold text-km-text-primary">
                                                Click to upload or drag resume
                                            </p>
                                            <p className="text-[11px] text-km-text-secondary mt-0.5">
                                                Your verified profile credentials will be submitted automatically
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 bg-km-surface border border-[#BFDBFE] rounded-xl dark:border-blue-500/30">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <FileTextIcon size={20} className="text-km-link shrink-0" aria-hidden="true" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-km-text-primary truncate">
                                                        {resumeFile.name}
                                                    </p>
                                                    <p className="text-[11px] text-km-text-secondary">
                                                        {(resumeFile.size / 1024).toFixed(1)} KB • Attached
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveFile}
                                                className="p-1.5 text-km-text-secondary hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer dark:hover:text-rose-400"
                                                title="Remove attached resume"
                                            >
                                                <TrashIcon weight="bold" size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Pitch or Note to Recruiter (Optional) */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-km-text-primary">
                                            Pitch or Note to Recruiter <span className="text-km-text-secondary font-normal">(Optional)</span>
                                        </label>
                                        <span className="text-[11px] text-km-text-secondary">{coverLetter.length}/500</span>
                                    </div>
                                    <textarea
                                        className="w-full bg-km-surface border border-km-border rounded-xl p-3 min-h-22 outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all font-medium text-xs text-km-text-primary placeholder:text-km-text-secondary/70 resize-none"
                                        placeholder="Add relevant experience, key certifications, or immediate availability..."
                                        value={coverLetter}
                                        onChange={(e) => setCoverLetter(e.target.value.slice(0, 500))}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsApplyModalOpen(false)}
                                        disabled={isApplying}
                                        className="flex-1 py-2.5 rounded-xl border border-km-border hover:bg-km-surface text-xs font-semibold text-km-text-secondary hover:text-km-text-primary transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitApplication}
                                        disabled={isApplying}
                                        className="flex-1 btn-primary py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {isApplying ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Submitting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Submit Application</span>
                                                <ArrowUpRightIcon weight="bold" size={14} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default JobDetailPage;