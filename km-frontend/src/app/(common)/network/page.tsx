'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, BriefcaseIcon, MapPinIcon, MedalIcon, TargetIcon, UsersThreeIcon, UsersIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/ui/UserAvatar';
import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';

// --- Types ---
interface User extends ProfileCardUser {
    id: string;
    _id?: string;
    name: string;
    profile_image?: string;
    roles: string[];
    headline?: string;
    city?: string;
    state?: string;
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

interface SuggestionsApiResponse {
    suggestions: User[];
    total: number;
    has_incomplete_profile: boolean;
    user_city: string;
    user_skills_count: number;
}

type FilterType = 'all' | 'city' | 'skills' | 'industry';

const NetworkPage = () => {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [invitations, setInvitations] = useState<EnrichedInvitation[]>([]);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [connections, setConnections] = useState<string[]>([]);
    const [sentPending, setSentPending] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [hasIncompleteProfile, setHasIncompleteProfile] = useState<boolean>(false);
    const [userCity, setUserCity] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

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

                // 2. Fetch pending invitations, connections, sent invitations, and suggestions in parallel
                const [pendingRes, connsRes, sentRes, suggestionsRes] = await Promise.all([
                    api.get('/network/pending').catch(() => []) as Promise<ConnectionRequest[]>,
                    api.get('/network/connections').catch(() => []) as Promise<string[]>,
                    api.get('/network/sent').catch(() => []) as Promise<string[]>,
                    api.get('/network/suggestions?type=all&limit=24').catch(() => null) as Promise<SuggestionsApiResponse | null>,
                ]);

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
                setConnections(connsRes || []);
                setSentPending(sentRes || []);

                if (suggestionsRes) {
                    const rawList = suggestionsRes.suggestions || [];
                    setSuggestions(rawList.map(u => ({ ...u, id: u.id || u._id || '' })));
                    setHasIncompleteProfile(Boolean(suggestionsRes.has_incomplete_profile));
                    setUserCity(suggestionsRes.user_city || '');
                }

            } catch (error) {
                console.error("Failed to load network data", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    const handleFilterSelect = async (filterKey: FilterType) => {
        if (activeFilter === filterKey) return;
        setActiveFilter(filterKey);
        setSuggestionsLoading(true);
        try {
            const res = await api.get(`/network/suggestions?type=${filterKey}&limit=24`) as SuggestionsApiResponse;
            if (res && res.suggestions) {
                setSuggestions(res.suggestions.map(u => ({ ...u, id: u.id || u._id || '' })));
            } else {
                setSuggestions([]);
            }
        } catch (err) {
            console.error("Failed to filter suggestions", err);
        } finally {
            setSuggestionsLoading(false);
        }
    };

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
            setSentPending(prev => [...prev, userId]);
        } catch (e: any) {
            console.error("Failed to connect", e);
            const msg = e?.response?.data?.error || e.message || '';
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('pending')) {
                setSentPending(prev => [...prev, userId]);
            }
        }
    };

    const handleDismiss = async (targetId: string) => {
        // Optimistic instant dismiss from list
        setSuggestions(prev => prev.filter(s => (s.id || s._id) !== targetId));
        try {
            await api.post(`/network/suggestions/${targetId}/dismiss`);
        } catch (e) {
            console.warn("Failed to record dismissal", e);
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
            {/* Profile Guidance Callout */}
            {hasIncompleteProfile && (
                <div className="bg-gradient-to-r from-blue-50/80 via-white to-amber-50/40 rounded-2xl border border-[#D9E0EA] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-start gap-3.5">
                        <TargetIcon size={28} weight="duotone" className="text-[#0B5ED7] shrink-0" aria-hidden="true" />
                        <div>
                            <h3 className="text-sm font-bold text-[#111827]">
                                Get higher precision recommendations
                            </h3>
                            <p className="text-xs text-[#5B6472] mt-0.5 leading-relaxed">
                                Add your verified skills and target industry role to discover top-rated peers and recruiters in your field.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/profile/edit"
                        className="whitespace-nowrap px-4 py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5 self-end sm:self-auto"
                    >
                        <span>Update Skills</span>
                        <ArrowRightIcon weight="bold" size={13} />
                    </Link>
                </div>
            )}

            {/* Invitations Section */}
            {invitations.length > 0 && (
                <section id="invitations" className="bg-white rounded-2xl shadow-xs p-5 sm:p-6 border border-[#D9E0EA] scroll-mt-24">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-[#D9E0EA]/70">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                                People You May Know
                            </h2>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B5ED7] bg-[#0B5ED7]/10 px-2 py-0.5 rounded-full border border-[#0B5ED7]/20">
                                Matched for you
                            </span>
                        </div>
                        <p className="text-xs text-[#5B6472] font-medium mt-0.5">
                            Expand your network across verified peers with shared skills and industry focus
                        </p>
                    </div>
                    <Link 
                        href="/network/connections"
                        className="text-[#071A4D] hover:text-[#0B5ED7] font-semibold text-xs transition-colors self-start sm:self-auto shrink-0"
                    >
                        View Connections ({connections.length}) →
                    </Link>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide pt-1">
                    {[
                        { id: 'all' as FilterType, label: 'All Recommended', icon: UsersThreeIcon },
                        { id: 'city' as FilterType, label: userCity ? `In ${userCity}` : 'Near You', icon: MapPinIcon },
                        { id: 'skills' as FilterType, label: 'Similar Skills', icon: MedalIcon },
                        { id: 'industry' as FilterType, label: 'In Your Domain', icon: BriefcaseIcon },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleFilterSelect(tab.id)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 border ${
                                    isActive
                                        ? 'bg-[#071A4D] text-white border-[#071A4D] shadow-2xs'
                                        : 'bg-[#F4F7FB] text-[#5B6472] border-[#D9E0EA] hover:bg-white hover:text-[#111827] hover:border-[#071A4D]/30'
                                }`}
                            >
                                <Icon size={12} className={isActive ? 'text-[#FF6B00]' : 'text-[#5B6472]'} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
                
                {suggestionsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 animate-pulse py-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-64 bg-[#F4F7FB]/60 border border-[#D9E0EA] rounded-2xl p-5 flex flex-col items-center justify-between">
                                <div className="w-16 h-16 rounded-full bg-slate-200" />
                                <div className="h-4 w-28 bg-slate-200 rounded mt-3" />
                                <div className="h-3 w-36 bg-slate-100 rounded mt-1" />
                                <div className="w-full space-y-2 mt-4">
                                    <div className="h-8 bg-slate-200 rounded-xl w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : suggestions.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-[#F4F7FB]/60 rounded-xl border border-dashed border-[#D9E0EA]">
                        <UsersIcon size={28} weight="duotone" className="text-[#071A4D] mx-auto mb-3" aria-hidden="true" />
                        <h3 className="text-sm font-bold text-[#111827] mb-1">
                            {activeFilter === 'city'
                                ? 'No Local Profiles Found'
                                : activeFilter === 'skills'
                                ? 'No Direct Skill Overlap Found'
                                : activeFilter === 'industry'
                                ? 'No Domain Matches Found'
                                : 'No New Suggestions Right Now'}
                        </h3>
                        <p className="text-xs text-[#5B6472] max-w-sm mx-auto leading-relaxed mb-4">
                            {activeFilter !== 'all'
                                ? 'Try selecting "All Recommended" to view candidates with broad professional affinity.'
                                : 'Check back soon as new candidates and industry experts join the platform daily.'}
                        </p>
                        {activeFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => handleFilterSelect('all')}
                                className="px-4 py-1.5 bg-[#071A4D] text-white rounded-xl text-xs font-semibold hover:bg-[#0B1F52] transition-colors cursor-pointer"
                            >
                                Show All Recommended
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {suggestions.map((user) => {
                            const uid = user.id || user._id || '';
                            const isPending = sentPending.includes(uid);
                            const isConnected = connections.includes(uid);

                            return (
                                <ProfileConnectionCard 
                                    key={uid} 
                                    user={user}
                                    variant="grid"
                                    actionType="discover"
                                    entityType="connect"
                                    isPending={isPending}
                                    isConnected={isConnected}
                                    onConnect={() => handleConnect(uid)}
                                    onChat={() => handleChat(uid)}
                                    onDismiss={(id) => handleDismiss(id)}
                                />
                            );
                        })}
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
                            <MapPinIcon weight="bold" size={11} className="text-[#071A4D] shrink-0" />
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