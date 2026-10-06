"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Check,
  CheckCheck,
  ChevronLeft,
  ExternalLink,
  X,
  Download,
  Loader2,
  MessageSquare,
  Clock,
  User as UserIcon,
  RefreshCw,
  Smile,
  MoreVertical,
  Trash2,
  RotateCcw,
  Ban,
  Copy,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { playMessageReceivedSound } from "@/lib/sound";
import { setActiveChatState, notifyChatUnreadChanged } from "@/lib/notifications";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="w-[330px] h-[370px] flex items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-xl">
      <Loader2 className="w-6 h-6 animate-spin text-[#071A4D]" />
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
  isOptimistic?: boolean;
}

interface PendingAttachment {
  file: File;
  previewUrl?: string;
  isImage: boolean;
  name: string;
  sizeFormatted: string;
}





// --- Formatters ---
const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Emoji Picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Pagination & Copy states
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState<boolean>(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Real-time typing states
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Lightbox image viewer
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  // DOM & State refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<Conversation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // 2. Load conversations (Enriched in 1 single backend query)
  // Note: isInitial flag ensures the sidebar ONLY shows the spinner on cold start, NEVER on message exchange!
  const loadConversations = async (myId: string, isInitial = false) => {
    try {
      if (isInitial) setLoadingConversations(true);
      const res = (await api.get("/chats")) as Conversation[];
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

                // If this is my own message and an optimistic placeholder exists, replace it
                const optIndex = prev.findIndex(
                  (m) =>
                    m.isOptimistic &&
                    m.sender_id === newMsg.sender_id &&
                    (m.content === newMsg.content ||
                      (newMsg.attachment_name &&
                        m.attachment_name === newMsg.attachment_name)),
                );
                if (optIndex !== -1) {
                  const next = [...prev];
                  next[optIndex] = newMsg;
                  return next;
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
                ? `📎 ${newMsg.attachment_name}`
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
                    }
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
        setActiveChat(existing);
        setMobileChatOpen(true);
        markAsRead(existing);
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
          setMobileChatOpen(true);
        } catch (e) {
          console.error("Failed to resolve target user for chat deep-link", e);
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
      const res: any = await api.get(`/chats/users/${otherUserId}/block-status`);
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
    }
  }, [messages, activeChat, isOtherTyping]);


  // 9. File attachment selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds the 10 MB limit");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setPendingAttachment({
      file,
      previewUrl,
      isImage,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
    });

    // Reset input element so re-selecting same file triggers event
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  };

  // 10. Send message (with attachment upload & optimistic update)
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (
      (!text && !pendingAttachment) ||
      !activeChat ||
      !currentUser ||
      isUploading
    )
      return;

    const other = activeChat.other_user || activeChat.otherUser;
    const otherId =
      other?.id || activeChat.participants.find((p) => p !== currentUser.id);
    if (!otherId) return;

    if (isBlockedByMe) {
      toast.error("You have blocked this user. Unblock them to send messages.");
      return;
    }
    if (isBlockedByOther) {
      toast.error("You cannot send messages to this conversation.");
      return;
    }

    // Close emoji picker
    setShowEmojiPicker(false);

    // Clear typing
    emitTyping(false);
    if (myTypingDebounceRef.current) clearTimeout(myTypingDebounceRef.current);

    let uploadedUrl = "";
    let uploadedType = "";
    let uploadedName = "";
    let uploadedSize = 0;

    // 1. Upload attachment if attached
    if (pendingAttachment) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", pendingAttachment.file);
        formData.append("module_name", "chat");
        formData.append("record_id", activeChat.id);

        const uploadRes = (await api.post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })) as any;

        uploadedUrl = uploadRes.url || uploadRes.URL || "";
        uploadedType = uploadRes.mime_type || pendingAttachment.file.type || "";
        uploadedName =
          uploadRes.original_filename || pendingAttachment.name || "";
        uploadedSize = uploadRes.size || pendingAttachment.file.size || 0;
      } catch (err: any) {
        console.error("File upload failed", err);
        toast.error(
          err?.message || "Attachment upload failed. Please try again.",
        );
        setIsUploading(false);
        return;
      }
    }

    // 2. Optimistic UI update
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeChat.id,
      sender_id: currentUser.id,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      attachment_url: uploadedUrl || pendingAttachment?.previewUrl,
      attachment_type:
        uploadedType ||
        (pendingAttachment?.isImage
          ? "image/jpeg"
          : "application/octet-stream"),
      attachment_name: uploadedName || pendingAttachment?.name,
      attachment_size: uploadedSize || pendingAttachment?.file.size,
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    removePendingAttachment();

    // Optimistically update conversation last message in the sidebar immediately (no spinner!)
    const displayPreview =
      text || (uploadedName ? `📎 ${uploadedName}` : "Sent an attachment");
    updateConversationLastMessageLocally(
      activeChat.id,
      displayPreview,
      otherId,
      0,
    );

    // 3. Post to API
    try {
      const payload: any = {
        receiver_id: otherId,
        content: text,
      };
      if (uploadedUrl) {
        payload.attachment_url = uploadedUrl;
        payload.attachment_type = uploadedType;
        payload.attachment_name = uploadedName;
        payload.attachment_size = uploadedSize;
      }

      const sentMsg = (await api.post("/chats/messages", payload)) as Message;

      // Replace optimistic message with actual message returned from server,
      // or remove the optimistic placeholder if WebSocket already added it.
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) =>
          m.id === tempId ? { ...sentMsg, isOptimistic: false } : m,
        );
      });

      // If it was a draft temporary conversation, refresh conversations to get real conversation ID
      if (activeChat.id.startsWith("temp-")) {
        const refreshed = await loadConversations(currentUser.id, false);
        const realChat = refreshed.find((c) =>
          c.participants.includes(otherId),
        );
        if (realChat) {
          setActiveChat(realChat);
        }
      } else {
        // Quiet background sync without showing a spinner
        loadConversations(currentUser.id, false);
      }
    } catch (err: any) {
      console.error("Failed to send message", err);
      toast.error(err?.message || "Failed to send message");
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsUploading(false);
    }
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
      setActiveChat(existing);
      markAsRead(existing);
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
    }
    setSearchQuery("");
    setPlatformSearchResults([]);
    setMobileChatOpen(true);
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
      other?.id || (currentUser && activeChat?.participants.find((p) => p !== currentUser.id));
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
      other?.id || (currentUser && activeChat?.participants.find((p) => p !== currentUser.id));
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

      toast.success(
        "Thank you for letting us know. Our team will review this report.",
      );

      if (reportModal.blockAlso) {
        setIsBlockedByMe(true);
      }

      setReportModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error("Failed to submit chat report", err);
      toast.error(err?.response?.data?.error || "Failed to submit report");
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
        toast.success("Message deleted");
      } else if (confirmModal.type === "conversation") {
        const convId = confirmModal.targetId;
        await api.delete(`/chats/${convId}`);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeChat?.id === convId) {
          setActiveChat(null);
          setMessages([]);
          setMobileChatOpen(false);
        }
        toast.success("Conversation removed from your inbox");
      } else if (confirmModal.type === "block") {
        const targetUserId = confirmModal.targetId;
        await api.post(`/chats/users/${targetUserId}/block`);
        setIsBlockedByMe(true);
        toast.success("User blocked");
      } else if (confirmModal.type === "unblock") {
        const targetUserId = confirmModal.targetId;
        await api.post(`/chats/users/${targetUserId}/unblock`);
        setIsBlockedByMe(false);
        toast.success("User unblocked");
      }
    } catch (e: any) {
      console.error("Action failed", e);
      toast.error(e?.response?.data?.error || "Failed to complete request");
    } finally {
      setIsDeleting(false);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] bg-[#F4F7FB] overflow-hidden relative font-sans w-full">
      {/* ── SIDEBAR / CONVERSATION LIST ── */}
      <aside
        className={`
                    w-full md:w-80 lg:w-[360px] xl:w-[380px] bg-white border-r border-[#D9E0EA]
                    flex flex-col h-full shrink-0 shadow-xs z-10
                    transition-transform duration-300 ease-in-out
                    ${mobileChatOpen ? "hidden md:flex" : "flex"}
                `}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#D9E0EA] space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#071A4D] font-poppins">
                Messages
              </h1>
              {conversations.reduce(
                (sum, c) => sum + (c.unread_count || 0),
                0,
              ) > 0 && (
                <span className="bg-[#FF6B00] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {conversations.reduce(
                    (sum, c) => sum + (c.unread_count || 0),
                    0,
                  )}
                </span>
              )}
            </div>
            <button
              onClick={() =>
                currentUser && loadConversations(currentUser.id, false)
              }
              title="Refresh conversations"
              className="p-1.5 rounded-lg text-[#5B6472] hover:text-[#071A4D] hover:bg-[#F4F7FB] transition-colors"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-[#F4F7FB] p-1 rounded-xl border border-[#D9E0EA]">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterTab === "all"
                  ? "bg-white text-[#071A4D] shadow-xs"
                  : "text-[#5B6472] hover:text-[#071A4D]"
              }`}
            >
              All Chats
            </button>
            <button
              onClick={() => setFilterTab("unread")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                filterTab === "unread"
                  ? "bg-white text-[#071A4D] shadow-xs"
                  : "text-[#5B6472] hover:text-[#071A4D]"
              }`}
            >
              <span>Unread</span>
              {conversations.filter((c) => (c.unread_count || 0) > 0).length >
                0 && <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handlePlatformSearch(e.target.value)}
              className="w-full bg-[#F4F7FB] rounded-xl py-2 pl-9 pr-8 text-sm text-[#111827] placeholder-[#5B6472] border border-[#D9E0EA] focus:border-[#071A4D] focus:bg-white focus:outline-none transition-all"
              placeholder="Search chats or find people..."
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPlatformSearchResults([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5B6472] hover:text-[#111827]"
              >
                <X size={15} />
              </button>
            )}

            {/* Search Results Dropdown (Platform Users) */}
            {searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white shadow-xl rounded-xl border border-[#D9E0EA] max-h-64 overflow-y-auto divide-y divide-[#F4F7FB]">
                <div className="p-2 bg-[#F4F7FB] text-[11px] font-bold text-[#5B6472] uppercase tracking-wider">
                  Platform Search Results
                </div>
                {isSearchingPlatform ? (
                  <div className="p-4 text-center text-xs text-[#5B6472] flex items-center justify-center gap-2">
                    <Loader2
                      size={14}
                      className="animate-spin text-[#071A4D]"
                    />
                    Searching users...
                  </div>
                ) : platformSearchResults.length > 0 ? (
                  platformSearchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => startConversationWithUser(u)}
                      className="p-3 hover:bg-[#F4F7FB] cursor-pointer flex items-center gap-3 transition-colors"
                    >
                      <div className="relative w-9 h-9 rounded-full bg-[#071A4D] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                        {u.profile_image ? (
                          <img
                            src={getFullMediaUrl(u.profile_image)}
                            className="w-full h-full object-cover"
                            alt={u.name}
                          />
                        ) : (
                          u.name?.[0]?.toUpperCase() || "U"
                        )}
                        {u.is_online && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {u.name}
                        </p>
                        <p className="text-xs text-[#5B6472] truncate">
                          {u.headline ||
                            u.roles?.join(", ") ||
                            "KaamMilega Member"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-[#5B6472]">
                    No users matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F4F7FB]">
          {loadingConversations ? (
            <div className="p-6 text-center text-xs text-[#5B6472] space-y-2">
              <Loader2
                size={20}
                className="animate-spin mx-auto text-[#071A4D]"
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
                    setActiveChat(chat);
                    setMobileChatOpen(true);
                    markAsRead(chat);
                  }}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all group ${
                    isActive
                      ? "bg-blue-50/70 border-l-4 border-l-[#071A4D]"
                      : "hover:bg-[#F4F7FB] border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Avatar with solid presence dot */}
                  <div className="relative w-11 h-11 rounded-full bg-[#071A4D] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden shadow-xs">
                    {partner?.profile_image ? (
                      <img
                        src={getFullMediaUrl(partner.profile_image)}
                        className="w-full h-full object-cover"
                        alt={partner.name || "User"}
                      />
                    ) : (
                      partner?.name?.[0]?.toUpperCase() || "U"
                    )}
                    {partner?.is_online && (
                      <span
                        title="Online"
                        className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"
                      />
                    )}
                  </div>

                  {/* Conversation Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4
                        className={`text-sm truncate font-semibold ${
                          unread > 0
                            ? "text-[#071A4D] font-bold"
                            : "text-[#111827]"
                        }`}
                      >
                        {partner?.name || "User"}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-[11px] text-[#5B6472]">
                          {formatChatListDate(chat.updated_at)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            promptDeleteConversation(chat.id);
                          }}
                          title="Delete conversation"
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {isTyping ? (
                        <span className="text-[#FF6B00] text-xs font-semibold animate-pulse">
                          Typing...
                        </span>
                      ) : (
                        <p
                          className={`text-xs truncate ${
                            unread > 0
                              ? "text-[#071A4D] font-medium"
                              : "text-[#5B6472]"
                          }`}
                        >
                          {chat.last_message || "Started a new conversation"}
                        </p>
                      )}
                      {unread > 0 && (
                        <span className="shrink-0 bg-[#FF6B00] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-[#5B6472] space-y-2">
              <MessageSquare size={32} className="mx-auto text-[#D9E0EA]" />
              <p className="text-sm font-semibold text-[#111827]">
                No conversations found
              </p>
              <p className="text-xs text-[#5B6472] max-w-xs mx-auto">
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
                    flex-1 flex flex-col bg-white md:m-2.5 lg:m-3 md:rounded-2xl
                    md:border md:border-[#D9E0EA] md:shadow-xs overflow-hidden h-full z-20
                    transition-all duration-300
                    ${mobileChatOpen ? "flex" : "hidden md:flex"}
                `}
      >
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-3.5 md:p-4 border-b border-[#D9E0EA] flex items-center justify-between bg-white z-10 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setMobileChatOpen(false)}
                  className="md:hidden p-1.5 -ml-1 rounded-lg text-[#5B6472] hover:bg-[#F4F7FB] transition-colors shrink-0"
                  aria-label="Back to messages"
                >
                  <ChevronLeft size={22} />
                </button>

                {/* Contact Avatar */}
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#071A4D] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden shadow-xs">
                  {activePartner?.profile_image ? (
                    <img
                      src={getFullMediaUrl(activePartner.profile_image)}
                      className="w-full h-full object-cover"
                      alt={activePartner.name || "User"}
                    />
                  ) : (
                    activePartner?.name?.[0]?.toUpperCase() || "U"
                  )}
                  {activePartner?.is_online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Contact Info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-sm font-bold text-[#111827] leading-snug truncate">
                      {activePartner?.name || "Direct Message"}
                    </h3>
                    {activePartner?.is_online && (
                      <span className="hidden sm:inline-block text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                        Active now
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5B6472] truncate">
                    {isOtherTyping ? (
                      <span className="text-[#FF6B00] font-semibold flex items-center gap-1.5">
                        <span>Typing</span>
                        <span className="inline-flex gap-0.5">
                          <span className="w-1 h-1 bg-[#FF6B00] rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1 h-1 bg-[#FF6B00] rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1 h-1 bg-[#FF6B00] rounded-full animate-bounce" />
                        </span>
                      </span>
                    ) : (
                      activePartner?.headline ||
                      activePartner?.roles?.join(" • ") ||
                      "KaamMilega Verified Member"
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {activePartner?.id && (
                  <Link
                    href={`/profile/${activePartner.id}`}
                    target="_blank"
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#071A4D] bg-[#F4F7FB] hover:bg-slate-200 rounded-lg border border-[#D9E0EA] transition-colors"
                  >
                    <span className="hidden xs:inline">Profile</span>
                    <ExternalLink size={13} />
                  </Link>
                )}

                {/* Chat Options Menu */}
                <div className="relative" ref={chatMenuRef}>
                  <button
                    onClick={() => setShowChatMenu(!showChatMenu)}
                    className="p-1.5 rounded-lg text-[#5B6472] hover:text-[#071A4D] hover:bg-[#F4F7FB] transition-colors"
                    title="Chat options"
                    aria-label="Chat options"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showChatMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-[#D9E0EA] rounded-xl shadow-lg z-30 py-1 text-xs">
                      {isBlockedByMe ? (
                        <button
                          onClick={promptUnblockUser}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <CheckCircle2 size={14} />
                          <span>Unblock user</span>
                        </button>
                      ) : (
                        <button
                          onClick={promptBlockUser}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Ban size={14} className="text-slate-500" />
                          <span>Block user</span>
                        </button>
                      )}

                      <button
                        onClick={openReportModal}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Flag size={14} className="text-amber-500" />
                        <span>Report conversation</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={() => promptDeleteConversation()}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
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
              className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-6 space-y-3.5 md:space-y-4 bg-[#F4F7FB]"
            >
              {/* Top reverse loading spinner for infinite scroll */}
              {loadingOlderMessages && (
                <div className="flex items-center justify-center py-2 animate-in fade-in">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/90 rounded-full border border-[#D9E0EA] text-xs text-[#5B6472] shadow-xs">
                    <Loader2 size={13} className="animate-spin text-[#FF6B00]" />
                    <span>Loading older messages...</span>
                  </div>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-[#5B6472] space-y-2">
                  <Loader2 size={24} className="animate-spin text-[#071A4D]" />
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border border-[#D9E0EA] shadow-xs">
                    <MessageSquare size={24} className="text-[#071A4D]" />
                  </div>
                  <p className="text-sm font-bold text-[#111827]">
                    Say hello to {activePartner?.name || "your contact"}!
                  </p>
                  <p className="text-xs text-[#5B6472] max-w-sm">
                    Send a direct message, emoji, or share a document to start
                    collaborating.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === currentUser?.id;
                  const prevMsg = messages[index - 1];
                  const showDateDivider =
                    index === 0 ||
                    new Date(msg.created_at).toDateString() !==
                      new Date(prevMsg.created_at).toDateString();

                  return (
                    <React.Fragment key={`${msg.id || "msg"}-${index}`}>
                      {showDateDivider && (
                        <div className="flex items-center justify-center my-3 sm:my-4">
                          <span className="bg-white text-[#5B6472] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#D9E0EA] shadow-xs">
                            {getDateDividerLabel(msg.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex gap-2 sm:gap-2.5 group ${isMe ? "flex-row-reverse" : ""}`}
                      >
                        {/* Mini avatar for received messages */}
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-[#071A4D] flex items-center justify-center text-white font-bold text-[10px] shrink-0 overflow-hidden mt-1">
                            {activePartner?.profile_image ? (
                              <img
                                src={getFullMediaUrl(
                                  activePartner.profile_image,
                                )}
                                className="w-full h-full object-cover"
                                alt={activePartner.name || "User"}
                              />
                            ) : (
                              activePartner?.name?.[0]?.toUpperCase() || "U"
                            )}
                          </div>
                        )}

                        {/* Action buttons on hover (Copy for all text messages, Delete for sender) */}
                        {!msg.is_deleted && !msg.isOptimistic && (
                          <div
                            className={`opacity-0 group-hover:opacity-100 transition-opacity self-center flex items-center gap-0.5 shrink-0 ${
                              isMe ? "flex-row-reverse" : "flex-row"
                            }`}
                          >
                            {/* Copy Message Button (for messages with text content) */}
                            {msg.content && (
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg)}
                                title={copiedMessageId === msg.id ? "Copied!" : "Copy message"}
                                aria-label="Copy message"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#071A4D] hover:bg-white border border-transparent hover:border-[#D9E0EA] shadow-xs transition-all"
                              >
                                {copiedMessageId === msg.id ? (
                                  <Check size={13} className="text-emerald-600 animate-in zoom-in-75" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            )}

                            {/* Delete message button (only for sender) */}
                            {isMe && (
                              <button
                                type="button"
                                onClick={() => promptDeleteMessage(msg.id)}
                                title="Delete message"
                                aria-label="Delete message"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-[#D9E0EA] shadow-xs transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}


                        <div
                          className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] ${
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Message Box */}
                          <div
                            className={`rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm shadow-xs break-words ${
                              msg.is_deleted
                                ? "bg-slate-100 text-slate-500 border border-slate-200 italic"
                                : isMe
                                ? "bg-[#071A4D] text-white rounded-tr-xs"
                                : "bg-white text-[#111827] border border-[#D9E0EA] rounded-tl-xs"
                            }`}
                          >
                            {msg.is_deleted ? (
                              <div className="flex items-center gap-1.5 py-0.5 select-none not-italic">
                                <Ban size={13} className="text-slate-400 shrink-0" />
                                <span className="text-[13px] text-slate-500 italic">This message was deleted</span>
                              </div>
                            ) : (
                              <>
                                {/* Attachment: Image */}
                                {msg.attachment_url &&
                                  (msg.attachment_type?.startsWith("image/") ||
                                    msg.attachment_url.match(
                                      /\.(jpg|jpeg|png|webp|gif)$/i,
                                    )) && (
                                    <div className="mb-2 overflow-hidden rounded-xl">
                                      <img
                                        src={getFullMediaUrl(msg.attachment_url)}
                                        alt={
                                          msg.attachment_name || "Attached image"
                                        }
                                        onClick={() =>
                                          setLightboxImage(
                                            getFullMediaUrl(msg.attachment_url),
                                          )
                                        }
                                        className="max-h-60 w-auto rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                      />
                                    </div>
                                  )}

                                {/* Attachment: File/Document */}
                                {msg.attachment_url &&
                                  !msg.attachment_type?.startsWith("image/") &&
                                  !msg.attachment_url.match(
                                    /\.(jpg|jpeg|png|webp|gif)$/i,
                                  ) && (
                                    <a
                                      href={getFullMediaUrl(msg.attachment_url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={msg.attachment_name || "document"}
                                      className={`flex items-center gap-2.5 p-2 mb-2 rounded-xl border transition-colors ${
                                        isMe
                                          ? "bg-white/10 hover:bg-white/20 border-white/20 text-white"
                                          : "bg-[#F4F7FB] hover:bg-slate-200 border-[#D9E0EA] text-[#071A4D]"
                                      }`}
                                    >
                                      <div
                                        className={`p-2 rounded-lg ${
                                          isMe
                                            ? "bg-white/20"
                                            : "bg-white border border-[#D9E0EA]"
                                        }`}
                                      >
                                        <FileText size={18} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold truncate">
                                          {msg.attachment_name ||
                                            "Attached Document"}
                                        </p>
                                        {msg.attachment_size ? (
                                          <p
                                            className={`text-[10px] ${
                                              isMe
                                                ? "text-white/70"
                                                : "text-[#5B6472]"
                                            }`}
                                          >
                                            {formatFileSize(msg.attachment_size)}
                                          </p>
                                        ) : null}
                                      </div>
                                      <Download size={15} className="shrink-0" />
                                    </a>
                                  )}

                                {/* Text Content */}
                                {msg.content && (
                                  <p className="whitespace-pre-wrap break-words leading-relaxed text-[13.5px]">
                                    {msg.content}
                                  </p>
                                )}
                              </>
                            )}

                            {/* Time & Read Status */}
                            <div
                              className={`flex items-center gap-1.5 justify-end mt-1 text-[10px] select-none ${
                                msg.is_deleted
                                  ? "text-slate-400"
                                  : isMe
                                  ? "text-white/80"
                                  : "text-[#5B6472]"
                              }`}
                            >
                              <span className="leading-none">
                                {formatMessageTime(msg.created_at)}
                              </span>
                              {isMe && !msg.is_deleted && (
                                <span
                                  className="inline-flex items-center justify-center shrink-0 pl-0.5 pr-0.5"
                                  style={{ minWidth: "18px" }}
                                >
                                  {msg.isOptimistic ? (
                                    <Clock
                                      size={12}
                                      className="text-white/70"
                                    />
                                  ) : msg.is_read ? (
                                    <span
                                      title="Read"
                                      className="inline-flex items-center"
                                    >
                                      <CheckCheck
                                        size={16}
                                        strokeWidth={2.4}
                                        className="text-[#38BDF8] shrink-0"
                                      />
                                    </span>
                                  ) : (
                                    <span
                                      title="Sent"
                                      className="inline-flex items-center"
                                    >
                                      <Check
                                        size={14}
                                        strokeWidth={2.2}
                                        className="text-white/70 shrink-0"
                                      />
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* Typing Indicator Bubble */}
              {isOtherTyping && (
                <div className="flex gap-2.5 items-end">
                  <div className="w-7 h-7 rounded-full bg-[#071A4D] flex items-center justify-center text-white font-bold text-[10px] shrink-0 overflow-hidden">
                    {activePartner?.profile_image ? (
                      <img
                        src={getFullMediaUrl(activePartner.profile_image)}
                        className="w-full h-full object-cover"
                        alt={activePartner.name || "User"}
                      />
                    ) : (
                      activePartner?.name?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div className="bg-white border border-[#D9E0EA] rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#5B6472] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#5B6472] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#5B6472] rounded-full animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-2.5 sm:p-3 md:p-4 bg-white border-t border-[#D9E0EA] space-y-2 shrink-0 relative">
              {/* Pending Attachment Draft Preview */}
              {pendingAttachment && (
                <div className="flex items-center gap-3 p-2 bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl">
                  {pendingAttachment.isImage && pendingAttachment.previewUrl ? (
                    <img
                      src={pendingAttachment.previewUrl}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-lg border border-[#D9E0EA]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white border border-[#D9E0EA] flex items-center justify-center text-[#071A4D]">
                      <FileText size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#111827] truncate">
                      {pendingAttachment.name}
                    </p>
                    <p className="text-[10px] text-[#5B6472]">
                      {pendingAttachment.sizeFormatted}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removePendingAttachment}
                    className="p-1 rounded-lg text-[#5B6472] hover:text-red-500 hover:bg-white transition-colors"
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Dynamic Comprehensive Emoji Picker Popover */}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-16 sm:bottom-20 left-3 sm:left-4 z-50 shadow-2xl rounded-2xl overflow-hidden border border-[#D9E0EA] bg-white animate-in fade-in zoom-in-95 duration-150"
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      insertEmoji(emojiData.emoji);
                    }}
                    autoFocusSearch={false}
                    lazyLoadEmojis={true}
                    previewConfig={{ showPreview: false }}
                    width={330}
                    height={380}
                  />
                </div>
              )}


              {/* Input Bar or Blocked Notice (F59) */}
              {isBlockedByMe ? (
                <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-700 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Ban size={17} className="text-slate-500 shrink-0" />
                    <span className="truncate font-medium">You have blocked this user.</span>
                  </div>
                  <button
                    type="button"
                    onClick={promptUnblockUser}
                    className="px-3.5 py-1.5 font-semibold text-xs text-[#071A4D] bg-white hover:bg-slate-50 rounded-xl border border-slate-300 transition-colors shrink-0 shadow-xs"
                  >
                    Unblock
                  </button>
                </div>
              ) : isBlockedByOther ? (
                <div className="flex items-center gap-2.5 p-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-600 shadow-xs">
                  <Ban size={17} className="text-slate-400 shrink-0" />
                  <span className="font-medium">You cannot send messages to this conversation right now.</span>
                </div>
              ) : (
                /* Input Bar Capsule */
                <div className="flex items-end gap-1.5 sm:gap-2 bg-[#F4F7FB] rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[#D9E0EA] focus-within:border-[#071A4D] focus-within:bg-white transition-all">
                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image or file"
                    disabled={isUploading}
                    className="p-1.5 sm:p-2 rounded-xl text-[#5B6472] hover:text-[#071A4D] hover:bg-slate-200/60 transition-colors shrink-0 mb-0.5"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Emoji Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    title="Insert emoji"
                    className={`p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 mb-0.5 ${
                      showEmojiPicker
                        ? "text-[#FF6B00] bg-orange-50"
                        : "text-[#5B6472] hover:text-[#071A4D] hover:bg-slate-200/60"
                    }`}
                  >
                    <Smile size={19} />
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
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm text-[#111827] placeholder-[#5B6472] resize-none py-1.5 min-h-[38px] max-h-28 leading-normal"
                    style={{ scrollbarWidth: "none" }}
                  />

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={
                      (!inputText.trim() && !pendingAttachment) || isUploading
                    }
                    className={`p-2 sm:p-2.5 rounded-xl transition-all shrink-0 mb-0.5 flex items-center justify-center ${
                      (inputText.trim() || pendingAttachment) && !isUploading
                        ? "bg-[#071A4D] text-white hover:bg-[#0B1F52] shadow-sm cursor-pointer"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Desktop Empty State */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-white h-full">
            <div className="w-20 h-20 bg-[#F4F7FB] border border-[#D9E0EA] rounded-full flex items-center justify-center mb-4 text-[#071A4D] shadow-xs">
              <Send size={32} className="ml-1" />
            </div>
            <h2 className="text-xl font-bold text-[#071A4D] font-poppins">
              Select a conversation
            </h2>
            <p className="text-sm text-[#5B6472] mt-1.5 max-w-sm">
              Pick an existing conversation from the left sidebar or search for
              a candidate or employer to send a message.
            </p>
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs cursor-zoom-out"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxImage}
            alt="Enlarged view"
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
      {/* ── PROFESSIONAL IN-APP CONFIRMATION POPUP MODAL ── */}
      {confirmModal.isOpen && (
        <div
          onClick={() =>
            !isDeleting &&
            setConfirmModal((prev) => ({ ...prev, isOpen: false }))
          }
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-[#D9E0EA] space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmModal.type === "unblock"
                    ? "bg-emerald-50 text-emerald-600"
                    : confirmModal.type === "block"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-red-50 text-red-600"
                }`}
              >
                {confirmModal.type === "unblock" ? (
                  <CheckCircle2 size={20} />
                ) : confirmModal.type === "block" ? (
                  <Ban size={20} />
                ) : (
                  <Trash2 size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[#111827]">
                  {confirmModal.title}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#5B6472] leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] border border-[#D9E0EA] transition-colors"
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
                      ? "bg-slate-800 hover:bg-slate-900"
                      : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#D9E0EA] space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Flag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827]">
                    Report conversation
                  </h3>
                  <p className="text-xs text-[#5B6472]">
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
                <X size={18} />
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
                  className="w-full text-xs sm:text-sm bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#071A4D] focus:bg-white transition-all"
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
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
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
                  className="w-full text-xs sm:text-sm bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#071A4D] focus:bg-white resize-none transition-all"
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
                  className="mt-0.5 rounded border-slate-300 text-[#071A4D] focus:ring-[#071A4D]"
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
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] border border-[#D9E0EA] transition-colors"
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
                    <Loader2 size={15} className="animate-spin" />
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
    </div>
  );
}

// Fallback skeleton while Suspense resolves useSearchParams
function ChatLoadingFallback() {
  return (
    <div className="flex h-[calc(100dvh-64px)] items-center justify-center bg-[#F4F7FB]">
      <div className="text-center space-y-3">
        <Loader2 size={32} className="animate-spin text-[#071A4D] mx-auto" />
        <p className="text-sm font-semibold text-[#071A4D]">
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
