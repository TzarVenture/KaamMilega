'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Calendar, Users, Bookmark, MapPin, Search, ArrowUpDown, Clock, TrendingUp } from 'lucide-react';
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
    participants?: string[];
    description?: string;
}

// ─── Shimmer Skeleton Card ───
const EventCardSkeleton = () => (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 animate-pulse">
        <div className="h-48 bg-slate-200" />
        <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded-lg w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
                </div>
            </div>
            <div className="flex justify-between mb-4">
                <div className="h-3 bg-slate-100 rounded-lg w-1/3" />
                <div className="h-3 bg-slate-100 rounded-lg w-1/4" />
            </div>
            <div className="h-9 bg-slate-100 rounded-xl w-full" />
        </div>
    </div>
);

// ─── Empty State ───
const EmptyState = ({ hasSearch }: { hasSearch: boolean }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
            <Calendar className="w-10 h-10 text-km-accent" />
        </div>
        <h3 className="text-xl font-black text-slate-800 mb-2">
            {hasSearch ? "No Events Found" : "No Events Yet"}
        </h3>
        <p className="text-sm text-slate-500 max-w-sm">
            {hasSearch
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Stay tuned! Exciting events and workshops are coming soon."}
        </p>
    </div>
);

const PublicEventsPage = () => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [sort, setSort] = useState('recent');

    // Debounce refs
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [debouncedLocation, setDebouncedLocation] = useState('');

    // Debounce search input
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [search]);

    // Debounce location input
    const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
        locationDebounceRef.current = setTimeout(() => {
            setDebouncedLocation(locationFilter);
        }, 500);
        return () => {
            if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
        };
    }, [locationFilter]);

    const fetchEvents = useCallback(async (pageNum: number, currentSearch: string, currentLocation: string, currentSort: string) => {
        try {
            setLoading(true);
            let url = `/events?page=${pageNum}&limit=9`;
            if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
            if (currentLocation) url += `&location=${encodeURIComponent(currentLocation)}`;
            if (currentSort === 'upcoming') url += `&sort=Upcoming`;

            const res: any = await api.get(url);
            const newEvents = res.data || [];
            if (pageNum === 1) {
                setEvents(newEvents);
            } else {
                setEvents((prev) => [...prev, ...newEvents]);
            }
            setTotal(res.total || 0);
            setHasMore(newEvents.length === 9);
        } catch (error: any) {
            toast.error(error.message || "Failed to load events");
        } finally {
            setLoading(false);
        }
    }, []);

    // Reset page and fetch when debounced values change
    useEffect(() => {
        setPage(1);
        fetchEvents(1, debouncedSearch, debouncedLocation, sort);
    }, [debouncedSearch, debouncedLocation, sort, fetchEvents]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchEvents(nextPage, debouncedSearch, debouncedLocation, sort);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-20">

            {/* ─── Hero Section ─── */}
            <div className="bg-linear-to-br from-slate-950 via-[#071A4D] to-slate-950 pt-10 pb-28 md:pt-14 md:pb-32 px-4 text-center text-white relative overflow-hidden">
                {/* Subtle Decorative Elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-km-accent/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-slate-50 to-transparent z-10 pointer-events-none" />

                <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-xs font-bold px-4 py-1.5 rounded-full border border-white/10 mb-5">
                        <Calendar size={14} className="text-km-accent" /> Workshops, Masterclasses & Networking
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black mb-3 tracking-tight">
                        Discover Amazing <span className="text-km-accent">Events</span>
                    </h1>
                    <p className="text-sm md:text-base text-white/60 max-w-lg mx-auto font-medium">
                        Join events hosted by top industry experts. Learn new skills, grow your network, and advance your career.
                    </p>
                </div>
            </div>

            {/* ─── Search + Filters Bar ─── */}
            <div className="max-w-5xl mx-auto px-4 -mt-20 relative z-20">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-3 md:p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Search Input */}
                        <div className="flex-1 flex items-center gap-2.5 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-km-primary/30 focus-within:ring-2 focus-within:ring-km-primary/10 transition-all">
                            <Search size={18} className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by event name or organizer..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Location Input */}
                        <div className="md:w-56 flex items-center gap-2.5 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-km-primary/30 focus-within:ring-2 focus-within:ring-km-primary/10 transition-all">
                            <MapPin size={18} className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="City or 'Online'"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Sort Toggle */}
                        <button
                            onClick={() => setSort(s => s === 'recent' ? 'upcoming' : 'recent')}
                            className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 text-sm font-bold text-slate-700 transition-colors shrink-0"
                        >
                            {sort === 'upcoming' ? <Clock size={16} className="text-km-accent" /> : <TrendingUp size={16} className="text-km-primary" />}
                            {sort === 'upcoming' ? 'Upcoming' : 'Recent'}
                            <ArrowUpDown size={14} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Results Count */}
                {!loading && (
                    <div className="flex items-center justify-between mt-6 mb-2 px-1">
                        <p className="text-sm font-bold text-slate-500">
                            {total > 0 ? (
                                <>{total} event{total !== 1 ? 's' : ''} found</>
                            ) : (
                                <>No events found</>
                            )}
                        </p>
                    </div>
                )}
            </div>

            {/* ─── Events Grid ─── */}
            <div className="max-w-5xl mx-auto px-4 mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {loading && events.length === 0 ? (
                        // Shimmer Skeleton
                        Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)
                    ) : events.length === 0 ? (
                        <EmptyState hasSearch={!!(debouncedSearch || debouncedLocation)} />
                    ) : (
                        events.map((event, idx) => (
                            <Link
                                href={`/events/${event.id}`}
                                key={event.id || idx}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-slate-100 hover:border-slate-200 transition-all duration-300 flex flex-col group"
                            >
                                {/* Card Image */}
                                <div className="h-44 bg-slate-200 relative overflow-hidden">
                                    {event.image_url ? (
                                        <img
                                            src={event.image_url}
                                            alt={event.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-linear-to-br from-slate-900 via-[#071A4D] to-slate-900 flex items-center justify-center">
                                            <div className="flex items-center justify-center opacity-30">
                                                <div className="w-14 h-14 bg-km-accent rounded-lg transform -rotate-12" />
                                                <div className="w-10 h-10 bg-km-accent/70 rounded-lg translate-y-3 -translate-x-3" />
                                            </div>
                                        </div>
                                    )}
                                    {/* Location Badge */}
                                    <span className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                                        <MapPin size={10} /> {event.location || 'Online'}
                                    </span>
                                    {/* Bookmark */}
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        className="absolute top-3 right-3 p-2 bg-white/15 backdrop-blur-md rounded-lg text-white hover:bg-white hover:text-km-accent transition-all"
                                    >
                                        <Bookmark size={14} />
                                    </button>
                                </div>

                                {/* Card Content */}
                                <div className="p-5 flex flex-col flex-1">
                                    {/* Title & Organizer */}
                                    <h4 className="font-bold text-slate-900 text-base leading-snug mb-1 line-clamp-2 group-hover:text-km-primary transition-colors">
                                        {event.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-medium mb-4">
                                        By <span className="font-semibold text-slate-600">{event.organizer}</span>
                                    </p>

                                    {/* Date & Participants */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium mt-auto pt-4 border-t border-slate-50">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar size={13} className="text-km-accent" />
                                            {formatDate(event.date)} {event.time && `• ${event.time}`}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Users size={13} className="text-km-primary" />
                                            {event.participants?.length || 0} joined
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                {/* Load More */}
                {hasMore && !loading && (
                    <div className="flex justify-center mt-10">
                        <button
                            onClick={handleLoadMore}
                            className="px-8 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:border-km-primary hover:text-km-primary transition-all shadow-sm"
                        >
                            Load More Events
                        </button>
                    </div>
                )}

                {/* Loading indicator for pagination */}
                {loading && events.length > 0 && (
                    <div className="flex justify-center mt-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-km-accent" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicEventsPage;
