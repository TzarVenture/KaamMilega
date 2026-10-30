"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowBendUpLeftIcon, ArrowsClockwiseIcon, CaretDownIcon, CaretLeftIcon, ChatIcon, CheckCircleIcon, CheckIcon, ChecksIcon, CircleNotchIcon, ClockIcon, CopyIcon, DotsThreeVerticalIcon, FileTextIcon, FlagIcon, MagnifyingGlassIcon, PaperPlaneRightIcon, PaperclipIcon, ProhibitIcon, SmileyIcon, TrashIcon, UserIcon, XIcon } from '@phosphor-icons/react';
import dynamic from "next/dynamic";
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { uploadFile, UPLOAD_LIMITS } from "@/lib/upload";
import { compressImage } from "@/lib/compressImage";
import MessageAttachments from "@/components/chat/MessageAttachments";
import MediaViewer from "@/components/chat/MediaViewer";
import ReplyQuote from "@/components/chat/ReplyQuote";
import {
  ChatAttachment,
  ReplyPreview,
  attachmentsOf,
  formatFileSize,
  isImageAttachment,
  replyPreviewOf,
} from "@/components/chat/chatTypes";
import { playMessageReceivedSound } from "@/lib/sound";
import {
  setActiveChatState,
  notifyChatUnreadChanged,
} from "@/lib/notifications";
import InstantPassModal from "@/components/instant-milega/InstantPassModal";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="w-[330px] h-[370px] flex items-center justify-center bg-km-surface-card rounded-2xl border border-slate-200 shadow-xl">
      <CircleNotchIcon className="w-6 h-6 animate-spin text-km-heading" />
    </div>
  ),
});

// --- Interfaces ---
interface User {
  id: string;
  name: string;
  profile_image?: string;
  roles?: string[];
  headline?: string;
  is_online?: boolean;
  /** Deactivated or deleted account: history stays, new messages are blocked */
  unavailable?: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  last_message: string;
  last_message_id?: string;
  updated_at: string;
  created_at?: string;
  other_user?: User;
  otherUser?: User; // backwards-compatible alias
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_size?: number;
  /** Every file of the message (an album); older messages only have attachment_* */
  attachments?: ChatAttachment[];
  reply_to?: ReplyPreview;
  isOptimistic?: boolean;
  /** Sending failed; the bubble offers Retry */
  sendFailed?: boolean;
}

// Same limits as the server: 10 files per message, chat file types only
const MAX_FILES = 10;
const CHAT_FILE_TYPES = /\.(jpe?g|png|webp|gif|pdf|docx?|txt)$/i;
// Photos are shrunk before upload, so a large camera photo is fine as long as the result is
// under the server's 10 MB
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/;
const MAX_PHOTO_BEFORE_COMPRESSION = 25 * 1024 * 1024;

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  isImage: boolean;
  name: string;
  sizeFormatted: string;
}

// --- Formatters ---

const formatMessageTime = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
};

const formatChatListDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    if (diffDays === 1 || (diffDays === 0 && d.getDate() !== now.getDate())) {
      return "Yesterday";
    }
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const getDateDividerLabel = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) return "Today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Yesterday";

    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateStr;
  }
};

