'use client'

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Users, Calendar, Award, Users2, BookOpen, X, MessageSquare, UserPlus, MapPin } from 'lucide-react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { ImpressionWrapper } from '@/lib/telemetry';

// --- Types ---
interface User {
    id: string;
    _id?: string;
    name: string;
    profile_image?: string;
    roles: string[];
    headline?: string;
    city?: string;
}

interface ConnectionRequest {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: string;
    created_at: string;
}

interface EnrichedInvitation extends ConnectionRequest {
    senderInfo: User;
}

const NetworkPage = () => {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [invitations, setInvitations] = useState<EnrichedInvitation[]>([]);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [connections, setConnections] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // 1. Get User Profile
                let userObj = null;
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser);
                        userObj = { ...parsed, id: parsed.id || parsed._id };
                        setCurrentUser(userObj);
                    } catch (e) {}
                }
                
                if (!userObj) {
                    const profile = await api.get('/user/profile') as any;
                    userObj = { ...profile, id: profile.id || profile._id };
                    setCurrentUser(userObj);
                }

                if (!userObj) return;

                // 2. Fetch pending invitations
                const pendingRes = await api.get('/network/pending') as ConnectionRequest[];
                const enrichedInvs = await Promise.all(
                    (pendingRes || []).map(async (inv) => {
                        try {
                            const sender = await api.get(`/user/${inv.sender_id}`) as User;
                            return { ...inv, senderInfo: sender };
                        } catch {
                            return null;
                        }
                    })
                );
                setInvitations(enrichedInvs.filter(i => i !== null) as EnrichedInvitation[]);

                // 3. Fetch connections
                const connsRes = await api.get('/network/connections') as string[];
                setConnections(connsRes || []);

                // 4. Fetch suggestions (Generic users right now)
                const usersRes = await api.get('/admin/users') as any[]; 
                // Filter out self and connected/pending users if needed
                const filteredSearch = (usersRes || []).filter(u => 
                    u.id !== userObj.id && 
                    u._id !== userObj.id &&
                    !connsRes?.includes(u.id || u._id)
                );
                // Grab up to 8
                setSuggestions(filteredSearch.slice(0, 8).map(u => ({...u, id: u.id || u._id})));

            } catch (error) {
                console.error("Failed to load network data", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    const handleAccept = async (senderId: string) => {
        try {
            await api.post('/network/accept', { sender_id: senderId });
            setInvitations(prev => prev.filter(inv => inv.sender_id !== senderId));
            setConnections(prev => [...prev, senderId]);
        } catch (e) {
            console.error("Failed to accept", e);
        }
    };

    const handleIgnore = async (senderId: string) => {
        try {
            await api.post('/network/ignore', { sender_id: senderId });
            setInvitations(prev => prev.filter(inv => inv.sender_id !== senderId));
        } catch (e) {
            console.error("Failed to ignore", e);
        }
    };

    const handleConnect = async (userId: string) => {
        try {
            await api.post('/network/connect', { receiver_id: userId });
            // Optimistically remove from suggestions
            setSuggestions(prev => prev.filter(s => s.id !== userId));
            alert("Invitation sent!");
        } catch (e: any) {
            console.error("Failed to connect", e);
            alert(e.message || "Could not send invitation");
        }
    };

    const handleChat = (userId: string) => {
        router.push(`/chat?userId=${userId}`); // App level handles starting the actual chat
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* --- LEFT SIDEBAR --- */}
                <aside className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <h2 className="font-semibold text-gray-800 mb-4">Manage My Network</h2>
                        <nav className="space-y-1">
                            <SidebarItem icon={<Users size={18} />} label="Connections" count={connections.length} href="/network/connections" />
                            <SidebarItem icon={<Calendar size={18} />} label="Events" count={2} href="/user/events" />
                            <SidebarItem icon={<Award size={18} />} label="Experts" count={5} href="/network/experts" />
                            <SidebarItem icon={<Users2 size={18} />} label="Groups" count={1} href="/network/groups" />
                        </nav>
                    </div>

                    <div className="bg-white rounded-xl h-64 flex items-center justify-center border border-dashed border-gray-300 text-gray-400">
                        Ad Banner
                    </div>
                </aside>

                {/* --- MAIN CONTENT --- */}
                <main className="lg:col-span-9 space-y-8">

                    {/* Invitations Section */}
                    {invitations.length > 0 && (
                        <section className="bg-white rounded-2xl shadow-xs p-6 overflow-hidden border border-slate-200/80">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold text-slate-900">Invitations</h2>
                                <button className="text-km-primary font-bold text-sm hover:underline">See All</button>
                            </div>
                            <div className="space-y-4">
                                {invitations.map((inv) => (
                                    <InvitationRow 
                                        key={inv.id} 
                                        invitation={inv} 
                                        onAccept={() => handleAccept(inv.sender_id)}
                                        onIgnore={() => handleIgnore(inv.sender_id)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* People You May Know (Grid) */}
                    <section className="bg-white rounded-2xl shadow-xs p-6 border border-slate-200/80">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-slate-900">People You May Know</h2>
                            <button className="text-km-primary font-bold text-sm hover:underline">See All</button>
                        </div>
                        
                        {suggestions.length === 0 ? (
                            <p className="text-slate-500 text-xs py-8 text-center bg-slate-50 rounded-xl font-medium">No suggestions right now. Invite more people!</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {suggestions.map((user) => (
                                    <ProfileCard 
                                        key={user.id} 
                                        person={user} 
                                        onConnect={() => handleConnect(user.id)}
                                        onChat={() => handleChat(user.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                </main>
            </div>
        </div>
    );
};

// --- Sub-Components ---

const SidebarItem = ({ icon, label, count, href }: { icon: React.ReactNode, label: string, count: number, href: string }) => (
    <Link href={href} className="flex items-center justify-between p-2.5 hover:bg-blue-50/60 rounded-xl cursor-pointer transition-colors group">
        <div className="flex items-center gap-3 text-slate-600 group-hover:text-km-primary">
            {icon}
            <span className="text-xs font-bold">{label}</span>
        </div>
        <span className="text-xs text-slate-400 font-bold group-hover:text-km-primary">{count}</span>
    </Link>
);

const InvitationRow = ({ invitation, onAccept, onIgnore }: { invitation: EnrichedInvitation, onAccept: () => void, onIgnore: () => void }) => {
    const { senderInfo } = invitation;
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 px-3 rounded-xl transition-colors">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-linear-to-br from-slate-950 via-km-primary-dark to-slate-950 text-white font-bold rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-700 shadow-xs">
                    {senderInfo.profile_image ? (
                        <img src={senderInfo.profile_image} alt={senderInfo.name} className="w-full h-full object-cover" />
                    ) : (
                        senderInfo.name?.[0] || 'U'
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-sm text-slate-900">{senderInfo.name || 'Unknown User'}</h4>
                    <p className="text-xs text-slate-500 font-medium">{senderInfo.headline || senderInfo.roles?.[0] || 'Member'}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={onIgnore} className="text-slate-500 text-xs font-bold hover:text-slate-900 transition-colors">Ignore</button>
                <button onClick={onAccept} className="bg-km-primary hover:bg-km-primary-dark text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs">
                    Accept
                </button>
            </div>
        </div>
    );
};

const ProfileCard = ({ person, onConnect, onChat }: { person: User, onConnect: () => void, onChat: () => void }) => {
    const authorId = person.id || person._id;
    return (
        <ImpressionWrapper authorId={authorId} entityId={`network:${authorId}`} className="h-full">
            <div className="relative border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center text-center group hover:shadow-md hover:border-blue-200 transition-all bg-white h-full">
                <button className="absolute top-3 right-3 text-slate-300 hover:text-slate-500 transition-colors">
                    <X size={16} />
                </button>
                <div className="w-16 h-16 bg-linear-to-br from-slate-950 via-km-primary-dark to-slate-950 text-white font-bold rounded-2xl mb-3 overflow-hidden flex items-center justify-center shadow-xs border border-slate-700">
                    {person.profile_image ? (
                            <img src={person.profile_image} alt={person.name} className="w-full h-full object-cover" />
                        ) : (
                            person.name?.[0] || 'U'
                    )}
                </div>
                <h4 className="font-bold text-sm text-slate-900 line-clamp-1 h-5">{person.name || 'Unknown User'}</h4>
                <p className="text-[11px] text-slate-500 font-medium mb-1 line-clamp-2 h-7">{person.headline || person.roles?.join(', ') || 'Member'}</p>
                <p className="text-[10px] text-slate-400 font-semibold mb-4 h-4 flex items-center justify-center gap-1">
                    {person.city ? (
                        <>
                            <MapPin size={10} className="text-km-primary" />
                            <span>{person.city}</span>
                        </>
                    ) : ''}
                </p>

                <div className="w-full space-y-2 mt-auto">
                    {(() => {
                        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                        let currentUserId = '';
                        if (storedUser) {
                            try {
                                const parsed = JSON.parse(storedUser);
                                currentUserId = parsed.id || parsed._id;
                            } catch (e) {}
                        }
                        const isSelf = (person.id === currentUserId || person._id === currentUserId);
                        
                        return !isSelf && (
                            <>
                                <button 
                                    onClick={onConnect}
                                    className="w-full flex items-center justify-center gap-2 bg-km-primary hover:bg-km-primary-dark text-white py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                                    <UserPlus size={14} /> Connect
                                </button>
                                <button 
                                    onClick={onChat}
                                    className="w-full flex items-center justify-center gap-2 border border-km-primary text-km-primary py-2 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors cursor-pointer">
                                    <MessageSquare size={14} /> Message
                                </button>
                            </>
                        );
                    })()}
                </div>
            </div>
        </ImpressionWrapper>
    );
};

export default NetworkPage;