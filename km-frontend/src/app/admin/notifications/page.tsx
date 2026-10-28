'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    ArrowLeftIcon, 
    ArrowUpRightIcon, 
    ArrowsClockwiseIcon, 
    BellIcon, 
    BriefcaseIcon, 
    CalendarBlankIcon, 
    CaretLeftIcon, 
    CaretRightIcon, 
    CheckIcon, 
    ChecksIcon, 
    GraduationCapIcon, 
    MagnifyingGlassIcon, 
    ShieldWarningIcon, 
    TrashIcon, 
    UsersIcon, 
    VideoCameraIcon 
} from '@phosphor-icons/react';
import CustomImage from '@/components/ui/CustomImage';
import Pagination from '@/components/ui/Pagination';
import { useNotifications, NotificationItem, sanitizeNotificationLink } from '@/lib/notifications';

const CATEGORIES = [
    { id: 'all', label: 'All System Activity', icon: BellIcon },
    { id: 'accounts', label: 'Accounts & Users', icon: UsersIcon },
    { id: 'jobs', label: 'Jobs & Recruiters', icon: BriefcaseIcon },
    { id: 'events', label: 'Events & Bookings', icon: CalendarBlankIcon },
    { id: 'experts', label: 'Mentors & Experts', icon: GraduationCapIcon },
    { id: 'resources', label: 'Resources & Videos', icon: VideoCameraIcon },
    { id: 'system', label: 'Security & Disputes', icon: ShieldWarningIcon },
] as const;

// Admin only receives system-level notifications, excluding personal chat messages
const isSystemLevelNotification = (n: NotificationItem) => {
    return n.category !== 'messages' && n.type !== 'chat_message';
};

