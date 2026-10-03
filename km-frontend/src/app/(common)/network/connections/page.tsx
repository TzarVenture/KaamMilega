'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';
import ProfileConnectionCard from '@/components/network/ProfileConnectionCard';

interface User {
    id: string;
    _id?: string;
    name: string;
    roles: string[];
    headline?: string;
    profile_image?: string;
    city?: string;
    last_login_lat?: number;
    last_login_lng?: number;
}

const ConnectionsPage = () => {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'name_asc' | 'name_desc'>('recent');
    const [connections, setConnections] = useState<User[]>([]);
    const [suggestedConnections, setSuggestedConnections] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const ITEMS_PER_PAGE = 9;

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const connsRes = await api.get('/network/connections') as string[];
                const enriched = await Promise.all(
                    (connsRes || []).map(async (id) => {
                        try {
                            const user = await api.get(`/user/${id}`) as User;
                            return { ...user, id: user.id || user._id || id };
                        } catch {
                            return null;
                        }
                    })
                );
                setConnections(enriched.filter(u => u !== null) as User[]);

                // Helper to calculate distance
                const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                    const R = 6371; // Radius of the earth in km
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return R * c;
                };

                try {
                    const usersRes = (await api.get('/admin/users')) as User[];
                    const currentUserStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                    let currentUserId = '';
                    if (currentUserStr) {
                        try {
                            const parsed = JSON.parse(currentUserStr);
                            currentUserId = parsed.id || parsed._id;
                        } catch (e) { }
                    }

                    const filteredSuggestions = (usersRes || []).filter(u =>
                        u.id !== currentUserId &&
                        u._id !== currentUserId &&
                        !connsRes.includes(u.id || u._id || '')
                    );

                    if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                const { latitude, longitude } = position.coords;
                                api.put('/user/location', { lat: latitude, lng: longitude });

                                const sorted = [...filteredSuggestions].sort((a, b) => {
                                    const distA = (a.last_login_lat && a.last_login_lng)
                                        ? getDistance(latitude, longitude, a.last_login_lat, a.last_login_lng)
                                        : 999999;
                                    const distB = (b.last_login_lat && b.last_login_lng)
                                        ? getDistance(latitude, longitude, b.last_login_lat, b.last_login_lng)
                                        : 999999;
                                    return distA - distB;
                                });
                                setSuggestedConnections(sorted.slice(0, 8));
                            },
                            () => {
                                setSuggestedConnections(filteredSuggestions.slice(0, 8));
                            },
                            { timeout: 10000, enableHighAccuracy: false, maximumAge: Infinity }
                        );
                    } else {
                        setSuggestedConnections(filteredSuggestions.slice(0, 8));
                    }
                } catch (e) {
                    console.error("Failed to fetch suggestions", e);
                }
            } catch (err) {
                console.error("Failed to fetch connections", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConnections();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this connection?')) return;
        try {
            await api.delete(`/network/connections/${id}`);
            setConnections(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error("Failed to delete connection", err);
            alert("Could not remove connection");
        }
    };

    const handleChat = (id: string) => {
        router.push(`/chat?userId=${id}`);
    };

    const filteredConnections = useMemo(() => {
        let list = [...connections];
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.name?.toLowerCase().includes(q) ||
                c.headline?.toLowerCase().includes(q) ||
                c.roles?.join(' ').toLowerCase().includes(q)
            );
        }

        if (sortBy === 'name_asc') {
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (sortBy === 'name_desc') {
            list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        }

        return list;
    }, [connections, searchQuery, sortBy]);

    const totalItems = filteredConnections.length;
    const currentList = filteredConnections.slice(
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
            {suggestedConnections.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#D9E0EA] p-4 sm:p-6 shadow-xs overflow-hidden">
                    <ConnectJustLikeYou
                        users={suggestedConnections}
                        onChat={(id) => handleChat(id)}
                        onFollow={async (id) => {
                            try {
                                await api.post('/network/connect', { receiver_id: id });
                                alert("Connection request sent!");
                            } catch (e: any) {
                                console.error("Failed to connect", e);
                                alert(e.message || "Could not send connection request");
                            }
                        }}
                    />
                </div>
            )}

            {/* Main Connections Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0EA] shadow-xs overflow-hidden">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-[#D9E0EA]/70">
                    <div className="flex items-center gap-3 mb-5">
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
                                {totalItems} {totalItems === 1 ? 'Connection' : 'Connections'}
                            </h1>
                            <p className="text-xs text-[#5B6472]">Verified professionals in your direct network</p>
                        </div>
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
                                placeholder="Search connections..."
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

                {/* Connections Grid */}
                <div className="p-5 sm:p-6 min-h-[300px]">
                    {currentList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center text-[#5B6472] mb-3">
                                <Search size={20} />
                            </div>
                            <p className="text-sm font-semibold text-[#111827]">
                                {searchQuery ? "No connections found matching your search." : "You don't have any connections yet."}
                            </p>
                            <p className="text-xs text-[#5B6472] mt-1 max-w-sm">
                                {searchQuery ? "Try a different search term or clear the filter." : "Discover industry peers and grow your professional circle."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
                            {currentList.map((person) => {
                                const personId = person.id || person._id || '';

                                return (
                                    <ProfileConnectionCard
                                        key={personId}
                                        user={person}
                                        variant="grid"
                                        actionType="connected"
                                        entityType="connect"
                                        onChat={() => handleChat(personId)}
                                        onRemove={() => handleDelete(personId)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination Section */}
                {totalItems > ITEMS_PER_PAGE && (
                    <div className="p-6 border-t border-[#D9E0EA]/70 flex justify-center">
                        <Pagination
                            current={currentPage}
                            total={Math.ceil(totalItems / ITEMS_PER_PAGE)}
                            onPageChange={(page) => setCurrentPage(page)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionsPage;
