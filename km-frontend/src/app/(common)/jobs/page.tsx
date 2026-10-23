'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowUpRightIcon, ArrowsDownUpIcon, BookmarkSimpleIcon, BriefcaseIcon, BuildingOfficeIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckCircleIcon, ClockIcon, MagnifyingGlassIcon, MapPinIcon, ShieldCheckIcon, SlidersHorizontalIcon, UsersIcon, XIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify, errorText } from "@/lib/notify";
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ───

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
const POPULAR_SEARCH_SUGGESTIONS = ['Software Engineer', 'Sales Executive', 'Driver', 'Delivery Representative', 'Telecaller', 'Accountant', 'Electrician'];

// ─── Design.md Shimmer Skeleton Loader ───
const JobCardSkeleton = () => (
    <div className="bg-km-surface-card p-5 sm:p-6 rounded-2xl border border-km-border shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-km-surface animate-shimmer shrink-0" />
                <div className="space-y-2 flex-1">
                    <div className="h-5 bg-km-surface rounded-lg w-2/3 animate-shimmer" />
                    <div className="h-3 bg-km-surface rounded-md w-1/3 animate-shimmer" />
                </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-km-surface animate-shimmer shrink-0" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="h-12 bg-km-surface rounded-xl animate-shimmer" />
            <div className="h-12 bg-km-surface rounded-xl animate-shimmer" />
        </div>
        <div className="flex items-center gap-2 pt-2">
            <div className="h-6 w-16 rounded-lg bg-km-surface animate-shimmer" />
            <div className="h-6 w-20 rounded-lg bg-km-surface animate-shimmer" />
            <div className="h-6 w-24 rounded-lg bg-km-surface animate-shimmer" />
        </div>
    </div>
);

// ─── Design.md Accordion Sub-Component ───
const FilterAccordion = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-km-border py-3.5">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full font-bold text-xs text-km-text-primary hover:text-km-link transition-colors cursor-pointer"
            >
                <span>{title}</span>
                <CaretDownIcon weight="bold" size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-km-link' : 'text-km-text-secondary'}`} />
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

