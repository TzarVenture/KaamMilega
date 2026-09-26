'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    Filter,
    MapPin,
    Briefcase,
    DollarSign,
    Users,
    ChevronLeft,
    MoreVertical,
    Calendar,
    Star,
    ArrowRight,
    FileText,
    UserCheck,
    Building2,
    Plus,
    PauseCircle,
    PlayCircle,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import ResumeModal from '@/components/modals/admin/ResumeModal';
import api from '@/lib/axios';

export default function JobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
                candidatesCount: 0,
                postedAt: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recently'
            }));
            setJobs(mappedJobs);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            toast.error('Failed to load job listings');
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
                toast.info(`Vacancy for "${job.title}" has been closed.`);
            } else {
                toast.success(`Vacancy for "${job.title}" is now active.`);
            }
        } catch (error: any) {
            console.error('Failed to update job status:', error);
            toast.error(error.response?.data?.error || 'Failed to update job status');
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
            toast.success(`Job "${job.title}" deleted successfully.`);
        } catch (error: any) {
            console.error('Failed to delete job:', error);
            toast.error(error.response?.data?.error || 'Failed to delete job');
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
                        status: app.status,
                        photo: user.profile_image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150'
                    };
                } catch (e) {
                    return {
                        id: app.id,
                        name: 'Candidate',
                        role: 'Applicant',
                        status: app.status,
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

    // Filter jobs by search
    const filteredJobs = jobs.filter((job) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            job.title.toLowerCase().includes(q) ||
            job.company.toLowerCase().includes(q) ||
            job.location.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-8">
            <ResumeModal
                isOpen={isResumeOpen}
                onClose={() => setIsResumeOpen(false)}
                candidateName={selectedCandidate?.name || ''}
                resumeUrl="https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=2070&auto=format&fit=crop"
            />

            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        {view === 'candidates' && (
                            <button
                                onClick={() => setView('jobs')}
                                className="p-2 hover:bg-purple-50 rounded-xl text-purple-600 transition-colors mr-2 border border-purple-100"
                            >
                                <ChevronLeft size={22} />
                            </button>
                        )}
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">
                            {view === 'jobs' ? 'Job Listings & Moderation' : `Candidates — ${selectedJob?.title}`}
                        </h1>
                    </div>
                    <p className="text-slate-500 font-medium">
                        {view === 'jobs'
                            ? `Monitoring ${jobs.length} vacancies across the platform`
                            : `Reviewing applications for this role`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={view === 'jobs' ? "Search title, company..." : "Search candidates..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:border-purple-300 transition-all shadow-sm"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-2.5 text-slate-600 bg-white border border-purple-100 rounded-2xl text-sm font-bold hover:bg-purple-50 transition-all shadow-sm">
                        <Filter size={18} />
                        <span>Filter</span>
                    </button>
                </div>
            </div>

            <main className="space-y-6">
                <AnimatePresence mode="wait">
                    {view === 'jobs' ? (
                        <motion.div
                            key="jobs-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 gap-6"
                        >
                            {isLoadingJobs ? (
                                <div className="text-center py-16 bg-white rounded-3xl border border-purple-50">
                                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium text-sm">Loading job vacancies...</p>
                                </div>
                            ) : filteredJobs.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-3xl border border-purple-50">
                                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h4 className="text-base font-bold text-slate-700">No Job Listings Found</h4>
                                    <p className="text-slate-400 text-sm mt-1">Try adjusting your search filters.</p>
                                </div>
                            ) : (
                                filteredJobs.map((job) => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                                        transition={{ duration: 0.25 }}
                                        key={job.id}
                                        className="bg-white rounded-[32px] p-8 border border-purple-100/70 shadow-sm hover:border-purple-200 transition-all group relative"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                            <div className="flex items-start gap-6">
                                                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-700 text-2xl font-bold shrink-0 border border-purple-100">
                                                    {job.company.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                                                            {job.title}
                                                        </h3>
                                                        <span className="text-xs font-semibold text-slate-400">at {job.company}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                                        <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                                            <DollarSign size={16} className="text-purple-600" />
                                                            <span>{job.salary}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                                            <MapPin size={16} className="text-purple-600" />
                                                            <span>{job.location}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                                            <Briefcase size={16} className="text-purple-600" />
                                                            <span>{job.type}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 relative">
                                                <button
                                                    onClick={() => handleViewCandidates(job)}
                                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                                                >
                                                    <span>View Candidates</span>
                                                    <ArrowRight size={15} />
                                                </button>

                                                {/* More Moderation Actions Trigger */}
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuId(activeMenuId === job.id ? null : job.id);
                                                        }}
                                                        disabled={processingJobId === job.id}
                                                        className={`p-2.5 rounded-xl transition-all border ${activeMenuId === job.id
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50 bg-white border-slate-200'
                                                        }`}
                                                        title="Moderate Job"
                                                    >
                                                        {processingJobId === job.id ? (
                                                            <Loader2 size={18} className="animate-spin text-purple-600" />
                                                        ) : (
                                                            <MoreVertical size={18} />
                                                        )}
                                                    </button>

                                                    {/* Moderation Dropdown Popover */}
                                                    <AnimatePresence>
                                                        {activeMenuId === job.id && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                                transition={{ duration: 0.15 }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-purple-100 p-1.5 z-50 flex flex-col gap-1"
                                                            >
                                                                <button
                                                                    onClick={(e) => handleToggleStatus(e, job)}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 rounded-xl transition-colors text-left"
                                                                >
                                                                    {job.status === 'Active' ? (
                                                                        <>
                                                                            <PauseCircle size={16} className="text-amber-600" />
                                                                            <span>Close Vacancy</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <PlayCircle size={16} className="text-emerald-600" />
                                                                            <span>Re-open Vacancy</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <div className="h-px bg-slate-100 my-0.5"></div>
                                                                <button
                                                                    onClick={(e) => handleDeleteJob(e, job)}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                                                                >
                                                                    <Trash2 size={16} />
                                                                    <span>Delete Job Vacancy</span>
                                                                </button>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Footer Status */}
                                        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                                            {job.status === 'Active' ? (
                                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    <span>Active Post</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                                    <span>Closed Post</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                                                <div className="flex items-center gap-1">
                                                    <Users size={14} />
                                                    <span>{job.candidatesCount} applications</span>
                                                </div>
                                                <span>•</span>
                                                <p>Posted {job.postedAt}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="candidates-view"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white rounded-[32px] border border-purple-50 shadow-sm overflow-hidden"
                        >
                            <div className="p-8 border-b border-purple-50 bg-slate-50/30 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900">All Candidate List</h3>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">{candidates.length} Total</span>
                                </div>
                            </div>

                            <div className="divide-y divide-purple-50/50">
                                {candidates.length === 0 ? (
                                    <div className="text-center py-16">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-slate-500">No candidates have applied for this vacancy yet.</p>
                                    </div>
                                ) : (
                                    candidates.map((candidate) => (
                                        <div key={candidate.id} className="p-8 hover:bg-purple-50/20 transition-all group flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="relative">
                                                    <div className="w-20 h-20 bg-slate-100 rounded-3xl overflow-hidden border-2 border-white shadow-md ring-4 ring-purple-500/5">
                                                        <img src={candidate.photo} alt={candidate.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-2 border-white p-1.5 rounded-2xl shadow-sm">
                                                        <UserCheck size={14} className="text-white" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <h4 className="text-xl font-black text-slate-900 group-hover:text-purple-700 transition-colors">{candidate.name}</h4>
                                                    <p className="text-sm font-bold text-slate-500 italic">{candidate.role} • {candidate.location}</p>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                                                            <Star size={12} fill="currentColor" />
                                                            Experience: {candidate.experience}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handleViewResume(candidate)}
                                                    className="px-6 py-2.5 bg-white border border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-50 transition-all flex items-center gap-2 shadow-sm"
                                                >
                                                    <FileText size={16} />
                                                    View Resume
                                                </button>
                                                <button
                                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 uppercase tracking-tight"
                                                >
                                                    Assign Interview
                                                    <Calendar size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

