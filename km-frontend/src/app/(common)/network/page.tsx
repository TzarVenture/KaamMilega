'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, MapPin } from 'lucide-react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/ui/UserAvatar';
import ProfileConnectionCard from '@/components/network/ProfileConnectionCard';

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
                let userObj: any = null;
                const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
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

                // 4. Fetch suggestions
                const usersRes = await api.get('/admin/users') as any[]; 
                const filteredSearch = (usersRes || []).filter(u => 
                    u.id !== userObj.id && 
                    u._id !== userObj.id &&
                    !connsRes?.includes(u.id || u._id)
                );
                setSuggestions(filteredSearch.slice(0, 12).map(u => ({ ...u, id: u.id || u._id })));

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
            setSuggestions(prev => prev.filter(s => s.id !== userId));
            alert("Invitation sent successfully!");
        } catch (e: any) {
            console.error("Failed to connect", e);
            alert(e?.response?.data?.error || e.message || "Could not send invitation");
        }
    };

    const handleChat = (userId: string) => {
        router.push(`/chat?userId=${userId}`);
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 shadow-xs">
                    <div className="h-5 w-44 bg-slate-200 rounded-lg mb-2" />
                    <div className="h-3 w-64 bg-slate-100 rounded-lg mb-6" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-64 bg-[#F4F7FB]/60 border border-[#D9E0EA] rounded-2xl p-5 flex flex-col items-center justify-between">
                                <div className="w-16 h-16 rounded-full bg-slate-200" />
                                <div className="h-4 w-28 bg-slate-200 rounded mt-3" />
                                <div className="h-3 w-36 bg-slate-100 rounded mt-1" />
                                <div className="w-full space-y-2 mt-4">
                                    <div className="h-8 bg-slate-200 rounded-xl w-full" />
                                    <div className="h-8 bg-slate-100 rounded-xl w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Invitations Section */}
            {invitations.length > 0 && (
                <section className="bg-white rounded-2xl shadow-xs p-5 sm:p-6 border border-[#D9E0EA]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-[#D9E0EA]/70">
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                                Pending Invitations
                            </h2>
                            <p className="text-xs text-[#5B6472] font-medium mt-0.5">
                                People who requested to connect with you
                            </p>
                        </div>
                        <span className="bg-[#FF6B00]/10 text-[#FF6B00] font-bold text-xs px-3 py-1 rounded-full border border-[#FF6B00]/20 self-start sm:self-auto">
                            {invitations.length} {invitations.length === 1 ? 'Request' : 'Requests'}
                        </span>
                    </div>

                    <div className="divide-y divide-[#D9E0EA]/60">
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

            {/* People You May Know Grid */}
            <section className="bg-white rounded-2xl shadow-xs p-5 sm:p-6 border border-[#D9E0EA]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-[#D9E0EA]/70">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                            People You May Know
                        </h2>
                        <p className="text-xs text-[#5B6472] font-medium mt-0.5">
                            Expand your network across industry peers and career mentors
                        </p>
                    </div>
                    <Link 
                        href="/network/connections"
                        className="text-[#071A4D] hover:text-[#0B5ED7] font-semibold text-xs transition-colors self-start sm:self-auto"
                    >
                        View Connections ({connections.length}) →
                    </Link>
                </div>
                
                {suggestions.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-[#F4F7FB]/60 rounded-xl border border-dashed border-[#D9E0EA]">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#071A4D] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                            <Users size={22} />
                        </div>
                        <h3 className="text-sm font-bold text-[#111827] mb-1">No New Suggestions Right Now</h3>
                        <p className="text-xs text-[#5B6472] max-w-sm mx-auto leading-relaxed">
                            Check back soon as new candidates and industry experts join the platform daily.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {suggestions.map((user) => (
                            <ProfileConnectionCard 
                                key={user.id || user._id} 
                                user={user}
                                variant="grid"
                                actionType="discover"
                                entityType="connect"
                                onConnect={() => handleConnect(user.id || user._id || '')}
                                onChat={() => handleChat(user.id || user._id || '')}
                                onDismiss={(id) => setSuggestions(prev => prev.filter(s => (s.id || s._id) !== id))}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

// --- Sub-Components ---

const InvitationRow = ({
    invitation,
    onAccept,
    onIgnore,
}: {
    invitation: EnrichedInvitation;
    onAccept: () => void;
    onIgnore: () => void;
}) => {
    const { senderInfo } = invitation;
    const name = senderInfo.name || 'Verified Member';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 py-4 first:pt-0 last:pb-0 hover:bg-[#F4F7FB]/40 px-2 sm:px-3 rounded-xl transition-colors">
            <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    <UserAvatar src={senderInfo.profile_image} name={name} />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#111827] leading-snug truncate">
                        {name}
                    </h4>
                    <p className="text-xs text-[#5B6472] font-medium line-clamp-1 truncate">
                        {senderInfo.headline || senderInfo.roles?.[0] || 'Member'}
                    </p>
                    {senderInfo.city && (
                        <div className="flex items-center gap-1 text-[11px] text-[#5B6472] font-semibold mt-0.5">
                            <MapPin size={11} className="text-[#071A4D] shrink-0" />
                            <span className="truncate">{senderInfo.city}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto justify-end">
                <button 
                    type="button"
                    onClick={onIgnore} 
                    className="text-[#5B6472] text-xs font-semibold hover:text-[#111827] px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all duration-150 cursor-pointer active:scale-[0.98]"
                >
                    Ignore
                </button>
                <button 
                    type="button"
                    onClick={onAccept} 
                    className="bg-[#071A4D] hover:bg-[#0B1F52] text-white px-5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 shadow-xs active:scale-[0.98] cursor-pointer"
                >
                    Accept
                </button>
            </div>
        </div>
    );
};

export default NetworkPage;