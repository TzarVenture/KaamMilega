'use client';

import React, { useState, useEffect } from 'react';
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
    Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ResumeModal from '@/components/modals/admin/ResumeModal';

// Mock Data
import api from '@/lib/axios';

export default function JobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

    const [view, setView] = useState<'jobs' | 'candidates'>('jobs');
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [isResumeOpen, setIsResumeOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // @ts-ignore
                const response = await api.get('/jobs');
                const data = (response as any).jobs || response; // Handle { jobs: [], total: ... } or []
                const jobsData = Array.isArray(data) ? data : (data.jobs || []);

                const mappedJobs = jobsData.map((job: any) => ({
                    id: job.id,
                    title: job.title,
                    company: job.company_name || 'Unknown',
                    salary: `₹${job.salary_min} - ₹${job.salary_max}`,
                    location: job.location || job.city_name,
                    type: job.job_type,
                    status: job.status || 'Active',
                    candidatesCount: 0, // Backend doesn't return this yet for list
                    postedAt: new Date(job.created_at).toLocaleDateString()
                }));
                setJobs(mappedJobs);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingJobs(false);
            }
        };
        fetchJobs();
    }, []);

    const handleViewCandidates = async (job: any) => {
        setSelectedJob(job);
        setView('candidates');
        setIsLoadingCandidates(true);
        try {
            // @ts-ignore
            const response = await api.get(`/applications/job/${job.id}`);
            const applications = response as unknown as any[];

            // Enrich with user details
            const enrichedCandidates = await Promise.all(applications.map(async (app: any) => {
                try {
                    // @ts-ignore
                    const userRes = await api.get(`/user/${app.candidate_id}`);
                    const user = userRes as any;
                    return {
                        id: app.id,
                        name: user.name || 'Unknown',
                        role: user.headline || 'Job Seeker',
                        location: user.city || 'Unknown',
                        experience: user.work_experience || 'Not specified',
                        status: app.status,
                        photo: user.profile_image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150'
                    };
                } catch (e) {
                    return {
                        id: app.id,
                        name: 'Unknown User',
                        role: 'Unknown',
                        status: app.status,
                        photo: ''
                    };
                }
            }));

            setCandidates(enrichedCandidates);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingCandidates(false);
        }
    };

    const handleViewResume = (candidate: any) => {
        setSelectedCandidate(candidate);
        setIsResumeOpen(true);
    };

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
                                className="p-2 hover:bg-purple-50 rounded-xl text-purple-600 transition-colors mr-2"
                            >
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">
                            {view === 'jobs' ? 'Job Listings' : `Candidates - ${selectedJob?.title}`}
                        </h1>
                    </div>
                    <p className="text-slate-500 font-medium">
                        {view === 'jobs'
                            ? 'Monitor and manage all active job vacancies'
                            : `Reviewing ${selectedJob?.candidatesCount} applications for this role`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={view === 'jobs' ? "Search jobs..." : "Search candidates..."}
                            className="w-full sm:w-64 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all shadow-sm"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-2.5 text-slate-600 bg-white border border-purple-100 rounded-2xl text-sm font-bold hover:bg-purple-50 transition-all shadow-sm">
                        <Filter size={18} />
                        <span>Filter</span>
                    </button>
                    {view === 'jobs' && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-purple-200"
                        >
                            <Plus size={18} />
                            <span>Post Job</span>
                        </motion.button>
                    )}
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
                            {jobs.map((job) => (
                                <div key={job.id} className="bg-white rounded-[32px] p-8 border border-purple-50 shadow-xl shadow-purple-900/5 hover:shadow-purple-900/10 transition-all group relative">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div className="flex items-start gap-6">
                                            <div className="w-16 h-16 bg-gradient-to-tr from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center text-purple-700 text-2xl font-bold shrink-0">
                                                {job.company.substring(0, 1)}
                                            </div>
                                            <div className="space-y-3">
                                                <h3 className="text-2xl font-black text-slate-900 group-hover:text-purple-700 transition-colors">{job.title}</h3>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                                    <div className="flex items-center gap-2 text-slate-500 font-bold text-sm italic">
                                                        <DollarSign size={16} className="text-purple-600" />
                                                        <span>{job.salary}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500 font-bold text-sm italic">
                                                        <MapPin size={16} className="text-purple-600" />
                                                        <span>{job.location}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500 font-bold text-sm italic">
                                                        <Briefcase size={16} className="text-purple-600" />
                                                        <span>{job.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <button
                                                className="px-6 py-3 bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
                                            >
                                                <Briefcase size={18} className="text-purple-600" />
                                                Remote Job
                                            </button>
                                            <button
                                                onClick={() => handleViewCandidates(job)}
                                                className="px-8 py-3 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 active:scale-95 flex items-center gap-2 uppercase tracking-tight"
                                            >
                                                View Candidates
                                                <ArrowRight size={18} />
                                            </button>
                                            <button className="p-3 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all border border-transparent hover:border-purple-100">
                                                <MoreVertical size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            {job.status} Post
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1 text-slate-400 text-sm font-medium">
                                                <Users size={16} />
                                                <span>{job.candidatesCount} candidates applied</span>
                                            </div>
                                            <span className="text-slate-300">•</span>
                                            <p className="text-slate-400 text-sm font-medium italic">Shared {job.postedAt}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="candidates-view"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white rounded-[32px] border border-purple-50 shadow-xl shadow-purple-900/5 overflow-hidden"
                        >
                            <div className="p-8 border-b border-purple-50 bg-slate-50/30 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900">All Candidate List</h3>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">{candidates.length} Total</span>
                                </div>
                            </div>

                            <div className="divide-y divide-purple-50/50">
                                {candidates.map((candidate) => (
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
                                                className="px-6 py-3 bg-white border border-purple-200 text-purple-700 rounded-2xl text-sm font-bold hover:bg-purple-50 transition-all flex items-center gap-2 shadow-sm"
                                            >
                                                <FileText size={18} />
                                                View Resume
                                            </button>
                                            <button
                                                className="px-8 py-3 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 active:scale-95 flex items-center gap-2 uppercase tracking-tight"
                                            >
                                                Assign Interview
                                                <Calendar size={18} />
                                            </button>
                                            <button className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent">
                                                <MoreVertical size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-8 bg-slate-50/30 border-t border-purple-50 flex items-center justify-between">
                                <p className="text-[13px] text-slate-500 font-medium">Showing <span className="text-slate-900 font-bold">{candidates.length}</span> of <span className="text-slate-900 font-bold">{candidates.length}</span> total applicants</p>
                                <div className="flex items-center gap-2">
                                    <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/20 text-xs">1</button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