const matchesCategory = (item: NotificationItem, category: string) => {
    if (category === 'all') return true;
    const type = (item.type || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();

    if (category === 'accounts') {
        return cat === 'network' || type.includes('account') || type.includes('user') || type.includes('registration');
    }
    if (category === 'jobs') {
        return cat === 'jobs' || type.includes('job') || type.includes('company') || type.includes('application');
    }
    if (category === 'events') {
        return type.includes('event') || type.includes('workshop') || type.includes('booking') || type.includes('interview');
    }
    if (category === 'experts') {
        return type.includes('expert') || type.includes('mentor');
    }
    if (category === 'resources') {
        return type.includes('video') || type.includes('resource') || type.includes('feed') || type.includes('learn');
    }
    if (category === 'system') {
        return cat === 'system' || type.includes('dispute') || type.includes('report') || type.includes('security') || type.includes('alert') || type.includes('wallet');
    }
    return true;
};

export default function AdminNotificationsPage() {
    const router = useRouter();
    const {
        notifications: contextNotifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    } = useNotifications();

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [feedItems, setFeedItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
    const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(15);

    // Horizontal category pills scroll state
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
    const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

    const checkScrollButtons = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setCanScrollLeft(scrollLeft > 6);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
    }, []);

    const scrollCategories = (direction: 'left' | 'right') => {
        if (!scrollContainerRef.current) return;
        const offset = direction === 'left' ? -220 : 220;
        scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
        setTimeout(checkScrollButtons, 300);
    };

    // Initial and refreshed fetch
    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchNotifications('all', false, 200, 0);
            const systemOnly = (res.notifications || []).filter(isSystemLevelNotification);
            setFeedItems(systemOnly);
        } catch (err) {
            console.error('Failed to load admin notifications:', err);
            setFeedItems([]);
        } finally {
            setLoading(false);
        }
    }, [fetchNotifications]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    useEffect(() => {
        checkScrollButtons();
        const handleResize = () => checkScrollButtons();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [checkScrollButtons]);

    // Reset pagination to page 1 whenever category or search filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchQuery]);

    // Merge incoming real-time notifications from context (filtering out personal chat messages)
    useEffect(() => {
        if (contextNotifications.length > 0) {
            setFeedItems((prev) => {
                const map = new Map<string, NotificationItem>();
                contextNotifications.filter(isSystemLevelNotification).forEach((n) => map.set(n.id, n));
                prev.forEach((n) => {
                    if (!map.has(n.id) && isSystemLevelNotification(n)) {
                        map.set(n.id, n);
                    }
                });
                return Array.from(map.values());
            });
        }
    }, [contextNotifications]);

    // Calculate unread system notifications count
    const unreadSystemCount = useMemo(() => {
        return feedItems.filter((item) => !item.is_read).length;
    }, [feedItems]);

    // Handle Mark All As Read
    const handleMarkAllRead = async () => {
        if (isMarkingAll || unreadSystemCount === 0) return;
        setIsMarkingAll(true);
        try {
            setFeedItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
            await markAllAsRead();
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        } finally {
            setIsMarkingAll(false);
        }
    };

    // Handle Single Mark as Read
    const handleMarkSingleRead = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setActionInProgressId(id);
        try {
            setFeedItems((prev) =>
                prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
            );
            await markAsRead(id);
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        } finally {
            setActionInProgressId(null);
        }
    };

    // Handle Delete Notification
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setActionInProgressId(id);
        try {
            setFeedItems((prev) => prev.filter((item) => item.id !== id));
            await deleteNotification(id);
        } catch (err) {
            console.error('Failed to delete notification:', err);
        } finally {
            setActionInProgressId(null);
        }
    };

    // Card click navigation
    const handleCardClick = async (item: NotificationItem) => {
        if (!item.is_read) {
            setFeedItems((prev) =>
                prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
            );
            markAsRead(item.id);
        }

        if (item.type === 'connection_accepted') {
            const targetId = item.actor_id || item.metadata?.accepted_by;
            if (targetId) {
                router.push(`/profile/${targetId}`);
                return;
            }
        }

        if (item.link) {
            router.push(sanitizeNotificationLink(item.link, item));
        }
    };

    // Filter by selected category and client search query
    const filteredFeedItems = useMemo(() => {
        return feedItems.filter((item) => {
            if (!matchesCategory(item, selectedCategory)) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const name = (item.actor_name || '').toLowerCase();
            const title = (item.title || '').toLowerCase();
            const msg = (item.message || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            return name.includes(q) || title.includes(q) || msg.includes(q) || cat.includes(q);
        });
    }, [feedItems, selectedCategory, searchQuery]);

    // Paginated subset
    const totalPages = Math.max(1, Math.ceil(filteredFeedItems.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedFeedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredFeedItems.slice(startIndex, startIndex + pageSize);
    }, [filteredFeedItems, currentPage, pageSize]);

    // Relative timestamp helper
    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const now = new Date();
            const date = new Date(dateStr);
            const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
            if (diffSec < 60) return 'Just now';
            const diffMin = Math.floor(diffSec / 60);
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ago`;
            const diffDay = Math.floor(diffHr / 24);
            if (diffDay === 1) return 'Yesterday';
            if (diffDay < 7) return `${diffDay}d ago`;
            return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    };

    // Category / Type icon & color badge
    const getCategoryBadge = (category: string, type: string) => {
        const t = (type || '').toLowerCase();
        const c = (category || '').toLowerCase();

        if (t.includes('event') || t.includes('booking') || t.includes('interview') || t.includes('workshop')) {
            return {
                icon: CalendarBlankIcon,
                bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-400',
                label: 'Event & Booking',
            };
        }
        if (t.includes('expert') || t.includes('mentor')) {
            return {
                icon: GraduationCapIcon,
                bg: 'bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-400',
                label: 'Expert / Mentor',
            };
        }
        if (t.includes('video') || t.includes('resource') || t.includes('feed') || t.includes('learn')) {
            return {
                icon: VideoCameraIcon,
                bg: 'bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-400',
                label: 'Resource / Video',
            };
        }
        if (c === 'jobs' || t.includes('job') || t.includes('company') || t.includes('application')) {
            return {
                icon: BriefcaseIcon,
                bg: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400',
                label: 'Job & Recruiter',
            };
        }
        if (c === 'network' || t.includes('user') || t.includes('account')) {
            return {
                icon: UsersIcon,
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400',
                label: 'New Account / User',
            };
        }
        return {
            icon: ShieldWarningIcon,
            bg: 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400',
            label: 'System Action',
        };
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-12 w-full max-w-6xl mx-auto px-1 sm:px-2">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Link href="/admin" className="hover:text-purple-600 transition-colors flex items-center gap-1">
                    <ArrowLeftIcon weight="bold" size={13} />
                    <span>Admin Overview</span>
                </Link>
                <span>/</span>
                <span className="text-purple-700 font-semibold">System Notifications</span>
            </div>

            {/* Header Banner */}
            <div className="bg-km-surface-card border border-purple-100/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-linear-to-bl from-purple-100/50 via-indigo-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-linear-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
                                <BellIcon size={22} weight="bold" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight dark:text-white truncate">
                                    System Notifications
                                </h1>
                                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                                    Live activity stream: accounts, jobs, bookings, events, mentors, and resources
                                </p>
                            </div>
                        </div>

                        {/* Quick Metrics */}
                        <div className="flex flex-wrap items-center gap-2 mt-3.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                Total Activity: {feedItems.length}
                            </span>
                            {unreadSystemCount > 0 ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200/60 animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {unreadSystemCount} Unread
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <CheckIcon size={12} weight="bold" />
                                    All Caught Up
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Top Action Buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={handleMarkAllRead}
                            disabled={isMarkingAll || unreadSystemCount === 0}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer whitespace-nowrap"
                        >
                            <ChecksIcon size={18} weight="bold" className="shrink-0" />
                            <span>{isMarkingAll ? 'Marking...' : 'Mark All as Read'}</span>
                        </button>

                        <button
                            onClick={loadNotifications}
                            disabled={loading}
                            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-km-surface-card hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-purple-100 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
                            title="Refresh system activity"
                        >
                            <ArrowsClockwiseIcon size={18} className={loading ? 'animate-spin text-purple-600' : ''} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-km-surface-card border border-purple-50 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3.5 min-w-0">
                {/* Search Input */}
                <div className="relative w-full">
                    <MagnifyingGlassIcon
                        size={16}
                        weight="bold"
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search system activity by title, keywords, or details..."
                        className="w-full pl-9 pr-14 py-2 sm:py-2.5 text-xs sm:text-sm bg-purple-50/40 border border-purple-100/60 rounded-xl focus:outline-none focus:border-purple-300 focus:bg-km-surface-card transition-all placeholder:text-slate-400"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Category Pills Strip */}
                <div className="relative min-w-0">
                    {canScrollLeft && (
                        <button
                            type="button"
                            onClick={() => scrollCategories('left')}
                            className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 hidden sm:flex items-center justify-center bg-white/95 dark:bg-slate-800 shadow-md border border-purple-200 rounded-full text-slate-700 hover:text-purple-700 hover:bg-purple-50 transition-all cursor-pointer"
                            title="Scroll left"
                            aria-label="Scroll left"
                        >
                            <CaretLeftIcon size={14} weight="bold" />
                        </button>
                    )}

                    <div
                        ref={scrollContainerRef}
                        onScroll={checkScrollButtons}
                        className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-1 pr-6 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.3)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-purple-200 hover:[&::-webkit-scrollbar-thumb]:bg-purple-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-purple-50/30"
                    >
                        {CATEGORIES.map((cat) => {
                            const IconComponent = cat.icon;
                            const isSelected = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer select-none ${
                                        isSelected
                                            ? 'bg-purple-600 text-white shadow-xs shadow-purple-600/20 ring-2 ring-purple-600/20'
                                            : 'bg-purple-50/80 text-slate-600 hover:bg-purple-100 hover:text-purple-900 border border-purple-100/60'
                                    }`}
                                >
                                    <IconComponent size={15} weight={isSelected ? 'bold' : 'regular'} className="shrink-0" />
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {canScrollRight && (
                        <button
                            type="button"
                            onClick={() => scrollCategories('right')}
                            className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 hidden sm:flex items-center justify-center bg-white/95 dark:bg-slate-800 shadow-md border border-purple-200 rounded-full text-slate-700 hover:text-purple-700 hover:bg-purple-50 transition-all cursor-pointer"
                            title="Scroll right"
                            aria-label="Scroll right"
                        >
                            <CaretRightIcon size={14} weight="bold" />
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications Feed */}
            <div className="bg-km-surface-card border border-purple-50 rounded-2xl shadow-xs overflow-hidden min-w-0">
                {loading ? (
                    <div className="divide-y divide-purple-50/60 p-4 space-y-3">
                        {[1, 2, 3, 4, 5].map((idx) => (
                            <div key={idx} className="flex items-center gap-3.5 py-3 animate-pulse">
                                <div className="w-10 h-10 bg-purple-100 rounded-xl shrink-0" />
                                <div className="flex-1 space-y-2 min-w-0">
                                    <div className="h-4 bg-purple-100 rounded-md w-1/3" />
                                    <div className="h-3 bg-purple-50 rounded-md w-2/3" />
                                </div>
                                <div className="w-16 h-4 bg-purple-100 rounded-md shrink-0" />
                            </div>
                        ))}
                    </div>
                ) : filteredFeedItems.length === 0 ? (
                    <div className="py-16 px-4 sm:px-6 text-center">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-purple-50 rounded-3xl flex items-center justify-center text-purple-500 mb-4 shadow-inner">
                            <BellIcon size={32} weight="duotone" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">
                            {searchQuery ? 'No matching activity found' : 'No notifications'}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                            {searchQuery
                                ? 'Try refining your search keyword or selecting a different category.'
                                : 'All caught up! New system-level activities (accounts, bookings, jobs, mentors, events) will appear here in real-time.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-purple-50/80">
                            {paginatedFeedItems.map((item) => {
                                const badge = getCategoryBadge(item.category, item.type);
                                const IconComponent = badge.icon;
                                const isBusy = actionInProgressId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleCardClick(item)}
                                        className={`p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-all cursor-pointer group hover:bg-purple-50/40 relative min-w-0 ${
                                            !item.is_read
                                                ? 'bg-purple-50/25 border-l-4 border-l-purple-600'
                                                : 'bg-km-surface-card'
                                        }`}
                                    >
                                        {/* Left: Avatar / Icon + Text content */}
                                        <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 flex-1 min-w-0">
                                            {/* Actor Avatar or Category Icon */}
                                            <div className="relative shrink-0">
                                                {item.actor_avatar ? (
                                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-purple-100 border border-purple-200/80 shadow-xs">
                                                        <CustomImage
                                                            src={item.actor_avatar}
                                                            alt={item.actor_name || 'User'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shadow-xs ${badge.bg}`}
                                                    >
                                                        <IconComponent size={20} weight="duotone" />
                                                    </div>
                                                )}
                                                {!item.is_read && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse shadow-xs" />
                                                )}
                                            </div>

                                            {/* Texts */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                    <h4
                                                        className={`text-xs sm:text-sm break-words line-clamp-2 ${
                                                            !item.is_read
                                                                ? 'font-bold text-slate-900 dark:text-white'
                                                                : 'font-semibold text-slate-700 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        {item.title}
                                                    </h4>
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${badge.bg}`}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 font-normal leading-relaxed">
                                                    {item.message}
                                                </p>

                                                <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mt-1 text-[11px] text-slate-400 font-medium">
                                                    <span>{formatTime(item.created_at)}</span>
                                                    {item.actor_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-slate-500 truncate max-w-[150px]">{item.actor_name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right / Bottom: Action Buttons */}
                                        <div className="flex items-center gap-1.5 justify-end self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t border-purple-50/80 sm:border-t-0 w-full sm:w-auto">
                                            {/* Mark as read button */}
                                            {!item.is_read && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkSingleRead(e, item.id)}
                                                    disabled={isBusy}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200/60 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                                                    title="Mark as read"
                                                >
                                                    <CheckIcon size={14} weight="bold" />
                                                    <span>Mark Read</span>
                                                </button>
                                            )}

                                            {/* Open / Link indicator */}
                                            {item.link && (
                                                <div
                                                    className="p-1.5 sm:p-2 text-slate-400 hover:text-purple-600 rounded-xl hover:bg-purple-50 transition-colors"
                                                    title="Open target link"
                                                >
                                                    <ArrowUpRightIcon size={16} weight="bold" />
                                                </div>
                                            )}

                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(e, item.id)}
                                                disabled={isBusy}
                                                className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                                title="Delete notification"
                                            >
                                                <TrashIcon size={16} weight="bold" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination Bar */}
                        {filteredFeedItems.length > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-purple-50 bg-purple-50/20">
                                <div className="flex items-center gap-3">
                                    <p className="text-xs text-slate-500 font-medium">
                                        Showing <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                                        <span className="font-bold text-slate-800">
                                            {Math.min(currentPage * pageSize, filteredFeedItems.length)}
                                        </span>{' '}
                                        of <span className="font-bold text-slate-800">{filteredFeedItems.length}</span> activities
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <span className="hidden sm:inline">Per page:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="bg-white border border-purple-100 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-300 cursor-pointer"
                                        >
                                            <option value={15}>15</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                </div>

                                {totalPages > 1 && (
                                    <Pagination
                                        current={currentPage}
                                        total={totalPages}
                                        onPageChange={setCurrentPage}
                                    />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
