'use client'
import React, { useState, useEffect, useRef } from 'react';
import { Search, Edit, MoreHorizontal, Send, ChevronLeft, Check } from 'lucide-react';
import api from '@/lib/axios';

// --- Types ---
interface User {
    id: string;
    name: string;
    profile_image?: string;
    roles: string[];
    headline?: string;
}

interface Conversation {
    id: string;
    participants: string[];
    last_message: string;
    last_message_id?: string;
    updated_at: string;
    otherUser?: User;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

// --- Main Page ---
const ChatPage = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<Conversation | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [inputText, setInputText] = useState('');
    const [initialChatChecked, setInitialChatChecked] = useState(false);

    // Mobile: show chat panel when a conversation is selected
    const [mobileChatOpen, setMobileChatOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeChatRef = useRef<Conversation | null>(null);
    const prevMessagesLength = useRef(0);
    const prevActiveChatId = useRef<string | null>(null);

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    // Initial Load
    useEffect(() => {
        const loadInitialData = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsed = JSON.parse(storedUser);
                    const userId = parsed.id || parsed._id;
                    setCurrentUser({ ...parsed, id: userId });
                    fetchConversations(userId);
                } catch (e) {
                    console.error("Failed to parse user", e);
                }
            } else {
                try {
                    const profile = await api.get('/user/profile') as any;
                    setCurrentUser({ ...profile, id: profile.id || profile._id });
                    fetchConversations(profile.id || profile._id);
                } catch (e) {
                    console.error("Not logged in");
                }
            }
        };
        loadInitialData();
    }, []);

    const fetchConversations = async (myId: string) => {
        try {
            const res = await api.get('/chats') as Conversation[];
            const enrichedCtxs = await Promise.all(res.map(async (c) => {
                const otherId = c.participants.find(p => p !== myId);
                if (!otherId) return c;
                try {
                    const user = await api.get(`/user/${otherId}`) as User;
                    return { ...c, otherUser: user };
                } catch (e) {
                    return c;
                }
            }));
            setConversations(enrichedCtxs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
        } catch (e) {
            console.error("Failed to fetch conversations", e);
        }
    };

    useEffect(() => {
        if (!activeChat) return;
        if (activeChat.id.startsWith('temp-')) {
            setMessages([]);
            return;
        }
        fetchMessages(activeChat.id);
    }, [activeChat]);

    // WebSocket
    useEffect(() => {
        if (!currentUser) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.NEXT_PUBLIC_API_URL
            ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
            : window.location.host;

        let ws: WebSocket;
        let reconnectTimer: NodeJS.Timeout;

        const connectWS = () => {
            const token = localStorage.getItem('token') || '';
            ws = new WebSocket(`${protocol}//${host}/api/ws/chats?token=${token}`);

            ws.onopen = () => {
                fetchConversations(currentUser.id);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'NEW_MESSAGE') {
                        fetchConversations(currentUser.id);
                        const currentActive = activeChatRef.current;
                        if (currentActive && data.message.conversation_id === currentActive.id) {
                            setMessages(prev => {
                                if (prev.find(m => m.id === data.message.id)) return prev;
                                return [...prev, data.message];
                            });
                        }
                    }
                } catch (e) {
                    console.error("Invalid WS payload", e);
                }
            };

            ws.onclose = () => {
                reconnectTimer = setTimeout(connectWS, 3000);
            };

            ws.onerror = (err) => {
                console.error("Chat WS Error", err);
            };
        };

        connectWS();

        return () => {
            clearTimeout(reconnectTimer);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [currentUser]);

    const fetchMessages = async (chatId: string) => {
        if (chatId.startsWith('temp-')) return;
        try {
            const res = await api.get(`/chats/${chatId}/messages`) as Message[];
            setMessages(res);
        } catch (e) {
            console.error("Failed to fetch messages", e);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || !activeChat || !currentUser) return;
        const otherId = activeChat.participants.find(p => p !== currentUser.id);
        if (!otherId) return;

        try {
            await api.post('/chats/messages', { receiver_id: otherId, content: inputText });
            setInputText('');
            if (activeChat.id.startsWith('temp-')) {
                await fetchConversations(currentUser.id);
            } else {
                fetchMessages(activeChat.id);
                fetchConversations(currentUser.id);
            }
        } catch (e) {
            console.error("Failed to send message", e);
        }
    };

    const handleSearchUsers = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setUserSearchResults([]);
            return;
        }
        setIsSearchingUsers(true);
        try {
            const res = await api.get(`/user/search?q=${query}`) as User[];
            setUserSearchResults(res || []);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const startConversation = async (user: User) => {
        if (!currentUser) return;
        const existing = conversations.find(c => c.participants.includes(user.id));
        if (existing) {
            setActiveChat(existing);
        } else {
            const newChat: Conversation = {
                id: 'temp-' + user.id,
                participants: [currentUser.id, user.id],
                last_message: '',
                updated_at: new Date().toISOString(),
                otherUser: user,
            };
            setActiveChat(newChat);
            setMessages([]);
        }
        setSearchQuery('');
        setUserSearchResults([]);
        setMobileChatOpen(true); // open chat panel on mobile
    };

    // Check URL params
    useEffect(() => {
        const checkInitialChat = async () => {
            if (!currentUser || initialChatChecked) return;
            const params = new URLSearchParams(window.location.search);
            const newUserId = params.get('userId');
            if (newUserId && newUserId !== currentUser.id) {
                const existing = conversations.find(c => c.participants.includes(newUserId));
                if (existing) {
                    setActiveChat(existing);
                    setMobileChatOpen(true);
                } else {
                    try {
                        const user = await api.get(`/user/${newUserId}`) as User;
                        startConversation(user);
                    } catch (e) {
                        console.error("Failed to start initial chat from URL", e);
                    }
                }
            }
            setInitialChatChecked(true);
        };
        checkInitialChat();
    }, [currentUser, conversations, initialChatChecked]);

    // Upgrade temp chat
    useEffect(() => {
        if (activeChat && activeChat.id.startsWith('temp-') && currentUser) {
            const otherId = activeChat.participants.find((p: string) => p !== currentUser.id);
            if (otherId) {
                const realChat = conversations.find(c => c.participants.includes(otherId) && !c.id.startsWith('temp-'));
                if (realChat) setActiveChat(realChat);
            }
        }
    }, [conversations, activeChat, currentUser]);

    // Scroll to bottom
    useEffect(() => {
        if (activeChat && activeChat.id !== prevActiveChatId.current) {
            prevActiveChatId.current = activeChat.id;
            prevMessagesLength.current = messages.length;
            messagesEndRef.current?.scrollIntoView();
        } else if (messages.length > prevMessagesLength.current) {
            prevMessagesLength.current = messages.length;
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        } else {
            prevMessagesLength.current = messages.length;
        }
    }, [messages, activeChat]);

    const handleSelectChat = (chat: Conversation) => {
        setActiveChat(chat);
        setMobileChatOpen(true);
    };

    const handleBackToList = () => {
        setMobileChatOpen(false);
    };

    return (
        // Full viewport height minus the navbar (assumed ~64px)
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden relative">

            {/* ── SIDEBAR / CONVERSATION LIST ── */}
            {/* On mobile: shown by default, slides out when a chat opens */}
            <aside
                className={`
                    absolute inset-0 z-10 md:static md:z-auto
                    w-full md:w-80 lg:w-96 bg-white border-r border-gray-100
                    flex flex-col h-full
                    transition-transform duration-300 ease-in-out
                    ${mobileChatOpen ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
                `}
            >
                {/* Header */}
                <div className="p-4 space-y-3 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
                        <div className="flex gap-2">
                            <MoreHorizontal className="text-gray-400 cursor-pointer hover:text-gray-600" size={20} />
                            <Edit className="text-gray-400 cursor-pointer hover:text-gray-600" size={20} />
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            value={searchQuery}
                            onChange={(e) => handleSearchUsers(e.target.value)}
                            className="w-full bg-gray-50 rounded-xl py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-purple-200 outline-none border border-gray-100"
                            placeholder="Search people..."
                        />

                        {/* Search Results Dropdown */}
                        {searchQuery && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white shadow-xl rounded-xl border border-gray-100 max-h-56 overflow-y-auto">
                                {isSearchingUsers ? (
                                    <div className="p-4 text-center text-sm text-gray-400">Searching…</div>
                                ) : userSearchResults.length > 0 ? (
                                    userSearchResults.map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => startConversation(u)}
                                            className="p-3 hover:bg-purple-50 cursor-pointer flex items-center gap-3"
                                        >
                                            <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs shrink-0 overflow-hidden">
                                                {u.profile_image
                                                    ? <img src={u.profile_image} className="w-full h-full object-cover" alt={u.name} />
                                                    : u.name[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{u.name}</p>
                                                <p className="text-xs text-gray-400 truncate">{u.roles?.join(', ')}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-gray-400">No users found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Recent Chats</h3>
                        <div className="space-y-0.5">
                            {conversations.map(chat => (
                                <ChatListItem
                                    key={chat.id}
                                    active={activeChat?.id === chat.id}
                                    name={chat.otherUser?.name || 'Unknown'}
                                    message={chat.last_message || 'No messages yet'}
                                    date={new Date(chat.updated_at).toLocaleDateString()}
                                    onClick={() => handleSelectChat(chat)}
                                    user={chat.otherUser}
                                />
                            ))}
                            {conversations.length === 0 && (
                                <p className="text-center text-xs text-gray-400 py-8">No conversations yet.<br />Search above to start one.</p>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── MAIN CHAT PANEL ── */}
            {/* On mobile: slides in when a chat is open */}
            <main
                className={`
                    absolute inset-0 z-20 md:static md:z-auto
                    flex-1 flex flex-col bg-white md:m-3 md:rounded-2xl
                    md:shadow-sm md:border md:border-gray-100 overflow-hidden
                    transition-transform duration-300 ease-in-out
                    ${mobileChatOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}
            >
                {activeChat ? (
                    <>
                        {/* Chat Header — includes back button on mobile */}
                        <ChatHeader
                            name={activeChat.otherUser?.name || 'Unknown User'}
                            designation={activeChat.otherUser?.roles?.join(' • ') || 'User'}
                            avatar={activeChat.otherUser?.profile_image}
                            onBack={handleBackToList}
                        />

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4 bg-slate-50">
                            {messages.map((msg, i) => {
                                const isMe = msg.sender_id === currentUser?.id;
                                const showDate = i === 0 || new Date(messages[i - 1].created_at).getDate() !== new Date(msg.created_at).getDate();
                                return (
                                    <React.Fragment key={msg.id}>
                                        {showDate && (
                                            <div className="text-center text-xs text-gray-400 my-2">
                                                {new Date(msg.created_at).toLocaleDateString()}
                                            </div>
                                        )}
                                        <MessageBubble
                                            isMe={isMe}
                                            name={isMe ? 'You' : (activeChat.otherUser?.name || 'User')}
                                            text={msg.content}
                                            time={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            avatar={isMe ? currentUser?.profile_image : activeChat.otherUser?.profile_image}
                                        />
                                    </React.Fragment>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 md:p-4 bg-white border-t border-gray-100">
                            <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-4 py-2 border border-transparent focus-within:bg-white focus-within:border-purple-200 transition-all">
                                <textarea
                                    rows={1}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Write a message..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none py-1.5 outline-none max-h-32"
                                    style={{ scrollbarWidth: 'none' }}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputText.trim()}
                                    className={`p-2 rounded-full transition-colors shrink-0 mb-0.5 ${inputText.trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400'}`}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    // Empty state — only visible on desktop since mobile shows sidebar
                    <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-400">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Send size={36} className="text-gray-300 ml-1 mt-1" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-600">Your Messages</h2>
                        <p className="text-sm text-center mt-1 max-w-xs">
                            Select a chat or search for someone to start a conversation.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

// --- Sub-Components ---

const ChatListItem = ({ name, message, date, active, onClick, user }: any) => (
    <div
        onClick={onClick}
        className={`p-3 rounded-xl flex gap-3 cursor-pointer transition-all ${active ? 'bg-purple-50 border border-purple-100' : 'hover:bg-gray-50 border border-transparent'}`}
    >
        <div className="relative w-11 h-11 bg-purple-100 rounded-full shrink-0 flex items-center justify-center text-purple-700 font-bold overflow-hidden">
            {user?.profile_image
                ? <img src={user.profile_image} className="w-full h-full object-cover" alt={name} />
                : name[0]}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
                <h4 className={`text-sm font-bold truncate ${active ? 'text-purple-900' : 'text-gray-800'}`}>{name}</h4>
                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 mt-0.5">{date}</span>
            </div>
            <p className={`text-xs truncate mt-0.5 ${active ? 'text-purple-600' : 'text-gray-500'}`}>{message}</p>
        </div>
    </div>
);

const ChatHeader = ({ name, designation, avatar, onBack }: any) => (
    <div className="p-3 md:p-4 border-b border-gray-100 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
            {/* Back button — mobile only */}
            <button
                onClick={onBack}
                className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                aria-label="Back to conversations"
            >
                <ChevronLeft size={22} />
            </button>

            <div className="relative w-9 h-9 md:w-10 md:h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold overflow-hidden shrink-0">
                {avatar
                    ? <img src={avatar} className="w-full h-full object-cover" alt={name} />
                    : name[0]}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">{name}</h3>
                <p className="text-[10px] text-gray-400">{designation}</p>
            </div>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
            <MoreHorizontal size={20} />
        </button>
    </div>
);

const MessageBubble = ({ name, text, time, isMe, avatar }: any) => (
    <div className={`flex gap-2 md:gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${isMe ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
            {avatar
                ? <img src={avatar} className="w-full h-full object-cover" alt={name} />
                : name[0]}
        </div>
        <div className={`flex flex-col max-w-[75%] md:max-w-sm ${isMe ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs font-bold text-gray-700">{name}</span>
                <span className="text-[10px] text-gray-400">{time}</span>
            </div>
            <div className={`px-3 md:px-4 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none shadow-sm'}`}>
                {text}
            </div>
        </div>
    </div>
);

export default ChatPage;