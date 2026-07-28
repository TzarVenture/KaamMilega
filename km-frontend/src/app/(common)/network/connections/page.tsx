'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, MessageCircle, Trash2, ArrowLeft } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';

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
    const [connections, setConnections] = useState<User[]>([]);
    const [suggestedConnections, setSuggestedConnections] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const ITEMS_PER_PAGE = 10;

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
                    return R * c; // Distance in km
                };

                try {
                    const usersRes = (await api.get('/admin/users')) as User[];
                    const currentUserStr = localStorage.getItem('user');
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

                    // Try to sort by location if browser allows geolocation
                    if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                const { latitude, longitude } = position.coords;

                                // Optional: You could make an API call here to save this location for the current user
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
                            (error) => {
                                console.warn("Geolocation Error:", error.message);
                                // Fallback if geolocation fails or is denied
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
        if (!searchQuery) return connections;
        const q = searchQuery.toLowerCase();
        return connections.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            c.headline?.toLowerCase().includes(q) ||
            c.roles?.join(' ').toLowerCase().includes(q)
        );
    }, [connections, searchQuery]);

    const totalItems = filteredConnections.length;
    const currentList = filteredConnections.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F4F2F7]">Loading...</div>;
    }

    return (
        <div className="bg-[#F4F2F7] min-h-screen pb-6">
            {suggestedConnections.length > 0 && (
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
            )}
            <div className="max-w-7xl mx-auto p-6 flex gap-8">

                {/* Main Content Area */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-4 mb-6">
                            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" onClick={() => router.back()}>
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <h1 className="text-xl font-bold text-gray-800">{totalItems} Connections</h1>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                                <span>Sort by:</span>
                                <button className="flex items-center gap-1 font-bold text-gray-800 hover:text-purple-700">
                                    Recently added <ChevronDown size={16} />
                                </button>
                            </div>

                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search connections..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Connections List */}
                    <div className="divide-y divide-gray-100 min-h-[400px]">
                        {currentList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                                {searchQuery ? "No connections found matching your search." : "You don't have any connections yet."}
                            </div>
                        ) : (
                            currentList.map((person) => (
                                <div key={person.id} className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 bg-purple-100 text-purple-700 font-bold rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                                {person.profile_image ? (
                                                    <img src={person.profile_image} alt={person.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    person.name?.[0] || 'U'
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{person.name || 'Unknown User'}</h3>
                                            <p className="text-xs text-gray-500">{person.headline || person.roles?.join(', ')}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleChat(person.id)}
                                            className="flex items-center gap-2 px-5 py-1.5 border border-purple-300 rounded-full text-purple-700 text-sm font-semibold hover:bg-purple-50 transition-all">
                                            <MessageCircle size={16} />
                                            Message
                                        </button>
                                        <button
                                            onClick={() => handleDelete(person.id)}
                                            className="p-2 text-purple-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination Section */}
                    {totalItems > ITEMS_PER_PAGE && (
                        <div className="p-8 border-t border-gray-100 flex justify-center">
                            <Pagination
                                current={currentPage}
                                total={Math.ceil(totalItems / ITEMS_PER_PAGE)}
                                onPageChange={(page) => setCurrentPage(page)}
                            />
                        </div>
                    )}
                </div>

                {/* Sidebar (Matching the UI Screenshot) */}
                <div className="hidden lg:block w-80 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-48 flex items-center justify-center text-gray-400 font-bold">
                        Ad Banner
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectionsPage;
