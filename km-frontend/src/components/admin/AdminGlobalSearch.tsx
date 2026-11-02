'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    BriefcaseIcon,
    BuildingOfficeIcon,
    CalendarBlankIcon,
    CircleNotchIcon,
    CommandIcon,
    FileXlsIcon,
    FlagIcon,
    GraduationCapIcon,
    MagnifyingGlassIcon,
    MapPinIcon,
    QuestionIcon,
    QuotesIcon,
    ShieldCheckIcon,
    ShieldWarningIcon,
    SquaresFourIcon,
    UserIcon,
    UsersIcon,
    VideoCameraIcon,
    XIcon,
    ArrowRightIcon,
    ArrowElbowDownLeftIcon,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';

interface SearchResultItem {
    id: string;
    type: 'user' | 'company' | 'job' | 'event';
    title: string;
    subtitle: string;
    badge: string;
    avatar?: string;
    url: string;
}

interface SearchResponse {
    query: string;
    total: number;
    users: SearchResultItem[];
    companies: SearchResultItem[];
    jobs: SearchResultItem[];
    events: SearchResultItem[];
}

const PORTAL_PAGES = [
    { name: 'Analytics & Overview', href: '/admin', icon: SquaresFourIcon, category: 'Overview', keywords: 'stats dashboard kpi revenue' },
    { name: 'User Module', href: '/admin/users', icon: UsersIcon, category: 'Accounts', keywords: 'candidates jobseekers recruiters members' },
    { name: 'Recruiter / Company', href: '/admin/companies', icon: BuildingOfficeIcon, category: 'Accounts', keywords: 'firms employers gst hiring' },
    { name: 'Job Vacancies', href: '/admin/jobs', icon: BriefcaseIcon, category: 'Operations', keywords: 'postings listings careers roles' },
    { name: 'Events & Workshops', href: '/admin/events', icon: CalendarBlankIcon, category: 'Operations', keywords: 'webinars tickets bookings' },
    { name: 'Cities Management', href: '/admin/cities', icon: MapPinIcon, category: 'Master Data', keywords: 'locations states areas' },
    { name: 'Job City Wise', href: '/admin/job-city', icon: MapPinIcon, category: 'Master Data', keywords: 'city jobs distribution' },
    { name: 'Professions & Skills', href: '/admin/professions', icon: GraduationCapIcon, category: 'Master Data', keywords: 'trades catalog tags roles' },
    { name: 'Learn Videos', href: '/admin/learn-videos', icon: VideoCameraIcon, category: 'Content', keywords: 'courses training youtube' },
    { name: 'Testimonials', href: '/admin/testimonials', icon: QuotesIcon, category: 'Content', keywords: 'reviews feedback stories' },
    { name: 'Questions & FAQs', href: '/admin/questions', icon: QuestionIcon, category: 'Content', keywords: 'help knowledgebase faq' },
    { name: 'Reports & Export', href: '/admin/reports', icon: FileXlsIcon, category: 'Analytics', keywords: 'csv download analytics excel' },
    { name: 'Wallet Disputes', href: '/admin/disputes', icon: ShieldWarningIcon, category: 'Finance', keywords: 'refunds payments claims' },
    { name: 'Chat Reports', href: '/admin/chat-reports', icon: FlagIcon, category: 'Moderation', keywords: 'abuse complaints flag' },
    { name: 'Policies', href: '/admin/policies', icon: ShieldCheckIcon, category: 'System', keywords: 'terms privacy compliance' },
];