// ─── Filter Panel Content ───
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
    <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-km-border">
            <div className="flex items-center gap-2">
                <SlidersHorizontalIcon weight="bold" className="w-4 h-4 text-km-link" />
                <h2 className="text-xs font-bold text-km-text-primary">Refine Filters</h2>
            </div>
            {activeFilterCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#EBF3FE] text-km-link text-[11px] font-bold border border-[#BFDBFE] dark:bg-blue-500/15 dark:border-blue-500/30">
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
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs ${
                                isSelected
                                    ? 'bg-[#EBF3FE] border-[#BFDBFE] text-km-link font-semibold dark:bg-blue-500/15 dark:border-blue-500/30'
                                    : 'border-transparent hover:bg-km-surface text-km-text-secondary'
                            }`}
                        >
                            <span>{type}</span>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleFilterChange('jobType', type)}
                                className="w-4 h-4 rounded border-km-border text-km-link focus:ring-[#0B5ED7]"
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
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs ${
                                isSelected
                                    ? 'bg-[#EBF3FE] border-[#BFDBFE] text-km-link font-semibold dark:bg-blue-500/15 dark:border-blue-500/30'
                                    : 'border-transparent hover:bg-km-surface text-km-text-secondary'
                            }`}
                        >
                            <span>{range.label}</span>
                            <input
                                type="radio"
                                name="salaryRange"
                                checked={isSelected}
                                onChange={() => handleFilterChange('salaryRange', range.value, false)}
                                className="w-4 h-4 border-km-border text-km-link focus:ring-[#0B5ED7]"
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
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs ${
                                isSelected
                                    ? 'bg-[#EBF3FE] border-[#BFDBFE] text-km-link font-semibold dark:bg-blue-500/15 dark:border-blue-500/30'
                                    : 'border-transparent hover:bg-km-surface text-km-text-secondary'
                            }`}
                        >
                            <span>{exp.label}</span>
                            <input
                                type="radio"
                                name="experience"
                                checked={isSelected}
                                onChange={() => handleFilterChange('experience', exp.value, false)}
                                className="w-4 h-4 border-km-border text-km-link focus:ring-[#0B5ED7]"
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
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs ${
                                isSelected
                                    ? 'bg-[#EBF3FE] border-[#BFDBFE] text-km-link font-semibold dark:bg-blue-500/15 dark:border-blue-500/30'
                                    : 'border-transparent hover:bg-km-surface text-km-text-secondary'
                            }`}
                        >
                            <span>{g}</span>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleFilterChange('gender', g)}
                                className="w-4 h-4 rounded border-km-border text-km-link focus:ring-[#0B5ED7]"
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
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border text-xs ${
                                isSelected
                                    ? 'bg-[#EBF3FE] border-[#BFDBFE] text-km-link font-semibold dark:bg-blue-500/15 dark:border-blue-500/30'
                                    : 'border-transparent hover:bg-km-surface text-km-text-secondary'
                            }`}
                        >
                            <span>{q}</span>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleFilterChange('qualification', q)}
                                className="w-4 h-4 rounded border-km-border text-km-link focus:ring-[#0B5ED7]"
                            />
                        </label>
                    );
                })}
            </div>
        </FilterAccordion>

        {activeFilterCount > 0 && (
            <button
                type="button"
                onClick={() => {
                    setFilters({
                        jobType: [],
                        jobRole: [],
                        salaryRange: 'all',
                        experience: 'all',
                        gender: [],
                        qualification: []
                    });
                    handlePageChange(1);
                }}
                className="btn-outline text-xs px-4 py-2 cursor-pointer w-full mt-4 flex items-center justify-center gap-1.5"
            >
                <ArrowCounterClockwiseIcon weight="bold" size={13} />
                <span>Reset All Filters</span>
            </button>
        )}
    </div>
);

// ─── Professional Job Card (Zero Emojis, Zero Sparkles, Zero AI Slop) ───
const JobCard = ({
    job,
    hasApplied,
    isBookmarked,
    onToggleBookmark
}: {
    job: Job;
    hasApplied?: boolean;
    isBookmarked?: boolean;
    onToggleBookmark?: (e: React.MouseEvent) => void;
}) => {
    const companyInitial = job.company ? job.company.charAt(0).toUpperCase() : 'C';

    return (
        <div className="bg-km-surface-card p-5 sm:p-6 rounded-2xl border border-km-border shadow-xs hover:border-[#0B5ED7]/50 hover:shadow-sm transition-all group">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-5">
                <div className="flex-1 min-w-0 w-full">
                    {/* Header: Company Avatar & Title */}
                    <div className="flex items-start gap-3.5 mb-3.5">
                        <div className="w-12 h-12 rounded-xl bg-[#071A4D] border border-[#0B1F52] text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs dark:bg-km-primary dark:border-km-link">
                            {companyInitial}
                        </div>
                        <div className="min-w-0 flex-1">
                            <Link href={`/jobs/${job.id}`}>
                                <h3 className="text-lg sm:text-xl font-bold text-km-text-primary group-hover:text-km-link transition-colors line-clamp-1 cursor-pointer">
                                    {job.title}
                                </h3>
                            </Link>
                            <p className="text-km-text-secondary font-medium text-xs mt-1 flex items-center gap-2">
                                <span>{job.company}</span>
                                <span className="w-1 h-1 rounded-full bg-[#D9E0EA] dark:bg-white/10" />
                                <span className="text-km-link font-semibold">Active Opening</span>
                            </p>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3.5">
                        <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-km-surface border border-km-border">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                                ₹
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-km-text-secondary">Monthly Salary</p>
                                <p className="text-xs sm:text-sm font-bold text-km-text-primary truncate">
                                    ₹{job.salary_min?.toLocaleString('en-IN') || 0} - ₹{job.salary_max?.toLocaleString('en-IN') || 0}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-km-surface border border-km-border">
                            <MapPinIcon size={20} className="text-km-link shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-km-text-secondary">Location</p>
                                <p className="text-xs sm:text-sm font-bold text-km-text-primary truncate">
                                    {job.location ? `${job.location}, ` : ''}{job.city_name || 'All India'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Semantic Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="px-2.5 py-1 bg-km-surface text-km-text-secondary border border-km-border text-xs font-medium rounded-lg">
                            {job.job_type}
                        </span>
                        <span className="px-2.5 py-1 bg-km-surface text-km-text-secondary border border-km-border text-xs font-medium rounded-lg flex items-center gap-1">
                            <UsersIcon weight="bold" size={12} className="text-km-text-secondary" />
                            <span>{job.vacancies || 1} Openings</span>
                        </span>
                        <span className="px-2.5 py-1 bg-km-surface text-km-text-secondary border border-km-border text-xs font-medium rounded-lg flex items-center gap-1">
                            <ClockIcon weight="bold" size={12} className="text-km-text-secondary" />
                            <span>{job.experience_min === 0 ? 'Fresher Friendly' : `${job.experience_min}+ yrs exp`}</span>
                        </span>
                        <span className="px-2.5 py-1 bg-[#EBF3FE] text-km-link border border-[#BFDBFE] text-xs font-semibold rounded-lg flex items-center gap-1 dark:bg-blue-500/15 dark:border-blue-500/30">
                            <CheckCircleIcon weight="bold" size={12} className="text-km-link" />
                            <span>KM Verified Employer</span>
                        </span>
                    </div>
                </div>

                {/* Right Action Column */}
                <div className="flex flex-row lg:flex-col items-center justify-end gap-2.5 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-0 border-km-border shrink-0">
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <button
                            type="button"
                            onClick={onToggleBookmark}
                            title={isBookmarked ? 'Remove Bookmark' : 'Save / Bookmark Job'}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                                isBookmarked
                                    ? 'bg-[#EBF3FE] text-km-link border-[#BFDBFE] dark:bg-blue-500/15 dark:border-blue-500/30'
                                    : 'bg-km-surface-card text-km-text-secondary hover:bg-km-surface hover:text-km-heading border-km-border'
                            }`}
                        >
                            {isBookmarked ? <BookmarkSimpleIcon weight="fill" size={16} className="fill-[#0B5ED7] text-km-link dark:fill-blue-400" /> : <BookmarkSimpleIcon weight="bold" size={16} />}
                        </button>

                        {hasApplied ? (
                            <Link
                                href="/applications"
                                className="h-10 px-4 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 flex-1 lg:flex-initial whitespace-nowrap shadow-xs"
                            >
                                <CheckCircleIcon weight="bold" size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <span>Applied • Track</span>
                            </Link>
                        ) : (
                            <Link
                                href={`/jobs/${job.id}`}
                                className="h-10 px-5 rounded-xl text-xs font-semibold btn-primary transition-all flex items-center justify-center gap-1.5 flex-1 lg:flex-initial whitespace-nowrap shadow-xs cursor-pointer"
                            >
                                <span>View & Apply</span>
                                <ArrowUpRightIcon weight="bold" size={14} />
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Jobs Page Content ───
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
    const [sortBy, setSortBy] = useState<'newest' | 'salary' | 'openings'>('newest');

    // Filter state
    const [filters, setFilters] = useState<FilterState>({
        jobType: [],
        jobRole: [],
        salaryRange: 'all',
        experience: 'all',
        gender: [],
        qualification: []
    });

    const searchTerm = searchParams.get('q') || '';
    const cityFilter = searchParams.get('city') || 'All';
    const currentPage = parseInt(searchParams.get('page') || '1');

    // Local inputs for top search bar
    const [searchInput, setSearchInput] = useState(searchTerm);
    const [cityInput, setCityInput] = useState(cityFilter === 'All' ? '' : cityFilter);

    // Keep inputs synced if URL changes externally
    useEffect(() => {
        setSearchInput(searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        setCityInput(cityFilter === 'All' ? '' : cityFilter);
    }, [cityFilter]);

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

            const res = (await api.get('/jobs', { params })) as unknown as JobsResponse;
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
            console.error('Failed to fetch jobs', error);
            notify.error('Failed to load jobs');
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
                        const myApps = (await api.get('/applications/my')) as any[];
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
            } catch {
                // Ignore
            }
        };
        fetchUserAndApplications();
    }, []);

    const handleToggleBookmark = async (jobId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!user) {
            notify.info('Please login to save jobs');
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
            notify.success(isBookmarked ? 'Job removed from saved items' : 'Job saved to your bookmarks');
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
            notify.error('Failed to update saved job');
        }
    };

    const handleApply = async (jobId: string) => {
        if (!user) {
            notify.info('Please login to apply');
            return;
        }

        if (appliedJobIds.has(jobId)) {
            notify.info('You have already applied for this job');
            return;
        }

        const roles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
        const isOnlyUser = roles.includes('user') && !roles.includes('recruiter') && !roles.includes('expert');
        if (!isOnlyUser) {
            notify.warning('Only candidates are allowed to apply for jobs.');
            return;
        }

        setApplyingId(jobId);
        try {
            await api.post('/applications', { job_id: jobId });
            notify.success('Applied successfully');
            setAppliedJobIds(prev => new Set(prev).add(jobId));
        } catch (error: any) {
            if (error.response?.status === 409) {
                setAppliedJobIds(prev => new Set(prev).add(jobId));
                notify.info(errorText(error, 'You have already applied for this job'));
            } else {
                notify.error(error, 'Failed to apply');
            }
        } finally {
            setApplyingId(null);
        }
    };

    const handleFilterChange = (category: keyof FilterState, value: string, isCheckbox: boolean = true) => {
        if (isCheckbox) {
            setFilters(prev => {
                const current = prev[category] as string[];
                const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
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

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (searchInput.trim()) {
            params.set('q', searchInput.trim());
        } else {
            params.delete('q');
        }
        if (cityInput.trim()) {
            params.set('city', cityInput.trim());
        } else {
            params.delete('city');
        }
        params.set('page', '1');
        router.push(`/jobs?${params.toString()}`);
    };

    const handleSuggestionClick = (term: string) => {
        setSearchInput(term);
        const params = new URLSearchParams(searchParams.toString());
        params.set('q', term);
        params.set('page', '1');
        router.push(`/jobs?${params.toString()}`);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setCityInput('');
        const params = new URLSearchParams(searchParams.toString());
        params.delete('q');
        params.delete('city');
        params.set('page', '1');
        router.push(`/jobs?${params.toString()}`);
    };

    const totalPages = Math.ceil(totalJobs / JOBS_PER_PAGE);
    const activeFilterCount =
        filters.jobType.length +
        filters.jobRole.length +
        (filters.salaryRange !== 'all' ? 1 : 0) +
        (filters.experience !== 'all' ? 1 : 0) +
        filters.gender.length +
        filters.qualification.length;

    const hasActiveFiltersOrSearch = Boolean(
        searchTerm || cityFilter !== 'All' || activeFilterCount > 0 || sortBy !== 'newest'
    );

    return (
        <div className="bg-km-surface min-h-screen font-sans text-km-text-primary pb-20">

            {/* Mobile Filter Drawer */}
            <AnimatePresence>
                {isMobileFilterOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="fixed inset-0 bg-[#071A4D]/60 z-40 lg:hidden dark:bg-km-primary"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 w-80 max-w-[90vw] bg-km-surface-card z-50 shadow-2xl flex flex-col lg:hidden border-r border-km-border"
                        >
                            <div className="flex items-center justify-between p-5 border-b border-km-border">
                                <h2 className="text-base font-bold text-km-text-primary">Filters</h2>
                                <button
                                    type="button"
                                    onClick={() => setIsMobileFilterOpen(false)}
                                    className="p-1.5 hover:bg-km-surface rounded-xl text-km-text-secondary transition-colors"
                                >
                                    <XIcon weight="bold" size={18} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
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

            {/* ─── Jobs Hero Section with Rounded Bottom ─── */}
            <section className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-8 sm:pt-10 lg:pt-12 pb-6 sm:pb-8 lg:pb-10 rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden font-sans dark:border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-end">
                        {/* Left Column: Category, Heading, Subhead & Key Value Props */}
                        <div className="lg:col-span-5 xl:col-span-5 text-left pb-2 sm:pb-4 lg:pb-6">
                            {/* Category Indicator */}
                            <div className="inline-flex items-center gap-2 bg-[#EBF3FE] text-km-link border border-[#BFDBFE] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-3.5 sm:mb-4 dark:bg-blue-500/15 dark:border-blue-500/30">
                                <BriefcaseIcon weight="bold" size={14} className="text-km-link" />
                                <span>Verified Direct Employment</span>
                            </div>

                            {/* Headline */}
                            <h1 className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
                                Find Verified Jobs & <span className="text-[#FF6B00]">Hire Direct</span>
                            </h1>

                            {/* Subheading */}
                            <p className="mt-3 text-sm sm:text-base text-white/80 max-w-lg font-normal leading-relaxed">
                                Connect directly with verified corporate employers and trade recruiters across India. 1-click apply, zero brokerage fees, and transparent application status tracking.
                            </p>

                            {/* CTA Row */}
                            <div className="flex flex-wrap items-center gap-3 mt-5 sm:mt-6">
                                <Link
                                    href="/jobs/saved"
                                    className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/30 text-white hover:bg-white/10 hover:border-white transition-all shadow-xs dark:hover:border-km-surface-card"
                                >
                                    <BookmarkSimpleIcon weight="fill" size={15} className="text-[#FF6B00]" />
                                    <span>Saved Jobs ({bookmarkedJobIds.size})</span>
                                </Link>
                                <Link
                                    href="/recruiter"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/20 text-white/90 hover:bg-white/10 hover:text-white transition-all shadow-xs"
                                >
                                    <span>Post a Job as Employer</span>
                                    <ArrowRightIcon weight="bold" size={13} />
                                </Link>
                            </div>

                            {/* Trust Chips */}
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-5 mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/10 text-xs text-white/90 font-medium">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon weight="bold" size={15} className="text-[#10B981] shrink-0" />
                                    <span>100% Verified Employers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon weight="bold" size={15} className="text-[#10B981] shrink-0" />
                                    <span>Zero Candidate Brokerage</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BuildingOfficeIcon weight="bold" size={15} className="text-[#10B981] shrink-0" />
                                    <span>Direct Recruiter Contacts</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Jobs Hero Artwork Resting Directly on Top Edge of Search Bar */}
                        <div className="lg:col-span-7 xl:col-span-7 flex items-end justify-center lg:justify-end self-end">
                            <div 
                                className="relative flex items-end justify-center lg:justify-end w-full"
                                style={{ width: 'clamp(380px, 56vw, 760px)', maxWidth: '100%' }}
                            >
                                <img
                                    src="/jobs-page-hero-art.png"
                                    alt="KaamMilega Verified Jobs"
                                    className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xl block translate-y-[1px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Integrated Top Search & Filter Bar (Overlapping Hero) ─── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 lg:-mt-10 relative z-20">
                <div className="bg-km-surface-card rounded-2xl shadow-sm border border-km-border p-4 sm:p-5">
                    <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                        {/* Search keyword input */}
                        <div className="flex-1 flex items-center gap-2.5 bg-km-surface-card rounded-xl px-3.5 py-2.5 border border-km-border focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all">
                            <MagnifyingGlassIcon weight="bold" size={17} className="text-km-text-secondary shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by job title, trade, or company..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full bg-transparent text-sm text-km-text-primary placeholder:text-km-text-secondary/70 focus:outline-hidden font-medium"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => setSearchInput('')}
                                    className="text-km-text-secondary hover:text-km-text-primary p-0.5 rounded-full"
                                >
                                    <XIcon weight="bold" size={14} />
                                </button>
                            )}
                        </div>

                        {/* City filter input */}
                        <div className="w-full md:w-60 flex items-center gap-2.5 bg-km-surface-card rounded-xl px-3.5 py-2.5 border border-km-border focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all">
                            <MapPinIcon weight="bold" size={17} className="text-km-text-secondary shrink-0" />
                            <input
                                type="text"
                                placeholder="City or location..."
                                value={cityInput}
                                onChange={(e) => setCityInput(e.target.value)}
                                className="w-full bg-transparent text-sm text-km-text-primary placeholder:text-km-text-secondary/70 focus:outline-hidden font-medium"
                            />
                            {cityInput && (
                                <button
                                    type="button"
                                    onClick={() => setCityInput('')}
                                    className="text-km-text-secondary hover:text-km-text-primary p-0.5 rounded-full"
                                >
                                    <XIcon weight="bold" size={14} />
                                </button>
                            )}
                        </div>

                        {/* Submit Search Button */}
                        <button
                            type="submit"
                            className="btn-accent text-xs px-6 py-2.5 shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <MagnifyingGlassIcon weight="bold" size={14} />
                            <span>Find Jobs</span>
                        </button>
                    </form>

                    {/* Popular Keyword Suggestions */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-km-border">
                        <span className="text-xs font-semibold text-km-text-secondary mr-1">Popular:</span>
                        {POPULAR_SEARCH_SUGGESTIONS.map((term) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => handleSuggestionClick(term)}
                                className="px-2.5 py-1 bg-km-surface hover:bg-[#EBF3FE] hover:text-km-link text-km-text-secondary rounded-lg text-xs font-medium transition-colors border border-km-border cursor-pointer dark:hover:bg-blue-500/15"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Main Content Grid: Filter Sidebar + Job Listings ─── */}
            <div className="max-w-7xl mx-auto pt-8 px-4 sm:px-6 lg:px-8">
                <div className="flex gap-8 lg:gap-10 items-start">
                    {/* Desktop Sidebar Filter */}
                    <aside className="hidden lg:block w-72 shrink-0">
                        <div className="bg-km-surface-card rounded-2xl p-5 shadow-xs border border-km-border sticky top-24">
                            <FilterPanelContent
                                filters={filters}
                                handleFilterChange={handleFilterChange}
                                setFilters={setFilters}
                                activeFilterCount={activeFilterCount}
                                handlePageChange={handlePageChange}
                            />
                        </div>
                    </aside>

                    {/* Main Job Listing Area */}
                    <div className="flex-1 min-w-0">
                        {/* Status & Sorting Control Bar */}
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-km-surface-card p-4 rounded-2xl border border-km-border shadow-xs">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-km-text-primary flex items-center gap-2">
                                    <span>Showing</span>
                                    <span className="text-km-link font-extrabold">{loading ? '...' : totalJobs} Positions</span>
                                </h2>
                                {(searchTerm || cityFilter !== 'All') && (
                                    <p className="text-xs text-km-text-secondary font-medium mt-0.5">
                                        Filtered by {searchTerm && <span className="font-semibold text-km-text-primary">"{searchTerm}"</span>}
                                        {searchTerm && cityFilter !== 'All' && ' in '}
                                        {cityFilter !== 'All' && <span className="font-semibold text-km-text-primary">{cityFilter}</span>}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5">
                                {/* Sorting Control */}
                                <div className="flex items-center gap-1.5 bg-km-surface border border-km-border rounded-xl px-3 py-1.5 text-xs font-semibold text-km-text-primary">
                                    <ArrowsDownUpIcon weight="bold" size={13} className="text-km-link" />
                                    <span className="text-km-text-secondary">Sort:</span>
                                    <select
                                        value={sortBy}
                                        onChange={(e: any) => setSortBy(e.target.value)}
                                        className="bg-transparent outline-hidden font-bold text-km-text-primary cursor-pointer"
                                    >
                                        <option value="newest">Newest First</option>
                                        <option value="salary">Highest Salary</option>
                                        <option value="openings">Most Openings</option>
                                    </select>
                                </div>

                                {/* Mobile Filter Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsMobileFilterOpen(true)}
                                    className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[#EBF3FE] border border-[#BFDBFE] text-km-link rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors shrink-0 cursor-pointer dark:bg-blue-500/15 dark:border-blue-500/30"
                                >
                                    <SlidersHorizontalIcon weight="bold" size={13} />
                                    <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                                </button>
                            </div>
                        </div>

                        {/* Job List Container */}
                        <div className="space-y-3.5">
                            {loading ? (
                                <div className="space-y-3.5">
                                    {[1, 2, 3].map(n => <JobCardSkeleton key={n} />)}
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="text-center py-16 bg-km-surface-card rounded-2xl border border-km-border p-8 shadow-xs">
                                    <MagnifyingGlassIcon size={36} weight="duotone" className="text-[#F59E0B] mx-auto mb-4" aria-hidden="true" />
                                    <h3 className="text-lg font-bold text-km-text-primary mb-1.5">No Matching Jobs Found</h3>
                                    <p className="text-km-text-secondary text-xs sm:text-sm max-w-md mx-auto font-normal leading-relaxed mb-6">
                                        We could not find active job postings matching your current search parameters. Try adjusting keywords or resetting filters.
                                    </p>

                                    {hasActiveFiltersOrSearch && (
                                        <button
                                            type="button"
                                            onClick={handleClearSearch}
                                            className="btn-outline text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-1.5 mb-6"
                                        >
                                            <ArrowCounterClockwiseIcon weight="bold" size={13} />
                                            <span>Reset All Search & Filters</span>
                                        </button>
                                    )}

                                    {/* Popular Suggestions */}
                                    <div className="pt-5 border-t border-km-border max-w-md mx-auto">
                                        <p className="text-xs font-semibold text-km-text-secondary mb-2.5">
                                            Popular Roles to Explore:
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {POPULAR_SEARCH_SUGGESTIONS.map((term) => (
                                                <button
                                                    key={term}
                                                    type="button"
                                                    onClick={() => handleSuggestionClick(term)}
                                                    className="px-2.5 py-1 bg-km-surface hover:bg-[#EBF3FE] hover:text-km-link text-km-text-secondary rounded-lg text-xs font-medium transition-colors border border-km-border cursor-pointer dark:hover:bg-blue-500/15"
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {jobs.map((job) => (
                                        <JobCard
                                            key={job.id}
                                            job={job}
                                            hasApplied={appliedJobIds.has(job.id)}
                                            isBookmarked={bookmarkedJobIds.has(job.id)}
                                            onToggleBookmark={(e) => handleToggleBookmark(job.id, e)}
                                        />
                                    ))}

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-10 py-4">
                                            <button
                                                type="button"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="p-2.5 rounded-xl bg-km-surface-card border border-km-border hover:border-[#0B5ED7] text-km-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
                                            >
                                                <CaretLeftIcon weight="bold" size={16} />
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
                                                            type="button"
                                                            onClick={() => handlePageChange(pageNum)}
                                                            className={`w-9 h-9 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                                                currentPage === pageNum
                                                                    ? 'bg-[#071A4D] text-white shadow-xs dark:bg-km-primary'
                                                                    : 'bg-km-surface-card text-km-text-secondary border border-km-border hover:border-[#0B5ED7] shadow-xs'
                                                            }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                                    return <span key={pageNum} className="text-km-text-secondary font-bold px-1">...</span>;
                                                }
                                                return null;
                                            })}

                                            <button
                                                type="button"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-2.5 rounded-xl bg-km-surface-card border border-km-border hover:border-[#0B5ED7] text-km-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
                                            >
                                                <CaretRightIcon weight="bold" size={16} />
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
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-km-text-secondary">Loading Jobs...</div>}>
            <JobsPageContent />
        </Suspense>
    );
};

export default JobsPage;