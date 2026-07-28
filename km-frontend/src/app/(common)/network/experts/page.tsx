'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, MessageSquare, Search, Trash2, ArrowLeft } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';

export interface ExpertUser {
    id: string;
    _id?: string;
    name: string;
    roles: string[];
    headline?: string;
    profile_image?: string;
    city?: string;
}

export const ExpertCard = ({ expert, onChat, onDelete }: { expert: ExpertUser, onChat: () => void, onDelete: () => void }) => {
    return (
        <div className="flex items-center justify-between py-5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors px-2">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-indigo-950 flex items-center justify-center overflow-hidden">
                        {expert.profile_image ? (
                            <img src={expert.profile_image} alt={expert.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white font-bold">{expert.name?.[0]?.toUpperCase() || 'E'}</span>
                        )}
                    </div>
                </div>

                <div>
                    <h3 className="font-bold text-gray-900 leading-tight">{expert.name || 'Unknown Expert'}</h3>
                    <p className="text-xs text-gray-500">{expert.headline || expert.roles?.join(', ')}</p>
                    {expert.city && <p className="text-xs text-gray-400 mt-1">📍 {expert.city}</p>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={onChat}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-200 text-purple-600 text-sm font-medium hover:bg-purple-50 transition-all">
                    <MessageSquare size={16} />
                    Chat
                </button>
                <button 
                    onClick={onDelete}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
};

export default function ExpertsPage() {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [myExperts, setMyExperts] = useState<ExpertUser[]>([]);
    const [suggestedExperts, setSuggestedExperts] = useState<ExpertUser[]>([]);
    const [loading, setLoading] = useState(true);
    const ITEMS_PER_PAGE = 10;

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
                const currentUserStr = localStorage.getItem('user');
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
                    setSuggestedExperts(filteredSuggestions.slice(0, 5));
                } catch (e) {
                    // /admin/users might be restricted depending on role, ignore failure silently
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
        if (!searchQuery) return myExperts;
        const q = searchQuery.toLowerCase();
        return myExperts.filter(c => 
            c.name?.toLowerCase().includes(q) || 
            c.headline?.toLowerCase().includes(q)
        );
    }, [myExperts, searchQuery]);

    const totalItems = filteredExperts.length;
    const currentList = filteredExperts.slice(
        (currentPage - 1) * ITEMS_PER_PAGE, 
        currentPage * ITEMS_PER_PAGE
    );

    if (loading) {
        return <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-[#F8F9FB] pb-6">
            {suggestedExperts.length > 0 && (
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
            )}
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 px-6 mt-6">

                <main className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" onClick={() => router.back()}>
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">{totalItems} Experts</h1>
                        </div>
                        <button 
                            onClick={() => router.push('/expert/apply')}
                            className="px-6 py-2 rounded-full border border-purple-600 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors"
                        >
                            Become An Expert
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">Sort by:</span>
                            <select className="font-bold bg-transparent outline-none">
                                <option>Recently added</option>
                            </select>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search experts..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-1 min-h-[400px]">
                        {currentList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                                {searchQuery ? "No experts found matching your search." : "You are not following any experts yet."}
                            </div>
                        ) : (
                            currentList.map((expert) => (
                                <ExpertCard
                                    key={expert.id}
                                    expert={expert}
                                    onChat={() => handleChat(expert.id)}
                                    onDelete={() => handleDelete(expert.id)}
                                />
                            ))
                        )}
                    </div>

                    {totalItems > ITEMS_PER_PAGE && (
                        <div className="mt-8 flex justify-center">
                            <Pagination
                                total={Math.ceil(totalItems / ITEMS_PER_PAGE)}
                                current={currentPage}
                                onPageChange={(page) => setCurrentPage(page)}
                            />
                        </div>
                    )}
                </main>

                <aside className="w-full lg:w-80 space-y-6">
                    <div className="bg-white rounded-2xl p-8 border border-gray-100 flex flex-col items-center justify-center min-h-[250px]">
                        <span className="text-gray-400 font-bold text-lg">Ad Banner</span>
                    </div>

                    {suggestedExperts.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">
                                    Our <span className="text-purple-600">Experts</span>
                                </h2>
                                <div className="space-y-6">
                                    {suggestedExperts.map((expert) => (
                                        <SidebarExpert key={expert.id} expert={expert} onChat={() => handleChat(expert.id)} />
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={() => router.push('/network')} 
                                className="w-full py-4 bg-gray-50 text-purple-600 text-sm font-bold border-t border-gray-100 hover:bg-gray-100 transition-colors">
                                Show All
                            </button>
                        </div>
                    )}
                </aside>

            </div>
        </div>
    );
}

export const SidebarExpert = ({ expert, onChat }: { expert: ExpertUser, onChat: () => void }) => {
    const handleConnect = async () => {
        try {
            await api.post('/network/connect', { receiver_id: expert.id });
            alert("Invitation sent to expert!");
        } catch (e: any) {
            console.error("Failed to connect", e);
            alert(e.message || "Could not send invitation");
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-indigo-950">
                        {expert.profile_image ? (
                            <img src={expert.profile_image} alt={expert.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white font-bold">{expert.name?.[0]?.toUpperCase() || 'E'}</span>
                        )}
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">{expert.name || 'Expert'}</h4>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider line-clamp-1">{expert.headline || expert.roles?.join(', ')}</p>
                    {expert.city && <p className="text-[10px] text-gray-400 mt-0.5">📍 {expert.city}</p>}
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={onChat}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-purple-200 rounded-full text-purple-600 text-xs font-semibold hover:bg-purple-50 transition-colors">
                    <MessageSquare size={14} />
                    Chat
                </button>
                <button 
                    onClick={handleConnect}
                    className="flex-1 py-1.5 bg-purple-500 border border-purple-500 rounded-full text-white text-xs font-semibold hover:bg-purple-600 transition-colors shadow-sm shadow-purple-200">
                    Follow
                </button>
            </div>
        </div>
    );
};