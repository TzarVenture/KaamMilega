'use client'

import React, { useState, useEffect } from 'react';
import Pagination from '@/components/ui/Pagination';
import { Calendar, Video, MoreHorizontal, Search, ArrowLeft, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    ticket_price?: number;
}

export const EventCard = ({ event }: { event: Event }) => {
    const eventId = event.id || event._id || '';

    return (
        <div className="flex flex-col sm:flex-row gap-5 p-4 sm:p-5 border-b border-[#D9E0EA]/70 last:border-0 hover:bg-[#F4F7FB]/40 transition-colors group rounded-xl">
            {/* Event Image */}
            <div className="w-full sm:w-44 h-36 sm:h-28 bg-[#071A4D] rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 border border-slate-700 shadow-2xs">
                {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex items-center gap-1.5 text-white/50 group-hover:scale-105 transition-transform duration-200">
                        <Ticket size={24} className="text-[#F59E0B]" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                    <Link href={`/events/${eventId}`} className="hover:text-[#0B5ED7] transition-colors">
                        <h3 className="text-base font-bold text-[#111827] leading-snug group-hover:text-[#0B5ED7] transition-colors line-clamp-2">
                            {event.title}
                        </h3>
                    </Link>
                    <p className="text-xs text-[#5B6472] font-medium mt-1 truncate">
                        Organized by <span className="text-[#D97706] font-semibold">{event.organizer}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 sm:gap-4 text-xs font-semibold text-[#5B6472]">
                        <div className="flex items-center gap-1.5 bg-[#F4F7FB] px-2.5 py-1 rounded-lg border border-[#D9E0EA]/70">
                            <Calendar size={14} className="text-[#F59E0B] shrink-0" />
                            <span>{event.date}, {event.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#F4F7FB] px-2.5 py-1 rounded-lg border border-[#D9E0EA]/70">
                            <Video size={14} className="text-[#F59E0B] shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-none">{event.location}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action */}
            <div className="flex flex-row sm:flex-col justify-between items-center sm:items-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D9E0EA]/40">
                <button 
                    type="button"
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label="Event options"
                >
                    <MoreHorizontal size={18} />
                </button>
                <Link
                    href={`/events/${eventId}`}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-white font-semibold rounded-xl transition-all duration-150 text-xs shadow-xs cursor-pointer active:scale-[0.98] inline-block text-center"
                >
                    Register Now
                </Link>
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
            
            const mappedEvents = (res.data || []).map(e => ({ ...e, id: e.id || e._id || '' }));
            setEvents(mappedEvents);
            setTotalEvents(res.total || 0);
        } catch (error) {
            console.error("Failed to fetch events", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchEvents(currentPage, searchQuery, sortOrder);
        }, 300);
        return () => clearTimeout(timeout);
    }, [currentPage, searchQuery, sortOrder]);

    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSortOrder(e.target.value);
        setCurrentPage(1);
    };

    return (
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
                            Events & Webinars
                        </h1>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#5B6472] font-medium">
                        <span>Sort by:</span>
                        <div className="relative">
                            <select 
                                value={sortOrder}
                                onChange={handleSortChange}
                                className="px-3 py-1.5 bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl text-xs font-semibold text-[#111827] hover:border-[#071A4D] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none transition-colors cursor-pointer"
                            >
                                <option value="Recently added">Recently added</option>
                                <option value="Upcoming">Upcoming</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5B6472]" size={16} />
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full pl-9 pr-4 py-2 bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl text-xs font-medium focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none text-[#111827] placeholder:text-[#5B6472] transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Events List */}
            <div className="divide-y divide-[#D9E0EA]/60 min-h-[300px]">
                {isLoading ? (
                    <div className="p-6 space-y-5 animate-pulse">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col sm:flex-row gap-5 pb-5 border-b border-[#D9E0EA]/40 last:border-0">
                                <div className="w-full sm:w-44 h-28 bg-[#F4F7FB] border border-[#D9E0EA] rounded-xl shrink-0" />
                                <div className="flex-1 space-y-2.5">
                                    <div className="h-5 w-48 bg-slate-200 rounded-lg" />
                                    <div className="h-3 w-32 bg-slate-100 rounded" />
                                    <div className="h-4 w-44 bg-slate-100 rounded mt-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center text-[#5B6472] mb-3">
                            <Calendar size={20} />
                        </div>
                        <p className="text-sm font-semibold text-[#111827]">
                            {searchQuery ? "No events found matching your search." : "There are currently no events to display."}
                        </p>
                        <p className="text-xs text-[#5B6472] mt-1 max-w-sm">
                            {searchQuery ? "Try searching with broader terms or check upcoming dates." : "New professional workshops, hackathons, and webinars are published regularly."}
                        </p>
                    </div>
                ) : (
                    events.map((event) => (
                        <EventCard key={event.id} event={event} />
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="p-6 border-t border-[#D9E0EA]/70 flex justify-center">
                    <Pagination
                        current={currentPage}
                        total={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}
        </div>
    );
}