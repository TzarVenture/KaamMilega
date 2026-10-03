'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';
import ProfileConnectionCard from '@/components/network/ProfileConnectionCard';

export interface ExpertUser {
    id: string;
    _id?: string;
    name: string;
    roles: string[];
    headline?: string;
    profile_image?: string;
    city?: string;
    rating?: string | number;
}

export default function ExpertsPage() {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'name_asc' | 'name_desc'>('recent');
    const [myExperts, setMyExperts] = useState<ExpertUser[]>([]);
    const [suggestedExperts, setSuggestedExperts] = useState<ExpertUser[]>([]);
    const [loading, setLoading] = useState(true);
    const ITEMS_PER_PAGE = 9;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch connections
                const connsRes = (await api.get('/network/connections')) as string[] || [];
                const enriched = await Promise.all(
                    connsRes.map(async (id) => {
                        try {
                            const user = await api.get(`/user/${id}`) as ExpertUser;
                            return { ...user, id: user.id || user._id || id };
                        } catch {
                            return null;
                        }
                    })
                );
                
                // Get current user id
                const currentUserStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                let currentUserId = '';
                if (currentUserStr) {
                    try {
                        const parsed = JSON.parse(currentUserStr);
                        currentUserId = parsed.id || parsed._id;
                    } catch (e) {}
                }

                // Filter connections to only those with 'expert' role, and not current user
                const validConnections = (enriched.filter(u => u !== null) as ExpertUser[]);
                const expertConnections = validConnections.filter(u => 
                    u.roles?.includes('expert') && 
                    u.id !== currentUserId && 
                    u._id !== currentUserId
                );
                setMyExperts(expertConnections);

                // Fetch all users to suggest experts
                try {
                    const usersRes = await api.get('/admin/users') as ExpertUser[];
                    
                    const filteredSuggestions = (usersRes || []).filter(u => 
                        u.roles?.includes('expert') && 
                        u.id !== currentUserId && 
                        u._id !== currentUserId &&
                        !connsRes.includes(u.id || u._id || '')
                    );
                    setSuggestedExperts(filteredSuggestions.slice(0, 6));
                } catch (e) {
                    // Ignore failure silently
                }
            } catch (err) {
                console.error("Failed to fetch experts", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this expert from your connections?')) return;
        try {
            await api.delete(`/network/connections/${id}`);
            setMyExperts(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error("Failed to delete connection", err);
            alert("Could not remove connection");
        }
    };

    const handleChat = (id?: string) => {
        if (id) {
            router.push(`/chat?userId=${id}`);
        } else {
            router.push('/chat');
        }
    };

    const filteredExperts = useMemo(() => {
        let list = [...myExperts];
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c => 
                c.name?.toLowerCase().includes(q) || 
                c.headline?.toLowerCase().includes(q)
            );
        }

        if (sortBy === 'name_asc') {
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (sortBy === 'name_desc') {
            list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        }

        return list;
    }, [myExperts, searchQuery, sortBy]);

    const totalItems = filteredExperts.length;
    const currentList = filteredExperts.slice(
        (currentPage - 1) * ITEMS_PER_PAGE, 
        currentPage * ITEMS_PER_PAGE
    );

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="bg-white rounded-2xl border border-[#D9E0EA] p-6 shadow-xs">
                    <div className="h-5 w-44 bg-slate-200 rounded-lg mb-2" />
                    <div className="h-3 w-60 bg-slate-100 rounded-lg mb-6" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
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
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {suggestedExperts.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#D9E0EA] p-4 sm:p-6 shadow-xs overflow-hidden">
                    <ConnectJustLikeYou 
                        users={suggestedExperts}
                        onChat={(id) => handleChat(id)}
                        onFollow={async (id) => {
                            try {
                                await api.post('/network/connect', { receiver_id: id });
                                alert("Invitation sent to expert!");
                            } catch (e: any) {
                                console.error("Failed to connect", e);
                                alert(e.message || "Could not send invitation");
                            }
                        }}
                    />
                </div>
            )}

            {/* Main Experts Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0EA] shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-[#D9E0EA]/70">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                className="p-2 hover:bg-[#F4F7FB] rounded-xl text-[#5B6472] hover:text-[#071A4D] transition-colors cursor-pointer active:scale-[0.98]" 
                                onClick={() => router.back()}
                                aria-label="Back to network"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold text-[#111827]">
                                    {totalItems} Connected {totalItems === 1 ? 'Expert' : 'Experts'}
                                </h1>
                                <p className="text-xs text-[#5B6472]">Verified mentors and industry advisors</p>
                            </div>
                        </div>

                        <button 
                            type="button"
                            onClick={() => router.push('/expert/apply')}
                            className="bg-[#FF6B00] hover:bg-[#E05E00] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 shadow-xs active:scale-[0.98] cursor-pointer self-start sm:self-auto"
                        >
                            Become An Expert
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-[#5B6472] font-medium">
                            <span>Sort by:</span>
                            <div className="relative">
                                <select 
                                    value={sortBy}
                                    onChange={(e) => {
                                        setSortBy(e.target.value as any);
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-1.5 bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl text-xs font-semibold text-[#111827] hover:border-[#071A4D] focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/20 outline-none transition-colors cursor-pointer"
                                >
                                    <option value="recent">Recently added</option>
                                    <option value="name_asc">Name (A – Z)</option>
                                    <option value="name_desc">Name (Z – A)</option>
                                </select>
                            </div>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5B6472]" size={16} />
                            <input
                                type="text"
                                placeholder="Search experts..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-4 py-2 bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl text-xs font-medium focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/20 outline-none text-[#111827] placeholder:text-[#5B6472] transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-5 sm:p-6 min-h-[300px]">
                    {currentList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center text-[#5B6472] mb-3">
                                <Search size={20} />
                            </div>
                            <p className="text-sm font-semibold text-[#111827]">
                                {searchQuery ? "No experts found matching your search." : "You are not connected to any experts yet."}
                            </p>
                            <p className="text-xs text-[#5B6472] mt-1 max-w-sm">
                                {searchQuery ? "Try a different search keyword." : "Explore verified experts to book 1-on-1 mentorship and career advice."}
                            </p>
                            <button
                                type="button"
                                onClick={() => router.push('/mentorship')}
                                className="mt-4 px-4 py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white text-xs font-semibold rounded-xl transition-all duration-150 shadow-xs active:scale-[0.98] cursor-pointer"
                            >
                                Browse Mentors
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
                            {currentList.map((expert) => {
                                const expertId = expert.id || expert._id || '';

                                return (
                                    <ProfileConnectionCard
                                        key={expertId}
                                        user={expert}
                                        variant="grid"
                                        actionType="expert"
                                        entityType="expert"
                                        onChat={() => handleChat(expertId)}
                                        onRemove={() => handleDelete(expertId)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {totalItems > ITEMS_PER_PAGE && (
                    <div className="p-6 border-t border-[#D9E0EA]/70 flex justify-center">
                        <Pagination
                            total={Math.ceil(totalItems / ITEMS_PER_PAGE)}
                            current={currentPage}
                            onPageChange={(page) => setCurrentPage(page)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}