// --- Resolve asset URL ---
const getFullMediaUrl = (url?: string): string => {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${apiUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
};

// --- Main Chat View Component ---
// One avatar for the whole chat: the photo, or the first letter on brand navy, with an
// optional solid presence dot (design.md: no blinking indicators)
const AVATAR_SIZES = {
  sm: "w-7 h-7 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-11 h-11 text-sm",
} as const;

function ChatAvatar({
  name,
  image,
  size = "md",
  online = false,
  className = "",
}: {
  name?: string;
  image?: string;
  size?: keyof typeof AVATAR_SIZES;
  online?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${AVATAR_SIZES[size]} rounded-full bg-km-primary text-white font-semibold flex items-center justify-center shrink-0 ${className}`}>
      <span className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
        {image ? (
          <img src={getFullMediaUrl(image)} className="w-full h-full object-cover" alt="" />
        ) : (
          name?.trim()?.[0]?.toUpperCase() || "U"
        )}
      </span>
      {online && (
        <span
          title="Online"
          className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-km-surface-card"
        />
      )}
    </div>
  );
}

function ChatView() {
  const searchParams = useSearchParams();

  // Data state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search & Filter
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformSearchResults, setPlatformSearchResults] = useState<User[]>(
    [],
  );
  const [isSearchingPlatform, setIsSearchingPlatform] = useState(false);

  // Input & Attachments
  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  // Briefly highlighted after jumping to it from a reply quote
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  // A reply started in another conversation doesn't follow you
  const activeReply = replyTo && activeChat && replyTo.conversation_id === activeChat.id ? replyTo : null;

  // Emoji Picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Pagination & Copy states
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
  const [loadingOlderMessages, setLoadingOlderMessages] =
    useState<boolean>(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Real-time typing states
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Full-screen photo viewer
  const [viewer, setViewer] = useState<{ images: ChatAttachment[]; index: number } | null>(null);

  // Mobile slide-in view
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // User Block & Safety states (F59)
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);

  // Report Modal state (F59)
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    reason: string;
    description: string;
    blockAlso: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    reason: "Spam or unwanted advertising",
    description: "",
    blockAlso: false,
    isSubmitting: false,
  });

  // Manual refresh loading state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Entitlement & ₹99 Pass Gate state
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [chatEntitlement, setChatEntitlement] = useState<{
    distinct_conversations: number;
    free_remaining: number;
    has_active_pass: boolean;
    can_start_new: boolean;
  } | null>(null);

  // Active floating action pill for mobile tap / desktop hover
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(
    null,
  );

  // DOM & State refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<Conversation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const swipeRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const prevMessagesLength = useRef(0);
  const prevActiveChatId = useRef<string | null>(null);
  const prevLastMsgId = useRef<string | null>(null);

  // Chat options menu state
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  // Reset window scroll on mount so page doesn't get scrolled under navbar
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Close chat menu when clicking outside
  useEffect(() => {
    const handleMenuClickOutside = (e: MouseEvent) => {
      if (
        chatMenuRef.current &&
        !chatMenuRef.current.contains(e.target as Node)
      ) {
        setShowChatMenu(false);
      }
    };
    if (showChatMenu) {
      document.addEventListener("mousedown", handleMenuClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleMenuClickOutside);
    };
  }, [showChatMenu]);

  useEffect(() => {
    activeChatRef.current = activeChat;
    setShowChatMenu(false);
  }, [activeChat]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Floating jump-to-bottom FAB state
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  // Close active message quick-action menu when tapping outside (Mobile friendly)
  useEffect(() => {
    const handleDocumentInteraction = (e: MouseEvent | TouchEvent) => {
      if (activeMessageMenuId) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-message-actions="true"]')) {
          setActiveMessageMenuId(null);
        }
      }
    };
    document.addEventListener("click", handleDocumentInteraction);
    document.addEventListener("touchstart", handleDocumentInteraction, {
      passive: true,
    });
    return () => {
      document.removeEventListener("click", handleDocumentInteraction);
      document.removeEventListener("touchstart", handleDocumentInteraction);
    };
  }, [activeMessageMenuId]);

  // Open mobile chat view with browser back gesture synchronization
  const openMobileChat = (chatToSelect?: Conversation) => {
    if (chatToSelect) {
      setActiveChat(chatToSelect);
      markAsRead(chatToSelect);
    }
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      if (!window.history.state?.chatOpen) {
        window.history.pushState({ chatOpen: true }, "");
      }
    }
    setMobileChatOpen(true);
  };

  const closeMobileChat = () => {
    if (typeof window !== "undefined" && window.history.state?.chatOpen) {
      window.history.back();
    } else {
      setMobileChatOpen(false);
    }
  };

  // Sync mobile back navigation gesture (e.g. Android hardware back, browser back)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      if (mobileChatOpen) {
        setMobileChatOpen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [mobileChatOpen]);

  // 1. Initial User Profile & Conversations
  useEffect(() => {
    const initUser = async () => {
      let userObj: User | null = null;
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          userObj = { ...parsed, id: parsed.id || parsed._id };
        } catch (e) {
          console.error("Failed to parse cached user", e);
        }
      }

      if (!userObj) {
        try {
          const profile = (await api.get("/user/profile")) as any;
          userObj = { ...profile, id: profile.id || profile._id };
        } catch (e) {
          console.error("User not logged in", e);
        }
      }

      if (userObj) {
        setCurrentUser(userObj);
        await loadConversations(userObj.id, true);
      } else {
        setLoadingConversations(false);
      }
    };

    initUser();
  }, []);

  // Load Chat Entitlement Status (Free 3-Person Quota vs ₹99 Pass)
  const loadChatEntitlement = async () => {
    try {
      const data: any = await api.get("/chats/entitlement");
      if (data) {
        setChatEntitlement(data);
      }
    } catch (e) {
      // silently fallback
    }
  };

  // 2. Load conversations (Enriched in 1 single backend query)
  // Note: isInitial flag ensures the sidebar ONLY shows the spinner on cold start, NEVER on message exchange!
  const loadConversations = async (myId: string, isInitial = false) => {
    try {
      if (isInitial) setLoadingConversations(true);
      const [res] = await Promise.all([
        api.get("/chats") as Promise<Conversation[]>,
        loadChatEntitlement(),
      ]);
      // Normalize other_user / otherUser
      const list = (res || []).map((c) => {
        const partner = c.other_user || c.otherUser;
        return {
          ...c,
          otherUser: partner,
          other_user: partner,
        };
      });

      // Sort by updated_at desc
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setConversations(list);
      return list;
    } catch (e) {
      console.error("Failed to fetch conversations", e);
      return [];
    } finally {
      if (isInitial) setLoadingConversations(false);
    }
  };

  // Manual refresh with visual spinner, active chat synchronization, and safety status reload
  const handleManualRefresh = async () => {
    if (!currentUser || isRefreshing) return;
    setIsRefreshing(true);
    try {
      // 1. Refresh conversations list
      await loadConversations(currentUser.id, false);

      // 2. Refresh active chat messages if an active chat is selected
      if (activeChat && !activeChat.id.startsWith("temp-")) {
        const res = (await api.get(
          `/chats/${activeChat.id}/messages?limit=50`,
        )) as Message[];
        if (res) {
          setMessages(res);
        }
        const other = activeChat.other_user || activeChat.otherUser;
        const otherId =
          other?.id ||
          activeChat.participants.find((p) => p !== currentUser.id);
        if (otherId) {
          checkBlockStatus(otherId);
        }
      }
      notify.success("Updated");
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  // Smooth In-Memory Sidebar Update (Prevents unmounting or flicker on message send/receive)
  const updateConversationLastMessageLocally = (
    convId: string,
    lastMsgText: string,
    partnerId?: string,
    unreadDelta = 0,
  ) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        const matches =
          c.id === convId || (partnerId && c.participants.includes(partnerId));
        if (matches) {
          return {
            ...c,
            last_message: lastMsgText,
            updated_at: new Date().toISOString(),
            unread_count: Math.max(0, (c.unread_count || 0) + unreadDelta),
          };
        }
        return c;
      });

      // Sort by updated_at so latest conversation moves smoothly to top
      return updated.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    });
  };

  // 3. Mark conversation as read
  const markAsRead = async (chat: Conversation) => {
    if (!chat || !chat.id || chat.id.startsWith("temp-") || !currentUser)
      return;
    const other = chat.other_user || chat.otherUser;
    const otherId =
      other?.id || chat.participants.find((p) => p !== currentUser.id);
    if (!otherId) return;

    try {
      await api
        .put(`/chats/${chat.id}/read?other_id=${otherId}`)
        .catch(() => {});
      // Optimistically reset unread count in state
      setConversations((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, unread_count: 0 } : c)),
      );
      notifyChatUnreadChanged();
    } catch {
      // Silently ignore
    }
  };

  // 4. WebSocket setup
  useEffect(() => {
    if (!currentUser) return;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;
    let isUnmounting = false;

    const connectWS = () => {
      if (isUnmounting) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, "")
        : window.location.host;

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const wsUrl = token
        ? `${protocol}//${host}/api/ws/chats?token=${encodeURIComponent(token)}`
        : `${protocol}//${host}/api/ws/chats`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Keep-alive or re-sync
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const currentActive = activeChatRef.current;

          // Handle New Incoming Message
          if (data.type === "NEW_MESSAGE" && data.message) {
            const newMsg: Message = data.message;
            const isForActiveChat =
              currentActive &&
              (newMsg.conversation_id === currentActive.id ||
                (currentActive.id.startsWith("temp-") &&
                  currentActive.participants.includes(newMsg.sender_id)));

            if (isForActiveChat) {
              setMessages((prev) => {
                // Prevent duplicate append if ID already in state
                if (prev.some((m) => m.id === newMsg.id)) return prev;

                // My own message while one of mine is still sending here: the send's response
                // puts it in place of its bubble. If it came from another device instead, add
                // it once the sends have settled.
                if (
                  newMsg.sender_id === currentUser.id &&
                  prev.some((m) => m.isOptimistic && !m.sendFailed)
                ) {
                  setTimeout(() => {
                    setMessages((later) =>
                      later.some((m) => m.id === newMsg.id)
                        ? later
                        : [...later, newMsg].sort(
                            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                          ),
                    );
                  }, 4000);
                  return prev;
                }

                return [...prev, newMsg];
              });

              // If incoming message from other user in active chat, mark as read immediately
              if (newMsg.sender_id !== currentUser.id) {
                markAsRead(currentActive);
              }
            } else {
              // Message in an inactive chat: play soft audio chime (powered by uisfx)
              if (newMsg.sender_id !== currentUser.id) {
                playMessageReceivedSound();
              }
            }

            // Smoothly update the last message in sidebar in-memory (no spinner!)
            const previewText =
              newMsg.content ||
              (newMsg.attachment_name
                ? `Attachment: ${newMsg.attachment_name}`
                : "Sent an attachment");
            updateConversationLastMessageLocally(
              newMsg.conversation_id,
              previewText,
              newMsg.sender_id,
              isForActiveChat ? 0 : 1,
            );

            // Quiet background refresh to keep state identical with backend
            loadConversations(currentUser.id, false);
          }

          // Handle Read Receipts
          if (data.type === "MESSAGES_READ" && data.conversation_id) {
            if (currentActive && currentActive.id === data.conversation_id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.sender_id === currentUser.id ? { ...m, is_read: true } : m,
                ),
              );
            }
          }

          // Handle Typing Indicator
          if (data.type === "USER_TYPING") {
            const typingSenderId = data.sender_id;
            if (typingSenderId && typingSenderId !== currentUser.id) {
              // Update sidebar typing indicators
              setTypingUsers((prev) => {
                const next = { ...prev };
                if (data.is_typing) {
                  next[typingSenderId] = true;
                } else {
                  delete next[typingSenderId];
                }
                return next;
              });

              // Check active conversation partner
              if (currentActive) {
                const partner =
                  currentActive.other_user || currentActive.otherUser;
                const partnerId =
                  partner?.id ||
                  currentActive.participants.find((p) => p !== currentUser.id);

                if (typingSenderId === partnerId) {
                  setIsOtherTyping(Boolean(data.is_typing));
                  if (typingTimeoutRef.current)
                    clearTimeout(typingTimeoutRef.current);
                  if (data.is_typing) {
                    typingTimeoutRef.current = setTimeout(() => {
                      setIsOtherTyping(false);
                    }, 3000);
                  }
                }
              }
            }
          }

          // Handle Message Deletion (LinkedIn style tombstone)
          if (data.type === "MESSAGE_DELETED") {
            const deletedMsgId = data.message_id;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === deletedMsgId
                  ? {
                      ...m,
                      is_deleted: true,
                      content: "",
                      attachment_url: "",
                      attachment_type: "",
                      attachment_name: "",
                      attachment_size: 0,
                      attachments: [],
                    }
                  : m.reply_to && m.reply_to.id === deletedMsgId
                    ? { ...m, reply_to: { id: deletedMsgId, sender_id: m.reply_to.sender_id, is_deleted: true } }
                    : m,
              ),
            );
            if (currentUser) {
              loadConversations(currentUser.id, false);
            }
          }

          // Handle Clear Messages
          if (data.type === "CHAT_CLEARED") {
            if (currentActive && currentActive.id === data.conversation_id) {
              setMessages([]);
            }
            if (currentUser) {
              loadConversations(currentUser.id, false);
            }
          }

          // Handle Conversation Deletion
          if (data.type === "CONVERSATION_DELETED") {
            const targetConvId = data.conversation_id;
            setConversations((prev) =>
              prev.filter((c) => c.id !== targetConvId),
            );
            if (currentActive && currentActive.id === targetConvId) {
              setActiveChat(null);
              setMessages([]);
              setMobileChatOpen(false);
            }
          }

          // Handle Real-time User Block / Unblock (F59)
          if (data.type === "USER_BLOCKED" || data.type === "USER_UNBLOCKED") {
            if (currentActive && currentUser) {
              const partner =
                currentActive.other_user || currentActive.otherUser;
              const partnerId =
                partner?.id ||
                currentActive.participants.find((p) => p !== currentUser.id);
              if (partnerId) {
                checkBlockStatus(partnerId);
              }
            }
          }
        } catch (e) {
          console.error("Invalid WS payload", e);
        }
      };

      ws.onclose = () => {
        if (!isUnmounting) {
          reconnectTimer = setTimeout(connectWS, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error("Chat WS connection error", err);
      };
    };

    connectWS();

    return () => {
      isUnmounting = true;
      clearTimeout(reconnectTimer);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [currentUser]);

  // 5. Emit typing status
  const emitTyping = (isTyping: boolean) => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !activeChat ||
      !currentUser
    ) {
      return;
    }
    const other = activeChat.other_user || activeChat.otherUser;
    const otherId =
      other?.id || activeChat.participants.find((p) => p !== currentUser.id);
    if (!otherId) return;

    try {
      wsRef.current.send(
        JSON.stringify({
          type: "TYPING",
          receiver_id: otherId,
          conversation_id: activeChat.id,
          is_typing: isTyping,
        }),
      );
    } catch {
      // ignore
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Auto expand textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    // Emit typing true
    emitTyping(true);
    if (myTypingDebounceRef.current) clearTimeout(myTypingDebounceRef.current);
    myTypingDebounceRef.current = setTimeout(() => {
      emitTyping(false);
    }, 2000);
  };

  // Insert emoji at cursor position
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputText((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const text = inputText;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setInputText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
    emitTyping(true);
  };

  // 6. Handle URL search params (?user= or ?userId=) to deep-link chat
  useEffect(() => {
    const targetUserId = searchParams.get("user") || searchParams.get("userId");
    if (!targetUserId || !currentUser || loadingConversations) return;
    if (targetUserId === currentUser.id) return;

    const selectOrStartChat = async () => {
      const existing = conversations.find((c) =>
        c.participants.includes(targetUserId),
      );
      if (existing) {
        openMobileChat(existing);
      } else {
        try {
          const targetUser = (await api.get(`/user/${targetUserId}`)) as User;
          const draft: Conversation = {
            id: `temp-${targetUserId}`,
            participants: [currentUser.id, targetUserId],
            last_message: "",
            updated_at: new Date().toISOString(),
            other_user: targetUser,
            otherUser: targetUser,
            unread_count: 0,
          };
          setActiveChat(draft);
          setMessages([]);
          openMobileChat();
        } catch (e) {
          console.error("Failed to resolve target user for chat deep-link", e);
          notify.error("This member isn't available to message right now.");
        }
      }
    };

    selectOrStartChat();
  }, [searchParams, currentUser, loadingConversations]);

  // Active chat notification suppression synchronization
  useEffect(() => {
    if (activeChat && currentUser) {
      const other = activeChat.other_user || activeChat.otherUser;
      const otherId =
        other?.id || activeChat.participants.find((p) => p !== currentUser.id);
      setActiveChatState(activeChat.id, otherId || null);
    } else {
      setActiveChatState(null, null);
    }
    return () => {
      setActiveChatState(null, null);
    };
  }, [activeChat, currentUser]);

  // Check user block status when active chat changes (F59)
  const checkBlockStatus = async (otherUserId: string) => {
    if (!otherUserId || otherUserId.startsWith("temp-")) return;
    try {
      const res: any = await api.get(
        `/chats/users/${otherUserId}/block-status`,
      );
      if (res) {
        setIsBlockedByMe(Boolean(res.is_blocked_by_me));
        setIsBlockedByOther(Boolean(res.is_blocked_by_other));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!activeChat || !currentUser) {
      setIsBlockedByMe(false);
      setIsBlockedByOther(false);
      return;
    }
    const other = activeChat.other_user || activeChat.otherUser;
    const otherId =
      other?.id || activeChat.participants.find((p) => p !== currentUser.id);
    if (otherId) {
      checkBlockStatus(otherId);
    }
  }, [activeChat?.id, currentUser?.id]);

  // 7. Load messages when active chat changes
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      setHasMoreMessages(false);
      return;
    }

    setIsOtherTyping(false);

    if (activeChat.id.startsWith("temp-")) {
      setMessages([]);
      setHasMoreMessages(false);
      return;
    }

    const fetchMessages = async () => {
      setLoadingMessages(true);
      setHasMoreMessages(true);
      try {
        const res = (await api.get(
          `/chats/${activeChat.id}/messages?limit=50`,
        )) as Message[];
        const batch = res || [];
        setMessages(batch);
        if (batch.length < 50) {
          setHasMoreMessages(false);
        }
        markAsRead(activeChat);
      } catch (e) {
        console.error("Failed to load messages", e);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeChat?.id]);

  // Load older messages when scrolling to top (infinite reverse scroll)
  const loadOlderMessages = async () => {
    if (
      !activeChat ||
      loadingOlderMessages ||
      !hasMoreMessages ||
      messages.length === 0 ||
      activeChat.id.startsWith("temp-")
    ) {
      return;
    }

    const oldestMessage = messages[0];
    if (!oldestMessage || !oldestMessage.id) return;

    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    setLoadingOlderMessages(true);
    try {
      const res = (await api.get(
        `/chats/${activeChat.id}/messages?limit=50&before=${oldestMessage.id}`,
      )) as Message[];

      if (!res || res.length === 0) {
        setHasMoreMessages(false);
      } else {
        if (res.length < 50) {
          setHasMoreMessages(false);
        }
        setMessages((prev) => {
          const newItems = res.filter(
            (m) => !prev.some((existing) => existing.id === m.id),
          );
          return [...newItems, ...prev];
        });

        // Maintain exact scroll position so view doesn't jump
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (
      container.scrollTop < 60 &&
      hasMoreMessages &&
      !loadingOlderMessages &&
      !loadingMessages
    ) {
      loadOlderMessages();
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBottomButton(distanceFromBottom > 220);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Copy message text to clipboard helper
  const handleCopyMessage = async (msg: Message) => {
    if (!msg.content || msg.is_deleted) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.id);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msg.id ? null : prev));
      }, 1800);
    } catch (err) {
      console.error("Failed to copy message", err);
    }
  };

  // 8. Auto-scroll on new messages (Container-level, never window-level)
  useEffect(() => {
    if (!activeChat) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const lastMsgId =
      messages.length > 0 ? messages[messages.length - 1].id : null;

    if (activeChat.id !== prevActiveChatId.current) {
      prevActiveChatId.current = activeChat.id;
      prevLastMsgId.current = lastMsgId;
      container.scrollTop = container.scrollHeight;
    } else if (lastMsgId && lastMsgId !== prevLastMsgId.current) {
      // Only smooth scroll down when a message is added to the end
      prevLastMsgId.current = lastMsgId;
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else if (isOtherTyping) {
      // Show the typing bubble like WhatsApp, but only if the user is reading the latest
      // messages; never yank them down while they scroll through older ones
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 220) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages, activeChat, isOtherTyping]);

  // 9. File attachments: picked, pasted or dropped, up to 10 per message
  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const room = MAX_FILES - pendingAttachments.length;
    if (room <= 0) {
      notify.error(`You can send up to ${MAX_FILES} files at a time.`);
      return;
    }
    const accepted: PendingAttachment[] = [];
    for (const file of files) {
      if (!CHAT_FILE_TYPES.test(file.name)) {
        notify.error(`${file.name} can't be sent. Use photos, PDF, Word or text files.`);
        continue;
      }
      const limit = COMPRESSIBLE.test(file.type) ? MAX_PHOTO_BEFORE_COMPRESSION : UPLOAD_LIMITS.chat;
      if (file.size > limit) {
        notify.error(`${file.name} is over ${Math.round(limit / 1024 / 1024)} MB.`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        isImage,
        name: file.name,
        sizeFormatted: formatFileSize(file.size),
      });
    }
    if (accepted.length > room) {
      notify.error(`You can send up to ${MAX_FILES} files at a time.`);
      accepted.splice(room).forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    }
    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
      textareaRef.current?.focus();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    // Reset so picking the same file again still triggers a change
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const startReply = (msg: Message) => {
    if (msg.is_deleted || msg.isOptimistic) return;
    setReplyTo(msg);
    setActiveMessageMenuId(null);
    textareaRef.current?.focus();
  };

  // Scrolls to the quoted message and highlights it for a moment
  const jumpToMessage = (id: string) => {
    const el = messagesContainerRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (!el) {
      notify.info("That message is further up. Scroll up to load it.");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(id);
    setTimeout(() => setHighlightedMessageId((cur) => (cur === id ? null : cur)), 1600);
  };

  // Updates one file of a message that is being sent
  const patchAttachment = (tempId: string, index: number, patch: Partial<ChatAttachment>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId && m.attachments
          ? { ...m, attachments: m.attachments.map((a, i) => (i === index ? { ...a, ...patch } : a)) }
          : m,
      ),
    );
  };

  // 10. Send: the bubble appears at once with this device's previews; files upload in the
  // background with progress, then the message is posted (WhatsApp pattern)
  const handleSendMessage = () => {
    const text = inputText.trim();
    if ((!text && pendingAttachments.length === 0) || !activeChat || !currentUser) return;

    const other = activeChat.other_user || activeChat.otherUser;
    const otherId =
      other?.id || activeChat.participants.find((p) => p !== currentUser.id);
    if (!otherId) return;

    if (isBlockedByMe) {
      notify.error("You have blocked this user. Unblock them to send messages.");
      return;
    }
    if (isBlockedByOther) {
      notify.error("You cannot send messages to this conversation.");
      return;
    }
    if (other?.unavailable) {
      notify.error("This member isn't available on KaamMilega right now.");
      return;
    }

    setShowEmojiPicker(false);
    emitTyping(false);
    if (myTypingDebounceRef.current) clearTimeout(myTypingDebounceRef.current);

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeChat.id,
      sender_id: currentUser.id,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      attachments: pendingAttachments.map((p) => ({
        url: "",
        type: p.file.type,
        name: p.name,
        size: p.file.size,
        localUrl: p.previewUrl,
        file: p.file,
        progress: 0,
      })),
      reply_to: activeReply ? replyPreviewOf(activeReply) : undefined,
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // Previews stay alive: the sent bubble keeps showing them
    setPendingAttachments([]);
    setReplyTo(null);

    const count = optimisticMsg.attachments!.length;
    updateConversationLastMessageLocally(
      activeChat.id,
      text || (count > 1 ? `${count} files` : count === 1 ? `Attachment: ${optimisticMsg.attachments![0].name}` : ""),
      otherId,
      0,
    );

    void deliverMessage(optimisticMsg, otherId, activeChat);
  };

  const deliverMessage = async (msg: Message, otherId: string, chat: Conversation) => {
    const tempId = msg.id;
    const atts = msg.attachments ?? [];
    try {
      // Upload what isn't uploaded yet (a retry skips finished files)
      const uploaded = await Promise.all(
        atts.map(async (a, i) => {
          if (a.url) return a;
          const file = a.file!.type.startsWith("image/") ? await compressImage(a.file!) : a.file!;
          if (file.size > UPLOAD_LIMITS.chat) {
            throw new Error(`${a.name} is still over 10 MB after compressing. Please choose a smaller photo.`);
          }
          const res = await uploadFile(file, "chat", {
            moduleName: "chat",
            recordId: chat.id,
            onProgress: (f) => patchAttachment(tempId, i, { progress: f }),
          });
          const done = { ...a, url: res.url, progress: 1 };
          patchAttachment(tempId, i, { url: res.url, progress: 1 });
          return done;
        }),
      );

      const payload: Record<string, unknown> = { receiver_id: otherId, content: msg.content };
      if (uploaded.length > 0) payload.attachments = uploaded.map((a) => ({ url: a.url }));
      if (msg.reply_to) payload.reply_to_id = msg.reply_to.id;
      const sent = (await api.post("/chats/messages", payload)) as Message;

      // Keep this device's previews so the photos don't flash while signed links load
      const withPreviews: Message = {
        ...sent,
        isOptimistic: false,
        attachments: attachmentsOf(sent).map((a, i) => ({ ...a, localUrl: uploaded[i]?.localUrl })),
      };
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === sent.id)) {
          return withoutTemp.map((m) => (m.id === sent.id ? withPreviews : m));
        }
        return prev.map((m) => (m.id === tempId ? withPreviews : m));
      });

      // A draft conversation gets its real ID from the server
      if (chat.id.startsWith("temp-")) {
        const refreshed = await loadConversations(currentUser!.id, false);
        const realChat = refreshed.find((c) => c.participants.includes(otherId));
        if (realChat) setActiveChat(realChat);
      } else {
        loadConversations(currentUser!.id, false);
      }
    } catch (err: unknown) {
      console.error("Failed to send message", err);
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message ?? "";
      // Backend error for the 3-person free chat limit (chat/service.go SendMessage)
      if (code === "CHAT_QUOTA_REACHED" || message.toLowerCase().startsWith("free chat quota reached")) {
        setIsPassModalOpen(true);
        loadChatEntitlement();
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        notify.error(err, "Failed to send message");
        return;
      }
      notify.error(err, "Your message wasn't sent. Tap Retry to send it again.");
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, sendFailed: true } : m)));
    }
  };

  const retrySend = (msg: Message) => {
    if (!activeChat || !currentUser) return;
    const other = activeChat.other_user || activeChat.otherUser;
    const otherId = other?.id || activeChat.participants.find((p) => p !== currentUser.id);
    if (!otherId) return;
    const again = { ...msg, sendFailed: false };
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? again : m)));
    void deliverMessage(again, otherId, activeChat);
  };

  // 11. Platform-wide user search for starting a new chat
  const handlePlatformSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setPlatformSearchResults([]);
      return;
    }

    setIsSearchingPlatform(true);
    try {
      const res = (await api.get(
        `/user/search?q=${encodeURIComponent(query.trim())}`,
      )) as User[];
      // Exclude current user from search
      const filtered = (res || []).filter((u) => u.id !== currentUser?.id);
      setPlatformSearchResults(filtered);
    } catch (e) {
      console.error("Search platform users failed", e);
    } finally {
      setIsSearchingPlatform(false);
    }
  };

  const startConversationWithUser = (user: User) => {
    if (!currentUser) return;
    const existing = conversations.find((c) =>
      c.participants.includes(user.id),
    );
    if (existing) {
      openMobileChat(existing);
    } else {
      const draft: Conversation = {
        id: `temp-${user.id}`,
        participants: [currentUser.id, user.id],
        last_message: "",
        updated_at: new Date().toISOString(),
        other_user: user,
        otherUser: user,
        unread_count: 0,
      };
      setActiveChat(draft);
      setMessages([]);
      openMobileChat();
    }
    setSearchQuery("");
    setPlatformSearchResults([]);
  };

  // 12. Filtered conversation list
  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (filterTab === "unread") {
      list = list.filter((c) => (c.unread_count || 0) > 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const partner = c.other_user || c.otherUser;
        const name = (partner?.name || "").toLowerCase();
        const lastMsg = (c.last_message || "").toLowerCase();
        return name.includes(q) || lastMsg.includes(q);
      });
    }
    return list;
  }, [conversations, filterTab, searchQuery]);

  const activePartner = activeChat?.other_user || activeChat?.otherUser;

  // 13. In-App Confirmation Modal & Handlers (Block, Unblock, Delete)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "message" | "conversation" | "block" | "unblock";
    targetId: string;
    title: string;
    description: string;
    confirmLabel: string;
  }>({
    isOpen: false,
    type: "message",
    targetId: "",
    title: "",
    description: "",
    confirmLabel: "Delete",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const promptDeleteMessage = (messageId: string) => {
    setConfirmModal({
      isOpen: true,
      type: "message",
      targetId: messageId,
      title: "Delete message?",
      description: "This message will be deleted for everyone in this chat.",
      confirmLabel: "Delete for everyone",
    });
  };

  const promptDeleteConversation = (conversationId?: string) => {
    const convId = conversationId || activeChat?.id;
    if (!convId) return;
    setShowChatMenu(false);
    setConfirmModal({
      isOpen: true,
      type: "conversation",
      targetId: convId,
      title: "Delete conversation?",
      description:
        "This will remove the conversation from your inbox. The other person will still see the conversation and messages.",
      confirmLabel: "Delete conversation",
    });
  };

  const promptBlockUser = () => {
    const other = activeChat?.other_user || activeChat?.otherUser;
    const otherId =
      other?.id ||
      (currentUser &&
        activeChat?.participants.find((p) => p !== currentUser.id));
    if (!otherId) return;
    setShowChatMenu(false);
    setConfirmModal({
      isOpen: true,
      type: "block",
      targetId: otherId,
      title: `Block ${other?.name || "this user"}?`,
      description:
        "They will not be able to send you messages on KaamMilega. You can unblock them at any time.",
      confirmLabel: "Block user",
    });
  };

  const promptUnblockUser = () => {
    const other = activeChat?.other_user || activeChat?.otherUser;
    const otherId =
      other?.id ||
      (currentUser &&
        activeChat?.participants.find((p) => p !== currentUser.id));
    if (!otherId) return;
    setShowChatMenu(false);
    setConfirmModal({
      isOpen: true,
      type: "unblock",
      targetId: otherId,
      title: `Unblock ${other?.name || "this user"}?`,
      description:
        "They will be able to send you messages and connect with you again on KaamMilega.",
      confirmLabel: "Unblock user",
    });
  };

  const openReportModal = () => {
    setShowChatMenu(false);
    setReportModal({
      isOpen: true,
      reason: "Spam or unwanted advertising",
      description: "",
      blockAlso: false,
      isSubmitting: false,
    });
  };

  const handleSubmitReport = async () => {
    if (!activeChat) return;
    setReportModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.post(`/chats/${activeChat.id}/report`, {
        reason: reportModal.reason,
        description: reportModal.description.trim(),
        block_user: reportModal.blockAlso,
      });

      notify.success(
        "Thank you for letting us know. Our team will review this report.",
      );

      if (reportModal.blockAlso) {
        setIsBlockedByMe(true);
      }

      setReportModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error("Failed to submit chat report", err);
      notify.error(err, "Failed to submit report");
    } finally {
      setReportModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleConfirmAction = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (confirmModal.type === "message") {
        const messageId = confirmModal.targetId;
        await api.delete(`/chats/messages/${messageId}`);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  is_deleted: true,
                  content: "",
                  attachment_url: "",
                  attachment_type: "",
                  attachment_name: "",
                  attachment_size: 0,
                }
              : m,
          ),
        );
        if (currentUser) {
          loadConversations(currentUser.id, false);
        }
        notify.success("Message deleted");
      } else if (confirmModal.type === "conversation") {
        const convId = confirmModal.targetId;
        await api.delete(`/chats/${convId}`);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeChat?.id === convId) {
          setActiveChat(null);
          setMessages([]);
          setMobileChatOpen(false);
        }
        notify.success("Conversation removed from your inbox");
      } else if (confirmModal.type === "block") {
        const targetUserId = confirmModal.targetId;
        await api.post(`/chats/users/${targetUserId}/block`);
        setIsBlockedByMe(true);
        notify.success("User blocked");
      } else if (confirmModal.type === "unblock") {
        const targetUserId = confirmModal.targetId;
        await api.post(`/chats/users/${targetUserId}/unblock`);
        setIsBlockedByMe(false);
        notify.success("User unblocked");
      }
    } catch (e: any) {
      console.error("Action failed", e);
      notify.error(e, "Failed to complete request");
    } finally {
      setIsDeleting(false);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] bg-km-surface overflow-hidden relative font-sans w-full">
      {/* ── SIDEBAR / CONVERSATION LIST ── */}
      <aside
        className={`
                    w-full md:w-80 lg:w-[360px] xl:w-[380px] bg-km-surface-card border-r border-km-border
                    flex flex-col h-full shrink-0 shadow-xs z-10
                    transition-transform duration-300 ease-in-out
                    ${mobileChatOpen ? "hidden md:flex" : "flex"}
                `}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 border-b border-km-border space-y-2.5 bg-km-surface-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-km-heading font-poppins">
                Messages
              </h1>
              {conversations.reduce(
                (sum, c) => sum + (c.unread_count || 0),
                0,
              ) > 0 && (
                <span className="bg-[#FF6B00] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {conversations.reduce(
                    (sum, c) => sum + (c.unread_count || 0),
                    0,
                  )}
                </span>
              )}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh conversations"
              aria-label="Refresh conversations"
              className="p-2 rounded-xl text-km-text-secondary hover:text-km-heading hover:bg-km-surface active:bg-slate-200 active:scale-95 transition-all disabled:opacity-60"
            >
              <ArrowsClockwiseIcon weight="bold"
                size={18}
                className={
                  isRefreshing
                    ? "animate-spin text-[#FF6B00]"
                    : "transition-transform"
                }
              />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-km-surface p-1 rounded-xl border border-km-border">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterTab === "all"
                  ? "bg-km-surface-card text-km-heading shadow-xs"
                  : "text-km-text-secondary hover:text-km-heading"
              }`}
            >
              All Chats
            </button>
            <button
              onClick={() => setFilterTab("unread")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                filterTab === "unread"
                  ? "bg-km-surface-card text-km-heading shadow-xs"
                  : "text-km-text-secondary hover:text-km-heading"
              }`}
            >
              <span>Unread</span>
              {conversations.filter((c) => (c.unread_count || 0) > 0).length >
                0 && <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />}
            </button>
          </div>

          {/* Free Chat Quota / Universal Pass Entitlement Banner */}
          {chatEntitlement && !chatEntitlement.has_active_pass && (
            <div className="px-3 py-2 rounded-xl bg-km-surface border border-km-border flex items-center justify-between gap-2">
              <span className="text-xs text-km-text-secondary">
                {chatEntitlement.free_remaining > 0 ? (
                  <>
                    <span className="font-semibold text-km-text-primary">{chatEntitlement.free_remaining} of 3</span> free new chats left
                  </>
                ) : (
                  <span className="font-semibold text-km-text-primary">Free new chats used (3 of 3)</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setIsPassModalOpen(true)}
                className="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] dark:text-[#FF9A4D] dark:hover:text-[#FFB27A] shrink-0 cursor-pointer"
              >
                Get ₹99 Pass
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlassIcon weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-secondary"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handlePlatformSearch(e.target.value)}
              className="w-full bg-km-surface rounded-xl py-2 pl-9 pr-8 text-base sm:text-sm text-km-text-primary placeholder-[#5B6472] border border-km-border focus:border-[#071A4D] focus:bg-km-surface-card focus:outline-none transition-all dark:placeholder-km-text-muted dark:focus:border-km-link"
              placeholder="Search chats or find people..."
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPlatformSearchResults([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-km-text-secondary hover:text-km-text-primary"
              >
                <XIcon weight="bold" size={15} />
              </button>
            )}

            {/* Search Results Dropdown (Platform Users) */}
            {searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-km-surface-card shadow-xl rounded-xl border border-km-border max-h-64 overflow-y-auto divide-y divide-[#F4F7FB] dark:divide-km-border">
                <div className="px-3 py-2 bg-km-surface text-xs font-semibold text-km-text-secondary">
                  People on KaamMilega
                </div>
                {isSearchingPlatform ? (
                  <div className="p-4 text-center text-xs text-km-text-secondary flex items-center justify-center gap-2">
                    <CircleNotchIcon weight="bold"
                      size={14}
                      className="animate-spin text-km-heading"
                    />
                    Searching users...
                  </div>
                ) : platformSearchResults.length > 0 ? (
                  platformSearchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => startConversationWithUser(u)}
                      className="p-3 hover:bg-km-surface cursor-pointer flex items-center gap-3 transition-colors"
                    >
                      <ChatAvatar name={u.name} image={u.profile_image} online={u.is_online} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-km-text-primary truncate">
                          {u.name}
                        </p>
                        <p className="text-xs text-km-text-secondary truncate">
                          {u.headline ||
                            u.roles?.join(", ") ||
                            "KaamMilega member"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-km-text-secondary">
                    No users matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F4F7FB] dark:divide-km-border">
          {loadingConversations ? (
            <div className="p-6 text-center text-xs text-km-text-secondary space-y-2">
              <CircleNotchIcon
                size={20}
                className="animate-spin mx-auto text-km-heading"
              />
              <p>Loading conversations...</p>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((chat, idx) => {
              const partner = chat.other_user || chat.otherUser;
              const isActive = activeChat?.id === chat.id;
              const unread = chat.unread_count || 0;
              const isTyping = Boolean(partner?.id && typingUsers[partner.id]);

              return (
                <div
                  key={`${chat.id}-${idx}`}
                  onClick={() => {
                    openMobileChat(chat);
                  }}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all group ${
                    isActive
                      ? "bg-[#EAF1FC] dark:bg-[#172A50] border-l-[3px] border-l-km-primary dark:border-l-km-link"
                      : "hover:bg-km-surface border-l-[3px] border-l-transparent"
                  }`}
                >
                  <ChatAvatar name={partner?.name} image={partner?.profile_image} size="lg" online={partner?.is_online} />

                  {/* Conversation Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4
                        className={`text-sm truncate font-semibold ${
                          unread > 0
                            ? "text-km-heading font-bold"
                            : "text-km-text-primary"
                        }`}
                      >
                        {partner?.name || "User"}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-xs text-km-text-secondary">
                          {formatChatListDate(chat.updated_at)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            promptDeleteConversation(chat.id);
                          }}
                          title="Delete conversation"
                          className="hidden md:block opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-[#271E35] transition-all dark:hover:text-red-400"
                        >
                          <TrashIcon weight="bold" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {isTyping ? (
                        <span className="text-[#C2410C] dark:text-[#FF9A4D] text-xs font-medium">typing…</span>
                      ) : (
                        <p
                          className={`text-xs truncate ${
                            unread > 0
                              ? "text-km-heading font-medium"
                              : "text-km-text-secondary"
                          }`}
                        >
                          {chat.last_message || "Started a new conversation"}
                        </p>
                      )}
                      {unread > 0 && (
                        <span className="shrink-0 bg-[#FF6B00] text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-km-text-secondary space-y-2">
              <ChatIcon size={32} className="mx-auto text-[#D9E0EA]" />
              <p className="text-sm font-semibold text-km-text-primary">
                No conversations found
              </p>
              <p className="text-xs text-km-text-secondary max-w-xs mx-auto">
                Search for a candidate, recruiter, or colleague above to start
                chatting.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CHAT PANEL ── */}
      <main
        className={`
                    flex-1 flex flex-col bg-km-surface-card md:m-2.5 lg:m-3 md:rounded-2xl
                    md:border md:border-km-border md:shadow-xs overflow-hidden h-full z-20
                    transition-all duration-300
                    ${mobileChatOpen ? "flex" : "hidden md:flex"}
                `}
      >
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-3.5 md:p-4 border-b border-km-border flex items-center justify-between bg-km-surface-card z-10 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={closeMobileChat}
                  className="md:hidden p-2 -ml-1.5 rounded-xl text-km-heading hover:bg-km-surface active:bg-slate-200 transition-colors shrink-0 flex items-center justify-center"
                  aria-label="Back to messages"
                >
                  <CaretLeftIcon size={22} />
                </button>

                <ChatAvatar name={activePartner?.name} image={activePartner?.profile_image} online={activePartner?.is_online} />

                {/* Contact Info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-sm font-bold text-km-text-primary leading-snug truncate">
                      {activePartner?.name || "Direct Message"}
                    </h3>
                    {activePartner?.is_online && (
                      <span className="hidden sm:inline text-xs font-medium text-emerald-700 shrink-0 dark:text-emerald-400">
                        Active now
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-km-text-secondary truncate">
                    {isOtherTyping ? (
                      <span className="text-[#C2410C] dark:text-[#FF9A4D] font-medium">typing…</span>
                    ) : (
                      activePartner?.headline ||
                      activePartner?.roles?.join(" • ") ||
                      "KaamMilega member"
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {activePartner?.id && (
                  <Link
                    href={`/profile/${activePartner.id}`}
                    className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-km-heading bg-km-surface hover:bg-slate-200 rounded-xl border border-km-border transition-colors shrink-0"
                    aria-label="View profile"
                  >
                    <UserIcon size={16} className="sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline">View profile</span>
                  </Link>
                )}

                {/* Chat Options Menu */}
                <div className="relative" ref={chatMenuRef}>
                  <button
                    onClick={() => setShowChatMenu(!showChatMenu)}
                    className="p-2 rounded-xl text-km-text-secondary hover:text-km-heading hover:bg-km-surface active:bg-slate-200 transition-colors shrink-0"
                    title="Chat options"
                    aria-label="Chat options"
                  >
                    <DotsThreeVerticalIcon weight="bold" size={18} />
                  </button>

                  {showChatMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-km-surface-card border border-km-border rounded-xl shadow-lg z-30 py-1 text-xs">
                      {isBlockedByMe ? (
                        <button
                          onClick={promptUnblockUser}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-[#112A3B] transition-colors dark:text-emerald-400"
                        >
                          <CheckCircleIcon weight="bold" size={14} />
                          <span>Unblock user</span>
                        </button>
                      ) : (
                        <button
                          onClick={promptBlockUser}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <ProhibitIcon weight="bold" size={14} className="text-slate-500" />
                          <span>Block user</span>
                        </button>
                      )}

                      <button
                        onClick={openReportModal}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <FlagIcon weight="bold" size={14} className="text-amber-500 dark:text-amber-400" />
                        <span>Report conversation</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={() => promptDeleteConversation()}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-[#271E35] transition-colors dark:text-red-400"
                      >
                        <TrashIcon weight="bold" size={14} />
                        <span>Delete conversation</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-3 sm:px-5 md:px-8 py-4 bg-[var(--chat-bg)] [--chat-bg:#FFFFFF] dark:[--chat-bg:var(--km-surface)]"
            >
              {/* Top reverse loading spinner for infinite scroll */}
              {loadingOlderMessages && (
                <div className="flex items-center justify-center py-2 animate-in fade-in">
                  <div className="flex items-center gap-2 px-3 py-1 bg-km-surface-card/90 rounded-full border border-km-border text-xs text-km-text-secondary shadow-xs">
                    <CircleNotchIcon weight="bold"
                      size={13}
                      className="animate-spin text-[#FF6B00]"
                    />
                    <span>Loading older messages...</span>
                  </div>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-km-text-secondary space-y-2">
                  <CircleNotchIcon size={24} className="animate-spin text-km-heading" />
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                  <ChatIcon size={32} weight="duotone" className="text-km-heading" aria-hidden="true" />
                  <p className="text-sm font-bold text-km-text-primary">
                    Say hello to {activePartner?.name || "your contact"}!
                  </p>
                  <p className="text-xs text-km-text-secondary max-w-sm">
                    Send a direct message, emoji, or share a document to start
                    collaborating.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === currentUser?.id;
                  const prevMsg = messages[index - 1];
                  const nextMsg = messages[index + 1];
                  const showDateDivider =
                    index === 0 ||
                    new Date(msg.created_at).toDateString() !==
                      new Date(prevMsg.created_at).toDateString();
                  // Messages from one person within a few minutes read as one group
                  const sameGroup = (a?: Message, b?: Message) =>
                    !!a &&
                    !!b &&
                    a.sender_id === b.sender_id &&
                    new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString() &&
                    Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60_000;
                  const isFirstInGroup = showDateDivider || !sameGroup(prevMsg, msg);
                  const isLastInGroup = !sameGroup(msg, nextMsg);

                  const atts = msg.is_deleted ? [] : attachmentsOf(msg);
                  const hasMedia = atts.length > 0;
                  // Photos with no caption: the time sits on the photo instead of a strip below it
                  const photoOnly = hasMedia && !msg.content && atts.every(isImageAttachment);
                  const menuOpen = activeMessageMenuId === msg.id;

                  // iMessage colours: brand blue for mine, soft grey for theirs. --bubble also paints the tail.
                  const bubbleTone = isMe
                    ? "[--bubble:#0B5ED7] dark:[--bubble:#2348A8] bg-[var(--bubble)] text-white"
                    : "[--bubble:#E9E9EB] dark:[--bubble:#1E2942] bg-[var(--bubble)] text-[#111827] dark:text-km-text-primary";
                  const metaTone = msg.is_deleted
                    ? "text-km-text-muted"
                    : photoOnly
                      ? "text-white"
                      : isMe
                        ? "text-[#DCE9FF] dark:text-[#C7D6F5]"
                        : "text-[#6B7280] dark:text-km-text-muted";

                  const meta = (
                    <span className={`inline-flex items-center gap-1 text-[11px] leading-none select-none whitespace-nowrap ${metaTone}`}>
                      {formatMessageTime(msg.created_at)}
                      {isMe && !msg.is_deleted && !msg.sendFailed && (
                        msg.isOptimistic ? (
                          <ClockIcon weight="bold" size={11} aria-label="Sending" />
                        ) : msg.is_read ? (
                          <ChecksIcon weight="bold" size={15} aria-label="Read" />
                        ) : (
                          <CheckIcon weight="bold" size={13} aria-label="Sent" />
                        )
                      )}
                    </span>
                  );

                  return (
                    <React.Fragment key={`${msg.id || "msg"}-${index}`}>
                      {showDateDivider && (
                        <div className="flex items-center justify-center pt-4 pb-2 first:pt-0">
                          <span className="text-km-text-muted text-[11px] font-semibold">
                            {getDateDividerLabel(msg.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        data-msg-id={msg.id}
                        className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${
                          isFirstInGroup && !showDateDivider ? "mt-3" : "mt-0.5"
                        }`}
                        // Swipe right on a phone to reply (WhatsApp gesture)
                        onTouchStart={(e) => {
                          swipeRef.current = { id: msg.id, x: e.touches[0].clientX, y: e.touches[0].clientY };
                        }}
                        onTouchMove={(e) => {
                          const start = swipeRef.current;
                          if (!start || start.id !== msg.id || msg.is_deleted || msg.isOptimistic) return;
                          const dx = e.touches[0].clientX - start.x;
                          const dy = Math.abs(e.touches[0].clientY - start.y);
                          if (dx > 0 && dy < 30) {
                            e.currentTarget.style.transform = `translateX(${Math.min(dx, 72)}px)`;
                          }
                        }}
                        onTouchEnd={(e) => {
                          const start = swipeRef.current;
                          swipeRef.current = null;
                          e.currentTarget.style.transform = "";
                          if (!start || start.id !== msg.id) return;
                          const dx = e.changedTouches[0].clientX - start.x;
                          const dy = Math.abs(e.changedTouches[0].clientY - start.y);
                          if (dx > 60 && dy < 30) startReply(msg);
                        }}
                      >
                        {/* Their avatar once per group, beside the last bubble */}
                        {!isMe &&
                          (isLastInGroup ? (
                            // Above the bubble tail's mask, which reaches into the gap
                            <span className="relative z-10 shrink-0">
                              <ChatAvatar name={activePartner?.name} image={activePartner?.profile_image} size="sm" />
                            </span>
                          ) : (
                            <span className="w-7 shrink-0" aria-hidden="true" />
                          ))}

                        <div
                          className={`relative flex flex-col max-w-[80%] sm:max-w-[70%] lg:max-w-[60%] group/msg ${
                            isMe ? "items-end" : "items-start"
                          }`}
                          data-message-actions="true"
                        >
                          {/* Quick actions: on hover (desktop) or tap (mobile) */}
                          {!msg.is_deleted && !msg.isOptimistic && (
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 z-20 ${isMe ? "right-full pr-1.5" : "left-full pl-1.5"} ${
                                menuOpen ? "flex" : "hidden md:group-hover/msg:flex"
                              }`}
                            >
                            <div className="flex items-center gap-0.5 rounded-full p-0.5 bg-[#1F2937] shadow-lg dark:bg-km-surface-card dark:border dark:border-km-border">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startReply(msg);
                                }}
                                title="Reply"
                                aria-label="Reply"
                                className="p-1.5 rounded-full text-[#E5E7EB] hover:text-white hover:bg-[#374151] dark:text-km-text-secondary dark:hover:text-km-heading dark:hover:bg-km-surface transition-colors"
                              >
                                <ArrowBendUpLeftIcon weight="bold" size={14} />
                              </button>
                              {msg.content && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyMessage(msg);
                                    setActiveMessageMenuId(null);
                                  }}
                                  title={copiedMessageId === msg.id ? "Copied!" : "Copy message"}
                                  aria-label="Copy message"
                                  className="p-1.5 rounded-full text-[#E5E7EB] hover:text-white hover:bg-[#374151] dark:text-km-text-secondary dark:hover:text-km-heading dark:hover:bg-km-surface transition-colors"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <CheckIcon weight="bold" size={14} className="text-[#6EE7B7] dark:text-emerald-400" />
                                  ) : (
                                    <CopyIcon weight="bold" size={14} />
                                  )}
                                </button>
                              )}
                              {isMe && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMessageMenuId(null);
                                    promptDeleteMessage(msg.id);
                                  }}
                                  title="Delete message"
                                  aria-label="Delete message"
                                  className="p-1.5 rounded-full text-[#E5E7EB] hover:text-[#FCA5A5] hover:bg-[#374151] dark:text-km-text-secondary dark:hover:bg-[#271E35] dark:hover:text-red-400 transition-colors"
                                >
                                  <TrashIcon weight="bold" size={14} />
                                </button>
                              )}
                            </div>
                            </div>
                          )}

                          {/* Message: photos and files stand on their own; text sits in a bubble,
                              with the iMessage tail on the last bubble of a group */}
                          <div
                            onClick={() => {
                              if (!msg.is_deleted && !msg.isOptimistic) {
                                setActiveMessageMenuId((prev) => (prev === msg.id ? null : msg.id));
                              }
                            }}
                            className={`flex flex-col gap-0.5 rounded-[20px] transition-shadow duration-300 ${isMe ? "items-end" : "items-start"} ${
                              menuOpen || highlightedMessageId === msg.id
                                ? "ring-2 ring-[#38BDF8] ring-offset-2 ring-offset-[var(--chat-bg)]"
                                : ""
                            }`}
                          >
                            {msg.is_deleted ? (
                              <p className="flex items-center gap-1.5 rounded-[18px] border border-dashed border-km-border px-3 py-1.5 italic text-[13px] text-km-text-secondary">
                                <ProhibitIcon size={13} className="shrink-0" aria-hidden="true" />
                                This message was deleted
                                <span className="ml-1 not-italic">{meta}</span>
                              </p>
                            ) : (
                              <>
                                {/* A reply with no text: the quote sits above the photos */}
                                {msg.reply_to && !msg.content && (
                                  <div className="w-[272px] max-w-full">
                                    <ReplyQuote
                                      reply={msg.reply_to}
                                      senderLabel={
                                        msg.reply_to.sender_id === currentUser?.id
                                          ? "You"
                                          : activePartner?.name?.split(" ")[0] || "Them"
                                      }
                                      onJump={() => jumpToMessage(msg.reply_to!.id)}
                                    />
                                  </div>
                                )}

                                {hasMedia && (
                                  <div className="relative">
                                    <MessageAttachments
                                      attachments={atts}
                                      isMe={isMe}
                                      sending={msg.isOptimistic}
                                      onOpenImage={(images, i) => setViewer({ images, index: i })}
                                    />
                                    {photoOnly && (
                                      // Liquid-glass time chip on the photo (approved exception to the
                                      // no-glass rule)
                                      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/25 px-2 py-1 backdrop-blur-md backdrop-saturate-150">
                                        {meta}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {hasMedia && !photoOnly && !msg.content && <div className="px-2">{meta}</div>}

                                {msg.content && (
                                  <div
                                    className={`relative rounded-[18px] px-3 py-1.5 text-[15px] leading-[1.35] break-words ${bubbleTone} ${
                                      isLastInGroup ? (isMe ? "km-tail-me" : "km-tail-them") : ""
                                    }`}
                                  >
                                    {msg.reply_to && (
                                      <div className="-mx-1.5 mt-0.5">
                                        <ReplyQuote
                                          reply={msg.reply_to}
                                          senderLabel={
                                            msg.reply_to.sender_id === currentUser?.id
                                              ? "You"
                                              : activePartner?.name?.split(" ")[0] || "Them"
                                          }
                                          onDarkBubble={isMe}
                                          onJump={() => jumpToMessage(msg.reply_to!.id)}
                                        />
                                      </div>
                                    )}
                                    {/* The time sits at the end of the last line; the spacer keeps text clear of it */}
                                    <p className="whitespace-pre-wrap break-words">
                                      {msg.content}
                                      <span className={`inline-block align-bottom ${isMe ? "w-[68px]" : "w-12"}`} aria-hidden="true" />
                                      <span className="absolute bottom-1.5 right-3">{meta}</span>
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {msg.sendFailed && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                retrySend(msg);
                              }}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] hover:underline dark:text-red-400"
                            >
                              <ArrowsClockwiseIcon weight="bold" size={12} aria-hidden="true" />
                              Not sent. Tap to retry
                            </button>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* Typing indicator: an incoming-style bubble with three dots in a soft wave
                  (WhatsApp pattern; still dots under reduced motion) */}
              {isOtherTyping && (
                <div className="flex gap-2 items-end mt-3">
                  <ChatAvatar name={activePartner?.name} image={activePartner?.profile_image} size="sm" />
                  <div
                    role="status"
                    className="bg-km-surface-card border border-km-border rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-1"
                  >
                    <span className="sr-only">{activePartner?.name?.split(" ")[0] || "They"} is typing</span>
                    <span className="km-typing-dot" aria-hidden="true" />
                    <span className="km-typing-dot" aria-hidden="true" />
                    <span className="km-typing-dot" aria-hidden="true" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Floating Scroll-To-Bottom FAB */}
            {showScrollBottomButton && (
              <button
                type="button"
                onClick={scrollToBottom}
                title="Scroll to latest messages"
                aria-label="Scroll to latest messages"
                className="absolute bottom-20 sm:bottom-24 right-4 sm:right-6 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-km-surface-card border border-km-border text-km-heading shadow-lg flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all animate-in fade-in zoom-in-75"
              >
                <CaretDownIcon weight="bold" size={18} />
              </button>
            )}

            {/* Input Area */}
            <div
              className={`p-2 sm:p-3 md:p-4 bg-km-surface-card border-t space-y-2 shrink-0 relative pb-[max(0.6rem,env(safe-area-inset-bottom))] ${
                isDraggingFiles ? "border-km-link ring-2 ring-inset ring-km-link" : "border-km-border"
              }`}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={(e) => {
                if (!e.dataTransfer.files.length) return;
                e.preventDefault();
                setIsDraggingFiles(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
            >
              {/* Replying to */}
              {activeReply && (
                <ReplyQuote
                  reply={replyPreviewOf(activeReply)}
                  senderLabel={
                    activeReply.sender_id === currentUser?.id
                      ? "You"
                      : activePartner?.name?.split(" ")[0] || "Them"
                  }
                  onCancel={() => setReplyTo(null)}
                />
              )}

              {/* Files waiting to be sent */}
              {pendingAttachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Files to send">
                  {pendingAttachments.map((p) => (
                    <div
                      key={p.id}
                      role="listitem"
                      className="relative shrink-0 w-20"
                      title={`${p.name} · ${p.sizeFormatted}`}
                    >
                      {p.isImage && p.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local preview
                        <img
                          src={p.previewUrl}
                          alt={p.name}
                          className="h-20 w-20 object-cover rounded-xl border border-km-border"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-xl border border-km-border bg-km-surface flex flex-col items-center justify-center gap-1 px-1.5 text-center">
                          <FileTextIcon size={24} weight="duotone" className="text-km-heading" aria-hidden="true" />
                          <span className="w-full truncate text-[11px] font-semibold text-km-text-primary">{p.name}</span>
                          <span className="text-[10px] text-km-text-secondary">{p.sizeFormatted}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePendingAttachment(p.id)}
                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-[#1F2937] text-white flex items-center justify-center shadow hover:bg-[#B91C1C] transition-colors"
                        title="Remove file"
                        aria-label={`Remove ${p.name}`}
                      >
                        <XIcon weight="bold" size={12} />
                      </button>
                    </div>
                  ))}
                  {pendingAttachments.length < MAX_FILES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-km-border text-km-text-secondary hover:text-km-heading hover:border-km-heading flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors"
                      aria-label="Add more files"
                    >
                      <PaperclipIcon weight="bold" size={18} aria-hidden="true" />
                      Add
                    </button>
                  )}
                </div>
              )}

              {/* Dynamic Comprehensive Emoji Picker Popover */}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-16 sm:bottom-20 left-2 right-2 sm:right-auto sm:left-4 z-50 shadow-2xl rounded-2xl border border-km-border bg-km-surface-card animate-in fade-in zoom-in-95 duration-150 max-w-[340px] mx-auto sm:mx-0 overflow-hidden"
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      insertEmoji(emojiData.emoji);
                    }}
                    autoFocusSearch={false}
                    lazyLoadEmojis={true}
                    previewConfig={{ showPreview: false }}
                    width="100%"
                    height={340}
                  />
                </div>
              )}

              {/* Input Bar or Blocked Notice (F59) */}
              {activePartner?.unavailable ? (
                <div role="status" className="flex items-center gap-2.5 p-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-600 shadow-xs">
                  <ProhibitIcon weight="bold" size={17} className="text-slate-400 shrink-0" />
                  <span className="font-medium">
                    This account is no longer active, so you can&apos;t reply. Your earlier messages stay here.
                  </span>
                </div>
              ) : isBlockedByMe ? (
                <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-700 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProhibitIcon weight="bold" size={17} className="text-slate-500 shrink-0" />
                    <span className="truncate font-medium">
                      You have blocked this user.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={promptUnblockUser}
                    className="px-3.5 py-1.5 font-semibold text-xs text-km-heading bg-km-surface-card hover:bg-slate-50 rounded-xl border border-slate-300 transition-colors shrink-0 shadow-xs"
                  >
                    Unblock
                  </button>
                </div>
              ) : isBlockedByOther ? (
                <div className="flex items-center gap-2.5 p-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-600 shadow-xs">
                  <ProhibitIcon weight="bold" size={17} className="text-slate-400 shrink-0" />
                  <span className="font-medium">
                    You cannot send messages to this conversation right now.
                  </span>
                </div>
              ) : (
                /* Input Bar Capsule */
                <div className="flex items-end gap-1.5 sm:gap-2 bg-km-surface rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2 border border-km-border focus-within:border-[#071A4D] focus-within:bg-km-surface-card transition-all dark:focus-within:border-km-link">
                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach photos or files"
                    aria-label="Attach photos or files"
                    className="p-2 rounded-xl text-km-text-secondary hover:text-km-heading hover:bg-slate-200/60 active:bg-slate-200 transition-colors shrink-0 mb-0.5"
                  >
                    <PaperclipIcon weight="bold" size={18} />
                  </button>

                  {/* Emoji Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    title="Insert emoji"
                    className={`p-2 rounded-xl transition-colors shrink-0 mb-0.5 ${
                      showEmojiPicker
                        ? "text-[#C2410C] bg-km-surface dark:text-[#FF9A4D]"
                        : "text-km-text-secondary hover:text-km-heading hover:bg-slate-200/60 active:bg-slate-200"
                    }`}
                  >
                    <SmileyIcon size={19} />
                  </button>

                  {/* Message Textarea */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    onPaste={(e) => {
                      const files = Array.from(e.clipboardData.files);
                      if (files.length > 0) {
                        e.preventDefault();
                        addFiles(files);
                      }
                    }}
                    placeholder={pendingAttachments.length > 0 ? "Add a caption..." : "Type a message..."}
                    className="flex-1 bg-transparent border-none focus:outline-none text-base sm:text-sm text-km-text-primary placeholder-[#5B6472] resize-none py-1.5 min-h-[38px] max-h-24 sm:max-h-28 leading-normal dark:placeholder-km-text-muted"
                    style={{ scrollbarWidth: "none" }}
                  />

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() && pendingAttachments.length === 0}
                    aria-label="Send message"
                    className={`p-2.5 sm:p-2.5 rounded-xl transition-all shrink-0 mb-0.5 flex items-center justify-center active:scale-95 ${
                      inputText.trim() || pendingAttachments.length > 0
                        ? "bg-[#071A4D] text-white hover:bg-[#0B1F52] shadow-sm cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <PaperPlaneRightIcon weight="bold" size={18} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Desktop Empty State */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-km-surface-card h-full">
            <PaperPlaneRightIcon size={48} weight="duotone" className="text-km-heading mb-4" aria-hidden="true" />
            <h2 className="text-xl font-bold text-km-heading font-poppins">
              Select a conversation
            </h2>
            <p className="text-sm text-km-text-secondary mt-1.5 max-w-sm">
              Pick an existing conversation from the left sidebar or search for
              a candidate or employer to send a message.
            </p>
          </div>
        )}
      </main>

      {/* Full-screen photo viewer */}
      {viewer && (
        <MediaViewer
          images={viewer.images}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
      {/* ── PROFESSIONAL IN-APP CONFIRMATION POPUP MODAL ── */}
      {confirmModal.isOpen && (
        <div
          onClick={() =>
            !isDeleting &&
            setConfirmModal((prev) => ({ ...prev, isOpen: false }))
          }
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-150"
        >
          <div
            className="bg-km-surface-card rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-km-border space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              {/* icons.md: no icon containers */}
              <div
                aria-hidden="true"
                className={`shrink-0 ${
                  confirmModal.type === "unblock"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : confirmModal.type === "block"
                      ? "text-slate-700"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {confirmModal.type === "unblock" ? (
                  <CheckCircleIcon size={28} weight="duotone" />
                ) : confirmModal.type === "block" ? (
                  <ProhibitIcon size={28} weight="duotone" />
                ) : (
                  <TrashIcon size={28} weight="duotone" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-km-text-primary">
                  {confirmModal.title}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-km-text-secondary leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface border border-km-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmAction}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-70 ${
                  confirmModal.type === "unblock"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : confirmModal.type === "block"
                      ? "bg-km-ink-soft hover:bg-km-ink"
                      : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isDeleting ? (
                  <>
                    <CircleNotchIcon weight="bold" size={15} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmModal.confirmLabel}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT CONVERSATION POPUP MODAL (F59) ── */}
      {reportModal.isOpen && (
        <div
          onClick={() =>
            !reportModal.isSubmitting &&
            setReportModal((prev) => ({ ...prev, isOpen: false }))
          }
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-150"
        >
          <div
            className="bg-km-surface-card rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-km-border space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <FlagIcon size={24} weight="duotone" className="text-amber-600 shrink-0 dark:text-amber-400" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold text-km-text-primary">
                    Report conversation
                  </h3>
                  <p className="text-xs text-km-text-secondary">
                    Help us keep KaamMilega safe and trustworthy
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={reportModal.isSubmitting}
                onClick={() =>
                  setReportModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <XIcon weight="bold" size={18} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Why are you reporting this conversation?
                </label>
                <select
                  value={reportModal.reason}
                  onChange={(e) =>
                    setReportModal((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="w-full text-xs sm:text-sm bg-km-surface border border-km-border rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#071A4D] focus:bg-km-surface-card transition-all dark:focus:border-km-link"
                >
                  <option value="Spam or unwanted advertising">
                    Spam or unwanted advertising
                  </option>
                  <option value="Harassment or inappropriate behavior">
                    Harassment or inappropriate behavior
                  </option>
                  <option value="Fraud, scam, or fake job offer">
                    Fraud, scam, or fake job offer
                  </option>
                  <option value="Asking for money or advance payment">
                    Asking for money or advance payment
                  </option>
                  <option value="Hate speech or abusive language">
                    Hate speech or abusive language
                  </option>
                  <option value="Other concern">Other concern</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Additional details{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={reportModal.description}
                  onChange={(e) =>
                    setReportModal((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Tell us what happened so our team can review this properly..."
                  className="w-full text-xs sm:text-sm bg-km-surface border border-km-border rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#071A4D] focus:bg-km-surface-card resize-none transition-all dark:focus:border-km-link"
                />
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={reportModal.blockAlso}
                  onChange={(e) =>
                    setReportModal((prev) => ({
                      ...prev,
                      blockAlso: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border-slate-300 text-km-heading focus:ring-[#071A4D] dark:focus:ring-km-link"
                />
                <span className="text-xs text-slate-600 leading-snug">
                  <strong className="text-slate-800 block">
                    Also block this user
                  </strong>
                  They will not be able to message you again on KaamMilega.
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={reportModal.isSubmitting}
                onClick={() =>
                  setReportModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface border border-km-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reportModal.isSubmitting}
                onClick={handleSubmitReport}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {reportModal.isSubmitting ? (
                  <>
                    <CircleNotchIcon weight="bold" size={15} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit report</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal ₹99 Pass Modal */}
      <InstantPassModal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        onSuccess={() => {
          loadChatEntitlement();
        }}
      />
    </div>
  );
}

// Fallback skeleton while Suspense resolves useSearchParams
function ChatLoadingFallback() {
  return (
    <div className="flex h-[calc(100dvh-64px)] items-center justify-center bg-km-surface">
      <div className="text-center space-y-3">
        <CircleNotchIcon size={32} className="animate-spin text-km-heading mx-auto" />
        <p className="text-sm font-semibold text-km-heading">
          Loading conversations...
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <ChatView />
    </Suspense>
  );
}
