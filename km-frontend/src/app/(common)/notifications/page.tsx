"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    BellIcon,
    BriefcaseIcon,
    AlarmIcon,
    CalendarBlankIcon,
    CertificateIcon,
    ChatIcon,
    CheckIcon,
    ChecksIcon,
    GearSixIcon,
    HeartIcon,
    MagnifyingGlassIcon,
    SealCheckIcon,
    ShieldWarningIcon,
    SpinnerGapIcon,
    TrashIcon,
    UsersIcon,
    XIcon,
    type Icon,
} from "@phosphor-icons/react";
import CustomImage from "@/components/ui/CustomImage";
import PushPrompt from "@/components/km/PushPrompt";
import { cursorAfter, useNotifications, type NotificationItem, sanitizeNotificationLink } from "@/lib/notifications";
import AdSlot from "@/components/ads/AdSlot";

const CATEGORIES: { id: string; label: string; icon: Icon }[] = [
    { id: "all", label: "All", icon: BellIcon },
    { id: "messages", label: "Messages", icon: ChatIcon },
    { id: "jobs", label: "Jobs and applications", icon: BriefcaseIcon },
    { id: "network", label: "Network", icon: UsersIcon },
    { id: "system", label: "Account and updates", icon: BellIcon },
];

const PAGE_SIZE = 20;

/** "now", "5m", "3h", "2d", then a date */
function shortTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function typeIcon(item: NotificationItem): { Icon: Icon; color: string } {
    if (item.type === "certificate_review") return { Icon: CertificateIcon, color: "text-km-link" };
    if (item.type === "expert_application") return { Icon: SealCheckIcon, color: "text-km-mentors" };
    if (item.type === "interview_scheduled") return { Icon: CalendarBlankIcon, color: "text-km-jobs" };
    if (item.type === "feed_reaction") return { Icon: HeartIcon, color: "text-km-services" };
    if (item.type === "job_alert") return { Icon: BriefcaseIcon, color: "text-km-jobs" };
    if (item.type === "reminder") return { Icon: AlarmIcon, color: "text-km-events" };
    if (item.type === "account") return { Icon: ShieldWarningIcon, color: "text-km-heading" };
    if (item.category === "messages") return { Icon: ChatIcon, color: "text-km-link" };
    if (item.category === "jobs") return { Icon: BriefcaseIcon, color: "text-km-jobs" };
    if (item.category === "network") return { Icon: UsersIcon, color: "text-km-link" };
    return { Icon: BellIcon, color: "text-km-text-secondary" };
}

function targetOf(item: NotificationItem): string | null {
    if (item.type === "connection_accepted") {
        const id = item.actor_id || item.metadata?.accepted_by;
        if (id) return `/profile/${id}`;
    }
    return item.link ? sanitizeNotificationLink(item.link, item) : null;
}

/** Does a live notification belong in the list as it's filtered now? */
function fits(item: NotificationItem, category: string, unreadOnly: boolean) {
    return (category === "all" || item.category === category) && (!unreadOnly || !item.is_read);
}

