"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BookmarkCheck, Search, MapPin, CheckCircle2, Phone, MessageCircle, Trash2, ArrowLeft } from 'lucide-react';
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
            toast.success("Applied successfully!");
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
        <div className="min-h-screen bg-[#F8FAFC] py-8 sm:py-12">
            <ToastContainer />
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 mb-2">
                            <ArrowLeft size={14} /> Back to All Jobs
                        </Link>
                        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <BookmarkCheck className="w-8 h-8 text-purple-600 fill-purple-100" />
                            Saved Jobs
                        </h1>
                        <p className="text-gray-500 font-medium text-sm mt-1">
                            {savedJobs.length} {savedJobs.length === 1 ? 'job' : 'jobs'} saved for later
                        </p>
                    </div>

                    {/* Search bar */}
                    {savedJobs.length > 0 && (
                        <div className="relative min-w-72">

                            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search saved jobs..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(n => (
                            <div key={n} className="h-44 bg-white rounded-3xl animate-pulse shadow-sm border border-gray-100" />
                        ))}
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                        <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookmarkCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Saved Jobs Found</h3>
                        <p className="text-gray-500 max-w-md mx-auto text-sm mb-6">
                            {savedJobs.length === 0
                                ? "You haven't bookmarked any jobs yet. Browse job listings and click the bookmark icon to save them for later."
                                : "No saved jobs matched your search query."}
                        </p>
                        <Link
                            href="/jobs"
                            className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-md shadow-purple-200"
                        >
                            Browse Jobs
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredJobs.map((job) => (
                            <div key={job.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col xl:flex-row justify-between items-start gap-6">
                                <div className="flex-1 min-w-0">
                                    <Link href={`/jobs/${job.id}`}>
                                        <h3 className="text-xl font-black text-gray-900 hover:text-purple-600 transition-colors line-clamp-1 mb-1">
                                            {job.title}
                                        </h3>
                                    </Link>
                                    <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <span>{job.company}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        <span className="text-purple-600 italic">Saved Job</span>
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-purple-600">₹</span>
                                            <span>₹{job.salary_min.toLocaleString()} - ₹{job.salary_max.toLocaleString()} / mo</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-gray-400" />
                                            <span>{job.location || 'N/A'}, {job.city_name}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <span className="px-3 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-full uppercase border border-gray-100">
                                            {job.job_type}
                                        </span>
                                        <span className="px-3 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full uppercase border border-purple-100">
                                            {job.vacancies || 1} Openings
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-row xl:flex-col items-center gap-3 w-full xl:w-auto pt-4 xl:pt-0 border-t xl:border-0 border-gray-50">
                                    <button
                                        onClick={() => handleRemoveBookmark(job.id)}
                                        className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center text-xs font-bold gap-1.5"
                                        title="Remove from saved"
                                    >
                                        <Trash2 size={16} />
                                        <span className="xl:hidden">Remove</span>
                                    </button>

                                    <button
                                        onClick={() => handleApply(job.id)}
                                        disabled={appliedJobIds.has(job.id)}
                                        className={`flex-1 xl:flex-none px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                            appliedJobIds.has(job.id)
                                                ? 'bg-emerald-600 text-white cursor-not-allowed'
                                                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
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
