"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SealCheckIcon, BellIcon, BriefcaseIcon, CalendarBlankIcon, ChatIcon, UsersIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import CustomImage from "@/components/ui/CustomImage";
import api from "./axios";
import { isAuthenticated } from "./auth";
import { playNotificationSound } from "@/lib/sound";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    is_read: boolean;
    is_seen?: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Route Link Sanitizer:
 * Guarantees legacy or inconsistent notification links never result in 404s.
 */
export const sanitizeNotificationLink = (rawLink?: string, notifItem?: Partial<NotificationItem>): string => {
    if (notifItem && notifItem.type === "connection_accepted") {
        const targetId = notifItem.actor_id || notifItem.metadata?.accepted_by;
        if (targetId) return `/profile/${targetId}`;
    }

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

/** Where to continue a list from: the last notification shown */
export interface NotificationCursor {
    before: string;
    before_id: string;
}

export const cursorAfter = (items: NotificationItem[]): NotificationCursor | undefined => {
    const last = items[items.length - 1];
    return last ? { before: last.created_at, before_id: last.id } : undefined;
};

/** What happened to notifications, so a page that keeps its own list can follow along */
export type NotificationEvent =
    | { type: "new"; notification: NotificationItem }
    | { type: "read"; id: string }
    | { type: "all_read" }
    | { type: "deleted"; id: string };

/** How many recent notifications the bell keeps */
const RECENT_LIMIT = 8;

interface NotificationContextType {
    unreadCount: number;
    /** The bell badge: unread notifications that arrived since the bell was last opened */
    unseenCount: number;
    /** Clears the badge (call when the bell or the page opens); items stay unread */
    markAllSeen: () => void;
    /** Unread per category (messages, jobs, network, system) */
    unreadByCategory: Record<string, number>;
    chatUnreadCount: number;
    /** The newest notifications (fetched for the bell, plus live arrivals), newest first */
    notifications: NotificationItem[];
    recentNotifications: NotificationItem[];
    loading: boolean;
    connected: boolean;
    /**
     * One page of notifications. It doesn't touch the shared lists except that a first page of
     * "all" refreshes the bell's recent list. Pass a cursor for the next page.
     */
    fetchNotifications: (
        category?: string,
        unreadOnly?: boolean,
        limit?: number,
        offset?: number,
        cursor?: NotificationCursor,
    ) => Promise<{ notifications: NotificationItem[]; total: number }>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    refreshUnreadCount: () => Promise<void>;
    refreshChatUnreadCount: () => Promise<void>;
    /** Follow new, read and deleted notifications; returns the unsubscribe */
    subscribe: (listener: (e: NotificationEvent) => void) => () => void;
}

export const setActiveChatState = (convId: string | null, partnerId: string | null) => {
    if (typeof window !== "undefined") {
        const w = window as unknown as Record<string, unknown>;
        w.__km_active_chat_conv_id = convId;
        w.__km_active_chat_sender_id = partnerId;
    }
};

export const notifyChatUnreadChanged = (total?: number) => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("km:chat-unread-updated", { detail: { count: total } }));
    }
};

/** The chat the member has open in this tab, if any */
const isOpenChat = (n: NotificationItem): boolean => {
    if (typeof window === "undefined" || !window.location.pathname.startsWith("/chat")) return false;
    const w = window as unknown as Record<string, unknown>;
    const convId = w.__km_active_chat_conv_id;
    const partnerId = w.__km_active_chat_sender_id;
    const meta = n.metadata ?? {};
    return Boolean(
        (convId && meta.conversation_id && String(meta.conversation_id) === String(convId)) ||
            (partnerId && meta.sender_id && String(meta.sender_id) === String(partnerId)),
    );
};

const withRead = (list: NotificationItem[], id: string) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n));
const without = (list: NotificationItem[], id: string) => list.filter((n) => n.id !== id);
const prepend = (list: NotificationItem[], n: NotificationItem, cap?: number) => {
    const next = [n, ...without(list, n.id)];
    return cap ? next.slice(0, cap) : next;
};