export default function AdminGlobalSearch() {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SearchResponse | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    // Keyboard shortcut (Ctrl+K or Cmd+K) to focus search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
            } else if (e.key === 'Escape') {
                setIsOpen(false);
                inputRef.current?.blur();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search API request
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults(null);
            setIsLoading(false);
            setSelectedIndex(-1);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res: any = await api.get(`/admin/global-search?q=${encodeURIComponent(trimmed)}`);
                setResults(res?.data || res || null);
            } catch (err) {
                console.error('Global search error:', err);
                setResults(null);
            } finally {
                setIsLoading(false);
            }
        }, 280);

        return () => clearTimeout(timer);
    }, [query]);

    // Filter quick portal pages matching the query
    const filteredPages = PORTAL_PAGES.filter(p => {
        if (!query.trim()) return true;
        const q = query.toLowerCase().trim();
        return p.name.toLowerCase().includes(q) || p.keywords.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }).slice(0, query.trim() ? 4 : 8);

    // Collect all selectable items for keyboard arrow navigation
    const allSelectableItems = [
        ...(results?.users || []).map(u => ({ title: u.title, url: u.url })),
        ...(results?.companies || []).map(c => ({ title: c.title, url: c.url })),
        ...(results?.jobs || []).map(j => ({ title: j.title, url: j.url })),
        ...(results?.events || []).map(e => ({ title: e.title, url: e.url })),
        ...filteredPages.map(p => ({ title: p.name, url: p.href })),
    ];

    const handleSelect = useCallback((url: string) => {
        setIsOpen(false);
        setQuery('');
        router.push(url);
    }, [router]);

    // Handle Keyboard Navigation (Arrows & Enter)
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < allSelectableItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : allSelectableItems.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < allSelectableItems.length) {
                handleSelect(allSelectableItems[selectedIndex].url);
            } else if (allSelectableItems.length > 0) {
                handleSelect(allSelectableItems[0].url);
            }
        }
    };

    const hasResults = results && (
        (results.users?.length || 0) > 0 ||
        (results.companies?.length || 0) > 0 ||
        (results.jobs?.length || 0) > 0 ||
        (results.events?.length || 0) > 0
    );

    const isSearching = query.trim().length >= 2;

    return (
        <div ref={containerRef} className="relative flex-1 min-w-0 max-w-xl">
            {/* Search Input Bar */}
            <div className="relative w-full group">
                <MagnifyingGlassIcon
                    weight="bold"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors pointer-events-none"
                    size={17}
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search intelligence..."
                    className="w-full pl-10 pr-20 py-2 sm:py-2.5 bg-purple-50/60 dark:bg-slate-800/80 border border-purple-100 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-purple-300 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 dark:text-white placeholder:text-slate-400 shadow-2xs"
                />

                {/* Right Input Badges & Controls */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                    {isLoading ? (
                        <CircleNotchIcon size={16} className="text-purple-600 animate-spin" />
                    ) : query ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuery('');
                                setResults(null);
                                inputRef.current?.focus();
                            }}
                            className="pointer-events-auto p-1 hover:bg-purple-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Clear search"
                        >
                            <XIcon size={13} weight="bold" />
                        </button>
                    ) : (
                        <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 shadow-2xs">
                            <span className="text-[11px]">⌘</span>K
                        </div>
                    )}
                </div>
            </div>

            {/* Dropdown Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-purple-100 dark:border-slate-800 shadow-2xl overflow-hidden z-50 max-h-[75vh] flex flex-col"
                    >
                        {/* Results Body */}
                        <div className="overflow-y-auto p-2.5 space-y-3 divide-y divide-purple-50/70 dark:divide-slate-800/80">
                            {/* ── CASE 1: SEARCH RESULTS ACROSS PLATFORM ── */}
                            {isSearching && hasResults && (
                                <div className="space-y-3">
                                    {/* USERS GROUP */}
                                    {results!.users?.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5">
                                                    <UsersIcon size={13} weight="bold" className="text-purple-600" />
                                                    <span>Users &amp; Candidates ({results!.users.length})</span>
                                                </span>
                                            </div>
                                            {results!.users.map((user) => (
                                                <div
                                                    key={`user-${user.id}`}
                                                    onClick={() => handleSelect(user.url)}
                                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-purple-50/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-slate-800 text-purple-700 dark:text-purple-400 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-200 dark:border-slate-700">
                                                            {user.avatar ? (
                                                                <img src={user.avatar} alt={user.title} className="w-full h-full object-cover rounded-xl" />
                                                            ) : (
                                                                <UserIcon size={16} weight="bold" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-purple-400">
                                                                {user.title}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 truncate">
                                                                {user.subtitle}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                            user.badge === 'Admin'
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : user.badge === 'Recruiter'
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        }`}>
                                                            {user.badge}
                                                        </span>
                                                        <ArrowRightIcon size={12} weight="bold" className="text-slate-300 group-hover:text-purple-600 transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* COMPANIES GROUP */}
                                    {results!.companies?.length > 0 && (
                                        <div className="pt-2 space-y-1">
                                            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5">
                                                    <BuildingOfficeIcon size={13} weight="bold" className="text-indigo-600" />
                                                    <span>Companies ({results!.companies.length})</span>
                                                </span>
                                            </div>
                                            {results!.companies.map((company) => (
                                                <div
                                                    key={`comp-${company.id}`}
                                                    onClick={() => handleSelect(company.url)}
                                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-purple-50/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100 dark:border-slate-700">
                                                            {company.avatar ? (
                                                                <img src={company.avatar} alt={company.title} className="w-full h-full object-cover rounded-xl" />
                                                            ) : (
                                                                <BuildingOfficeIcon size={16} weight="bold" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                                                                {company.title}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 truncate">
                                                                {company.subtitle || 'Company Profile'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            {company.badge}
                                                        </span>
                                                        <ArrowRightIcon size={12} weight="bold" className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* JOBS GROUP */}
                                    {results!.jobs?.length > 0 && (
                                        <div className="pt-2 space-y-1">
                                            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5">
                                                    <BriefcaseIcon size={13} weight="bold" className="text-emerald-600" />
                                                    <span>Job Vacancies ({results!.jobs.length})</span>
                                                </span>
                                            </div>
                                            {results!.jobs.map((job) => (
                                                <div
                                                    key={`job-${job.id}`}
                                                    onClick={() => handleSelect(job.url)}
                                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-purple-50/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-100 dark:border-slate-700">
                                                            <BriefcaseIcon size={16} weight="bold" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                                                                {job.title}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 truncate">
                                                                {job.subtitle}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                            job.badge.toLowerCase() === 'closed'
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {job.badge}
                                                        </span>
                                                        <ArrowRightIcon size={12} weight="bold" className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* EVENTS GROUP */}
                                    {results!.events?.length > 0 && (
                                        <div className="pt-2 space-y-1">
                                            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5">
                                                    <CalendarBlankIcon size={13} weight="bold" className="text-amber-600" />
                                                    <span>Events &amp; Workshops ({results!.events.length})</span>
                                                </span>
                                            </div>
                                            {results!.events.map((event) => (
                                                <div
                                                    key={`event-${event.id}`}
                                                    onClick={() => handleSelect(event.url)}
                                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-purple-50/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-100 dark:border-slate-700">
                                                            <CalendarBlankIcon size={16} weight="bold" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-400">
                                                                {event.title}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 truncate">
                                                                {event.subtitle}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                                            {event.badge}
                                                        </span>
                                                        <ArrowRightIcon size={12} weight="bold" className="text-slate-300 group-hover:text-amber-600 transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── CASE 2: EMPTY SEARCH STATE ── */}
                            {isSearching && !isLoading && !hasResults && filteredPages.length === 0 && (
                                <div className="text-center py-8 px-4 space-y-1">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-slate-800 flex items-center justify-center text-purple-400 mx-auto mb-2">
                                        <MagnifyingGlassIcon size={20} weight="bold" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                                        No records found for &ldquo;{query}&rdquo;
                                    </h4>
                                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                                        Try searching by role, user name, mobile number, company, or portal module.
                                    </p>
                                </div>
                            )}

                            {/* ── CASE 3: QUICK PORTAL NAVIGATION ── */}
                            {(!isSearching || filteredPages.length > 0) && (
                                <div className="space-y-1 pt-1.5 first:pt-0">
                                    <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                        <span>{isSearching ? 'Matching Admin Modules' : 'Quick Portal Navigation'}</span>
                                        {!isSearching && <span className="text-[10px] lowercase opacity-75">jump to section</span>}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {filteredPages.map((page) => (
                                            <div
                                                key={page.href}
                                                onClick={() => handleSelect(page.href)}
                                                className="flex items-center justify-between p-2 rounded-xl hover:bg-purple-50/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100/60 dark:border-slate-700">
                                                        <page.icon size={15} weight="bold" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-purple-700 dark:group-hover:text-purple-400 truncate block">
                                                            {page.name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <ArrowRightIcon size={12} weight="bold" className="text-slate-300 group-hover:text-purple-600 transition-colors shrink-0" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
