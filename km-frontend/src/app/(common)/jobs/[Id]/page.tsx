'use client';

import React, { useState, useEffect } from 'react';
import {
    MapPin,
    Briefcase,
    CheckCircle2,
    Clock,
    Users,
    ShieldCheck,
    ArrowLeft,
    Calendar,
    X,
    Share2,
    Bookmark,
    BookmarkCheck,
    MessageCircle,
    UserPlus,
    ArrowUpRight,
    FileText,
    Award,
    User,
    Mail,
    Phone,
    GraduationCap,
    ExternalLink,
    UploadCloud,
    Trash2
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="bg-[#F4F7FB] min-h-screen font-sans pb-20">
        <div className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-8 pb-12 rounded-b-[32px] sm:rounded-b-[44px]">
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
                <div className="h-48 bg-white rounded-2xl border border-[#D9E0EA] animate-shimmer" />
                <div className="h-64 bg-white rounded-2xl border border-[#D9E0EA] animate-shimmer" />
            </div>
            <div className="lg:col-span-4">
                <div className="h-80 bg-white rounded-2xl border border-[#D9E0EA] animate-shimmer" />
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
                toast.error('Job details not found');
                router.push('/jobs');
            } finally {
                setLoading(false);
            }
        };
        if (jobId) fetchData();
    }, [jobId, router]);

    const handleApplyClick = () => {
        if (!user) {
            toast.info('Please login to apply');
            router.push(`/login?redirect=${encodeURIComponent(`/jobs/${jobId}`)}`);
            return;
        }

        if (hasApplied) {
            toast.info('You have already applied for this job');
            return;
        }

        const roles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
        const isOnlyUser = roles.includes('user') && !roles.includes('recruiter') && !roles.includes('expert');

        if (!isOnlyUser) {
            toast.warning('Only candidates are allowed to apply for jobs.');
            return;
        }

        setIsApplyModalOpen(true);
    };

    const submitApplication = async () => {
        setIsApplying(true);
        try {
            await api.post('/applications', {
                job_id: job?.id,
                cover_letter: coverLetter,
                resume_url: resumeFile ? resumeFile.name : ''
            });
            toast.success('Application submitted successfully! Track your status in My Applications.');
            setHasApplied(true);
            setIsApplyModalOpen(false);
        } catch (error: any) {
            if (error.response?.status === 409) {
                setHasApplied(true);
                setIsApplyModalOpen(false);
                toast.info(error.response?.data?.error || 'You have already applied for this job');
            } else {
                toast.error(error.response?.data?.error || 'Failed to apply');
            }
        } finally {
            setIsApplying(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Resume file must be under 5MB');
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
            toast.info('Please login to save jobs');
            return;
        }
        const nextState = !isBookmarked;
        setIsBookmarked(nextState);
        try {
            await api.post(`/user/bookmark/${jobId}`);
            toast.success(nextState ? 'Job saved to your bookmarks' : 'Job removed from saved items');
        } catch {
            setIsBookmarked(!nextState);
            toast.error('Failed to update saved job');
        }
    };

    const handleShare = async () => {
        if (typeof window !== 'undefined') {
            try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success('Job link copied to clipboard');
            } catch {
                toast.info('Share URL: ' + window.location.href);
            }
        }
    };

    const handleConnectOrChat = async () => {
        if (!user) {
            toast.info('Please sign in to connect with recruiter');
            router.push(`/login?redirect=${encodeURIComponent(`/jobs/${jobId}`)}`);
            return;
        }

        if (connectionStatus === 'accepted') {
            router.push(`/chat?userId=${job?.recruiter_id}`);
            return;
        }

        if (connectionStatus === 'pending') {
            toast.info('Connection request is pending recruiter acceptance.');
            return;
        }

        if (!job?.recruiter_id) {
            toast.info('Recruiter contact details will be shared once your application is reviewed.');
            return;
        }

        try {
            await api.post('/network/connect', { receiver_id: job.recruiter_id });
            toast.success('Connection request sent to recruiter. You can chat once accepted.');
            setConnectionStatus('pending');
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || '';
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('pending')) {
                setConnectionStatus('pending');
                toast.info('Connection request already sent.');
            } else {
                toast.error(msg || 'Failed to send connection request.');
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
        <div className="bg-[#F4F7FB] min-h-screen pb-20 font-sans text-[#111827]">
            <ToastContainer />

            {/* ─── Hero Section with Rounded Bottom ─── */}
            <section className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-6 sm:pt-8 lg:pt-10 pb-8 sm:pb-10 lg:pb-12 rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Back Link */}
                    <div className="mb-4">
                        <Link
                            href="/jobs"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={14} />
                            <span>Back to All Jobs</span>
                        </Link>
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                        {/* Left Header Content */}
                        <div className="flex-1 min-w-0">
                            {/* Category Indicator */}
                            <div className="inline-flex items-center gap-2 bg-[#EBF3FE] text-[#0B5ED7] border border-[#BFDBFE] text-xs font-semibold px-3 py-1 rounded-full mb-3">
                                <Briefcase size={13} className="text-[#0B5ED7] fill-[#0B5ED7]/20" />
                                <span>Verified Direct Job Opening</span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.2]">
                                {job.title}
                            </h1>

                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-white/80 font-medium">
                                <span className="text-white font-semibold text-sm">{job.company}</span>
                                <span className="w-1 h-1 rounded-full bg-white/40" />
                                <span className="flex items-center gap-1">
                                    <MapPin size={13} className="text-[#0B5ED7] fill-[#0B5ED7]" />
                                    <span>
                                        {job.location ? `${job.location}, ` : ''}
                                        {job.city_name || 'All India'}
                                    </span>
                                </span>
                                {job.created_at && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/40" />
                                        <span className="flex items-center gap-1">
                                            <Calendar size={13} className="text-white/60 fill-white/20" />
                                            <span>Posted {formatDate(job.created_at)}</span>
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Key Metrics Chips Grid inside Hero */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-white/10">
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3">
                                    <p className="text-[11px] font-medium text-white/60">Monthly Salary</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        ₹{job.salary_min?.toLocaleString('en-IN') || 0} - ₹{job.salary_max?.toLocaleString('en-IN') || 0}
                                    </p>
                                </div>
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3">
                                    <p className="text-[11px] font-medium text-white/60">Job Type</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        {job.job_type}
                                    </p>
                                </div>
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3">
                                    <p className="text-[11px] font-medium text-white/60">Experience</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                                        {job.experience_min === 0 ? 'Fresher Friendly' : `${job.experience_min} - ${job.experience_max} Yrs`}
                                    </p>
                                </div>
                                <div className="bg-[#0B1F52] border border-white/10 rounded-xl p-3">
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
                                    <CheckCircle2 size={15} className="fill-white text-emerald-600" />
                                    <span>Application Submitted • Track Status</span>
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleApplyClick}
                                    className="h-11 px-6 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer btn-accent"
                                >
                                    <span>Apply for Position</span>
                                    <ArrowUpRight size={14} />
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
                                            ? 'bg-white/10 text-white/70 border-white/20 cursor-default'
                                            : 'bg-[#0B1F52] hover:bg-white/10 text-white border-white/20'
                                    }`}
                                >
                                    {connectionStatus === 'accepted' ? (
                                        <>
                                            <MessageCircle size={15} className="fill-white" />
                                            <span>Chat with HR</span>
                                        </>
                                    ) : connectionStatus === 'pending' ? (
                                        <>
                                            <Clock size={15} className="fill-amber-400/20 text-amber-400" />
                                            <span>Connection Pending</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={15} className="fill-white/20" />
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
                                        ? 'bg-[#EBF3FE] text-[#0B5ED7] border-[#BFDBFE]'
                                        : 'bg-[#0B1F52] text-white/90 hover:text-white hover:bg-white/10 border-white/20'
                                }`}
                            >
                                {isBookmarked ? (
                                    <BookmarkCheck size={16} className="fill-[#0B5ED7] text-[#0B5ED7]" />
                                ) : (
                                    <Bookmark size={16} className="fill-white/10 text-white/90" />
                                )}
                            </button>

                            {/* Share Button */}
                            <button
                                type="button"
                                onClick={handleShare}
                                title="Share this job"
                                className="w-11 h-11 rounded-xl bg-[#0B1F52] border border-white/20 text-white/90 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                            >
                                <Share2 size={16} />
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
                        <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 sm:p-7 shadow-xs">
                            <h2 className="text-base font-bold text-[#111827] mb-4 pb-3 border-b border-[#D9E0EA] flex items-center gap-2">
                                <Briefcase size={16} className="text-[#0B5ED7] fill-[#0B5ED7]/20" />
                                <span>Role Overview & Specifications</span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-[#5B6472] w-32 shrink-0">Employment Type:</span>
                                    <span className="font-bold text-[#111827]">{job.job_type}</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-[#5B6472] w-32 shrink-0">Work Location:</span>
                                    <span className="font-bold text-[#111827]">{job.city_name || 'All India'}</span>
                                </div>
                                {job.education && (
                                    <div className="flex items-start gap-2.5">
                                        <span className="font-semibold text-[#5B6472] w-32 shrink-0">Minimum Education:</span>
                                        <span className="font-bold text-[#111827]">{job.education}</span>
                                    </div>
                                )}
                                {job.gender && (
                                    <div className="flex items-start gap-2.5">
                                        <span className="font-semibold text-[#5B6472] w-32 shrink-0">Gender Eligibility:</span>
                                        <span className="font-bold text-[#111827]">{job.gender}</span>
                                    </div>
                                )}
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-[#5B6472] w-32 shrink-0">Experience:</span>
                                    <span className="font-bold text-[#111827]">
                                        {job.experience_min === 0 ? 'Fresher Friendly (0 yrs)' : `${job.experience_min} to ${job.experience_max} Years`}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="font-semibold text-[#5B6472] w-32 shrink-0">Available Vacancies:</span>
                                    <span className="font-bold text-[#111827]">{job.vacancies || 1} Positions</span>
                                </div>
                                {typeof job.applicant_count === 'number' && job.applicant_count > 0 && (
                                    <div className="flex items-start gap-2.5">
                                        <span className="font-semibold text-[#5B6472] w-32 shrink-0">Applications:</span>
                                        <span className="font-bold text-[#0B5ED7]">{job.applicant_count} candidates applied</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description Card */}
                        <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 sm:p-7 shadow-xs">
                            <h2 className="text-base font-bold text-[#111827] mb-4 pb-3 border-b border-[#D9E0EA] flex items-center gap-2">
                                <FileText size={16} className="text-[#0B5ED7] fill-[#0B5ED7]/20" />
                                <span>Detailed Job Description</span>
                            </h2>
                            <div className="text-sm text-[#111827] leading-relaxed whitespace-pre-wrap font-normal">
                                {job.description}
                            </div>
                        </div>

                        {/* Skills & Requirements Card (Only if present in database) */}
                        {job.requirements && job.requirements.length > 0 && (
                            <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 sm:p-7 shadow-xs">
                                <h2 className="text-base font-bold text-[#111827] mb-4 pb-3 border-b border-[#D9E0EA] flex items-center gap-2">
                                    <Award size={16} className="text-[#0B5ED7] fill-[#0B5ED7]/20" />
                                    <span>Key Requirements & Skills</span>
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {job.requirements.map((skill) => (
                                        <span
                                            key={skill}
                                            className="px-3 py-1.5 bg-[#F4F7FB] border border-[#D9E0EA] text-[#071A4D] rounded-xl text-xs font-medium flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 size={13} className="fill-[#0B5ED7] text-white" />
                                            <span>{skill}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Benefits & Offerings Card (Only if present in database) */}
                        {job.we_offer && job.we_offer.length > 0 && (
                            <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 sm:p-7 shadow-xs">
                                <h2 className="text-base font-bold text-[#111827] mb-4 pb-3 border-b border-[#D9E0EA] flex items-center gap-2">
                                    <CheckCircle2 size={16} className="fill-emerald-600 text-white" />
                                    <span>Compensation & Perks Offered</span>
                                </h2>
                                <ul className="space-y-2.5">
                                    {job.we_offer.map((offer, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#111827] font-medium">
                                            <CheckCircle2 size={15} className="fill-emerald-600 text-white shrink-0 mt-0.5" />
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
                        <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 shadow-xs space-y-5">
                            <div>
                                <span className="text-xs font-semibold text-[#5B6472]">
                                    Offered Monthly Salary
                                </span>
                                <div className="text-2xl font-extrabold text-[#111827] mt-0.5">
                                    ₹{job.salary_min?.toLocaleString('en-IN') || 0} - ₹{job.salary_max?.toLocaleString('en-IN') || 0}
                                </div>
                                <span className="text-xs text-[#5B6472]">Direct recruitment with zero agency deductions</span>
                            </div>

                            <div className="space-y-2.5 pt-2">
                                {hasApplied ? (
                                    <Link
                                        href="/applications"
                                        className="w-full h-11 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <CheckCircle2 size={15} className="fill-white text-emerald-600" />
                                        <span>Application Submitted • Track Status</span>
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleApplyClick}
                                        className="w-full h-11 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer btn-accent"
                                    >
                                        <span>Apply for Position</span>
                                        <ArrowUpRight size={14} />
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
                                                ? 'bg-[#F4F7FB] text-[#5B6472] border-[#D9E0EA] cursor-default'
                                                : 'btn-outline'
                                        }`}
                                    >
                                        {connectionStatus === 'accepted' ? (
                                            <>
                                                <MessageCircle size={14} className="fill-current" />
                                                <span>Chat with Hiring Manager</span>
                                            </>
                                        ) : connectionStatus === 'pending' ? (
                                            <>
                                                <Clock size={14} className="fill-amber-500/20 text-amber-500" />
                                                <span>Connection Pending</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus size={14} className="fill-current/20" />
                                                <span>Connect with Recruiter</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Direct Hiring Assurance Box */}
                            <div className="pt-4 border-t border-[#D9E0EA] space-y-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-[#10B981] fill-[#10B981]/20" />
                                    <span className="text-xs font-bold text-[#111827]">Direct Hiring Guarantee</span>
                                </div>
                                <ul className="text-xs text-[#5B6472] space-y-2 font-medium">
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
                            <div className="pt-4 border-t border-[#D9E0EA]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#071A4D] text-white font-bold text-sm flex items-center justify-center shrink-0 border border-[#0B1F52]">
                                        {job.company ? job.company.charAt(0).toUpperCase() : 'C'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-[#111827] truncate">{job.company}</p>
                                        <p className="text-[11px] text-[#0B5ED7] font-semibold flex items-center gap-1">
                                            <CheckCircle2 size={11} className="fill-[#0B5ED7] text-white" /> Verified Employer
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hiring Process Card */}
                        <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 shadow-xs space-y-4">
                            <h3 className="text-xs font-bold text-[#111827]">
                                Hiring Process
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-[#EBF3FE] text-[#0B5ED7] font-bold text-xs flex items-center justify-center shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-[#111827]">Direct Application</p>
                                        <p className="text-[11px] text-[#5B6472]">Apply directly with your verified candidate credentials.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-[#EBF3FE] text-[#0B5ED7] font-bold text-xs flex items-center justify-center shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-[#111827]">Direct HR Review</p>
                                        <p className="text-[11px] text-[#5B6472]">The employer reviews candidate profiles with zero agency filter.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-[#EBF3FE] text-[#0B5ED7] font-bold text-xs flex items-center justify-center shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-[#111827]">Interview & Offer</p>
                                        <p className="text-[11px] text-[#5B6472]">Direct call or chat invitation to finalize your onboarding.</p>
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
                            className="fixed inset-0 bg-[#071A4D]/60 backdrop-blur-xs"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-7 relative z-10 shadow-xl border border-[#D9E0EA] font-sans text-[#111827]"
                        >
                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={() => setIsApplyModalOpen(false)}
                                className="absolute top-5 right-5 p-1.5 text-[#5B6472] hover:text-[#111827] rounded-xl hover:bg-[#F4F7FB] transition-colors cursor-pointer"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>

                            {/* Modal Header */}
                            <div className="mb-5 pr-8">
                                <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">Apply for Position</h2>
                                <p className="text-[#5B6472] text-xs mt-0.5">
                                    <span className="font-semibold text-[#111827]">{job.title}</span> • {job.company}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* Compact Candidate Profile Strip */}
                                <div className="bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl p-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-[#071A4D] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#0B1F52]">
                                            {(user?.name || user?.first_name || 'C').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-bold text-[#111827] truncate">
                                                    {user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Candidate'}
                                                </p>
                                                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                    <CheckCircle2 size={10} className="fill-emerald-600 text-white" />
                                                    Verified
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#5B6472] truncate">
                                                {user?.mobile || user?.email || user?.city || 'Profile linked'}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href="/profile"
                                        target="_blank"
                                        className="text-[11px] font-semibold text-[#0B5ED7] hover:underline shrink-0"
                                    >
                                        Edit Profile
                                    </Link>
                                </div>

                                {/* Resume Upload Dropzone */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-[#111827] flex items-center justify-between">
                                        <span>Attach Resume <span className="text-[#5B6472] font-normal">(Optional)</span></span>
                                        <span className="text-[10px] text-[#5B6472]">PDF, DOC, DOCX up to 5MB</span>
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
                                            className="border-2 border-dashed border-[#D9E0EA] hover:border-[#0B5ED7] hover:bg-[#EBF3FE]/30 rounded-xl p-4 text-center cursor-pointer transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-[#EBF3FE] text-[#0B5ED7] flex items-center justify-center mx-auto mb-1.5 group-hover:scale-105 transition-transform">
                                                <UploadCloud size={16} className="fill-[#0B5ED7]/20" />
                                            </div>
                                            <p className="text-xs font-semibold text-[#111827]">
                                                Click to upload or drag resume
                                            </p>
                                            <p className="text-[11px] text-[#5B6472] mt-0.5">
                                                Your verified profile credentials will be submitted automatically
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 bg-[#F4F7FB] border border-[#BFDBFE] rounded-xl">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-[#EBF3FE] text-[#0B5ED7] flex items-center justify-center shrink-0">
                                                    <FileText size={16} className="fill-[#0B5ED7]/20" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[#111827] truncate">
                                                        {resumeFile.name}
                                                    </p>
                                                    <p className="text-[11px] text-[#5B6472]">
                                                        {(resumeFile.size / 1024).toFixed(1)} KB • Attached
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveFile}
                                                className="p-1.5 text-[#5B6472] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                                title="Remove attached resume"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Pitch or Note to Recruiter (Optional) */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-[#111827]">
                                            Pitch or Note to Recruiter <span className="text-[#5B6472] font-normal">(Optional)</span>
                                        </label>
                                        <span className="text-[11px] text-[#5B6472]">{coverLetter.length}/500</span>
                                    </div>
                                    <textarea
                                        className="w-full bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl p-3 min-h-22 outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all font-medium text-xs text-[#111827] placeholder:text-[#5B6472]/70 resize-none"
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
                                        className="flex-1 py-2.5 rounded-xl border border-[#D9E0EA] hover:bg-[#F4F7FB] text-xs font-semibold text-[#5B6472] hover:text-[#111827] transition-colors cursor-pointer"
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
                                                <ArrowUpRight size={14} />
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