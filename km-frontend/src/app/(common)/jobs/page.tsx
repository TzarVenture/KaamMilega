'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import {
    ChevronDown, MapPin, Search, Phone, MessageCircle,
    CheckCircle2, Star, ChevronRight, ChevronLeft, Bookmark, BookmarkCheck,
    Briefcase, SlidersHorizontal, ShieldCheck, Building2, TrendingUp, Zap, RotateCcw,
    ArrowUpDown, Clock, Users, ArrowUpRight
} from 'lucide-react';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Types ---

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
    is_top_match?: boolean;
    is_verified?: boolean;
}

interface FilterState {
    jobType: string[];
    jobRole: string[];
    salaryRange: string;
    experience: string;
    gender: string[];
    qualification: string[];
}

interface JobsResponse {
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
}

const JOBS_PER_PAGE = 10;
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];

const SALARY_RANGES = [
    { label: 'All Salaries', value: 'all' },
    { label: '₹ 5,000+ / mo', value: '5000' },
    { label: '₹ 10,000+ / mo', value: '10000' },
    { label: '₹ 20,000+ / mo', value: '20000' },
    { label: '₹ 30,000+ / mo', value: '30000' },
];

const EXPERIENCE_LEVELS = [
    { label: 'All Levels', value: 'all' },
    { label: 'Fresher (0 yrs)', value: '0' },
    { label: '1 Year', value: '1' },
    { label: '2 - 4 Years', value: '4' },
    { label: '5+ Years', value: '5' },
];

const GENDER_OPTIONS = ['Male', 'Female'];
const QUALIFICATION_OPTIONS = ['10th Pass', '12th Pass', 'Diploma', 'Graduation', 'Post Graduation'];
const POPULAR_SEARCH_SUGGESTIONS = ['Software Engineer', 'Sales Executive', 'Driver', 'Delivery Representative', 'Telecaller', 'Accountant'];

// --- Shimmer Skeleton Loader ---
const JobCardSkeleton = () => (
    <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/70 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl animate-shimmer shrink-0" />
                <div className="space-y-2 flex-1">
                    <div className="h-5 bg-slate-200 rounded-lg w-2/3 animate-shimmer" />
                    <div className="h-3 bg-slate-100 rounded-md w-1/3 animate-shimmer" />
                </div>
            </div>
            <div className="w-8 h-8 rounded-full animate-shimmer shrink-0" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="h-12 rounded-2xl animate-shimmer" />
            <div className="h-12 rounded-2xl animate-shimmer" />
        </div>
        <div className="flex items-center gap-2 pt-2">
            <div className="h-6 w-16 rounded-full animate-shimmer" />
            <div className="h-6 w-20 rounded-full animate-shimmer" />
            <div className="h-6 w-24 rounded-full animate-shimmer" />
        </div>
    </div>
);

