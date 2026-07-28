'use client'
import React, { useState, useEffect, Suspense, useCallback } from 'react';
import {
    ChevronDown, MapPin, Search, Phone, MessageCircle,
    CheckCircle2, Star, Download, Globe, LogIn, ChevronRight,
    ChevronLeft
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
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
    { label: 'All', value: 'all' },
    { label: 'More Than ₹ 5000', value: '5000' },
    { label: 'More Than ₹ 10000', value: '10000' },
    { label: 'More Than ₹ 20000', value: '20000' },
    { label: 'More Than ₹ 30000', value: '30000' },
];

const EXPERIENCE_LEVELS = [
    { label: 'All', value: 'all' },
    { label: 'Fresher', value: '0' },
    { label: '1 Year', value: '1' },
    { label: '2-4 Years', value: '4' },
    { label: '5 Years', value: '5' },
    { label: '> 5 Years', value: '30' },
];

const GENDER_OPTIONS = ['Male', 'Female'];

const QUALIFICATION_OPTIONS = [
    '10th Pass',
    '12th Pass',
    'Diploma',
    'Graduation',
    'Post Graduation'
];

const JobsPageContent = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [totalJobs, setTotalJobs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    // Filters from UI
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

            // Map UI filters to API params

            if (filters.jobType.length > 0) {
                params.job_types = filters.jobType.join(',');
            }
            if (filters.salaryRange && filters.salaryRange !== 'all') {
                params.salary_min = parseInt(filters.salaryRange);
            }
            if (filters.experience && filters.experience !== 'all') {
                params.experience_max = parseInt(filters.experience);
            }
            if (filters.gender.length > 0) {
                params.genders = filters.gender.join(',');
            }
            if (filters.qualification.length > 0) {
                params.education = filters.qualification.join(',');
            }

            const res = await api.get('/jobs', { params }) as unknown as JobsResponse;
            setJobs(res.jobs || []);
            setTotalJobs(res.total || 0);
        } catch (error) {
            console.error("Failed to fetch jobs", error);
            toast.error("Failed to load jobs");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, cityFilter, currentPage, filters]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await api.get('/user/profile').catch(() => null);
                setUser(userData);
            } catch { }
        };
        fetchUser();
    }, []);

    const handleApply = async (jobId: string) => {
        if (!user) {
            toast.info("Please login to apply");
            return;
        }
        setApplyingId(jobId);
        try {
            await api.post('/applications', { job_id: jobId });
            toast.success("Applied successfully!");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to apply");
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
        // Reset to page 1 on filter change
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', '1');
        router.push(`/jobs?${params.toString()}`);
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

    const FilterPanelContent = () => (
        <>
            <h2 className="text-lg font-bold mb-6">Filters ({activeFilterCount})</h2>

            <FilterAccordion title="Job Type" defaultOpen={false}>
                                <div className="space-y-3 pt-2">
                                    {JOB_TYPES.map(type => (
                                        <label key={type} className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={filters.jobType.includes(type)}
                                                onChange={() => handleFilterChange('jobType', type)}
                                                className="w-4 h-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                                            />
                                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterAccordion>

                            <FilterAccordion title="Monthly Salary" defaultOpen={true}>
                                <div className="space-y-3 pt-2">
                                    {SALARY_RANGES.map(sal => (
                                        <label key={sal.value} className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="salary"
                                                checked={filters.salaryRange === sal.value}
                                                onChange={() => handleFilterChange('salaryRange', sal.value, false)}
                                                className="w-4 h-4 border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                                            />
                                            <span className="text-sm text-gray-600 group-hover:text-gray-900">{sal.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterAccordion>

                            <FilterAccordion title="Experience" defaultOpen={true}>
                                <div className="space-y-3 pt-2">
                                    {EXPERIENCE_LEVELS.map(exp => (
                                        <label key={exp.value} className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="experience"
                                                checked={filters.experience === exp.value}
                                                onChange={() => handleFilterChange('experience', exp.value, false)}
                                                className="w-4 h-4 border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                                            />
                                            <span className="text-sm text-gray-600 group-hover:text-gray-900">{exp.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterAccordion>

                            <FilterAccordion title="Gender" defaultOpen={false}>
                                <div className="space-y-3 pt-2">
                                    {GENDER_OPTIONS.map(g => (
                                        <label key={g} className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={filters.gender.includes(g)}
                                                onChange={() => handleFilterChange('gender', g)}
                                                className="w-4 h-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                                            />
                                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{g}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterAccordion>

                            <FilterAccordion title="Qualification" defaultOpen={false}>
                                <div className="space-y-3 pt-2">
                                    {QUALIFICATION_OPTIONS.map(q => (
                                        <label key={q} className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={filters.qualification.includes(q)}
                                                onChange={() => handleFilterChange('qualification', q)}
                                                className="w-4 h-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                                            />
                                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{q}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterAccordion>

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
                className="w-full mt-8 py-2.5 border border-[#8B5CF6] text-[#8B5CF6] rounded-full text-sm font-bold hover:bg-[#8B5CF6] hover:text-white transition-all"
            >
                Clear All
            </button>
        </>
    );

    return (
        <div className="bg-[#FBFBFF] min-h-screen font-sans text-[#1A1A1A]">
            {/* ── Mobile Filter Drawer ── */}
            <AnimatePresence>
                {isMobileFilterOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 w-80 max-w-[90vw] bg-white z-50 shadow-2xl flex flex-col lg:hidden"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                <h2 className="text-lg font-bold">Filters</h2>
                                <button onClick={() => setIsMobileFilterOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <FilterPanelContent />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 md:px-12">
                <div className="flex gap-8 lg:gap-10">
                    {/* ── Desktop Sidebar Filter ── */}
                    <aside className="hidden lg:block w-72 shrink-0">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-50 sticky top-24">
                            <FilterPanelContent />
                        </div>
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 min-w-0">
                        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-4">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                                    Showing <span className="text-[#A855F7]">{loading ? '...' : totalJobs} Jobs</span>
                                </h1>
                                {(searchTerm || cityFilter !== 'All') && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        Results for {searchTerm && <span className="font-bold">"{searchTerm}"</span>}
                                        {searchTerm && cityFilter !== 'All' && ' in '}
                                        {cityFilter !== 'All' && <span className="font-bold">{cityFilter}</span>}
                                    </p>
                                )}
                            </div>
                            {/* Mobile filter toggle */}
                            <button
                                onClick={() => setIsMobileFilterOpen(true)}
                                className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-[#8B5CF6] text-[#8B5CF6] rounded-full text-xs font-bold shadow-md hover:bg-[#F5F3FF] transition-all active:scale-95 shrink-0"
                            >
                                <Search size={14} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                            </button>
                        </div>

                        {/* Top Match Summary Card */}
                        <div className="bg-[#FFFDF2] border border-[#FDE68A] rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="w-10 h-10 bg-[#FBBF24] rounded-lg flex items-center justify-center text-white shrink-0">
                                <Star size={20} fill="currentColor" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-sm sm:text-base">Top Match Jobs For You</h3>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 sm:mt-1">
                                    <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> Near You</span>
                                    <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> Good Salary</span>
                                    <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> Matching Experience</span>
                                </div>
                            </div>
                        </div>

                        {/* JobList */}
                        <div className="space-y-1">
                            {loading ? (
                                <div className="space-y-6">
                                    {[1, 2, 3].map(n => <div key={n} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />)}
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
                                    <p className="text-gray-500">Try adjusting your search or filters</p>
                                </div>
                            ) : (
                                <>
                                    {jobs.map((job, idx) => (
                                        <React.Fragment key={job.id}>
                                            <JobCard
                                                job={job}
                                                isTopMatch={currentPage === 1 && idx < 3}
                                                onApply={() => handleApply(job.id)}
                                                loading={applyingId === job.id}
                                            />
                                            <div className="border-t border-dashed border-gray-200 my-1 last:hidden" />
                                        </React.Fragment>
                                    ))}

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-12 py-6">
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="p-2 rounded-full hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>

                                            {[...Array(totalPages)].map((_, i) => {
                                                const pageNum = i + 1;
                                                // Simplified pagination: only show current, 2 neighbors, first and last
                                                if (
                                                    pageNum === 1 ||
                                                    pageNum === totalPages ||
                                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => handlePageChange(pageNum)}
                                                            className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${currentPage === pageNum
                                                                ? 'bg-[#8B5CF6] text-white shadow-lg shadow-purple-100'
                                                                : 'text-gray-500 hover:bg-white border border-transparent hover:border-gray-200'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                                    return <span key={pageNum} className="text-gray-400">...</span>;
                                                }
                                                return null;
                                            })}

                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-2 rounded-full hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Promo Banner */}
                        <div className="mt-10 sm:mt-12 bg-[#FFFDF2] border border-[#FDE68A] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                            <div className="flex-1">
                                <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-2 leading-tight">Waiting To Get A Job?</h2>
                                <p className="text-sm sm:text-base text-gray-500 font-bold italic">Get Faster HR Response By Applying To More Jobs Now</p>
                            </div>
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center shadow-xl shadow-yellow-100/50 shrink-0 border-4 border-white">
                                <HandshakeIcon className="w-10 h-10 sm:w-12 sm:h-12 text-[#2D1B4E]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const JobsPage = () => {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Jobs...</div>}>
            <JobsPageContent />
        </Suspense>
    );
};

// --- Sub Components ---

const FilterAccordion = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-gray-50 last:border-0 py-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full font-bold text-sm text-gray-800"
            >
                {title}
                <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

const JobCard = ({ job, isTopMatch, onApply, loading }: { job: Job, isTopMatch?: boolean, onApply: () => void, loading?: boolean }) => {
    return (
        <div className="relative group">
            <div className={`p-4 sm:p-8 bg-white transition-all ${isTopMatch ? 'rounded-t-3xl border-t border-x border-gray-50 shadow-sm' : ''}`}>
                {isTopMatch && (
                    <div className="inline-flex items-center gap-1.5 bg-[#FBBF24] text-white text-[10px] font-black px-2 py-1 rounded-sm mb-4 uppercase tracking-tighter shadow-sm animate-pulse-slow">
                        <Star size={12} fill="currentColor" /> Top Match
                    </div>
                )}

                <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
                    <div className="flex-1 min-w-0 w-full">
                        <Link href={`/jobs/${job.id}`}>
                            <h3 className="text-lg sm:text-2xl font-black text-[#1A1A1A] mb-1 group-hover:text-[#8B5CF6] transition-colors cursor-pointer hover:underline underline-offset-4 line-clamp-2">
                                {job.title}
                            </h3>
                        </Link>
                        <p className="text-gray-400 font-black text-[10px] sm:text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                            <span>{job.company}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="text-[#8B5CF6] italic">Hiring Now</span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-[#8B5CF6] shrink-0">
                                    <span className="font-black text-sm">₹</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Monthly Salary</p>
                                    <p className="font-black text-[#1A1A1A] truncate text-xs sm:text-sm">₹{job.salary_min.toLocaleString()} - ₹{job.salary_max.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-[#8B5CF6] shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Location</p>
                                    <p className="font-black text-[#1A1A1A] truncate text-xs sm:text-sm">{job.location || 'N/A'}, {job.city_name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-8">
                            <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[9px] font-black rounded-full uppercase italic border border-rose-100">Hot</span>
                            <span className="px-3 py-1 bg-gray-50 text-gray-500 text-[9px] font-black rounded-md uppercase border border-gray-100">{job.job_type}</span>
                            <span className="px-3 py-1 bg-gray-50 text-gray-500 text-[9px] font-black rounded-md uppercase border border-gray-100">{job.vacancies || 0} Openings</span>
                            <span className="px-3 py-1 bg-blue-50 text-[#2563EB] text-[9px] font-black rounded-md uppercase flex items-center gap-1.5 border border-blue-100">
                                <CheckCircle2 size={12} fill="currentColor" /> KM Verified
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-row xl:flex-col items-center gap-3 w-full xl:w-auto pt-4 xl:pt-0 border-t xl:border-0 border-gray-50">
                        <button className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-[#8B5CF6] hover:text-white transition-all shadow-sm shrink-0 border border-gray-100">
                            <Phone size={20} />
                        </button>
                        <button className="flex-1 xl:flex-none px-6 py-3 bg-white border-2 border-[#8B5CF6] text-[#8B5CF6] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#F5F3FF] transition-all flex items-center justify-center gap-2">
                            <MessageCircle size={18} /> Chat
                        </button>
                        <button
                            onClick={onApply}
                            disabled={loading}
                            className="flex-1 xl:flex-none px-8 py-3 bg-[#A855F7] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#9333EA] transition-all shadow-xl shadow-purple-200 disabled:opacity-50 italic"
                        >
                            {loading ? '...' : 'Apply Now'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HandshakeIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m11 17 2 2 6-7" />
        <path d="m18 18 2 2" />
        <path d="m20 14 2 2" />
        <path d="M10 10 5 7a3.3 3.3 0 0 0-5 3v9a2 2 0 0 0 2 2h14c1.1 0 2-0.9 2-2V10a2 2 0 0 0-2-2h-5.93" />
        <path d="m12 18-2-2" />
    </svg>
);

export default JobsPage;