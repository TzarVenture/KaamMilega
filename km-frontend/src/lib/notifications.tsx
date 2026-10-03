"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Bell,
    MessageSquare,
    Briefcase,
    Users,
    Calendar,
    X,
    ArrowUpRight,
} from "lucide-react";
import CustomImage from "@/components/ui/CustomImage";
import api from "./axios";
import { isAuthenticated } from "./auth";

export interface NotificationItem {
    id: string;
    user_id: string;
    actor_id?: string;
    actor_name?: string;
    actor_avatar?: string;
    type: string;
    category: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
    is_read: boolean;
    created_at: string;
    updated_at: string;
}

export interface ToastAlertItem {
    id: string;
    notification: NotificationItem;
    createdAt: number;
}

/**
 * Route Link Sanitizer:
 * Guarantees legacy or inconsistent notification links never result in 404s.
 */
export const sanitizeNotificationLink = (rawLink?: string): string => {
    if (!rawLink) return "/notifications";
    let link = rawLink.trim();

    // Map candidate application links to canonical /applications route
    if (link.startsWith("/candidate/applications") || link.startsWith("/candidate/application")) {
        link = link.replace(/^\/candidate\/applications?/, "/applications");
    }
    // Map candidate interview links to canonical /interviews route
    if (link.startsWith("/candidate/interviews") || link.startsWith("/candidate/interview")) {
        link = link.replace(/^\/candidate\/interviews?/, "/interviews");
    }
    // Map candidate profile links to canonical /profile route
    if (link.startsWith("/candidate/profile")) {
        link = link.replace(/^\/candidate\/profile/, "/profile");
    }

    return link;
};

/**
 * Synthesizes a pleasant, subtle two-tone audio chime via HTML5 Web Audio API.
 * 100% self-contained, offline-compatible, and zero external asset dependencies.
 */
const playNotificationChime = () => {
    try {
        if (typeof window === "undefined") return;
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Harmonic notes (E5 659.25Hz -> G#5 830.61Hz)
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, now);
        osc1.frequency.exponentialRampToValueAtTime(830.61, now + 0.12);

        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(1318.5, now);
        osc2.frequency.exponentialRampToValueAtTime(1661.22, now + 0.12);

        // Soft, professional gain envelope
        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.linearRampToValueAtTime(0.12, now + 0.025);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.38);
        osc2.stop(now + 0.38);

        setTimeout(() => {
            ctx.close().catch(() => {});
        }, 450);
    } catch {
        // Silently catch audio policy blocks when user hasn't interacted with document yet
    }
};

interface NotificationContextType {
    unreadCount: number;
    notifications: NotificationItem[];
    recentNotifications: NotificationItem[];
    loading: boolean;
    connected: boolean;
    fetchNotifications: (category?: string, unreadOnly?: boolean, limit?: number, offset?: number) => Promise<{ notifications: NotificationItem[]; total: number }>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [connected, setConnected] = useState<boolean>(false);
    const [toasts, setToasts] = useState<ToastAlertItem[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-dismiss foreground toast alerts after 5 seconds
    useEffect(() => {
        if (toasts.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setToasts((prev) => prev.filter((t) => now - t.createdAt < 5000));
        }, 500);

        return () => clearInterval(interval);
    }, [toasts.length]);

    // Refresh unread count via REST
    const refreshUnreadCount = useCallback(async () => {
        if (!isAuthenticated()) return;
        try {
            const data: any = await api.get("/notifications/unread-count");
            if (typeof data?.unread_count === "number") {
                setUnreadCount(data.unread_count);
            }
        } catch {
            // Silently ignore if unauthenticated or network error
        }
    }, []);

