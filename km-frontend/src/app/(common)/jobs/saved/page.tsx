"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BookmarkCheck, Search, MapPin, CheckCircle2, Trash2, ArrowLeft, Users, ArrowUpRight } from 'lucide-react';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';

interface Job {
    id: string;
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
    vacancies: number;
    created_at: string;
}

export default function SavedJobsPage() {
    const [savedJobs, setSavedJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
    const [user, setUser] = useState<any>(null);

    const fetchSavedJobs = useCallback(async () => {
        setLoading(true);
        try {
            const userData: any = await api.get('/user/profile').catch(() => null);
            setUser(userData);

            if (!userData) {
                toast.info("Please login to view saved jobs");
                setLoading(false);
                return;
            }

            const bookmarkedIds: string[] = userData.bookmarked_jobs || [];
            if (bookmarkedIds.length === 0) {
                setSavedJobs([]);
                setLoading(false);
                return;
            }

            // Fetch all jobs and filter bookmarked
            const jobsRes: any = await api.get('/jobs', { params: { limit: 100 } });
            const allJobs: Job[] = jobsRes.jobs || [];
            const filtered = allJobs.filter(j => bookmarkedIds.includes(j.id));
            setSavedJobs(filtered);

            // Fetch my applications
            const myApps = await api.get('/applications/my').catch(() => []) as any[];
            if (Array.isArray(myApps)) {
                setAppliedJobIds(new Set(myApps.map((a: any) => a.job_id || a.job?.id).filter(Boolean)));
            }
        } catch (error) {
            console.error("Failed to load saved jobs", error);
            toast.error("Failed to load saved jobs");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSavedJobs();
    }, [fetchSavedJobs]);

    const handleRemoveBookmark = async (jobId: string) => {
        try {
            setSavedJobs(prev => prev.filter(j => j.id !== jobId));
            await api.post(`/user/bookmark/${jobId}`);
            toast.success("Job removed from saved items");
        } catch (error) {
            toast.error("Failed to remove saved job");
            fetchSavedJobs();
        }
    };

    const handleApply = async (jobId: string) => {
        if (appliedJobIds.has(jobId)) {
            toast.info("Already applied to this job");
            return;
        }

        try {
            await api.post('/applications', { job_id: jobId });
            toast.success("Applied successfully");
            setAppliedJobIds(prev => new Set(prev).add(jobId));
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to apply");
        }
    };

    const filteredJobs = savedJobs.filter(j =>
        j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.city_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#F4F7FB] py-8 sm:py-10 font-sans text-[#111827]">
            <ToastContainer />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B5ED7] hover:underline mb-2">
                            <ArrowLeft size={14} /> Back to All Jobs
                        </Link>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight flex items-center gap-3">
                            <BookmarkCheck className="w-7 h-7 text-[#0B5ED7]" />
                            <span>Saved Jobs</span>
                        </h1>
                        <p className="text-[#5B6472] font-normal text-xs sm:text-sm mt-1">
                            {savedJobs.length} {savedJobs.length === 1 ? 'job' : 'jobs'} saved for later
                        </p>
                    </div>

                    {/* Search bar */}
                    {savedJobs.length > 0 && (
                        <div className="relative min-w-72">
                            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#5B6472]" />
                            <input
                                type="text"
                                placeholder="Search saved jobs..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D9E0EA] rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#5B6472]/70 focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all shadow-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="space-y-3.5">
                        {[1, 2, 3].map(n => (
                            <div key={n} className="h-40 bg-white rounded-2xl animate-shimmer shadow-xs border border-[#D9E0EA]" />
                        ))}
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#D9E0EA] p-10 text-center shadow-xs">
                        <div className="w-16 h-16 bg-[#FFFBEB] border border-[#FDE68A] text-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xs">
                            <BookmarkCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-[#111827] mb-1.5">No Saved Jobs Found</h3>
                        <p className="text-[#5B6472] max-w-md mx-auto text-xs sm:text-sm font-normal leading-relaxed mb-6">
                            {savedJobs.length === 0
                                ? "You have not saved any jobs yet. Browse active job listings and click the bookmark icon to save them for quick reference."
                                : "No saved jobs match your current search query."}
                        </p>
                        <Link
                            href="/jobs"
                            className="btn-primary text-xs px-5 py-2.5 inline-flex items-center gap-1.5"
                        >
                            <span>Browse Jobs</span>
                            <ArrowUpRight size={14} />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3.5">
                        {filteredJobs.map((job) => (
                            <div key={job.id} className="bg-white p-5 sm:p-6 rounded-2xl border border-[#D9E0EA] shadow-xs hover:border-[#0B5ED7]/50 hover:shadow-sm transition-all flex flex-col xl:flex-row justify-between items-start gap-5">
                                <div className="flex-1 min-w-0">
                                    <Link href={`/jobs/${job.id}`}>
                                        <h3 className="text-lg sm:text-xl font-bold text-[#111827] hover:text-[#0B5ED7] transition-colors line-clamp-1 mb-1">
                                            {job.title}
                                        </h3>
                                    </Link>
                                    <p className="text-[#5B6472] font-medium text-xs mb-3 flex items-center gap-2">
                                        <span>{job.company}</span>
                                        <span className="w-1 h-1 rounded-full bg-[#D9E0EA]" />
                                        <span className="text-[#0B5ED7] font-semibold">Saved Item</span>
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#111827]">
                                        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#F4F7FB] border border-[#D9E0EA]">
                                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 w-6 h-6 rounded-lg flex items-center justify-center text-xs">₹</span>
                                            <span className="font-bold">₹{job.salary_min?.toLocaleString('en-IN') || 0} - ₹{job.salary_max?.toLocaleString('en-IN') || 0} / mo</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#F4F7FB] border border-[#D9E0EA]">
                                            <MapPin size={15} className="text-[#0B5ED7]" />
                                            <span className="font-semibold">{job.location || 'Flexible'}, {job.city_name}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className="px-2.5 py-1 bg-[#F4F7FB] text-[#5B6472] text-xs font-medium rounded-lg border border-[#D9E0EA]">
                                            {job.job_type}
                                        </span>
                                        <span className="px-2.5 py-1 bg-[#F4F7FB] text-[#5B6472] text-xs font-medium rounded-lg border border-[#D9E0EA] flex items-center gap-1">
                                            <Users size={12} className="text-[#5B6472]" />
                                            <span>{job.vacancies || 1} Openings</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-row xl:flex-col items-center gap-2.5 w-full xl:w-auto pt-3 xl:pt-0 border-t xl:border-0 border-[#D9E0EA]">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveBookmark(job.id)}
                                        className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center text-xs font-semibold gap-1.5 border border-rose-200 cursor-pointer"
                                        title="Remove from saved"
                                    >
                                        <Trash2 size={15} />
                                        <span className="xl:hidden">Remove</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleApply(job.id)}
                                        disabled={appliedJobIds.has(job.id)}
                                        className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                            appliedJobIds.has(job.id)
                                                ? 'bg-emerald-600 text-white cursor-default shadow-xs'
                                                : 'btn-primary shadow-xs'
                                        }`}
                                    >
                                        {appliedJobIds.has(job.id) ? (
                                            <>
                                                <CheckCircle2 size={14} /> Applied
                                            </>
                                        ) : (
                                            'Apply Now'
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
