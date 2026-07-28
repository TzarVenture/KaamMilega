'use client'
import React, { useEffect, useState } from 'react';
import { Calendar, Users, Bookmark, ChevronDown, MapPin, Search, Filter, Gift } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import Link from 'next/link';

interface EventData {
    id: string;
    title: string;
    organizer: string;
    date: string;
    time: string;
    location: string;
    image_url?: string;
}

const PublicEventsPage = () => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    
    // Filters logic
    const [search, setSearch] = useState('');
    const [locationFilter, setLocationFilter] = useState('');

    const fetchEvents = async (pageNum: number, currentSearch: string, currentLocation: string) => {
        try {
            setLoading(true);
            let url = `/events?page=${pageNum}&limit=9`;
            if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
            if (currentLocation) url += `&location=${encodeURIComponent(currentLocation)}`;
            
            const res: any = await api.get(url);
            if (pageNum === 1) {
                setEvents(res.data || []);
            } else {
                setEvents((prev) => [...prev, ...(res.data || [])]);
            }
            setHasMore((res.data || []).length === 9);
        } catch (error: any) {
            toast.error(error.message || "Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents(1, search, locationFilter);
    }, [search, locationFilter]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchEvents(nextPage, search, locationFilter);
    };

    return (
        <div className="bg-[#F8F9FB] min-h-screen pb-16">
            
            {/* Header / Hero Section */}
            <div className="bg-[#3b1641] pt-12 pb-20 md:pt-16 md:pb-24 px-4 md:px-6 text-center text-white relative overflow-hidden">
                <div className="absolute top-10 left-10 w-20 h-20 border border-white/20 rounded-full" />
                <div className="absolute bottom-10 right-20 w-32 h-32 border border-white/20 rounded-full" />

                <div className="relative z-10 max-w-3xl mx-auto">
                    <h1 className="text-3xl md:text-5xl font-black mb-4 px-4">Discover Amazing <span className="text-[#c084fc]">Events</span></h1>
                    <p className="text-[13px] md:text-base opacity-80 mb-8 max-w-xl mx-auto px-6">
                        Join workshops, masterclasses, and networking events hosted by top experts. Learn, grow, and connect.
                    </p>

                    {/* Search Bar */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3 max-w-2xl bg-white p-2 rounded-2xl md:rounded-full shadow-lg mx-4 md:mx-auto">
                        <div className="flex-1 flex items-center pr-4 border-b md:border-b-0 md:border-r border-gray-100 pl-4 py-3 md:py-2 text-gray-800">
                            <Search size={18} className="text-gray-400 mr-3 md:mr-2 shrink-0" />
                            <input 
                                type="text" 
                                placeholder="Search events..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-medium placeholder:font-normal text-sm"
                            />
                        </div>
                        <div className="flex-1 flex items-center pl-4 py-3 md:py-2 text-gray-800">
                            <MapPin size={18} className="text-gray-400 mr-3 md:mr-2 shrink-0" />
                            <input 
                                type="text" 
                                placeholder="Location or 'Online'" 
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-medium placeholder:font-normal text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-8 md:-mt-10 relative z-20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 border-l-4 border-purple-600 pl-4">Featured Events</h2>
                    <button className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-md text-sm font-bold text-gray-700 hover:text-purple-600 transition-colors border border-gray-100">
                        <Filter size={16} /> Filters
                    </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading && events.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-gray-500 font-bold">Loading events...</div>
                    ) : events.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-gray-500 font-bold">No events found matching your criteria.</div>
                    ) : (
                        events.map((event, idx) => (
                            <Link href={`/events/${event.id}`} key={event.id || idx} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-50 transition-all flex flex-col group cursor-pointer">
                                
                                <div className="h-48 bg-gray-200 relative overflow-hidden">
                                    {event.image_url ? (
                                        <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full bg-[#1D0A1C] flex items-center justify-center relative overflow-hidden">
                                            <div className="flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="w-12 h-12 bg-purple-400 clip-path-triangle transform -rotate-12 -translate-x-2" />
                                                <div className="w-10 h-10 bg-purple-300 clip-path-triangle translate-x-2 translate-y-2" />
                                            </div>
                                        </div>
                                    )}
                                    <span className="absolute top-4 left-4 bg-black/60 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md">{event.location || 'Online'}</span>
                                    <button className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-purple-600 transition-colors">
                                        <Bookmark size={16} />
                                    </button>
                                </div>
                                
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg">{event.title?.[0] || '🎉'}</div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-gray-900 text-base truncate">{event.title}</h4>
                                            <p className="text-[11px] text-gray-500 font-bold truncate">By {event.organizer}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-[12px] text-gray-500 font-bold mb-6 border-b border-gray-50 pb-4">
                                        <span className="flex items-center gap-1"><Calendar size={14} className="text-purple-500" /> {event.date} {event.time}</span>
                                        <span className="flex items-center gap-1"><Users size={14} className="text-purple-500" /> 1K+ Joined</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-[12px] font-black mt-auto pt-2">
                                        <span className="text-pink-500 flex items-center gap-1.5"><Gift size={15} /> Exciting Event</span>
                                        <span className="text-purple-600 bg-purple-50 px-4 py-1.5 rounded-full hover:bg-purple-100 transition-colors">Register</span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                {/* Show More Pagination */}
                {hasMore && (
                    <div className="flex justify-center mt-12">
                        <button 
                            onClick={handleLoadMore}
                            disabled={loading}
                            className="px-10 py-3 bg-white border border-gray-200 rounded-full text-gray-700 font-bold text-sm hover:border-purple-300 hover:text-purple-600 transition-all shadow-sm"
                        >
                            {loading ? "Loading..." : "Load More Events"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicEventsPage;