    // Fetch notifications list
    const fetchNotifications = useCallback(
        async (category = "all", unreadOnly = false, limit = 20, offset = 0) => {
            if (!isAuthenticated()) return { notifications: [], total: 0 };
            setLoading(true);
            try {
                const params: Record<string, any> = { category, limit, offset };
                if (unreadOnly) params.unread_only = true;

                const data: any = await api.get("/notifications", { params });
                const items: NotificationItem[] = data?.notifications || [];
                setNotifications(items);

                // Update recent notifications cache if fetching main/all feed
                if (category === "all" && offset === 0) {
                    setRecentNotifications(items.slice(0, 6));
                }

                return { notifications: items, total: data?.total || items.length };
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
                return { notifications: [], total: 0 };
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        try {
            // Optimistic update
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setRecentNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));

            await api.put(`/notifications/${id}/read`);
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
            refreshUnreadCount();
        }
    }, [refreshUnreadCount]);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        try {
            // Optimistic update
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);

            await api.put("/notifications/read-all");
        } catch (err) {
            console.error("Failed to mark all as read:", err);
            refreshUnreadCount();
        }
    }, [refreshUnreadCount]);

    // Delete notification
    const deleteNotification = useCallback(
        async (id: string) => {
            try {
                const target = notifications.find((n) => n.id === id);
                setNotifications((prev) => prev.filter((n) => n.id !== id));
                setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
                if (target && !target.is_read) {
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                }

                await api.delete(`/notifications/${id}`);
            } catch (err) {
                console.error("Failed to delete notification:", err);
                refreshUnreadCount();
            }
        },
        [notifications, refreshUnreadCount]
    );

    // Dismiss a single foreground toast
    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    // Handle clicking a toast alert: mark as read, dismiss, and safely route
    const handleToastClick = (toast: ToastAlertItem) => {
        dismissToast(toast.id);
        if (!toast.notification.is_read) {
            markAsRead(toast.notification.id);
        }
        const safeLink = sanitizeNotificationLink(toast.notification.link);
        router.push(safeLink);
    };

    // Establish persistent WebSocket connection for real-time alerts
    useEffect(() => {
        if (typeof window === "undefined") return;

        let isMounted = true;

        const connectWebSocket = () => {
            if (!isAuthenticated()) return;

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const wsBase = apiUrl.replace(/^http/, "ws");
            const token = localStorage.getItem("token") || "";
            const wsEndpoint = `${wsBase}/api/ws/notifications${token ? `?token=${encodeURIComponent(token)}` : ""}`;

            try {
                const ws = new WebSocket(wsEndpoint);
                wsRef.current = ws;

                ws.onopen = () => {
                    if (isMounted) setConnected(true);
                };

                ws.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (!payload || !payload.type) return;

                        if (payload.type === "INIT" && typeof payload.unread_count === "number") {
                            setUnreadCount(payload.unread_count);
                        } else if (payload.type === "NEW_NOTIFICATION" && payload.notification) {
                            const newNotif: NotificationItem = payload.notification;

                            // Active Chat Screen Suppression:
                            // If recipient is currently active on /chat with this sender, auto-mark as read without alerting badge or toast
                            const isCurrentlyChatting =
                                typeof window !== "undefined" &&
                                window.location.pathname.startsWith("/chat") &&
                                newNotif.type === "chat_message" &&
                                Boolean(newNotif.metadata?.sender_id && window.location.search.includes(String(newNotif.metadata.sender_id)));

                            if (isCurrentlyChatting) {
                                newNotif.is_read = true;
                                api.put(`/notifications/${newNotif.id}/read`).catch(() => {});
                            }

                            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
                            setRecentNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)].slice(0, 6));

                            if (!isCurrentlyChatting) {
                                if (typeof payload.unread_count === "number") {
                                    setUnreadCount(payload.unread_count);
                                } else {
                                    setUnreadCount((prev) => prev + 1);
                                }

                                // 1. Audio chime on real-time notification
                                playNotificationChime();

                                // 2. Floating toast alert in foreground
                                setToasts((prev) => [
                                    ...prev.slice(-3), // keep maximum 4 active toasts simultaneously
                                    {
                                        id: newNotif.id || String(Date.now()),
                                        notification: newNotif,
                                        createdAt: Date.now(),
                                    },
                                ]);
                            }
                        } else if (payload.type === "NOTIFICATION_READ") {
                            if (payload.notification_id) {
                                setNotifications((prev) =>
                                    prev.map((n) => (n.id === payload.notification_id ? { ...n, is_read: true } : n))
                                );
                                setRecentNotifications((prev) =>
                                    prev.map((n) => (n.id === payload.notification_id ? { ...n, is_read: true } : n))
                                );
                                setToasts((prev) => prev.filter((t) => t.notification.id !== payload.notification_id));
                            }
                            if (typeof payload.unread_count === "number") {
                                setUnreadCount(payload.unread_count);
                            }
                        } else if (payload.type === "ALL_READ") {
                            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                            setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                            setUnreadCount(0);
                            setToasts([]);
                        } else if (payload.type === "NOTIFICATION_DELETED") {
                            if (payload.notification_id) {
                                setNotifications((prev) => prev.filter((n) => n.id !== payload.notification_id));
                                setRecentNotifications((prev) => prev.filter((n) => n.id !== payload.notification_id));
                                setToasts((prev) => prev.filter((t) => t.notification.id !== payload.notification_id));
                            }
                            if (typeof payload.unread_count === "number") {
                                setUnreadCount(payload.unread_count);
                            }
                        }
                    } catch (e) {
                        console.error("[NotificationWS] Error parsing payload:", e);
                    }
                };

                ws.onclose = () => {
                    if (isMounted) {
                        setConnected(false);
                        // Reconnect after 3 seconds if still mounted and authenticated
                        reconnectTimeoutRef.current = setTimeout(() => {
                            if (isMounted && isAuthenticated()) {
                                connectWebSocket();
                            }
                        }, 3000);
                    }
                };

                ws.onerror = () => {
                    ws.close();
                };
            } catch (err) {
                console.error("[NotificationWS] Connection error:", err);
            }
        };

        // Initial fetch & connect
        refreshUnreadCount();
        connectWebSocket();

        // Fallback polling every 45s
        const pollInterval = setInterval(() => {
            if (isAuthenticated()) {
                refreshUnreadCount();
            }
        }, 45000);

        return () => {
            isMounted = false;
            clearInterval(pollInterval);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [refreshUnreadCount]);

    return (
        <NotificationContext.Provider
            value={{
                unreadCount,
                notifications,
                recentNotifications,
                loading,
                connected,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                refreshUnreadCount,
            }}
        >
            {children}

            {/* Floating Real-Time Toast Alerts Container */}
            {toasts.length > 0 && (
                <div
                    aria-live="polite"
                    className="fixed top-20 right-4 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
                >
                    {toasts.map((toast) => {
                        const notif = toast.notification;
                        const isMessage = notif.category === "messages";
                        const isJob = notif.category === "jobs";
                        const isNetwork = notif.category === "network";
                        const isInterview = notif.type === "interview_scheduled";

                        return (
                            <div
                                key={toast.id}
                                onClick={() => handleToastClick(toast)}
                                className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl shadow-slate-200/50 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:scale-[1.01] hover:border-blue-400 group animate-in slide-in-from-top-4 fade-in duration-200 relative overflow-hidden"
                            >
                                {/* Micro Accent Bar */}
                                <div
                                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                                        isInterview
                                            ? "bg-indigo-600"
                                            : isMessage
                                            ? "bg-blue-600"
                                            : isJob
                                            ? "bg-amber-600"
                                            : isNetwork
                                            ? "bg-emerald-600"
                                            : "bg-km-primary"
                                    }`}
                                />

                                {/* Avatar or Category Icon */}
                                <div className="shrink-0 mt-0.5 ml-1">
                                    {notif.actor_avatar ? (
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                                            <CustomImage
                                                src={notif.actor_avatar}
                                                alt={notif.actor_name || "User"}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : isInterview ? (
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                                            <Calendar size={15} className="fill-indigo-700" />
                                        </div>
                                    ) : isMessage ? (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                                            <MessageSquare size={15} className="fill-blue-700" />
                                        </div>
                                    ) : isJob ? (
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                                            <Briefcase size={15} className="fill-amber-700" />
                                        </div>
                                    ) : isNetwork ? (
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                                            <Users size={15} className="fill-emerald-700" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                                            <Bell size={15} className="fill-slate-700" />
                                        </div>
                                    )}
                                </div>

                                {/* Content Details */}
                                <div className="flex-1 min-w-0 pr-1">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-xs font-bold text-slate-900 truncate">
                                            {notif.actor_name || notif.title || "KaamMilega Notification"}
                                        </p>
                                        <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-full shrink-0">
                                            New
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                                        {notif.message}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-km-primary group-hover:underline flex items-center gap-0.5">
                                            {isMessage ? "Reply" : "View details"}
                                            <ArrowUpRight size={11} />
                                        </span>
                                    </div>
                                </div>

                                {/* Dismiss Button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dismissToast(toast.id);
                                    }}
                                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                                    aria-label="Dismiss alert"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </NotificationContext.Provider>
    );
};

export const useNotifications = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};
