'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Search,
    ArrowLeft,
    MapPin,
    Briefcase,
    DollarSign,
    Users,
    Loader2,
    Building2,
    TrendingUp,
    Map,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Globe2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';

interface City {
    id: string;
    name: string;
    state?: string;
    country?: string;
    active?: boolean;
    vacancies?: string;
    jobs_count?: number;
    total_vacancies?: number;
}

interface Job {
    id: string;
    title: string;
    company: string;
    salary_min?: number;
    salary_max?: number;
    salary_range?: string;
    location?: string;
    city_name?: string;
    job_type?: string;
    status?: string;
    requirements?: string[];
    applicant_count?: number;
    created_at?: string;
}

function JobCityWiseContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // The active city is controlled directly by the URL query parameter ?city=...
    const activeCityName = searchParams.get('city') || '';
    const view: 'cities' | 'jobs' = activeCityName ? 'jobs' : 'cities';

    const [cities, setCities] = useState<City[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isJobsLoading, setIsJobsLoading] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'with_vacancies'>('all');
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [processingJobId, setProcessingJobId] = useState<string | null>(null);

    // Fetch all cities with live vacancy aggregation
    const fetchCities = async () => {
        setIsLoading(true);
        try {
            const response: any = await api.get(`/cities?limit=100&search=${searchTerm}`);
            if (response && Array.isArray(response)) {
                setCities(response);
            } else if (response && response.data) {
                setCities(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch cities:', error);
            setActionMessage({
                type: 'error',
                message: 'Failed to load cities from database.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch live jobs for the active city from query param
    const fetchJobsByCity = async (cityName: string) => {
        setIsJobsLoading(true);
        try {
            const cleanName = cityName.trim();
            const response: any = await api.get(`/admin/jobs?city=${encodeURIComponent(cleanName)}&search=${encodeURIComponent(searchTerm)}`);
            const jobList = response?.jobs || response?.data || (Array.isArray(response) ? response : []);
            setJobs(jobList);
        } catch (error) {
            console.error('Failed to fetch jobs by city:', error);
            // Fallback to public endpoint query
            try {
                const fallbackRes: any = await api.get(`/jobs?city=${encodeURIComponent(cityName.trim())}`);
                const fallbackList = fallbackRes?.jobs || fallbackRes?.data || (Array.isArray(fallbackRes) ? fallbackRes : []);
                setJobs(fallbackList);
            } catch (err) {
                setJobs([]);
            }
        } finally {
            setIsJobsLoading(false);
        }
    };

    // Reactively fetch based on URL query param changes
    useEffect(() => {
        if (activeCityName) {
            fetchJobsByCity(activeCityName);
        } else {
            fetchCities();
        }
    }, [activeCityName, searchTerm]);

    // Summary Analytics
    const totalVacanciesCount = useMemo(() => {
        return cities.reduce((acc, c) => acc + (c.jobs_count || 0), 0);
    }, [cities]);

    const topCity = useMemo(() => {
        if (!cities.length) return null;
        return [...cities].sort((a, b) => (b.jobs_count || 0) - (a.jobs_count || 0))[0];
    }, [cities]);

    const selectedCity = useMemo(() => {
        if (!activeCityName) return null;
        return cities.find((c) => c.name.toLowerCase() === activeCityName.toLowerCase()) || {
            id: '',
            name: activeCityName
        };
    }, [cities, activeCityName]);

    const filteredCities = useMemo(() => {
        return cities.filter((c) => {
            const matchesSearch =
                !searchTerm.trim() ||
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.state || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesVacancyFilter =
                filterCategory === 'all' || (c.jobs_count || 0) > 0;

            return matchesSearch && matchesVacancyFilter;
        });
    }, [cities, searchTerm, filterCategory]);

    // Navigate to specific city (updates browser history stack)
    const handleCityClick = (city: City) => {
        setSearchTerm('');
        router.push(`/admin/job-city?city=${encodeURIComponent(city.name.trim())}`);
    };

    // Navigate back to All Cities (updates browser history stack)
    const handleBack = () => {
        setSearchTerm('');
        router.push('/admin/job-city');
    };

    // Close / Remove Job
    const handleCloseJob = async (jobId: string, jobTitle: string) => {
        if (!confirm(`Are you sure you want to close or remove "${jobTitle}"?`)) return;

        setProcessingJobId(jobId);
        try {
            await api.patch(`/admin/jobs/${jobId}/status`, { status: 'Closed' });
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
            setActionMessage({
                type: 'success',
                message: `Job vacancy "${jobTitle}" closed successfully.`
            });
            if (activeCityName) {
                setCities((prev) =>
                    prev.map((c) =>
                        c.name.toLowerCase() === activeCityName.toLowerCase()
                            ? {
                                  ...c,
                                  jobs_count: Math.max(0, (c.jobs_count || 1) - 1),
                                  vacancies: `${Math.max(0, (c.jobs_count || 1) - 1)} Active Vacancies`
                              }
                            : c
                    )
                );
            }
        } catch (error: any) {
            console.error('Job removal failed:', error);
            setActionMessage({
                type: 'error',
                message: error?.response?.data?.error || 'Failed to update job status.'
            });
        } finally {
            setProcessingJobId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Status Feedback Banner */}
            {actionMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center justify-between gap-3 p-4 rounded-2xl border text-xs sm:text-sm font-semibold ${
                        actionMessage.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {actionMessage.type === 'success' ? (
                            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle size={18} className="text-rose-600 shrink-0" />
                        )}
                        <span>{actionMessage.message}</span>
                    </div>
                    <button
                        onClick={() => setActionMessage(null)}
                        className="text-xs font-bold hover:underline opacity-80"
                    >
                        Dismiss
                    </button>
                </motion.div>
            )}

            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-[28px] border border-purple-100/60 shadow-sm">
                <div className="flex items-center gap-4">
                    {view === 'jobs' && (
                        <button
                            onClick={handleBack}
                            className="p-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-2xl transition-all border border-purple-200 shadow-sm"
                            title="Back to all cities"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-700 shrink-0">
                                <Map size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-900 bg-clip-text text-transparent">
                                    {view === 'cities' ? 'Job City Mapping & Vacancy Aggregator' : `${activeCityName} Job Listings`}
                                </h1>
                                <p className="text-slate-500 text-xs sm:text-sm font-medium">
                                    {view === 'cities'
                                        ? 'Real-time geographic distribution of jobs and verified recruiter vacancies across India'
                                        : `Active vacancies and hiring positions currently listed in ${activeCityName}, ${selectedCity?.state || 'India'}`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={view === 'cities' ? fetchCities : () => fetchJobsByCity(activeCityName)}
                        disabled={isLoading || isJobsLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={isLoading || isJobsLoading ? 'animate-spin' : ''} />
                        <span>Refresh Data</span>
                    </button>
                </div>
            </div>

            {/* Metric Summary Cards (Shown on Cities view) */}
            {view === 'cities' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-[24px] border border-purple-100/60 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                            <Globe2 size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monitored Cities</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{cities.length}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[24px] border border-purple-100/60 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                            <Briefcase size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Open Vacancies</p>
                            <p className="text-2xl font-black text-emerald-700 mt-0.5">{totalVacanciesCount}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[24px] border border-purple-100/60 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                            <TrendingUp size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Hiring Hub</p>
                            <p className="text-xl font-black text-indigo-900 mt-0.5 truncate">
                                {topCity ? `${topCity.name} (${topCity.jobs_count || 0})` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="bg-white p-6 rounded-[28px] border border-purple-100/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={view === 'cities' ? "Search city or state..." : `Search jobs in ${activeCityName}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-600/5 transition-all"
                    />
                </div>

                {view === 'cities' && (
                    <div className="flex items-center gap-2 self-start md:self-auto overflow-x-auto">
                        <button
                            onClick={() => setFilterCategory('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                filterCategory === 'all'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            All Cities ({cities.length})
                        </button>
                        <button
                            onClick={() => setFilterCategory('with_vacancies')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                filterCategory === 'with_vacancies'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            <span>With Active Jobs</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterCategory === 'with_vacancies' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                {cities.filter((c) => (c.jobs_count || 0) > 0).length}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* Main Content View */}
            <main>
                <AnimatePresence mode="wait">
                    {view === 'cities' ? (
                        <motion.div
                            key="cities-view"
                            initial={{ opacity: 0, scale: 0.99 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.99 }}
                            className="bg-white rounded-[28px] shadow-sm border border-purple-100/60 overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/60">
                                            <th className="px-6 sm:px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                City & State
                                            </th>
                                            <th className="px-6 sm:px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Aggregated Vacancies
                                            </th>
                                            <th className="px-6 sm:px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                                                Status
                                            </th>
                                            <th className="px-6 sm:px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                                                            Aggregating job vacancies per city...
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredCities.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-16 text-center text-slate-400">
                                                    No cities found matching your search query.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCities.map((city) => {
                                                const hasJobs = (city.jobs_count || 0) > 0;
                                                return (
                                                    <tr
                                                        key={city.id}
                                                        onClick={() => handleCityClick(city)}
                                                        className="hover:bg-purple-50/20 transition-colors cursor-pointer group"
                                                    >
                                                        <td className="px-6 sm:px-8 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${hasJobs ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                    <MapPin size={18} />
                                                                </div>
                                                                <div>
                                                                    <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                                                                        {city.name}
                                                                    </span>
                                                                    {city.state && (
                                                                        <p className="text-xs text-slate-400 font-medium">
                                                                            {city.state}, {city.country || 'India'}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-6 sm:px-8 py-4">
                                                            <span
                                                                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                                                                    hasJobs
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                                                }`}
                                                            >
                                                                {city.vacancies || `${city.jobs_count || 0} Vacancies`}
                                                            </span>
                                                        </td>

                                                        <td className="px-6 sm:px-8 py-4 hidden sm:table-cell">
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                                                <span className={`w-2 h-2 rounded-full ${city.active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                                                {city.active !== false ? 'Active Hub' : 'Inactive'}
                                                            </span>
                                                        </td>

                                                        <td className="px-6 sm:px-8 py-4 text-right">
                                                            <button className="px-4 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                                                                View Jobs →
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="jobs-view"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            {isJobsLoading ? (
                                <div className="bg-white rounded-[28px] p-20 flex flex-col items-center justify-center gap-4 shadow-sm border border-purple-100/60">
                                    <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                                        Retrieving real-time jobs in {activeCityName}...
                                    </p>
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="bg-white rounded-[28px] p-16 text-center border border-dashed border-purple-200 shadow-sm space-y-4">
                                    <div className="w-16 h-16 bg-purple-50 rounded-3xl flex items-center justify-center text-3xl mx-auto">
                                        📍
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">No Active Jobs in {activeCityName}</h3>
                                    <p className="text-slate-500 text-xs max-w-md mx-auto">
                                        There are currently no active job postings registered in {activeCityName}. Recruiters can post jobs mapped to this city via the Recruiter Portal.
                                    </p>
                                    <button
                                        onClick={handleBack}
                                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm"
                                    >
                                        ← Back to All Cities
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {jobs.map((job) => {
                                        const isProcessing = processingJobId === job.id;
                                        const salaryDisplay =
                                            job.salary_min && job.salary_max
                                                ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}`
                                                : job.salary_range || 'Competitive Salary';

                                        return (
                                            <div
                                                key={job.id}
                                                className="bg-white rounded-[28px] p-6 sm:p-7 border border-purple-100/60 shadow-sm hover:shadow-md transition-all space-y-4"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-lg font-black text-slate-900">{job.title}</h3>
                                                        <p className="text-xs sm:text-sm font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                            <Building2 size={15} className="text-purple-600" />
                                                            <span>{job.company}</span>
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2 self-start sm:self-auto">
                                                        <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded-full">
                                                            {job.job_type || 'Full Time'}
                                                        </span>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${job.status === 'Closed' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                            {job.status || 'Active'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <DollarSign size={15} className="text-purple-600" />
                                                        <span>{salaryDisplay}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={15} className="text-purple-600" />
                                                        <span>{job.location || job.city_name || activeCityName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Users size={15} className="text-purple-600" />
                                                        <span>{job.applicant_count || 0} Applicants</span>
                                                    </div>
                                                </div>

                                                {job.requirements && job.requirements.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        {job.requirements.slice(0, 4).map((req, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium"
                                                            >
                                                                {req}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                                                    <span className="text-[11px] text-slate-400 font-mono">
                                                        ID: {job.id}
                                                    </span>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleCloseJob(job.id, job.title)}
                                                            disabled={isProcessing}
                                                            className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                                        >
                                                            {isProcessing ? 'Updating...' : 'Close Vacancy'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default function JobCityWisePage() {
    return (
        <Suspense fallback={
            <div className="bg-white rounded-[28px] p-20 flex flex-col items-center justify-center gap-4 shadow-sm border border-purple-100/60">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Loading city mapping...</p>
            </div>
        }>
            <JobCityWiseContent />
        </Suspense>
    );
}
