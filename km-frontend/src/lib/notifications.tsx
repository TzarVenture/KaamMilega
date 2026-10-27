"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, BriefcaseIcon, CalendarBlankIcon, ChatIcon, UsersIcon } from '@phosphor-icons/react';
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
    metadata?: Record<string, any>;
    is_read: boolean;
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



interface NotificationContextType {
    unreadCount: number;
    chatUnreadCount: number;
    notifications: NotificationItem[];
    recentNotifications: NotificationItem[];
    loading: boolean;
    connected: boolean;
    fetchNotifications: (category?: string, unreadOnly?: boolean, limit?: number, offset?: number) => Promise<{ notifications: NotificationItem[]; total: number }>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    refreshUnreadCount: () => Promise<void>;
    refreshChatUnreadCount: () => Promise<void>;
}

export const setActiveChatState = (convId: string | null, partnerId: string | null) => {
    if (typeof window !== "undefined") {
        (window as any).__km_active_chat_conv_id = convId;
        (window as any).__km_active_chat_sender_id = partnerId;
    }
};

export const notifyChatUnreadChanged = (total?: number) => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("km:chat-unread-updated", { detail: { count: total } }));
    }
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [connected, setConnected] = useState<boolean>(false);
    // Live notification alerts currently on screen (shown through the app toaster)
    const alertIdsRef = useRef<Set<string>>(new Set());

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Refresh total unread chat messages for Navbar badge
    const refreshChatUnreadCount = useCallback(async () => {
        if (!isAuthenticated()) return;
        try {
            const data: any = await api.get("/chats/unread-count");
            if (typeof data?.unread_count === "number") {
                setChatUnreadCount(data.unread_count);
            }
        } catch {
            // Silently ignore if unauthenticated or network error
        }
    }, []);

    // Listen for custom chat-unread sync events across tabs / components
    useEffect(() => {
        refreshChatUnreadCount();
        const handleChatUnreadSync = (e: Event) => {
            const customEvent = e as CustomEvent<{ count?: number }>;
            if (typeof customEvent.detail?.count === "number") {
                setChatUnreadCount(customEvent.detail.count);
            } else {
                refreshChatUnreadCount();
            }
        };
        window.addEventListener("km:chat-unread-updated", handleChatUnreadSync);
        return () => {
            window.removeEventListener("km:chat-unread-updated", handleChatUnreadSync);
        };
    }, [refreshChatUnreadCount]);


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
                    setRecentNotifications(items.slice(0, 8));
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
        if (!id || typeof id !== "string") return;
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
            notify.error(err, "Could not mark all notifications as read.");
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
                notify.error(err, "Could not delete this notification.");
                refreshUnreadCount();
            }
        },
        [notifications, refreshUnreadCount]
    );

    const dismissAlert = (id: string) => {
        notify.dismiss(`alert:${id}`);
        alertIdsRef.current.delete(id);
    };

    // Open a live alert: mark read and route to its (sanitised) link. Kept in a ref so the
    // WebSocket handler, created once, always calls the latest version.
    const openAlertRef = useRef<(n: NotificationItem) => void>(() => {});
    openAlertRef.current = (n: NotificationItem) => {
        alertIdsRef.current.delete(n.id);
        if (!n.is_read) markAsRead(n.id);
        router.push(sanitizeNotificationLink(n.link));
    };

    const showAlert = (n: NotificationItem) => {
        const isMessage = n.category === "messages";
        const icon = n.actor_avatar ? (
            <CustomImage src={n.actor_avatar} alt="" className="w-full h-full object-cover rounded-full" />
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
                            const isChatRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/chat");
                            const activeChatConvId = typeof window !== "undefined" ? (window as any).__km_active_chat_conv_id : null;
                            const activeChatSenderId = typeof window !== "undefined" ? (window as any).__km_active_chat_sender_id : null;

                            const isWithActivePartner = Boolean(
                                (activeChatConvId && newNotif.metadata?.conversation_id && String(newNotif.metadata.conversation_id) === String(activeChatConvId)) ||
                                (activeChatSenderId && newNotif.metadata?.sender_id && String(newNotif.metadata.sender_id) === String(activeChatSenderId)) ||
                                (newNotif.metadata?.sender_id && typeof window !== "undefined" && window.location.search.includes(String(newNotif.metadata.sender_id)))
                            );

                            const isCurrentlyChatting = isChatRoute && newNotif.type === "chat_message" && isWithActivePartner;

                            if (isCurrentlyChatting) {
                                // Active chat thread: auto-mark read silently on backend.
                                // Do NOT play sound chime, do NOT show toast, do NOT increment bell count,
                                // and do NOT clutter notifications list or bell dropdown.
                                api.put(`/notifications/${newNotif.id}/read`).catch(() => {});
                                return;
                            }

                            // If this is a chat message from another conversation:
                            if (newNotif.type === "chat_message") {
                                setChatUnreadCount((prev) => prev + 1);
                                // If user is already on /chat screen, the in-app chat UI handles the sidebar indicator.
                                // Suppress the floating toast alert to prevent obstructing the screen.
                                if (isChatRoute) {
                                    return;
                                }
                            }

                            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
                            setRecentNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)].slice(0, 6));

                            if (typeof payload.unread_count === "number") {
                                setUnreadCount(payload.unread_count);
                            } else {
                                setUnreadCount((prev) => prev + 1);
                            }

                            // 1. Audio chime on real-time notification (powered by uisfx)
                            playNotificationSound();

                            // 2. Alert through the app toaster (stacks with every other toast)
                            showAlert(newNotif);
                        }
 else if (payload.type === "NOTIFICATION_READ") {
                            if (payload.notification_id) {
                                setNotifications((prev) =>
                                    prev.map((n) => (n.id === payload.notification_id ? { ...n, is_read: true } : n))
                                );
                                setRecentNotifications((prev) =>
                                    prev.map((n) => (n.id === payload.notification_id ? { ...n, is_read: true } : n))
                                );
                                dismissAlert(payload.notification_id);
                            }
                            if (typeof payload.unread_count === "number") {
                                setUnreadCount(payload.unread_count);
                            }
                        } else if (payload.type === "ALL_READ") {
                            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                            setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                            setUnreadCount(0);
                            alertIdsRef.current.forEach((alertId) => notify.dismiss(`alert:${alertId}`));
                            alertIdsRef.current.clear();
                        } else if (payload.type === "NOTIFICATION_DELETED") {
                            if (payload.notification_id) {
                                setNotifications((prev) => prev.filter((n) => n.id !== payload.notification_id));
                                setRecentNotifications((prev) => prev.filter((n) => n.id !== payload.notification_id));
                                dismissAlert(payload.notification_id);
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
        fetchNotifications("all", false, 8, 0).catch(() => {});
        connectWebSocket();

        // Fallback polling every 45s
        const pollInterval = setInterval(() => {
            if (isAuthenticated()) {
                refreshUnreadCount();
                refreshChatUnreadCount();
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
    }, [refreshUnreadCount, refreshChatUnreadCount]);

    return (
        <NotificationContext.Provider
            value={{
                unreadCount,
                chatUnreadCount,
                notifications,
                recentNotifications,
                loading,
                connected,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                refreshUnreadCount,
                refreshChatUnreadCount,
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
