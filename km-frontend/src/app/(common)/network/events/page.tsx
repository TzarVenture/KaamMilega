'use client'

import React, { useState, useEffect } from 'react';
import Pagination from '@/components/ui/Pagination';
import { Calendar, Video, MoreHorizontal, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

export interface Event {
    id: string;
    _id?: string;
    title: string;
    organizer: string;
    date: string;
    time: string;
    location: string;
    image_url?: string;
}

export const EventCard = ({ event }: { event: Event }) => {
    return (
        <div className="flex flex-col md:flex-row gap-6 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
            {/* Event Image Placeholder */}
            <div className="w-full md:w-48 h-32 bg-indigo-950 rounded-lg flex items-center justify-center relative overflow-hidden flex-shrink-0">
                {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex gap-1 opacity-40 group-hover:scale-110 transition-transform">
                        <div className="w-4 h-8 bg-white rotate-12" />
                        <div className="w-4 h-8 bg-white rotate-12" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight">{event.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">Event By <span className="text-purple-600 font-medium cursor-pointer">{event.organizer}</span></p>

                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={16} className="text-gray-400" />
                            <span>{event.date}, {event.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Video size={16} className="text-gray-400" />
                            <span>{event.location}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action */}
            <div className="flex flex-col justify-between items-end">
                <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <MoreHorizontal size={20} className="text-gray-600" />
                </button>
                <button className="px-6 py-2 bg-white border border-purple-600 text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-all text-sm">
                    Register
                </button>
            </div>
        </div>
    );
};


export default function EventsPage() {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [events, setEvents] = useState<Event[]>([]);
    const [totalEvents, setTotalEvents] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('Recently added');
    
    const eventsPerPage = 5;
    const totalPages = Math.ceil(totalEvents / eventsPerPage);

    const fetchEvents = async (page: number, search: string, sort: string) => {
        setIsLoading(true);
        try {
            const res = await api.get('/events', {
                params: {
                    page,
                    limit: eventsPerPage,
                    search,
                    sort: sort === 'Upcoming' ? 'Upcoming' : 'Recent'
                }
            }) as { data: Event[], total: number };
            
            // Map _id to id if necessary
            const mappedEvents = (res.data || []).map(e => ({ ...e, id: e.id || e._id || '' }));
            setEvents(mappedEvents);
            setTotalEvents(res.total || 0);
        } catch (error) {
            console.error("Failed to fetch events", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce search effect or fetch immediately
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchEvents(currentPage, searchQuery, sortOrder);
        }, 300);
        return () => clearTimeout(timeout);
    }, [currentPage, searchQuery, sortOrder]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // reset to first page on new search
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSortOrder(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen shadow-sm flex gap-8">
            {/* Left Column: Events */}
            <div className="flex-1 overflow-hidden">
                <header className="mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" onClick={() => router.back()}>
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                        <h2 className="text-lg font-semibold text-gray-800">{totalEvents} Events Found</h2>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search events..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Sort by:</span>
                        <select 
                            value={sortOrder}
                            onChange={handleSortChange}
                            className="font-semibold bg-transparent cursor-pointer outline-none hover:text-purple-600"
                        >
                            <option>Recently added</option>
                            <option>Upcoming</option>
                        </select>
                    </div>
                </header>

                {/* Events List */}
                <div className="space-y-2 min-h-[400px]">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48 text-gray-500">
                            Loading events...
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                            {searchQuery ? "No events found matching your search." : "There are currently no events to display."}
                        </div>
                    ) : (
                        events.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="mt-12 flex items-center justify-center gap-2">
                        <Pagination
                            current={currentPage}
                            total={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            {/* Right Column: Sidebar Ad */}
            <aside className="hidden lg:block w-72 flex-shrink-0">
                <div className="sticky top-6 h-64 w-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                    <span className="text-sm font-semibold uppercase tracking-widest">Ad Banner</span>
                    <p className="text-xs mt-2 px-8 text-center leading-relaxed">Promote your brand here</p>
                </div>
            </aside>
        </div>
    );
}