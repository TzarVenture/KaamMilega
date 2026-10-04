"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Bell,
    MessageSquare,
    Briefcase,
    Users,
    Calendar,
    Check,
    CheckCheck,
    Trash2,
    SlidersHorizontal,
    ArrowUpRight,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import CustomImage from "@/components/ui/CustomImage";
import { useNotifications, NotificationItem, sanitizeNotificationLink } from "@/lib/notifications";

const CATEGORIES = [
    { id: "all", label: "All", icon: Bell },
    { id: "messages", label: "Messages & Chat", icon: MessageSquare },
    { id: "jobs", label: "Jobs & Applications", icon: Briefcase },
    { id: "network", label: "Network & Invites", icon: Users },
    { id: "system", label: "System & Alerts", icon: Bell },
] as const;

const PAGE_SIZE = 20;

export default function NotificationsPage() {
    const router = useRouter();
    const {
        unreadCount,
        notifications: contextNotifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    } = useNotifications();

    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [feedItems, setFeedItems] = useState<NotificationItem[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Initial fetch when category or unread filter changes
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        fetchNotifications(selectedCategory, unreadOnly, PAGE_SIZE, 0)
            .then((res) => {
                if (isMounted) {
                    setFeedItems(res.notifications);
                    setTotalCount(res.total);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setFeedItems([]);
                    setTotalCount(0);
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedCategory, unreadOnly, fetchNotifications]);

    // Handle real-time incoming notification from context
    useEffect(() => {
        if (contextNotifications.length > 0 && selectedCategory === "all" && !unreadOnly) {
            setFeedItems((prev) => {
                const map = new Map<string, NotificationItem>();
                // Context items first (newest)
                contextNotifications.forEach((n) => map.set(n.id, n));
                // Then previous loaded items
                prev.forEach((n) => {
                    if (!map.has(n.id)) {
                        map.set(n.id, n);
                    }
                });
                return Array.from(map.values());
            });
        }
    }, [contextNotifications, selectedCategory, unreadOnly]);

    // Load More pagination
    const handleLoadMore = useCallback(async () => {
        if (loadingMore || feedItems.length >= totalCount) return;
        setLoadingMore(true);
        try {
            const nextOffset = feedItems.length;
            const res = await fetchNotifications(selectedCategory, unreadOnly, PAGE_SIZE, nextOffset);
            setFeedItems((prev) => {
                const map = new Map<string, NotificationItem>();
                prev.forEach((item) => map.set(item.id, item));
                res.notifications.forEach((item) => map.set(item.id, item));
                return Array.from(map.values());
            });
            setTotalCount(res.total);
        } catch (err) {
            console.error("Failed to load more notifications:", err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, feedItems.length, totalCount, selectedCategory, unreadOnly, fetchNotifications]);

    // Client-side Keyword Search filter (by actor name, title, message, company, or job title)
    const filteredFeedItems = useMemo(() => {
        if (!searchQuery.trim()) return feedItems;
        const q = searchQuery.toLowerCase().trim();
        return feedItems.filter((item) => {
            const name = (item.actor_name || "").toLowerCase();
            const title = (item.title || "").toLowerCase();
            const msg = (item.message || "").toLowerCase();
            const company = String(item.metadata?.company_name || item.metadata?.company || "").toLowerCase();
            const jobTitle = String(item.metadata?.job_title || "").toLowerCase();
            return name.includes(q) || title.includes(q) || msg.includes(q) || company.includes(q) || jobTitle.includes(q);
        });
    }, [feedItems, searchQuery]);

    // Group filtered items by timeline: Today, Yesterday, Earlier
    const groupedNotifications = useMemo(() => {
        const today: NotificationItem[] = [];
        const yesterday: NotificationItem[] = [];
        const earlier: NotificationItem[] = [];

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 86400000;

        for (const item of filteredFeedItems) {
            const itemTime = new Date(item.created_at).getTime();
            if (itemTime >= startOfToday) {
                today.push(item);
            } else if (itemTime >= startOfYesterday) {
                yesterday.push(item);
            } else {
                earlier.push(item);
            }
        }

        return { today, yesterday, earlier };
    }, [filteredFeedItems]);

    // Calculate unread counts per category from current context
    const categoryUnreadCounts = useMemo(() => {
        const counts: Record<string, number> = {
            all: unreadCount,
            messages: 0,
            jobs: 0,
            network: 0,
            system: 0,
        };

        for (const n of contextNotifications) {
            if (!n.is_read) {
                if (n.category && counts[n.category] !== undefined) {
                    counts[n.category]++;
                }
            }
        }

        return counts;
    }, [unreadCount, contextNotifications]);

    // Format relative time helper
    const formatTime = (dateStr: string) => {
        if (!dateStr) return "";
        try {
            const now = new Date();
            const date = new Date(dateStr);
            const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
            if (diffSec < 60) return "just now";
            const diffMin = Math.floor(diffSec / 60);
            if (diffMin < 60) return `${diffMin}m`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h`;
            const diffDay = Math.floor(diffHr / 24);
            if (diffDay === 1) return "1d";
            if (diffDay < 7) return `${diffDay}d`;
            return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        } catch {
            return "";
        }
    };

    // Category icon helper with solid fill
    const renderCategoryIcon = (category: string, type: string) => {
        if (type === "interview_scheduled") {
            return (
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                    <Calendar size={16} className="fill-indigo-700" />
                </div>
            );
        }
        if (category === "messages") {
            return (
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <MessageSquare size={16} className="fill-blue-700" />
                </div>
            );
        }
        if (category === "jobs") {
            return (
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                    <Briefcase size={16} className="fill-amber-700" />
                </div>
            );
        }
        if (category === "network") {
            return (
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Users size={16} className="fill-emerald-700" />
                </div>
            );
        }
        return (
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Bell size={16} className="fill-slate-700" />
            </div>
        );
    };



    // Action button label helper
    const getActionLabel = (item: NotificationItem) => {
        if (item.category === "messages") return "Reply";
        if (item.type === "application_received") return "Review";
        if (item.type === "application_status") return "View";
        if (item.type === "interview_scheduled") return "View";
        if (item.type === "connection_request") return "View";
        if (item.type === "connection_accepted") return "Profile";
        if (item.link) return "Open";
        return null;
    };

    const handleActionClick = (e: React.MouseEvent, item: NotificationItem) => {
        e.stopPropagation();
        if (!item.is_read) {
            markAsRead(item.id);
            setFeedItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
        }
        if (item.type === "connection_accepted") {
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

    const handleCardClick = (item: NotificationItem) => {
        if (!item.is_read) {
            markAsRead(item.id);
            setFeedItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
        }
        if (item.type === "connection_accepted") {
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

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteNotification(id);
        setFeedItems((prev) => prev.filter((n) => n.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
    };

    const handleMarkSingleRead = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        markAsRead(id);
        setFeedItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead();
        setFeedItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    };

    // Compact Notification Row (~58px–64px height)
    const renderNotificationRow = (item: NotificationItem) => {
        const actionLabel = getActionLabel(item);

        return (
            <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={`px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-3.5 transition-colors cursor-pointer group hover:bg-slate-50 relative ${
                    !item.is_read ? "bg-blue-50/40" : "bg-white"
                }`}
            >
                {/* 1. Compact Avatar / Icon (36px) */}
                <div className="relative shrink-0">
                    {item.actor_avatar ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                            <CustomImage src={item.actor_avatar} alt={item.actor_name || "User"} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        renderCategoryIcon(item.category, item.type)
                    )}
                </div>

                {/* 2. Inline Sentence Flow */}
                <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs sm:text-sm text-slate-700 leading-snug line-clamp-2">
                        <span className={`mr-1.5 ${!item.is_read ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>
                            {item.actor_name || item.title}
                        </span>
                        <span className={!item.is_read ? "text-slate-800 font-medium" : "text-slate-600"}>
                            {item.message}
                        </span>
                        <span className="inline-block mx-1.5 text-slate-300">·</span>
                        <span className="text-[11px] text-slate-400 font-normal shrink-0">
                            {formatTime(item.created_at)}
                        </span>
                    </p>
                </div>

                {/* 3. Trailing Quick Action & Controls */}
                <div className="flex items-center gap-2 shrink-0">
                    {actionLabel && (
                        <button
                            onClick={(e) => handleActionClick(e, item)}
                            className="hidden sm:inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-km-primary hover:text-km-primary-dark bg-blue-50/90 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                        >
                            {actionLabel}
                        </button>
                    )}

                    {!item.is_read && (
                        <button
                            onClick={(e) => handleMarkSingleRead(e, item.id)}
                            title="Mark as read"
                            className="p-1.5 text-slate-400 hover:text-km-primary hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <Check size={14} />
                        </button>
                    )}

                    <button
                        onClick={(e) => handleDelete(e, item.id)}
                        title="Delete notification"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                        <Trash2 size={14} />
                    </button>

                    {/* Unread Indicator Dot */}
                    {!item.is_read ? (
                        <span className="w-2 h-2 rounded-full bg-km-primary shrink-0" />
                    ) : (
                        <span className="w-2 h-2 shrink-0" />
                    )}
                </div>
            </div>
        );
    };

    const hasMore = feedItems.length < totalCount;

    return (
        <div className="min-h-screen bg-[#F4F7FB] py-6 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT SIDEBAR: Categories & Settings Navigation */}
                <aside className="lg:col-span-3 space-y-4">
                    {/* Management Card */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
                            {unreadCount > 0 && (
                                <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full border border-red-100">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>

                        {/* Category Navigation with Dynamic Count Badges */}
                        <div className="space-y-1">
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                const isActive = selectedCategory === cat.id;
                                const count = categoryUnreadCounts[cat.id] || 0;

                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                            isActive
                                                ? "bg-km-primary text-white shadow-xs"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Icon size={15} className={isActive ? "fill-white text-white" : "fill-slate-500 text-slate-500"} />
                                            <span>{cat.label}</span>
                                        </div>
                                        {count > 0 && (
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                    isActive ? "bg-white/20 text-white" : "bg-red-50 text-red-600"
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <hr className="my-3 border-slate-100" />

                        {/* Direct link to real Settings page */}
                        <Link
                            href="/settings?tab=notifications"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal size={14} className="text-slate-600" />
                                <span>Notification Settings</span>
                            </div>
                            <ArrowUpRight size={13} className="text-slate-400" />
                        </Link>
                    </div>

                    {/* Unread Filter Switch Card */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-900">Unread only</p>
                            <p className="text-[11px] text-slate-500">Filter pending alerts</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={unreadOnly}
                                onChange={(e) => setUnreadOnly(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-km-primary"></div>
                        </label>
                    </div>
                </aside>

                {/* CENTER FEED: Compact High-Density List */}
                <main className="lg:col-span-6 space-y-4">
                    {/* Header Bar */}
                    <div className="bg-white rounded-2xl px-5 py-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold text-slate-900">
                                {CATEGORIES.find((c) => c.id === selectedCategory)?.label || "Notifications"}
                            </h1>
                            <span className="text-xs font-semibold text-slate-400">
                                ({searchQuery ? `${filteredFeedItems.length} of ${totalCount}` : totalCount})
                            </span>
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-km-primary hover:text-km-primary-dark transition-colors cursor-pointer"
                            >
                                <CheckCheck size={15} />
                                <span>Mark all as read</span>
                            </button>
                        )}
                    </div>

                    {/* Optional Keyword Search Input (filter by user name, company, or message) */}
                    <div className="bg-white rounded-2xl p-2.5 sm:px-4 sm:py-3 border border-slate-200 shadow-xs flex items-center gap-2.5">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter by name, company, or keyword (e.g. Google, Rohan)..."
                            className="w-full text-xs sm:text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors shrink-0"
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Feed Content */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <div className="w-7 h-7 border-2 border-km-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-xs font-medium text-slate-500">Loading notifications...</p>
                            </div>
                        ) : filteredFeedItems.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                                    {searchQuery ? <Search size={20} className="text-slate-400" /> : <Bell size={20} className="fill-slate-400 text-slate-400" />}
                                </div>
                                <h3 className="text-sm font-bold text-slate-800">
                                    {searchQuery ? "No matching notifications" : "You're all caught up!"}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    {searchQuery
                                        ? `No notifications found matching "${searchQuery}". Check the spelling or clear the search filter.`
                                        : unreadOnly
                                        ? "No unread notifications in this category. Switch off the unread filter to see past activity."
                                        : "No notifications found in this category yet. When updates arrive, they will appear here."}
                                </p>
                                {searchQuery ? (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        Clear Search
                                    </button>
                                ) : unreadOnly ? (
                                    <button
                                        onClick={() => setUnreadOnly(false)}
                                        className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        View All
                                    </button>
                                ) : null}
                            </div>
                        ) : (
                            <div>
                                {/* Today Group */}
                                {groupedNotifications.today.length > 0 && (
                                    <div className="divide-y divide-slate-100">
                                        <div className="px-5 py-2 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Today
                                        </div>
                                        {groupedNotifications.today.map(renderNotificationRow)}
                                    </div>
                                )}

                                {/* Yesterday Group */}
                                {groupedNotifications.yesterday.length > 0 && (
                                    <div className="divide-y divide-slate-100">
                                        <div className="px-5 py-2 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Yesterday
                                        </div>
                                        {groupedNotifications.yesterday.map(renderNotificationRow)}
                                    </div>
                                )}

                                {/* Earlier Group */}
                                {groupedNotifications.earlier.length > 0 && (
                                    <div className="divide-y divide-slate-100">
                                        <div className="px-5 py-2 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Earlier
                                        </div>
                                        {groupedNotifications.earlier.map(renderNotificationRow)}
                                    </div>
                                )}

                                {/* Pagination / Load More (hidden if searching locally) */}
                                {hasMore && !searchQuery && (
                                    <div className="p-3 text-center border-t border-slate-100 bg-slate-50/50">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={loadingMore}
                                            className="px-5 py-2 text-xs font-bold text-km-primary hover:text-km-primary-dark hover:bg-blue-50 border border-blue-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-km-primary border-t-transparent rounded-full animate-spin" />
                                                    <span>Loading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw size={13} />
                                                    <span>Load more notifications ({totalCount - feedItems.length} remaining)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>

                {/* RIGHT SIDEBAR: Preserved Ad Banner Placeholder */}
                <aside className="lg:col-span-3">
                    <div className="bg-white rounded-2xl h-64 flex items-center justify-center border border-dashed border-gray-200 text-gray-400 font-bold text-xl shadow-xs sticky top-20">
                        Ad Banner
                    </div>
                </aside>

            </div>
        </div>
    );
}