// Reconnect waits: 1s, 2s, 4s… up to 30s, with some randomness so many tabs don't retry together
const backoff = (attempt: number) => Math.min(30000, 1000 * 2 ** attempt) * (0.75 + Math.random() * 0.5);

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [unseenCount, setUnseenCount] = useState<number>(0);
    const unseenRef = useRef(0);
    useEffect(() => {
        unseenRef.current = unseenCount;
    }, [unseenCount]);
    const [unreadByCategory, setUnreadByCategory] = useState<Record<string, number>>({});
    const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);
    const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [connected, setConnected] = useState<boolean>(false);
    // Live notification alerts currently on screen (shown through the app toaster)
    const alertIdsRef = useRef<Set<string>>(new Set());
    const listenersRef = useRef<Set<(e: NotificationEvent) => void>>(new Set());
    const recentRef = useRef<NotificationItem[]>([]);
    useEffect(() => {
        recentRef.current = recentNotifications;
    }, [recentNotifications]);

    const emit = useCallback((e: NotificationEvent) => {
        listenersRef.current.forEach((l) => l(e));
    }, []);

    const subscribe = useCallback((listener: (e: NotificationEvent) => void) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    }, []);

    // Unread counts from the server (overall and per category)
    const refreshUnreadCount = useCallback(async () => {
        if (!isAuthenticated()) return;
        try {
            const data = (await api.get("/notifications/unread-count")) as { unread_count?: number; unseen_count?: number; by_category?: Record<string, number> } | null;
            if (typeof data?.unread_count === "number") setUnreadCount(data.unread_count);
            if (typeof data?.unseen_count === "number") setUnseenCount(data.unseen_count);
            if (data?.by_category) setUnreadByCategory(data.by_category);
        } catch {
            // Signed out or offline: the next poll or reconnect tries again
        }
    }, []);

    // Total unread chat messages, for the navbar badge
    const refreshChatUnreadCount = useCallback(async () => {
        if (!isAuthenticated()) return;
        try {
            const data = (await api.get("/chats/unread-count")) as { unread_count?: number } | null;
            if (typeof data?.unread_count === "number") setChatUnreadCount(data.unread_count);
        } catch {
            // As above
        }
    }, []);

    // The chat screen reports its unread total after reading a conversation
    useEffect(() => {
        void refreshChatUnreadCount();
        const handleChatUnreadSync = (e: Event) => {
            const customEvent = e as CustomEvent<{ count?: number }>;
            if (typeof customEvent.detail?.count === "number") {
                setChatUnreadCount(customEvent.detail.count);
            } else {
                void refreshChatUnreadCount();
            }
        };
        window.addEventListener("km:chat-unread-updated", handleChatUnreadSync);
        return () => {
            window.removeEventListener("km:chat-unread-updated", handleChatUnreadSync);
        };
    }, [refreshChatUnreadCount]);

    const fetchNotifications = useCallback(
        async (category = "all", unreadOnly = false, limit = 20, offset = 0, cursor?: NotificationCursor) => {
            if (!isAuthenticated()) return { notifications: [], total: 0 };
            const firstPage = !cursor && offset === 0;
            if (firstPage) setLoading(true);
            try {
                const params: Record<string, string | number | boolean> = { category, limit };
                if (cursor) {
                    params.before = cursor.before;
                    params.before_id = cursor.before_id;
                } else {
                    params.offset = offset;
                }
                if (unreadOnly) params.unread_only = true;

                const data = (await api.get("/notifications", { params })) as { notifications?: NotificationItem[]; total?: number } | null;
                const items: NotificationItem[] = data?.notifications || [];

                if (category === "all" && !unreadOnly && firstPage) {
                    setRecentNotifications(items.slice(0, RECENT_LIMIT));
                }
                return { notifications: items, total: data?.total ?? items.length };
            } finally {
                if (firstPage) setLoading(false);
            }
        },
        [],
    );

    const dismissAlert = (id: string) => {
        notify.dismiss(`alert:${id}`);
        alertIdsRef.current.delete(id);
    };

    const markAsRead = useCallback(async (id: string) => {
        if (!id) return;
        const target = recentRef.current.find((n) => n.id === id);
        // On screen at once; the server's answer (and the socket) settle the counts
        setRecentNotifications((prev) => withRead(prev, id));
        if (!target || !target.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
            if (target?.category) {
                setUnreadByCategory((prev) => ({ ...prev, [target.category]: Math.max(0, (prev[target.category] ?? 0) - 1) }));
            }
        }
        emit({ type: "read", id });
        try {
            await api.put(`/notifications/${id}/read`);
        } catch {
            void refreshUnreadCount();
        }
    }, [emit, refreshUnreadCount]);

    const markAllSeen = useCallback(() => {
        if (unseenRef.current === 0) return;
        setUnseenCount(0);
        api.post("/notifications/seen").catch(() => {});
    }, []);

    const markAllAsRead = useCallback(async () => {
        setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        setUnseenCount(0);
        setUnreadByCategory({});
        emit({ type: "all_read" });
        try {
            await api.put("/notifications/read-all");
        } catch (err) {
            notify.error(err, "Could not mark all notifications as read.");
            void refreshUnreadCount();
        }
    }, [emit, refreshUnreadCount]);

    const deleteNotification = useCallback(async (id: string) => {
        setRecentNotifications((prev) => without(prev, id));
        emit({ type: "deleted", id });
        try {
            await api.delete(`/notifications/${id}`);
        } catch (err) {
            notify.error(err, "Could not delete this notification.");
        } finally {
            // Whether it was unread is the server's call
            void refreshUnreadCount();
        }
    }, [emit, refreshUnreadCount]);

    // Open a live alert: mark read and route to its (sanitised) link. Kept in a ref so the
    // WebSocket handler, created once, always calls the latest version.
    const openAlertRef = useRef<(n: NotificationItem) => void>(() => {});
    useEffect(() => {
        openAlertRef.current = (n: NotificationItem) => {
            alertIdsRef.current.delete(n.id);
            if (!n.is_read) void markAsRead(n.id);
            router.push(sanitizeNotificationLink(n.link, n));
        };
    }, [markAsRead, router]);

    const showAlert = (n: NotificationItem) => {
        const isMessage = n.category === "messages";
        const icon = n.actor_avatar ? (
            <CustomImage src={n.actor_avatar} alt="" className="w-full h-full object-cover rounded-full" />
        ) : n.type === "expert_application" ? (
            <SealCheckIcon size={22} />
        ) : n.type === "interview_scheduled" ? (
            <CalendarBlankIcon size={22} />
        ) : isMessage ? (
            <ChatIcon size={22} />
        ) : n.category === "jobs" ? (
            <BriefcaseIcon size={22} />
        ) : n.category === "network" ? (
            <UsersIcon size={22} />
        ) : (
            <BellIcon size={22} />
        );
        const id = n.id || String(Date.now());
        alertIdsRef.current.add(id);
        notify.alert({
            id,
            title: n.actor_name || n.title || "KaamMilega",
            description: n.message,
            icon,
            actionLabel: isMessage ? "Reply" : "View",
            onAction: () => openAlertRef.current(n),
        });
    };
    const showAlertRef = useRef(showAlert);
    useEffect(() => {
        showAlertRef.current = showAlert;
    });

    // One live connection for the whole site
    useEffect(() => {
        if (typeof window === "undefined") return;

        let stopped = false;
        let ws: WebSocket | null = null;
        let attempt = 0;
        let everConnected = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const catchUp = () => {
            void refreshUnreadCount();
            void refreshChatUnreadCount();
            fetchNotifications("all", false, RECENT_LIMIT, 0).catch(() => {});
        };

        const handle = (payload: { type?: string; [k: string]: unknown }) => {
            const unread = typeof payload.unread_count === "number" ? payload.unread_count : null;
            // Every event carries the badge count
            if (typeof payload.unseen_count === "number") setUnseenCount(payload.unseen_count);
            switch (payload.type) {
                case "ALL_SEEN":
                    setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_seen: true })));
                    return;
                case "INIT":
                    if (unread !== null) setUnreadCount(unread);
                    return;
                case "NEW_NOTIFICATION": {
                    const n = payload.notification as NotificationItem | undefined;
                    if (!n) return;
                    const isChat = n.type === "chat_message";
                    // The open chat already shows the message (the server normally skips these)
                    if (isChat && isOpenChat(n)) {
                        api.put(`/notifications/${n.id}/read`).catch(() => {});
                        return;
                    }
                    if (isChat) setChatUnreadCount((prev) => prev + 1);
                    // A chat notification that was updated (another message) moves back to the top
                    const wasThere = recentRef.current.some((x) => x.id === n.id && !x.is_read);
                    setRecentNotifications((prev) => prepend(prev, n, RECENT_LIMIT));
                    if (unread !== null) setUnreadCount(unread);
                    else if (!wasThere) setUnreadCount((prev) => prev + 1);
                    if (!wasThere && n.category) {
                        setUnreadByCategory((prev) => ({ ...prev, [n.category]: (prev[n.category] ?? 0) + 1 }));
                    }
                    emit({ type: "new", notification: n });

                    // Sound and a toast only for someone looking at this tab; otherwise the
                    // device's push notification does the job. The chat screen has its own.
                    if (document.hidden || (isChat && window.location.pathname.startsWith("/chat"))) return;
                    playNotificationSound();
                    showAlertRef.current(n);
                    return;
                }
                case "NOTIFICATION_READ": {
                    const id = payload.notification_id as string | undefined;
                    if (id) {
                        const target = recentRef.current.find((x) => x.id === id);
                        setRecentNotifications((prev) => withRead(prev, id));
                        if (target && !target.is_read && target.category) {
                            setUnreadByCategory((prev) => ({ ...prev, [target.category]: Math.max(0, (prev[target.category] ?? 0) - 1) }));
                        }
                        dismissAlert(id);
                        emit({ type: "read", id });
                    }
                    if (unread !== null) setUnreadCount(unread);
                    return;
                }
                case "ALL_READ":
                    setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                    setUnreadCount(0);
                    setUnreadByCategory({});
                    alertIdsRef.current.forEach((alertId) => notify.dismiss(`alert:${alertId}`));
                    alertIdsRef.current.clear();
                    emit({ type: "all_read" });
                    return;
                case "NOTIFICATION_DELETED": {
                    const id = payload.notification_id as string | undefined;
                    if (id) {
                        setRecentNotifications((prev) => without(prev, id));
                        dismissAlert(id);
                        emit({ type: "deleted", id });
                    }
                    if (unread !== null) setUnreadCount(unread);
                    // The category counts follow from the server
                    void refreshUnreadCount();
                    return;
                }
            }
        };

        const connect = () => {
            if (stopped || !isAuthenticated()) return;
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = localStorage.getItem("token") || "";
            const url = `${apiUrl.replace(/^http/, "ws")}/api/ws/notifications${token ? `?token=${encodeURIComponent(token)}` : ""}`;

            let socket: WebSocket;
            try {
                socket = new WebSocket(url);
            } catch {
                scheduleRetry();
                return;
            }
            ws = socket;
            socket.onopen = () => {
                attempt = 0;
                setConnected(true);
                // Anything that happened while we were away
                if (everConnected) catchUp();
                everConnected = true;
            };
            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload && payload.type) handle(payload);
                } catch {
                    // Not one of ours
                }
            };
            socket.onclose = () => {
                if (ws === socket) ws = null;
                setConnected(false);
                scheduleRetry();
            };
            socket.onerror = () => socket.close();
        };

        const scheduleRetry = () => {
            if (stopped || retryTimer) return;
            retryTimer = setTimeout(() => {
                retryTimer = null;
                connect();
            }, backoff(attempt++));
        };

        // Back online or back on the tab: reconnect now instead of waiting out the backoff
        const reconnectNow = () => {
            if (document.hidden) return;
            attempt = 0;
            connect();
        };

        catchUp();
        connect();
        window.addEventListener("online", reconnectNow);
        document.addEventListener("visibilitychange", reconnectNow);

        // Safety net for anything a dropped connection missed
        const poll = setInterval(() => {
            if (isAuthenticated() && !document.hidden) {
                void refreshUnreadCount();
                void refreshChatUnreadCount();
            }
        }, 60000);

        return () => {
            stopped = true;
            clearInterval(poll);
            if (retryTimer) clearTimeout(retryTimer);
            window.removeEventListener("online", reconnectNow);
            document.removeEventListener("visibilitychange", reconnectNow);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [refreshUnreadCount, refreshChatUnreadCount, fetchNotifications, emit]);

    return (
        <NotificationContext.Provider
            value={{
                unreadCount,
                unseenCount,
                markAllSeen,
                unreadByCategory,
                chatUnreadCount,
                notifications: recentNotifications,
                recentNotifications,
                loading,
                connected,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                refreshUnreadCount,
                refreshChatUnreadCount,
                subscribe,
            }}
        >
            {children}
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
