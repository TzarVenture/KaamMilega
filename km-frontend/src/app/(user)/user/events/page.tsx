'use client'
import React, { useEffect, useState } from 'react';
import { Calendar, Video, Users, Bookmark, ChevronDown, MapPin } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

interface EventData {
    id: string;
    title: string;
    organizer: string;
    date: string;
    time: string;
    location: string;
    image_url?: string;
}

const EventsPage = () => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const fetchEvents = async (pageNum: number) => {
        try {
            setLoading(true);
            const res: any = await api.get(`/events?page=${pageNum}&limit=5`);
            if (pageNum === 1) {
                setEvents(res.data || []);
            } else {
                setEvents((prev) => [...prev, ...(res.data || [])]);
            }
            setHasMore((res.data || []).length === 5); // Simple simple hasMore check
        } catch (error: any) {
            toast.error(error.message || "Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents(1);
    }, []);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchEvents(nextPage);
    };

    return (
        <div className="max-w-7xl mx-auto p-6 flex flex-col lg:flex-row gap-8 bg-[#F4F2F7] min-h-screen">

            {/* Left Content: Events List */}
            <div className="flex-1">
                <div className="flex items-center justify-between mb-8 px-2">
                    <h1 className="text-3xl font-bold text-gray-900">Events</h1>

                    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                        <span>Sort by:</span>
                        <button className="flex items-center gap-1 font-bold text-gray-800 hover:text-purple-700 transition-colors">
                            Recently added <ChevronDown size={16} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {loading && events.length === 0 ? (
                        <div className="text-gray-500 py-10 text-center">Loading events...</div>
                    ) : events.length === 0 ? (
                        <div className="text-gray-500 py-10 text-center">No events found.</div>
                    ) : events.map((event, idx) => (
                        <div key={event.id || idx} className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 transition-all hover:shadow-md">

                            {/* Event Banner Placeholder */}
                            <div className="w-full md:w-56 h-32 bg-[#1D0A1C] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden">
                                {event.image_url ? (
                                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 bg-purple-400 clip-path-triangle transform -rotate-12 -translate-x-2" />
                                        <div className="w-8 h-8 bg-purple-300 clip-path-triangle translate-x-2 translate-y-2" />
                                    </div>
                                )}
                            </div>

                            {/* Event Details */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 mb-1">{event.title}</h2>
                                        <p className="text-xs text-gray-500 font-medium">
                                            Event By <span className="text-purple-600 cursor-pointer hover:underline">{event.organizer}</span>
                                        </p>
                                    </div>
                                    <button className="p-2 text-purple-400 hover:text-purple-700 bg-purple-50 rounded-lg transition-colors">
                                        <Bookmark size={18} />
                                    </button>
                                </div>

                                {/* Metadata Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                        <Calendar size={14} className="text-purple-500 shrink-0" />
                                        <span className="truncate">{event.date} {event.time}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                        <MapPin size={14} className="text-purple-500 shrink-0" />
                                        <span className="truncate">{event.location}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Show More Pagination */}
                {hasMore && (
                    <div className="flex justify-center mt-10 mb-6">
                        <button 
                            onClick={handleLoadMore}
                            disabled={loading}
                            className="px-12 py-2 border-2 border-purple-200 rounded-full text-purple-700 font-bold text-sm hover:bg-purple-50 hover:border-purple-300 transition-all disabled:opacity-50"
                        >
                            {loading ? "Loading..." : "Show More"}
                        </button>
                    </div>
                )}
            </div>

            {/* Right Content: Sidebar */}
            <div className="hidden lg:block w-80">
                <div className="sticky top-6 bg-white rounded-[32px] p-8 h-[450px] border border-gray-100 shadow-sm flex items-center justify-center">
                    <span className="text-gray-400 font-bold text-xl tracking-tight italic">Ad Banner</span>
                </div>
            </div>
        </div>
    );
};

export default EventsPage;