export default function NotificationsPage() {
    const router = useRouter();
    const { unreadCount, unseenCount, markAllSeen, unreadByCategory, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, subscribe } =
        useNotifications();

    const [category, setCategory] = useState("all");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadingMore, setLoadingMore] = useState(false);
    // Ignores an answer for a filter that has since changed
    const requestRef = useRef(0);

    const loadFirst = useCallback(() => {
        const req = ++requestRef.current;
        fetchNotifications(category, unreadOnly, PAGE_SIZE, 0)
            .then((res) => {
                if (req !== requestRef.current) return;
                setItems(res.notifications);
                setTotal(res.total);
                setStatus("ready");
            })
            .catch(() => {
                if (req === requestRef.current) setStatus("error");
            });
    }, [category, unreadOnly, fetchNotifications]);

    useEffect(() => {
        loadFirst();
    }, [loadFirst]);

    // Being on this page counts as having seen what arrives, so the bell badge stays clear
    useEffect(() => {
        if (unseenCount > 0) markAllSeen();
    }, [unseenCount, markAllSeen]);

    const pickCategory = (id: string) => {
        if (id === category) return;
        setStatus("loading");
        setItems([]);
        setCategory(id);
    };
    const toggleUnread = () => {
        setStatus("loading");
        setItems([]);
        setUnreadOnly((v) => !v);
    };

    // Live changes from any tab or device
    useEffect(
        () =>
            subscribe((e) => {
                if (e.type === "new") {
                    if (!fits(e.notification, category, unreadOnly)) return;
                    setItems((prev) => {
                        const known = prev.some((n) => n.id === e.notification.id);
                        if (!known) setTotal((t) => t + 1);
                        return [e.notification, ...prev.filter((n) => n.id !== e.notification.id)];
                    });
                } else if (e.type === "read") {
                    setItems((prev) => prev.map((n) => (n.id === e.id ? { ...n, is_read: true } : n)));
                } else if (e.type === "all_read") {
                    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
                } else if (e.type === "deleted") {
                    setItems((prev) => {
                        if (prev.some((n) => n.id === e.id)) setTotal((t) => Math.max(0, t - 1));
                        return prev.filter((n) => n.id !== e.id);
                    });
                }
            }),
        [subscribe, category, unreadOnly],
    );

    const loadMore = async () => {
        const cursor = cursorAfter(items);
        if (loadingMore || !cursor) return;
        setLoadingMore(true);
        const req = requestRef.current;
        try {
            const res = await fetchNotifications(category, unreadOnly, PAGE_SIZE, 0, cursor);
            if (req !== requestRef.current) return;
            // Older items go below; anything already shown stays where it is
            setItems((prev) => [...prev, ...res.notifications.filter((n) => !prev.some((p) => p.id === n.id))]);
            setTotal(res.total);
        } catch {
            // The button stays for another try
        } finally {
            setLoadingMore(false);
        }
    };

    const open = (item: NotificationItem) => {
        if (!item.is_read) void markAsRead(item.id);
        const to = targetOf(item);
        if (to) router.push(to);
    };

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((n) =>
            [n.actor_name, n.title, n.message, n.metadata?.company_name, n.metadata?.company, n.metadata?.job_title]
                .some((v) => String(v ?? "").toLowerCase().includes(q)),
        );
    }, [items, query]);

    const groups = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const out: { label: string; items: NotificationItem[] }[] = [
            { label: "Today", items: [] },
            { label: "Yesterday", items: [] },
            { label: "Earlier", items: [] },
        ];
        for (const n of shown) {
            const t = new Date(n.created_at).getTime();
            out[t >= today ? 0 : t >= yesterday ? 1 : 2].items.push(n);
        }
        return out.filter((g) => g.items.length > 0);
    }, [shown]);

    const countFor = (id: string) => (id === "all" ? unreadCount : unreadByCategory[id] ?? 0);
    const hasMore = items.length < total;
    const currentLabel = CATEGORIES.find((c) => c.id === category)?.label ?? "Notifications";

    const row = (item: NotificationItem) => {
        const { Icon, color } = typeIcon(item);
        const unread = !item.is_read;
        return (
            <li key={item.id} className={`group relative flex items-start gap-3 px-4 sm:px-5 py-3 ${unread ? "bg-km-surface" : ""}`}>
                <button
                    type="button"
                    onClick={() => open(item)}
                    className="flex flex-1 min-w-0 items-start gap-3 text-left cursor-pointer"
                >
                    <span className="shrink-0">
                        {item.actor_avatar ? (
                            <span className="block w-10 h-10 rounded-full overflow-hidden bg-km-surface border border-km-border">
                                <CustomImage src={item.actor_avatar} alt="" className="w-full h-full object-cover" />
                            </span>
                        ) : (
                            <span className="flex w-10 h-10 items-center justify-center rounded-full bg-km-surface border border-km-border">
                                <Icon size={20} className={color} aria-hidden="true" />
                            </span>
                        )}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-km-text-primary line-clamp-3">
                            <span className={`${unread ? "font-semibold text-km-heading" : "font-medium"}`}>{item.actor_name || item.title}</span>{" "}
                            <span className={unread ? "" : "text-km-text-secondary"}>{item.message}</span>
                        </span>
                        <time dateTime={item.created_at} className="mt-0.5 block text-[13px] text-km-text-secondary tabular-nums">
                            {shortTime(item.created_at)}
                        </time>
                    </span>
                    {unread && <span className="mt-2 w-2 h-2 shrink-0 rounded-full bg-km-link" aria-label="Unread" />}
                </button>
                <span className="flex shrink-0 items-center">
                    {unread && (
                        <button
                            type="button"
                            onClick={() => void markAsRead(item.id)}
                            aria-label="Mark as read"
                            title="Mark as read"
                            className="flex w-9 h-9 items-center justify-center rounded-full text-km-text-secondary hover:text-km-heading hover:bg-km-surface-card cursor-pointer"
                        >
                            <CheckIcon size={16} weight="bold" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => void deleteNotification(item.id)}
                        aria-label="Delete notification"
                        title="Delete"
                        className="flex w-9 h-9 items-center justify-center rounded-full text-km-text-secondary hover:text-red-600 hover:bg-km-surface-card cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:text-red-400"
                    >
                        <TrashIcon size={16} />
                    </button>
                </span>
            </li>
        );
    };

    return (
        <div className="min-h-screen bg-km-surface py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                <aside className="lg:col-span-3">
                    <div className="km-card p-3 lg:sticky lg:top-20">
                        <nav aria-label="Notification types" className="flex lg:flex-col gap-1 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {CATEGORIES.map(({ id, label, icon: CatIcon }) => {
                                const active = category === id;
                                const count = countFor(id);
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => pickCategory(id)}
                                        aria-pressed={active}
                                        className={`flex shrink-0 items-center justify-between gap-3 min-h-11 px-3 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap ${
                                            active ? "bg-km-surface text-km-heading font-semibold" : "text-km-text-secondary hover:text-km-heading hover:bg-km-surface"
                                        }`}
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <CatIcon size={18} weight={active ? "fill" : "regular"} aria-hidden="true" />
                                            {label}
                                        </span>
                                        {count > 0 && (
                                            <span className="min-w-5 px-1.5 rounded-full bg-km-link text-white text-xs font-semibold leading-5 text-center tabular-nums">
                                                {count > 99 ? "99+" : count}
                                                <span className="sr-only"> unread</span>
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                        <div className="hidden lg:block mt-2 pt-2 border-t border-km-border">
                            <Link
                                href="/settings?tab=notifications"
                                className="flex items-center gap-2.5 min-h-11 px-3 rounded-xl text-sm font-medium text-km-text-secondary hover:text-km-heading hover:bg-km-surface"
                            >
                                <GearSixIcon size={18} aria-hidden="true" />
                                Notification settings
                            </Link>
                        </div>
                    </div>
                </aside>

                <main className="lg:col-span-6 space-y-4">
                    <PushPrompt />
                    <section className="km-card overflow-hidden" aria-labelledby="notifications-title">
                        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-km-border">
                            <h1 id="notifications-title" className="text-lg font-semibold text-km-heading text-balance">
                                {currentLabel}
                            </h1>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-km-text-secondary cursor-pointer">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={unreadOnly}
                                        onClick={toggleUnread}
                                        className={`relative w-9 h-5 rounded-full cursor-pointer ${unreadOnly ? "bg-km-link" : "bg-km-border"}`}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${unreadOnly ? "translate-x-4" : ""}`}
                                        />
                                    </button>
                                    Unread only
                                </label>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => void markAllAsRead()}
                                        className="inline-flex items-center gap-1.5 min-h-9 text-sm font-semibold text-km-link hover:underline cursor-pointer"
                                    >
                                        <ChecksIcon size={16} aria-hidden="true" />
                                        Mark all as read
                                    </button>
                                )}
                            </div>
                        </header>

                        {items.length > 3 && (
                            <div className="px-4 sm:px-5 py-2 border-b border-km-border">
                                <label className="flex items-center gap-2.5">
                                    <MagnifyingGlassIcon size={16} className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                    <span className="sr-only">Filter notifications</span>
                                    <input
                                        type="search"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Filter by name or keyword"
                                        className="w-full h-9 bg-transparent text-sm text-km-text-primary placeholder:text-km-text-muted outline-none"
                                    />
                                    {query && (
                                        <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" className="p-1.5 rounded-full text-km-text-secondary hover:text-km-heading cursor-pointer">
                                            <XIcon size={14} />
                                        </button>
                                    )}
                                </label>
                            </div>
                        )}

                        {status === "loading" ? (
                            <div className="flex justify-center py-12" role="status" aria-label="Loading notifications">
                                <SpinnerGapIcon size={24} className="animate-spin text-km-text-secondary" />
                            </div>
                        ) : status === "error" ? (
                            <p className="px-5 py-10 text-center text-sm text-km-text-secondary">
                                Notifications couldn’t be loaded.{" "}
                                <button type="button" onClick={() => { setStatus("loading"); loadFirst(); }} className="font-semibold text-km-link hover:underline cursor-pointer">
                                    Try again
                                </button>
                            </p>
                        ) : shown.length === 0 ? (
                            <div className="px-5 py-12 text-center">
                                <BellIcon size={28} className="mx-auto text-km-text-secondary" aria-hidden="true" />
                                <p className="mt-2 text-sm font-semibold text-km-heading">
                                    {query ? "Nothing matches that filter" : unreadOnly ? "No unread notifications" : "No notifications yet"}
                                </p>
                                {(query || unreadOnly) && (
                                    <button
                                        type="button"
                                        onClick={() => (query ? setQuery("") : toggleUnread())}
                                        className="mt-2 text-sm font-semibold text-km-link hover:underline cursor-pointer"
                                    >
                                        {query ? "Clear filter" : "Show all"}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                {groups.map((g) => (
                                    <div key={g.label}>
                                        <h2 className="px-4 sm:px-5 pt-3 pb-1 text-[13px] font-semibold text-km-text-secondary">{g.label}</h2>
                                        <ul className="divide-y divide-km-border">{g.items.map(row)}</ul>
                                    </div>
                                ))}
                                {hasMore && !query && (
                                    <div className="border-t border-km-border">
                                        <button
                                            type="button"
                                            onClick={() => void loadMore()}
                                            disabled={loadingMore}
                                            className="w-full min-h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-km-link hover:bg-km-surface cursor-pointer disabled:opacity-60"
                                        >
                                            {loadingMore && <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />}
                                            Show older notifications
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </main>

                <div className="lg:col-span-3">
                    <div className="sticky top-20">
                        <AdSlot placement="notifications_sidebar" />
                    </div>
                </div>
            </div>
        </div>
    );
}