// --- Top-Level Sub-Component for Filter Panel ---
const FilterPanelContent = ({
    filters,
    handleFilterChange,
    setFilters,
    activeFilterCount,
    handlePageChange
}: {
    filters: FilterState;
    handleFilterChange: (category: keyof FilterState, value: string, isCheckbox?: boolean) => void;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    activeFilterCount: number;
    handlePageChange: (page: number) => void;
}) => (
    <div className="space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Refine Filters</h2>
            </div>
            {activeFilterCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                    {activeFilterCount} Active
                </span>
            )}
        </div>

        <FilterAccordion title="Job Type" defaultOpen={true}>
            <div className="space-y-1.5 pt-2">
                {JOB_TYPES.map(type => {
                    const isSelected = filters.jobType.includes(type);
                    return (
                        <label
                            key={type}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs font-semibold ${
                                isSelected
                                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold'
                                    : 'border-transparent hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <span>{type}</span>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleFilterChange('jobType', type)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>
                    );
                })}
            </div>
        </FilterAccordion>

        <FilterAccordion title="Monthly Salary" defaultOpen={true}>
            <div className="space-y-1.5 pt-2">
                {SALARY_RANGES.map(range => {
                    const isSelected = filters.salaryRange === range.value;
                    return (
                        <label
                            key={range.value}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs font-semibold ${
                                isSelected
                                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 font-bold'
                                    : 'border-transparent hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <span>{range.label}</span>
                            <input
                                type="radio"
                                name="salaryRange"
                                checked={isSelected}
                                onChange={() => handleFilterChange('salaryRange', range.value, false)}
                                className="w-4 h-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                        </label>
                    );
                })}
            </div>
        </FilterAccordion>

        <FilterAccordion title="Experience Required" defaultOpen={false}>
            <div className="space-y-1.5 pt-2">
                {EXPERIENCE_LEVELS.map(exp => {
                    const isSelected = filters.experience === exp.value;
                    return (
                        <label
                            key={exp.value}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs font-semibold ${
                                isSelected
                                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold'
                                    : 'border-transparent hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <span>{exp.label}</span>
                            <input
                                type="radio"
                                name="experience"
                                checked={isSelected}
                                onChange={() => handleFilterChange('experience', exp.value, false)}
                                className="w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>
                    );
                })}
            </div>
        </FilterAccordion>

        <FilterAccordion title="Gender Preference" defaultOpen={false}>
            <div className="space-y-1.5 pt-2">
                {GENDER_OPTIONS.map(g => {
                    const isSelected = filters.gender.includes(g);
                    return (
                        <label
                            key={g}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs font-semibold ${
                                isSelected
                                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold'
                                    : 'border-transparent hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <span>{g}</span>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleFilterChange('gender', g)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>
                    );
                })}
            </div>
        </FilterAccordion>

        <FilterAccordion title="Qualification" defaultOpen={false}>
            <div className="space-y-1.5 pt-2">
                {QUALIFICATION_OPTIONS.map(q => {
                    const isSelected = filters.qualification.includes(q);
                    return (
                        <label
                            key={q}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs font-semibold ${
                                isSelected
                                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold'
                                    : 'border-transparent hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <span>{q}</span>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleFilterChange('qualification', q)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>
                    );
                })}
            </div>
        </FilterAccordion>

        {activeFilterCount > 0 && (
            <button
                onClick={() => {
                    setFilters({
                        jobType: [],
                        jobRole: [],
                        salaryRange: "all",
                        experience: "all",
                        gender: [],
                        qualification: []
                    });
                    handlePageChange(1);
                }}
                className="w-full mt-4 py-2.5 border border-indigo-200 bg-indigo-50/50 text-indigo-700 rounded-2xl text-xs font-black hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
            >
                <RotateCcw size={14} /> Clear All Filters
            </button>
        )}
    </div>
);

const JobsPageContent = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [totalJobs, setTotalJobs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
    const [bookmarkedJobIds, setBookmarkedJobIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<"newest" | "salary" | "openings">("newest");

    const [filters, setFilters] = useState<FilterState>({
        jobType: [],
        jobRole: [],
        salaryRange: "all",
        experience: "all",
        gender: [],
        qualification: []
    });

    const searchTerm = searchParams.get('q') || '';
    const cityFilter = searchParams.get('city') || 'All';
    const currentPage = parseInt(searchParams.get('page') || '1');

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {
                page: currentPage,
                limit: JOBS_PER_PAGE,
            };

            if (searchTerm) params.search = searchTerm;
            if (cityFilter !== 'All') params.city_ids = cityFilter;

            if (filters.jobType.length > 0) params.job_types = filters.jobType.join(',');
            if (filters.salaryRange && filters.salaryRange !== 'all') params.salary_min = parseInt(filters.salaryRange);
            if (filters.experience && filters.experience !== 'all') params.experience_max = parseInt(filters.experience);
            if (filters.gender.length > 0) params.genders = filters.gender.join(',');
            if (filters.qualification.length > 0) params.education = filters.qualification.join(',');

            const res = await api.get('/jobs', { params }) as unknown as JobsResponse;
            let fetchedJobs = res.jobs || [];

            // Client-side Sorting
            if (sortBy === 'salary') {
                fetchedJobs = [...fetchedJobs].sort((a, b) => b.salary_max - a.salary_max);
            } else if (sortBy === 'openings') {
                fetchedJobs = [...fetchedJobs].sort((a, b) => (b.vacancies || 0) - (a.vacancies || 0));
            }

            setJobs(fetchedJobs);
            setTotalJobs(res.total || 0);
        } catch (error) {
            console.error("Failed to fetch jobs", error);
            toast.error("Failed to load jobs");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, cityFilter, currentPage, filters, sortBy]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    useEffect(() => {
        const fetchUserAndApplications = async () => {
            try {
                const userData: any = await api.get('/user/profile').catch(() => null);
                setUser(userData);

                if (userData) {
                    if (Array.isArray(userData.bookmarked_jobs)) {
                        setBookmarkedJobIds(new Set(userData.bookmarked_jobs));
                    }
                    try {
                        const myApps = await api.get('/applications/my') as any[];
                        if (Array.isArray(myApps)) {
                            const ids = new Set<string>(
                                myApps.map((a: any) => a.job_id || a.job?.id).filter(Boolean)
                            );
                            setAppliedJobIds(ids);
                        }
                    } catch {
                        // Ignore
                    }
                }
            } catch { }
        };
        fetchUserAndApplications();
    }, []);

    const handleToggleBookmark = async (jobId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!user) {
            toast.info("Please login to save jobs");
            return;
        }

        const isBookmarked = bookmarkedJobIds.has(jobId);
        setBookmarkedJobIds(prev => {
            const next = new Set(prev);
            if (isBookmarked) {
                next.delete(jobId);
            } else {
                next.add(jobId);
            }
            return next;
        });

        try {
            const res: any = await api.post(`/user/bookmark/${jobId}`).catch(() => api.post(`/user/bookmarks/${jobId}`));
            if (res?.bookmarked_jobs && Array.isArray(res.bookmarked_jobs)) {
                setBookmarkedJobIds(new Set(res.bookmarked_jobs));
            }
            toast.success(isBookmarked ? "Job removed from saved items" : "Job saved to your bookmarks!");
        } catch (error) {
            setBookmarkedJobIds(prev => {
                const next = new Set(prev);
                if (isBookmarked) {
                    next.add(jobId);
                } else {
                    next.delete(jobId);
                }
                return next;
            });
            toast.error("Failed to update saved job");
        }
    };

    const handleApply = async (jobId: string) => {
        if (!user) {
            toast.info("Please login to apply");
            return;
        }

        if (appliedJobIds.has(jobId)) {
            toast.info("You have already applied for this job");
            return;
        }

        const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
        const isOnlyUser = roles.includes('user') && !roles.includes('recruiter') && !roles.includes('expert');
        if (!isOnlyUser) {
            toast.warning("Only candidates are allowed to apply for jobs.");
            return;
        }

        setApplyingId(jobId);
        try {
            await api.post('/applications', { job_id: jobId });
            toast.success("Applied successfully!");
            setAppliedJobIds(prev => new Set(prev).add(jobId));
        } catch (error: any) {
            if (error.response?.status === 409) {
                setAppliedJobIds(prev => new Set(prev).add(jobId));
                toast.info(error.response?.data?.error || "You have already applied for this job");
            } else {
                toast.error(error.response?.data?.error || "Failed to apply");
            }
        } finally {
            setApplyingId(null);
        }
    };

    const handleFilterChange = (category: keyof FilterState, value: string, isCheckbox: boolean = true) => {
        if (isCheckbox) {
            setFilters(prev => {
                const current = prev[category] as string[];
                const next = current.includes(value)
                    ? current.filter(v => v !== value)
                    : [...current, value];
                return { ...prev, [category]: next };
            });
        } else {
            setFilters(prev => ({ ...prev, [category]: value }));
        }
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', newPage.toString());
        router.push(`/jobs?${params.toString()}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const totalPages = Math.ceil(totalJobs / JOBS_PER_PAGE);
    const activeFilterCount = filters.jobType.length + filters.jobRole.length +
        (filters.salaryRange !== 'all' ? 1 : 0) + (filters.experience !== 'all' ? 1 : 0) +
        filters.gender.length + filters.qualification.length;

    return (
        <div className="bg-[#F8FAFC] min-h-screen font-sans text-slate-900 pb-20">
            <ToastContainer />

            {/* Mobile Filter Drawer */}
            <AnimatePresence>
                {isMobileFilterOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 w-80 max-w-[90vw] bg-white z-50 shadow-2xl flex flex-col lg:hidden"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-base font-black text-slate-900">Filters</h2>
                                <button onClick={() => setIsMobileFilterOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <FilterPanelContent
                                    filters={filters}
                                    handleFilterChange={handleFilterChange}
                                    setFilters={setFilters}
                                    activeFilterCount={activeFilterCount}
                                    handlePageChange={handlePageChange}
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 md:px-12">
                
                {/* HERO BANNER */}
                <div className="mb-10 bg-linear-to-r from-slate-950 via-km-primary-dark to-slate-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl shadow-blue-950/20 relative overflow-hidden border border-slate-800">
                    <div className="absolute -right-16 -top-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute left-1/3 -bottom-16 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 backdrop-blur-md text-blue-200 text-xs font-bold px-3.5 py-1.5 rounded-full mb-4">
                                <ShieldCheck size={14} className="text-emerald-400" />
                                <span>Verified Indian Employment Portal</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                                Find Jobs & Connect Direct
                            </h1>
                            <p className="text-slate-300 text-xs sm:text-sm mt-2 font-medium">
                                Direct candidate-to-recruiter hiring with 1-click apply and real-time interview management.
                            </p>

                            <div className="flex flex-wrap gap-4 mt-6 text-xs text-slate-300 font-semibold">
                                <span className="flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-400" /> 1,250+ Active Listings</span>
                                <span className="flex items-center gap-1.5"><Building2 size={14} className="text-blue-400" /> 450+ Verified Companies</span>
                                <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-400" /> Instant Application</span>
                            </div>
                        </div>

                        <div className="relative z-10 shrink-0">
                            <Link
                                href="/jobs/saved"
                                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-xs font-bold text-white transition-all shadow-lg hover:scale-[1.02]"
                            >
                                <BookmarkCheck size={18} className="text-amber-400 fill-amber-400" />
                                <span>Saved Jobs ({bookmarkedJobIds.size})</span>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="flex gap-8 lg:gap-10 items-start">
                    {/* DESKTOP SIDEBAR FILTER */}
                    <aside className="hidden lg:block w-72 shrink-0">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 sticky top-24">
                            <FilterPanelContent
                                filters={filters}
                                handleFilterChange={handleFilterChange}
                                setFilters={setFilters}
                                activeFilterCount={activeFilterCount}
                                handlePageChange={handlePageChange}
                            />
                        </div>
                    </aside>

                    {/* MAIN JOB LISTING AREA */}
                    <div className="flex-1 min-w-0">
                        {/* Status & Sorting Control Bar */}
                        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                                    Showing <span className="text-km-primary font-black">{loading ? '...' : totalJobs} Available Positions</span>
                                </h2>
                                {(searchTerm || cityFilter !== 'All') && (
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        Filtered by {searchTerm && <span className="font-bold text-slate-900">"{searchTerm}"</span>}
                                        {searchTerm && cityFilter !== 'All' && ' in '}
                                        {cityFilter !== 'All' && <span className="font-bold text-slate-900">{cityFilter}</span>}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Sorting Control */}
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
                                    <ArrowUpDown size={14} className="text-km-primary" />
                                    <span>Sort:</span>
                                    <select
                                        value={sortBy}
                                        onChange={(e: any) => setSortBy(e.target.value)}
                                        className="bg-transparent outline-none font-bold text-slate-900 cursor-pointer"
                                    >
                                        <option value="newest">Newest First</option>
                                        <option value="salary">Highest Salary</option>
                                        <option value="openings">Most Vacancies</option>
                                    </select>
                                </div>

                                {/* Mobile filter button */}
                                <button
                                    onClick={() => setIsMobileFilterOpen(true)}
                                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-km-primary rounded-xl text-xs font-bold shadow-sm hover:bg-blue-100 transition-all shrink-0"
                                >
                                    <SlidersHorizontal size={14} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                                </button>
                            </div>
                        </div>

                        {/* Job List Container */}
                        <div className="space-y-4">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(n => <JobCardSkeleton key={n} />)}
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-sm">
                                    <div className="w-16 h-16 bg-blue-50 text-km-primary rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Search className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">No Matching Jobs Found</h3>
                                    <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto font-medium mb-6">
                                        We couldn't find any active job postings matching your current search parameters.
                                    </p>
                                    
                                    {/* Popular Suggestions */}
                                    <div className="pt-4 border-t border-slate-100 max-w-md mx-auto">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Popular Roles to Explore:</p>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {POPULAR_SEARCH_SUGGESTIONS.map((term) => (
                                                <button
                                                    key={term}
                                                    onClick={() => {
                                                        const params = new URLSearchParams(searchParams.toString());
                                                        params.set('q', term);
                                                        router.push(`/jobs?${params.toString()}`);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-km-primary text-slate-600 rounded-xl text-xs font-bold transition-all border border-slate-200/60"
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {jobs.map((job, idx) => (
                                        <JobCard
                                            key={job.id}
                                            job={job}
                                            isTopMatch={currentPage === 1 && idx < 3}
                                            onApply={() => handleApply(job.id)}
                                            loading={applyingId === job.id}
                                            hasApplied={appliedJobIds.has(job.id)}
                                            isBookmarked={bookmarkedJobIds.has(job.id)}
                                            onToggleBookmark={(e) => handleToggleBookmark(job.id, e)}
                                        />
                                    ))}

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-12 py-6">
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-km-primary text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>

                                            {[...Array(totalPages)].map((_, i) => {
                                                const pageNum = i + 1;
                                                if (
                                                    pageNum === 1 ||
                                                    pageNum === totalPages ||
                                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => handlePageChange(pageNum)}
                                                            className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${
                                                                currentPage === pageNum
                                                                    ? 'bg-km-primary text-white shadow-md shadow-blue-900/10'
                                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-km-primary shadow-sm'
                                                            }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                                    return <span key={pageNum} className="text-slate-400 font-bold">...</span>;
                                                }
                                                return null;
                                            })}

                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-km-primary text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const JobsPage = () => {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Loading Jobs...</div>}>
            <JobsPageContent />
        </Suspense>
    );
};

// --- Sub Components ---

const FilterAccordion = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-slate-100 py-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full font-bold text-xs uppercase tracking-wider text-slate-700 hover:text-km-primary transition-colors"
            >
                {title}
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-km-primary' : 'text-slate-400'}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const JobCard = ({
    job,
    isTopMatch,
    onApply,
    loading,
    hasApplied,
    isBookmarked,
    onToggleBookmark
}: {
    job: Job,
    isTopMatch?: boolean,
    onApply: () => void,
    loading?: boolean,
    hasApplied?: boolean,
    isBookmarked?: boolean,
    onToggleBookmark?: (e: React.MouseEvent) => void
}) => {
    const companyInitial = job.company ? job.company.charAt(0).toUpperCase() : 'C';

    return (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-0.5 transition-all duration-300 group relative">
            {isTopMatch && (
                <div className="inline-flex items-center gap-1.5 bg-linear-to-r from-amber-500 to-amber-400 text-white text-[10px] font-black px-3 py-1 rounded-full mb-4 uppercase tracking-wider shadow-sm">
                    <Star size={12} fill="currentColor" /> Top Recommended Match
                </div>
            )}

            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                <div className="flex-1 min-w-0 w-full">
                    
                    {/* Company Logo Avatar & Job Title */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-slate-950 via-km-primary-dark to-slate-950 border border-slate-700 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-sm">
                            {companyInitial}
                        </div>
                        <div className="min-w-0 flex-1">
                            <Link href={`/jobs/${job.id}`}>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-km-primary transition-colors line-clamp-1 cursor-pointer">
                                    {job.title}
                                </h3>
                            </Link>
                            <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider mt-0.5 flex items-center gap-2">
                                <span>{job.company}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                <span className="text-km-primary italic font-bold">Hiring Now</span>
                            </p>
                        </div>
                    </div>

                    {/* Key Metrics Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs my-4">
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-emerald-900">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                                ₹
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">Monthly Salary</p>
                                <p className="font-extrabold text-xs sm:text-sm truncate">
                                    ₹{job.salary_min.toLocaleString()} - ₹{job.salary_max.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50/60 border border-blue-100 text-slate-900">
                            <div className="w-8 h-8 rounded-xl bg-km-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                                <MapPin size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-km-primary font-black uppercase tracking-wider">Location</p>
                                <p className="font-extrabold text-xs sm:text-sm truncate">
                                    {job.location || 'Flexible'}, {job.city_name}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pill Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <span className="px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full uppercase border border-rose-100">
                            🔥 Hot Listing
                        </span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full uppercase border border-slate-200/60">
                            {job.job_type}
                        </span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full uppercase border border-slate-200/60">
                            {job.vacancies || 1} Openings
                        </span>
                        <span className="px-3 py-1 bg-blue-50 text-km-primary text-[10px] font-bold rounded-full uppercase flex items-center gap-1 border border-blue-100">
                            <CheckCircle2 size={12} className="fill-km-primary text-white" /> KM Verified
                        </span>
                    </div>
                </div>

                {/* Right Action Column */}
                <div className="flex flex-row lg:flex-col items-center gap-2.5 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-0 border-slate-100">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleBookmark}
                            title={isBookmarked ? "Remove Bookmark" : "Save / Bookmark Job"}
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-xs shrink-0 border ${
                                isBookmarked
                                    ? 'bg-blue-50 text-km-primary border-blue-200 ring-2 ring-km-primary/20'
                                    : 'bg-slate-50 text-slate-400 hover:bg-km-primary hover:text-white border-slate-200'
                            }`}
                        >
                            {isBookmarked ? <BookmarkCheck size={18} className="fill-km-primary text-km-primary" /> : <Bookmark size={18} />}
                        </button>
                        <button
                            title="Call Recruiter"
                            className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-500 hover:bg-km-primary hover:text-white transition-all shadow-xs shrink-0 border border-slate-200 flex items-center justify-center"
                        >
                            <Phone size={18} />
                        </button>
                        <button
                            title="Chat with Recruiter"
                            className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-500 hover:bg-km-primary hover:text-white transition-all shadow-xs shrink-0 border border-slate-200 flex items-center justify-center"
                        >
                            <MessageCircle size={18} />
                        </button>
                    </div>

                    <button
                        onClick={onApply}
                        disabled={loading || hasApplied}
                        className={`w-full lg:w-44 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                            hasApplied
                                ? 'bg-emerald-600 text-white cursor-not-allowed shadow-sm'
                                : 'bg-km-primary hover:bg-km-primary-dark text-white shadow-md shadow-blue-900/10 active:scale-[0.98] disabled:opacity-50'
                        }`}
                    >
                        {loading ? (
                            '...'
                        ) : hasApplied ? (
                            <>
                                <CheckCircle2 size={15} /> Applied
                            </>
                        ) : (
                            <>
                                Apply Now <ArrowUpRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobsPage;