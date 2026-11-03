'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowsClockwiseIcon, BellIcon, BriefcaseIcon, CalendarBlankIcon, CheckIcon, ChecksIcon, GraduationCapIcon, ShieldWarningIcon, TrashIcon, UsersIcon, VideoCameraIcon } from '@phosphor-icons/react';
import CustomImage from '@/components/ui/CustomImage';
import Pagination from '@/components/ui/Pagination';
import { useNotifications, NotificationItem, sanitizeNotificationLink } from '@/lib/notifications';
import { AdminPageHeader, AdminPanel, EmptyState, FilterTabs, SearchInput, SkeletonRows, btn, cx } from '@/components/admin/ui';

const CATEGORIES = [
    { id: 'all', label: 'All', icon: BellIcon },
    { id: 'accounts', label: 'Accounts', icon: UsersIcon },
    { id: 'jobs', label: 'Jobs', icon: BriefcaseIcon },
    { id: 'events', label: 'Events and bookings', icon: CalendarBlankIcon },
    { id: 'experts', label: 'Experts', icon: GraduationCapIcon },
    { id: 'resources', label: 'Videos', icon: VideoCameraIcon },
    { id: 'system', label: 'Safety and disputes', icon: ShieldWarningIcon },
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

    // The first category (after "All") an item falls in, for its icon and label
    const categoryOf = (item: NotificationItem) =>
        CATEGORIES.find((c) => c.id !== 'all' && matchesCategory(item, c.id)) || CATEGORIES[CATEGORIES.length - 1];

    return (
        <div>
            <AdminPageHeader
                title="Notifications"
                description="Platform activity: new accounts, jobs, bookings, experts and reports"
                actions={
                    <>
                        <button type="button" onClick={loadNotifications} disabled={loading} className={btn.icon} aria-label="Refresh">
                            <ArrowsClockwiseIcon size={18} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={handleMarkAllRead} disabled={isMarkingAll || unreadSystemCount === 0} className={btn.secondary}>
                            <ChecksIcon size={16} aria-hidden="true" />
                            Mark all as read
                        </button>
                    </>
                }
            />

            <AdminPanel>
                <div className="flex flex-col gap-3 px-5 py-4 border-b border-km-border-subtle">
                    <div className="flex items-center justify-between gap-3">
                        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search notifications" className="w-full sm:max-w-sm" />
                        {!loading && (
                            <span className="hidden sm:inline shrink-0 text-sm text-km-text-secondary font-inter">
                                {unreadSystemCount > 0 ? `${unreadSystemCount} unread` : 'All read'}
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto -mx-1 px-1">
                        <FilterTabs
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={CATEGORIES.map((c) => ({ value: c.id as string, label: c.label }))}
                        />
                    </div>
                </div>

                {loading ? (
                    <SkeletonRows rows={6} />
                ) : filteredFeedItems.length === 0 ? (
                    <EmptyState
                        icon={BellIcon}
                        title={searchQuery || selectedCategory !== 'all' ? 'No matching notifications' : 'No notifications'}
                        description={searchQuery || selectedCategory !== 'all' ? 'Try a different search or category.' : 'Platform activity shows up here as it happens.'}
                    />
                ) : (
                    <>
                        <ul className="divide-y divide-km-border-subtle">
                            {paginatedFeedItems.map((item) => {
                                const cat = categoryOf(item);
                                const CatIcon = cat.icon;
                                const isBusy = actionInProgressId === item.id;
                                const clickable = Boolean(item.link) || item.type === 'connection_accepted';

                                return (
                                    <li key={item.id} className={cx('relative flex items-start gap-3 px-5 py-4 transition-colors hover:bg-km-surface', !item.is_read && 'bg-blue-50/40')}>
                                        {!item.is_read && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-km-accent" aria-hidden="true" />}
                                        {item.actor_avatar ? (
                                            <CustomImage src={item.actor_avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-km-surface" />
                                        ) : (
                                            <CatIcon size={22} className="mt-0.5 shrink-0 text-km-text-secondary" aria-hidden="true" />
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleCardClick(item)}
                                            className={cx('flex-1 min-w-0 text-left', clickable ? 'cursor-pointer' : 'cursor-default')}
                                        >
                                            <p className={cx('text-sm break-words line-clamp-2', item.is_read ? 'font-medium text-km-text-primary' : 'font-semibold text-km-heading')}>
                                                {!item.is_read && <span className="sr-only">Unread: </span>}
                                                {item.title}
                                            </p>
                                            {item.message && <p className="mt-0.5 text-sm text-km-text-secondary line-clamp-2">{item.message}</p>}
                                            <p className="mt-1 text-xs text-km-text-muted">
                                                {[cat.label, item.actor_name, formatTime(item.created_at)].filter(Boolean).join(' · ')}
                                            </p>
                                        </button>

                                        <div className="flex items-center shrink-0">
                                            {!item.is_read && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkSingleRead(e, item.id)}
                                                    disabled={isBusy}
                                                    className={btn.icon}
                                                    aria-label="Mark as read"
                                                    title="Mark as read"
                                                >
                                                    <CheckIcon size={18} aria-hidden="true" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(e, item.id)}
                                                disabled={isBusy}
                                                className={`${btn.icon} hover:text-red-600`}
                                                aria-label="Delete notification"
                                                title="Delete"
                                            >
                                                <TrashIcon size={18} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-km-border-subtle">
                            <div className="flex items-center gap-3 text-sm text-km-text-secondary">
                                <span className="font-inter">
                                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredFeedItems.length)} of {filteredFeedItems.length}
                                </span>
                                <label className="flex items-center gap-1.5">
                                    <span className="sr-only sm:not-sr-only">Per page</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="h-8 px-2 rounded-lg border border-km-border bg-km-surface-card text-sm text-km-text-primary cursor-pointer outline-none focus:border-km-blue"
                                    >
                                        <option value={15}>15</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </label>
                            </div>
                            {totalPages > 1 && (
                                <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
                            )}
                        </div>
                    </>
                )}
            </AdminPanel>
        </div>
    );
}
