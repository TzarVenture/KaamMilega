'use client'

import React, { useState, useEffect } from 'react';
import Pagination from '@/components/ui/Pagination';
import { ArrowLeftIcon, CalendarBlankIcon, DotsThreeIcon, MagnifyingGlassIcon, TicketIcon, VideoCameraIcon } from '@phosphor-icons/react';
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
        <div className="flex flex-col sm:flex-row gap-5 p-4 sm:p-5 border-b border-km-border/70 last:border-0 hover:bg-km-surface/40 transition-colors group rounded-xl">
            {/* Event Image */}
            <div className="w-full sm:w-44 h-36 sm:h-28 bg-[#071A4D] rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 border border-slate-700 shadow-2xs dark:bg-km-primary">
                {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex items-center gap-1.5 text-white/50 group-hover:scale-105 transition-transform duration-200">
                        <TicketIcon size={24} className="text-[#F59E0B]" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                    <Link href={`/events/${eventId}`} className="hover:text-km-link transition-colors">
                        <h3 className="text-base font-bold text-km-text-primary leading-snug group-hover:text-km-link transition-colors line-clamp-2">
                            {event.title}
                        </h3>
                    </Link>
                    <p className="text-xs text-km-text-secondary font-medium mt-1 truncate">
                        Organized by <span className="text-[#D97706] font-semibold">{event.organizer}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 sm:gap-4 text-xs font-semibold text-km-text-secondary">
                        <div className="flex items-center gap-1.5 bg-km-surface px-2.5 py-1 rounded-lg border border-km-border/70">
                            <CalendarBlankIcon weight="bold" size={14} className="text-[#F59E0B] shrink-0" />
                            <span>{event.date}, {event.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-km-surface px-2.5 py-1 rounded-lg border border-km-border/70">
                            <VideoCameraIcon weight="bold" size={14} className="text-[#F59E0B] shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-none">{event.location}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action */}
            <div className="flex flex-row sm:flex-col justify-between items-center sm:items-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-km-border/40">
                <button 
                    type="button"
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label="Event options"
                >
                    <DotsThreeIcon weight="bold" size={18} />
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
        <div className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-km-border/70">
                <div className="flex items-center gap-3 mb-5">
                    <button 
                        type="button"
                        className="p-2 hover:bg-km-surface rounded-xl text-km-text-secondary hover:text-km-heading transition-colors cursor-pointer active:scale-[0.98]" 
                        onClick={() => router.back()}
                        aria-label="Back to network"
                    >
                        <ArrowLeftIcon weight="bold" size={18} />
                    </button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-km-text-primary">
                            Events & Webinars
                        </h1>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-km-text-secondary font-medium">
                        <span>Sort by:</span>
                        <div className="relative">
                            <select 
                                value={sortOrder}
                                onChange={handleSortChange}
                                className="px-3 py-1.5 bg-km-surface border border-km-border rounded-xl text-xs font-semibold text-km-text-primary hover:border-[#071A4D] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none transition-colors cursor-pointer dark:hover:border-km-link"
                            >
                                <option value="Recently added">Recently added</option>
                                <option value="Upcoming">Upcoming</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <MagnifyingGlassIcon weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary" size={16} />
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full pl-9 pr-4 py-2 bg-km-surface border border-km-border rounded-xl text-xs font-medium focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none text-km-text-primary placeholder:text-km-text-secondary transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Events List */}
            <div className="divide-y divide-km-border/60 min-h-[300px]">
                {isLoading ? (
                    <div className="p-6 space-y-5 animate-pulse">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col sm:flex-row gap-5 pb-5 border-b border-km-border/40 last:border-0">
                                <div className="w-full sm:w-44 h-28 bg-km-surface border border-km-border rounded-xl shrink-0" />
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
                        <CalendarBlankIcon size={28} weight="duotone" className="text-km-text-secondary mb-3" aria-hidden="true" />
                        <p className="text-sm font-semibold text-km-text-primary">
                            {searchQuery ? "No events found matching your search." : "There are currently no events to display."}
                        </p>
                        <p className="text-xs text-km-text-secondary mt-1 max-w-sm">
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
                <div className="p-6 border-t border-km-border/70 flex justify-center">
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