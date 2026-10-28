'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { 
    ArrowRightIcon, 
    ArrowsClockwiseIcon,
    BriefcaseIcon, 
    BuildingOfficeIcon, 
    CalendarBlankIcon, 
    CaretLeftIcon, 
    CaretRightIcon, 
    CircleNotchIcon, 
    CurrencyInrIcon, 
    DotsThreeVerticalIcon, 
    FileTextIcon, 
    MagnifyingGlassIcon, 
    MapPinIcon, 
    PauseCircleIcon, 
    PlayCircleIcon, 
    StarIcon, 
    TrashIcon, 
    UserCheckIcon, 
    UsersIcon, 
    XCircleIcon 
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { notify } from "@/lib/notify";
import ResumeModal from '@/components/modals/admin/ResumeModal';
import api from '@/lib/axios';

function JobsContent() {
    const searchParams = useSearchParams();
    const [jobs, setJobs] = useState<any[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

    useEffect(() => {
        const q = searchParams.get('search');
        if (q !== null) {
            setSearchQuery(q);
        }
    }, [searchParams]);

    const [view, setView] = useState<'jobs' | 'candidates'>('jobs');
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [isResumeOpen, setIsResumeOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

    // Active action dropdown ID
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [processingJobId, setProcessingJobId] = useState<string | null>(null);

    // Click outside to close action menu
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchJobs = async () => {
        setIsLoadingJobs(true);
        try {
            // @ts-ignore
            const response = await api.get('/jobs');
            const data = (response as any).jobs || response;
            const jobsData = Array.isArray(data) ? data : (data.jobs || []);

            const mappedJobs = jobsData.map((job: any) => ({
                id: job.id,
                title: job.title || 'Untitled Role',
                company: job.company_name || job.company || 'Direct Employer',
                salary: job.salary_min && job.salary_max ? `₹${job.salary_min} - ₹${job.salary_max}` : (job.salary_range || 'Competitive'),
                location: job.location || job.city_name || 'Flexible',
                type: job.job_type || 'Full Time',
                status: (job.status || 'Active').toLowerCase() === 'closed' ? 'Closed' : 'Active',
                candidatesCount: job.applications_count || job.candidates_count || 0,
                postedAt: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recently'
            }));
            setJobs(mappedJobs);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            notify.error('Failed to load job listings');
        } finally {
            setIsLoadingJobs(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    // Toggle Active / Closed status
    const handleToggleStatus = async (e: React.MouseEvent, job: any) => {
        e.stopPropagation();
        setActiveMenuId(null);
        const nextStatus = job.status === 'Active' ? 'Closed' : 'Active';
        setProcessingJobId(job.id);

        try {
            await api.patch(`/admin/jobs/${job.id}/status`, { status: nextStatus.toLowerCase() });
            setJobs((prev) =>
                prev.map((item) => (item.id === job.id ? { ...item, status: nextStatus } : item))
            );
            if (nextStatus === 'Closed') {
                notify.info(`Vacancy for "${job.title}" has been closed.`);
            } else {
                notify.success(`Vacancy for "${job.title}" is now active.`);
            }
        } catch (error: any) {
            console.error('Failed to update job status:', error);
            notify.error(error, 'Failed to update job status');
        } finally {
            setProcessingJobId(null);
        }
    };

    // Delete / Moderate Job
    const handleDeleteJob = async (e: React.MouseEvent, job: any) => {
        e.stopPropagation();
        setActiveMenuId(null);

        if (!confirm(`Are you sure you want to permanently delete the job vacancy "${job.title}"?`)) {
            return;
        }

        setProcessingJobId(job.id);
        try {
            await api.delete(`/admin/jobs/${job.id}`);
            setJobs((prev) => prev.filter((item) => item.id !== job.id));
            notify.success(`Job "${job.title}" deleted successfully.`);
        } catch (error: any) {
            console.error('Failed to delete job:', error);
            notify.error(error, 'Failed to delete job');
        } finally {
            setProcessingJobId(null);
        }
    };

    const handleViewCandidates = async (job: any) => {
        setSelectedJob(job);
        setView('candidates');
        setIsLoadingCandidates(true);
        try {
            // @ts-ignore
            const response = await api.get(`/applications/job/${job.id}`);
            const applications = (response as unknown as any[]) || [];

            // Enrich with user details
            const enrichedCandidates = await Promise.all(applications.map(async (app: any) => {
                try {
                    // @ts-ignore
                    const userRes = await api.get(`/user/${app.candidate_id}`);
                    const user = userRes as any;
                    return {
                        id: app.id,
                        name: user.name || 'Candidate',
                        role: user.headline || 'Job Seeker',
                        location: user.city || 'Location N/A',
                        experience: user.work_experience || 'Not specified',
                        status: app.status || 'Applied',
                        photo: user.profile_image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150'
                    };
                } catch (e) {
                    return {
                        id: app.id,
                        name: 'Candidate',
                        role: 'Applicant',
                        status: app.status || 'Applied',
                        experience: 'Not specified',
                        location: 'Location N/A',
                        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150'
                    };
                }
            }));

            setCandidates(enrichedCandidates);
        } catch (err) {
            console.error('Failed to load applications:', err);
            setCandidates([]);
        } finally {
            setIsLoadingCandidates(false);
        }
    };

    const handleViewResume = (candidate: any) => {
        setSelectedCandidate(candidate);
        setIsResumeOpen(true);
    };

    // Filter jobs by status & search
    const filteredJobs = jobs.filter((job) => {
        if (statusFilter === 'active' && job.status !== 'Active') return false;
        if (statusFilter === 'closed' && job.status !== 'Closed') return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            job.title.toLowerCase().includes(q) ||
            job.company.toLowerCase().includes(q) ||
            job.location.toLowerCase().includes(q) ||
            job.type.toLowerCase().includes(q) ||
            job.salary.toLowerCase().includes(q)
        );
    });

    // Pagination state (10 cards per page)
    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    // Reset to page 1 on filter or search query change
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, searchQuery]);

    // Summary counts
    const totalJobsCount = jobs.length;
    const activeJobsCount = jobs.filter((j) => j.status === 'Active').length;
    const closedJobsCount = jobs.filter((j) => j.status === 'Closed').length;
    const totalApplicationsCount = jobs.reduce((acc, j) => acc + (Number(j.candidatesCount) || 0), 0);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
    const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredJobs.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredJobs.length);

    const getPageNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | string)[] = [];
        if (currentPage <= 3) {
            pages.push(1, 2, 3, '...', totalPages);
        } else if (currentPage >= totalPages - 2) {
            pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
        return pages;
    };

    return (
        <div className="space-y-4">
            <ResumeModal
                isOpen={isResumeOpen}
                onClose={() => setIsResumeOpen(false)}
                candidateName={selectedCandidate?.name || ''}
                resumeUrl="https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=2070&auto=format&fit=crop"
            />

            {/* ── COMPACT OPERATIONAL METRIC CARDS (matching /admin/companies) ── */}
            {view === 'jobs' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            label: 'Total Vacancies',
                            value: totalJobsCount.toLocaleString(),
                            icon: BriefcaseIcon,
                            color: 'text-indigo-600 dark:text-indigo-400',
                            bg: 'bg-indigo-50/70 border-indigo-100/60 dark:bg-indigo-950/30 dark:border-indigo-900/50',
                            active: statusFilter === 'all',
                            onClick: () => setStatusFilter('all')
                        },
                        {
                            label: 'Active Listings',
                            value: activeJobsCount.toLocaleString(),
                            icon: PlayCircleIcon,
                            color: 'text-emerald-600 dark:text-emerald-400',
                            bg: 'bg-emerald-50/70 border-emerald-100/60 dark:bg-emerald-950/30 dark:border-emerald-900/50',
                            active: statusFilter === 'active',
                            onClick: () => setStatusFilter('active')
                        },
                        {
                            label: 'Closed Vacancies',
                            value: closedJobsCount.toLocaleString(),
                            icon: PauseCircleIcon,
                            color: 'text-amber-600 dark:text-amber-400',
                            bg: 'bg-amber-50/70 border-amber-100/60 dark:bg-amber-950/30 dark:border-amber-900/50',
                            active: statusFilter === 'closed',
                            onClick: () => setStatusFilter('closed')
                        },
                        {
                            label: 'Total Applicants',
                            value: totalApplicationsCount.toLocaleString(),
                            icon: UsersIcon,
                            color: 'text-purple-600 dark:text-purple-400',
                            bg: 'bg-purple-50/70 border-purple-100/60 dark:bg-purple-950/30 dark:border-purple-900/50',
                            active: false,
                            onClick: undefined
                        },
                    ].map((stat, i) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            key={stat.label}
                            onClick={stat.onClick}
                            className={`p-3 sm:p-3.5 bg-km-surface-card rounded-2xl border ${stat.bg} ${
                                stat.active ? 'ring-2 ring-purple-500/30 border-purple-300 shadow-sm' : ''
                            } shadow-xs flex items-center justify-between gap-2.5 ${
                                stat.onClick ? 'cursor-pointer hover:shadow-xs transition-all' : ''
                            }`}
                        >
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{stat.label}</p>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stat.value}</h3>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-white/80 dark:bg-black/20 flex items-center justify-center shrink-0 shadow-2xs">
                                <stat.icon size={20} weight="duotone" className={stat.color} aria-hidden="true" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── PAGE HEADER & SEARCH BAR (matching /admin/companies) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-km-surface-card px-4 sm:px-5 py-3 rounded-2xl border border-purple-50 shadow-xs">
                <div className="flex items-center gap-2.5">
                    {view === 'candidates' && (
                        <button
                            type="button"
                            onClick={() => setView('jobs')}
                            className="p-1.5 hover:bg-purple-50 rounded-xl text-purple-700 transition-colors border border-purple-100 bg-white dark:bg-slate-800 dark:text-purple-400 dark:border-slate-700 shadow-xs cursor-pointer"
                            title="Back to Job Listings"
                        >
                            <CaretLeftIcon size={18} weight="bold" />
                        </button>
                    )}
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent break-words">
                        {view === 'jobs' ? 'Job Listings & Moderation' : `Candidates — ${selectedJob?.title}`}
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {statusFilter !== 'all' && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                            <XCircleIcon size={14} weight="bold" />
                            <span>Clear Filter</span>
                        </button>
                    )}

                    <div className="relative group max-sm:w-full">
                        <MagnifyingGlassIcon
                            weight="bold"
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors"
                            size={16}
                        />
                        <input
                            type="text"
                            placeholder={view === 'jobs' ? "Search role, company, city..." : "Search candidates..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-10 pr-3.5 py-2 bg-purple-50/50 dark:bg-slate-800/80 border border-purple-100 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-purple-300 transition-all outline-none"
                        />
                    </div>

                    {view === 'jobs' && (
                        <button
                            type="button"
                            onClick={fetchJobs}
                            disabled={isLoadingJobs}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-purple-600 hover:border-purple-300 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                            title="Refresh Listings"
                        >
                            <ArrowsClockwiseIcon size={16} weight="bold" className={isLoadingJobs ? 'animate-spin text-purple-600' : ''} />
                        </button>
                    )}

                    {/* Top Right Pagination Controls */}
                    {view === 'jobs' && !isLoadingJobs && filteredJobs.length > 0 && (
                        <div className="flex items-center gap-1.5 pl-2 sm:border-l border-purple-100 dark:border-slate-700">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 hidden md:inline">
                                Page <strong className="text-slate-800 dark:text-white">{currentPage}</strong> of <strong className="text-slate-800 dark:text-white">{totalPages}</strong>
                            </span>
                            <button
                                type="button"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="p-1.5 rounded-lg border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                                title="Previous Page"
                            >
                                <CaretLeftIcon size={14} weight="bold" />
                            </button>
                            {getPageNumbers().map((p, idx) => {
                                if (p === '...') {
                                    return (
                                        <span key={`top-ellipsis-${idx}`} className="w-5 text-center text-xs text-slate-400 font-bold select-none">
                                            ...
                                        </span>
                                    );
                                }
                                const pageNum = Number(p);
                                return (
                                    <button
                                        key={`top-${pageNum}`}
                                        type="button"
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                            pageNum === currentPage
                                                ? 'bg-purple-600 text-white shadow-2xs'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="p-1.5 rounded-lg border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                                title="Next Page"
                            >
                                <CaretRightIcon size={14} weight="bold" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MAIN CONTENT AREA ── */}
            <main>
                <AnimatePresence mode="wait">
                    {view === 'jobs' ? (
                        <motion.div
                            key="jobs-view"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                        >
                            {isLoadingJobs ? (
                                <div className="text-center py-14 bg-km-surface-card rounded-2xl border border-purple-100/80 shadow-xs">
                                    <CircleNotchIcon className="w-7 h-7 text-purple-600 animate-spin mx-auto mb-2" />
                                    <p className="text-slate-600 dark:text-slate-300 font-semibold text-xs">Loading job vacancies...</p>
                                </div>
                            ) : filteredJobs.length === 0 ? (
                                <div className="text-center py-14 bg-km-surface-card rounded-2xl border border-purple-100/80 shadow-xs">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-slate-800 flex items-center justify-center text-purple-400 mx-auto mb-3">
                                        <BriefcaseIcon size={24} weight="duotone" />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">No Job Listings Found</h4>
                                    <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                                        {searchQuery || statusFilter !== 'all'
                                            ? 'No job listings match your search criteria.'
                                            : 'There are currently no job vacancies posted on the platform.'}
                                    </p>
                                    {(searchQuery || statusFilter !== 'all') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter('all');
                                                setSearchQuery('');
                                            }}
                                            className="mt-3 px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors cursor-pointer"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* ── CONCISE RESPONSIVE JOB CARDS GRID ── */
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                    {paginatedJobs.map((job) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            key={job.id}
                                            className="bg-km-surface-card rounded-2xl p-4 border border-purple-100/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between relative"
                                        >
                                            {/* Top Card Row */}
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-2.5">
                                                    {/* Company Initial Badge */}
                                                    <div className="w-9 h-9 bg-linear-to-br from-purple-100 to-indigo-100 dark:from-purple-950/60 dark:to-indigo-950/60 rounded-xl flex items-center justify-center text-purple-700 dark:text-purple-300 text-sm font-black shrink-0 border border-purple-200/60 dark:border-purple-800 shadow-xs">
                                                        {job.company ? job.company.substring(0, 1).toUpperCase() : 'J'}
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {/* Status Pill */}
                                                        {job.status === 'Active' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                <span>Active</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                <span>Closed</span>
                                                            </span>
                                                        )}

                                                        {/* Moderation Dropdown Menu */}
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuId(activeMenuId === job.id ? null : job.id);
                                                                }}
                                                                disabled={processingJobId === job.id}
                                                                className={`p-1.5 rounded-lg transition-all border cursor-pointer ${
                                                                    activeMenuId === job.id
                                                                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                                                                        : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                                }`}
                                                                title="Job Actions"
                                                            >
                                                                {processingJobId === job.id ? (
                                                                    <CircleNotchIcon weight="bold" size={14} className="animate-spin text-purple-600" />
                                                                ) : (
                                                                    <DotsThreeVerticalIcon weight="bold" size={14} />
                                                                )}
                                                            </button>

                                                            <AnimatePresence>
                                                                {activeMenuId === job.id && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                                        transition={{ duration: 0.15 }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-purple-100 dark:border-slate-800 p-1 z-50 flex flex-col gap-0.5"
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleToggleStatus(e, job)}
                                                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-left cursor-pointer"
                                                                        >
                                                                            {job.status === 'Active' ? (
                                                                                <>
                                                                                    <PauseCircleIcon weight="bold" size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                                                    <span>Close Vacancy</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <PlayCircleIcon weight="bold" size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                                    <span>Re-open Vacancy</span>
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5"></div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleDeleteJob(e, job)}
                                                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors text-left cursor-pointer"
                                                                        >
                                                                            <TrashIcon weight="bold" size={15} className="shrink-0" />
                                                                            <span>Delete Vacancy</span>
                                                                        </button>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Job Title: full words clearly visible, no trimming */}
                                                <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors break-words leading-snug">
                                                    {job.title}
                                                </h3>

                                                {/* Company Name */}
                                                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 break-words">
                                                    <BuildingOfficeIcon weight="bold" size={13} className="shrink-0 text-slate-400" />
                                                    <span className="break-words">{job.company}</span>
                                                </div>

                                                {/* Badges / Chips */}
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {/* Salary */}
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100/90 dark:border-purple-800/50 rounded-lg text-[11px] font-semibold text-purple-700 dark:text-purple-300 break-words">
                                                        <CurrencyInrIcon weight="bold" size={13} className="shrink-0" />
                                                        <span className="break-words">{job.salary}</span>
                                                    </div>

                                                    {/* Location */}
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 break-words">
                                                        <MapPinIcon weight="bold" size={13} className="shrink-0 text-slate-400" />
                                                        <span className="break-words">{job.location}</span>
                                                    </div>

                                                    {/* Job Type */}
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 break-words">
                                                        <BriefcaseIcon weight="bold" size={13} className="shrink-0 text-slate-400" />
                                                        <span className="break-words">{job.type}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Card Footer */}
                                            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium mb-2.5">
                                                    <span className="flex items-center gap-1">
                                                        <UsersIcon weight="bold" size={13} className="text-slate-400" />
                                                        <span>{job.candidatesCount} applicant{job.candidatesCount === 1 ? '' : 's'}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <CalendarBlankIcon weight="bold" size={13} className="text-slate-400" />
                                                        <span>Posted {job.postedAt}</span>
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleViewCandidates(job)}
                                                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                                >
                                                    <span>View Candidates</span>
                                                    <ArrowRightIcon weight="bold" size={13} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {/* ── BOTTOM PAGINATION BAR (Bottom Right) ── */}
                            {!isLoadingJobs && filteredJobs.length > 0 && (
                                <div className="mt-4 bg-km-surface-card px-4 sm:px-5 py-3 rounded-2xl border border-purple-50 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                                        Showing <strong className="text-slate-800 dark:text-white font-bold">{startIndex}</strong> - <strong className="text-slate-800 dark:text-white font-bold">{endIndex}</strong> of <strong className="text-slate-800 dark:text-white font-bold">{filteredJobs.length}</strong> jobs
                                    </p>

                                    {/* Bottom Right Pagination Controls */}
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs mr-1 hidden sm:inline">
                                            Page <strong className="text-slate-800 dark:text-white">{currentPage}</strong> of <strong className="text-slate-800 dark:text-white">{totalPages}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            disabled={currentPage <= 1}
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            className="p-1.5 rounded-lg border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                                            title="Previous Page"
                                        >
                                            <CaretLeftIcon size={14} weight="bold" />
                                        </button>
                                        {getPageNumbers().map((p, idx) => {
                                            if (p === '...') {
                                                return (
                                                    <span key={`bottom-ellipsis-${idx}`} className="w-5 text-center text-xs text-slate-400 font-bold select-none">
                                                        ...
                                                    </span>
                                                );
                                            }
                                            const pageNum = Number(p);
                                            return (
                                                <button
                                                    key={`bottom-${pageNum}`}
                                                    type="button"
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                                        pageNum === currentPage
                                                            ? 'bg-purple-600 text-white shadow-2xs'
                                                            : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            disabled={currentPage >= totalPages}
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            className="p-1.5 rounded-lg border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                                            title="Next Page"
                                        >
                                            <CaretRightIcon size={14} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        /* ── CANDIDATES VIEW IN COMPACT CARDS ── */
                        <motion.div
                            key="candidates-view"
                            initial={{ opacity: 0, x: 15 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -15 }}
                            className="space-y-4"
                        >
                            {/* Selected Job Context Card */}
                            <div className="bg-km-surface-card rounded-2xl p-4 border border-purple-100/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[11px] font-bold border border-purple-100">
                                            {selectedJob?.type || 'Role'}
                                        </span>
                                        <span className="text-xs font-medium text-slate-400">at {selectedJob?.company}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">
                                        {selectedJob?.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 pt-0.5">
                                        <span className="flex items-center gap-1">
                                            <CurrencyInrIcon weight="bold" size={13} className="text-purple-600" />
                                            {selectedJob?.salary}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <MapPinIcon weight="bold" size={13} className="text-purple-600" />
                                            {selectedJob?.location}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setView('jobs')}
                                    className="px-3.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-slate-800 dark:text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 self-start md:self-auto cursor-pointer"
                                >
                                    <CaretLeftIcon weight="bold" size={14} />
                                    <span>Back to Listings</span>
                                </button>
                            </div>

                            {/* Candidate Cards Grid */}
                            {isLoadingCandidates ? (
                                <div className="text-center py-14 bg-km-surface-card rounded-2xl border border-purple-100/80 shadow-xs">
                                    <CircleNotchIcon className="w-7 h-7 text-purple-600 animate-spin mx-auto mb-2" />
                                    <p className="text-slate-600 dark:text-slate-300 font-semibold text-xs">Loading applicants...</p>
                                </div>
                            ) : candidates.length === 0 ? (
                                <div className="text-center py-14 bg-km-surface-card rounded-2xl border border-purple-100/80 shadow-xs">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-slate-800 flex items-center justify-center text-purple-400 mx-auto mb-3">
                                        <UsersIcon size={24} weight="duotone" />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">No Candidates Yet</h4>
                                    <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                                        No candidates have submitted an application for this vacancy yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {candidates.map((candidate) => (
                                        <div
                                            key={candidate.id}
                                            className="bg-km-surface-card rounded-2xl p-4 border border-purple-100/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="relative shrink-0">
                                                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-white shadow-xs ring-1 ring-purple-500/10 dark:border-slate-800">
                                                            <img
                                                                src={candidate.photo}
                                                                alt={candidate.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 border border-white dark:border-slate-800 p-0.5 rounded-lg shadow-xs">
                                                            <UserCheckIcon weight="bold" size={10} className="text-white" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-1.5">
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white break-words leading-snug">
                                                                {candidate.name}
                                                            </h4>
                                                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                                                {candidate.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-500 break-words leading-tight">
                                                            {candidate.role}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 flex items-center gap-1 break-words">
                                                            <MapPinIcon size={11} weight="bold" className="shrink-0" />
                                                            <span>{candidate.location}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Experience Pill */}
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 rounded-lg text-[11px] font-bold text-purple-700 dark:text-purple-300 break-words w-full">
                                                    <StarIcon weight="fill" size={12} className="shrink-0 text-amber-500" />
                                                    <span className="break-words">Experience: {candidate.experience}</span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewResume(candidate)}
                                                    className="py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold hover:bg-purple-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                                >
                                                    <FileTextIcon weight="bold" size={14} />
                                                    <span>Resume</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="py-1.5 px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                                                >
                                                    <span>Interview</span>
                                                    <CalendarBlankIcon weight="bold" size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default function JobsPage() {
    return (
        <Suspense fallback={
            <div className="bg-km-surface-card rounded-[28px] p-20 flex flex-col items-center justify-center gap-4 shadow-sm border border-purple-100/60">
                <CircleNotchIcon className="w-10 h-10 text-purple-600 animate-spin dark:text-purple-400" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Loading job listings...</p>
            </div>
        }>
            <JobsContent />
        </Suspense>
    );
}




