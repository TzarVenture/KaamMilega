'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
    Calendar, 
    Users, 
    MapPin, 
    Search, 
    ArrowUpDown, 
    Clock, 
    Ticket, 
    CheckCircle2, 
    Tag, 
    ArrowRight,
    X,
    RotateCcw,
    Video,
    Award,
    Sparkle
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import Link from 'next/link';
import AttendeeListModal from '@/components/km/AttendeeListModal';

interface EventData {
    id: string;
    title: string;
    organizer: string;
    date: string;
    time: string;
    location: string;
    image_url?: string;
    category?: string;
    is_paid?: boolean;
    price?: number;
    capacity?: number;
    available_seats?: number;
    participants?: string[];
    description?: string;
}

// ─── Design.md Shimmer Skeleton Card ───
const EventCardSkeleton = () => (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#D9E0EA] flex flex-col shadow-xs">
        <div className="h-48 bg-[#F4F7FB] animate-shimmer" />
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
                <div className="h-4 bg-[#F4F7FB] animate-shimmer rounded-md w-1/3" />
                <div className="h-5 bg-[#F4F7FB] animate-shimmer rounded-md w-4/5" />
                <div className="h-3 bg-[#F4F7FB] animate-shimmer rounded-md w-1/2" />
            </div>
            <div className="pt-3 border-t border-[#D9E0EA] flex justify-between items-center">
                <div className="h-3 bg-[#F4F7FB] animate-shimmer rounded-md w-1/4" />
                <div className="h-3 bg-[#F4F7FB] animate-shimmer rounded-md w-1/4" />
            </div>
        </div>
    </div>
);

// ─── Professional Empty State ───
const EmptyState = ({ hasSearch, onReset }: { hasSearch: boolean; onReset: () => void }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 bg-[#FFFBEB] border border-[#FDE68A] text-[#F59E0B] rounded-2xl flex items-center justify-center mb-4 shadow-2xs">
            <Calendar className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#111827] mb-1.5">
            {hasSearch ? "No Workshops Found" : "No Workshops Scheduled Yet"}
        </h3>
        <p className="text-sm text-[#5B6472] max-w-md mb-5 leading-relaxed">
            {hasSearch
                ? "No workshops match your current search criteria. Try modifying your search keywords or resetting filters."
                : "Interactive workshops, masterclasses, and expert-led skill sessions will appear here once announced by our verified experts."}
        </p>
        {hasSearch && (
            <button
                type="button"
                onClick={onReset}
                className="btn-outline text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-1.5"
            >
                <RotateCcw size={13} />
                <span>Reset All Filters</span>
            </button>
        )}
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
    const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
    const [attendeeModalEvent, setAttendeeModalEvent] = useState<{ id: string; title: string; total: number } | null>(null);

    // Debounce refs
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [debouncedLocation, setDebouncedLocation] = useState('');

    // Debounce search input
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
        }, 400);
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
        }, 400);
        return () => {
            if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
        };
    }, [locationFilter]);

    const fetchEvents = useCallback(async (pageNum: number, currentSearch: string, currentLocation: string, currentSort: string, currentPricing: string) => {
        try {
            setLoading(true);
            let url = `/events?page=${pageNum}&limit=9`;
            if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
            if (currentLocation) url += `&location=${encodeURIComponent(currentLocation)}`;
            if (currentSort === 'upcoming') url += `&sort=Upcoming`;
            if (currentPricing === 'free') url += `&is_paid=false`;
            if (currentPricing === 'paid') url += `&is_paid=true`;

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
            toast.error(error?.response?.data?.error || error.message || "Failed to load workshops");
        } finally {
            setLoading(false);
        }
    }, []);

    // Reset page and fetch when debounced values or pricing filters change
    useEffect(() => {
        setPage(1);
        fetchEvents(1, debouncedSearch, debouncedLocation, sort, pricingFilter);
    }, [debouncedSearch, debouncedLocation, sort, pricingFilter, fetchEvents]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchEvents(nextPage, debouncedSearch, debouncedLocation, sort, pricingFilter);
    };

    const handleResetFilters = () => {
        setSearch('');
        setLocationFilter('');
        setSort('recent');
        setPricingFilter('all');
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

    const hasActiveFilters = Boolean(search || locationFilter || pricingFilter !== 'all' || sort !== 'recent');

    return (
        <div className="bg-[#F4F7FB] min-h-screen pb-20 font-sans">

            {/* ─── Hero Section with Dynamic Art Sizing Resting on Card Edge ─── */}
            <section className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-8 sm:pt-10 lg:pt-12 pb-6 sm:pb-8 lg:pb-10 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
                        {/* Left Column: Headlines & Value Props */}
                        <div className="lg:col-span-7 xl:col-span-7 text-left pb-6 sm:pb-8 lg:pb-10">
                            {/* Hero Badge without "Service 07" */}
                            <div className="inline-flex items-center gap-2 bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4">
                                <Calendar size={14} className="text-[#F59E0B]" />
                                <span>Workshops & Masterclasses</span>
                            </div>

                            {/* Master Brand Headline tailored for Skill Learning & Expert Sessions */}
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
                                Learn Practical Skills with <span className="text-[#FF6B00]">Live Expert Sessions</span>
                            </h1>

                            {/* Precise & Authentic Subheading */}
                            <p className="mt-3.5 text-sm sm:text-base text-white/80 max-w-xl font-normal leading-relaxed">
                                Join interactive workshops and live masterclasses led by verified practitioners. Learn practical trades, participate in live Q&A via Google Meet or Zoom, and advance your professional craft.
                            </p>

                            {/* CTA Row */}
                            <div className="flex flex-wrap items-center gap-3 mt-6">
                                <a
                                    href="#workshops-catalog"
                                    className="btn-accent text-xs px-5 py-2.5 shadow-sm"
                                >
                                    Browse Live Workshops
                                </a>
                                <Link
                                    href="/expert/apply"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/30 text-white hover:bg-white/10 hover:border-white transition-all"
                                >
                                    <span>Become an Expert & Host Sessions</span>
                                    <ArrowRight size={13} />
                                </Link>
                            </div>

                            {/* Key Benefits / Trust Chips */}
                            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 pt-5 border-t border-white/10 text-xs text-white/90 font-medium">
                                <div className="flex items-center gap-2">
                                    <Video size={15} className="text-[#10B981] shrink-0" />
                                    <span>Live Google Meet & Zoom Access</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-[#10B981] shrink-0" />
                                    <span>Verified Industry Practitioners</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Award size={15} className="text-[#10B981] shrink-0" />
                                    <span>Instant Digital Pass & QR</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Hero Artwork Resting Directly on Top Edge of Search Card */}
                        <div className="lg:col-span-5 xl:col-span-5 flex items-end justify-center lg:justify-end self-end">
                            <div 
                                className="relative flex items-end justify-center lg:justify-end"
                                style={{ width: 'clamp(320px, 44vw, 560px)', maxWidth: '100%' }}
                            >
                                <img
                                    src="/expert-page-art.png"
                                    alt="KaamMilega Skill Workshops and Masterclasses"
                                    className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xl block translate-y-[1px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Search + Filters Bar ─── */}
            <div id="workshops-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 lg:-mt-10 relative z-20">
                <div className="bg-white rounded-2xl shadow-sm border border-[#D9E0EA] p-4 sm:p-5">
                    <div className="flex flex-col md:flex-row gap-3 mb-3.5">
                        {/* Search Input */}
                        <div className="flex-1 flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5 border border-[#D9E0EA] focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all">
                            <Search size={17} className="text-[#5B6472] shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by workshop title, mentor name, or skill..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#5B6472]/70 focus:outline-hidden font-medium"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="text-[#5B6472] hover:text-[#111827] p-0.5 rounded-full"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Location Input */}
                        <div className="w-full md:w-60 flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5 border border-[#D9E0EA] focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all">
                            <MapPin size={17} className="text-[#5B6472] shrink-0" />
                            <input
                                type="text"
                                placeholder="Filter by city or online..."
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#5B6472]/70 focus:outline-hidden font-medium"
                            />
                            {locationFilter && (
                                <button
                                    type="button"
                                    onClick={() => setLocationFilter('')}
                                    className="text-[#5B6472] hover:text-[#111827] p-0.5 rounded-full"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Sort Toggle */}
                        <button
                            type="button"
                            onClick={() => setSort(s => s === 'recent' ? 'upcoming' : 'recent')}
                            className="flex items-center justify-center gap-2 bg-white hover:bg-[#F4F7FB] text-[#111827] px-4 py-2.5 rounded-xl border border-[#D9E0EA] font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
                        >
                            <Clock size={14} className="text-[#5B6472]" />
                            <span>{sort === 'upcoming' ? 'Sorted by: Upcoming Date' : 'Sorted by: Recently Added'}</span>
                            <ArrowUpDown size={13} className="text-[#5B6472]" />
                        </button>
                    </div>

                    {/* Pricing Filter Pills & Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D9E0EA]">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[#5B6472] mr-1 flex items-center gap-1.5">
                                <Tag size={13} className="text-[#F59E0B]" /> Format & Pricing:
                            </span>
                            <button
                                type="button"
                                onClick={() => setPricingFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    pricingFilter === 'all'
                                        ? 'bg-[#071A4D] text-white shadow-2xs'
                                        : 'bg-[#F4F7FB] text-[#5B6472] hover:text-[#111827]'
                                }`}
                            >
                                All Sessions
                            </button>
                            <button
                                type="button"
                                onClick={() => setPricingFilter('free')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    pricingFilter === 'free'
                                        ? 'bg-[#071A4D] text-white shadow-2xs'
                                        : 'bg-[#F4F7FB] text-[#5B6472] hover:text-[#111827]'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${pricingFilter === 'free' ? 'bg-[#10B981]' : 'bg-[#5B6472]'}`} />
                                Free Workshops
                            </button>
                            <button
                                type="button"
                                onClick={() => setPricingFilter('paid')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    pricingFilter === 'paid'
                                        ? 'bg-[#FF6B00] text-white shadow-2xs'
                                        : 'bg-[#F4F7FB] text-[#5B6472] hover:text-[#111827]'
                                }`}
                            >
                                <Ticket size={12} />
                                Paid Masterclasses
                            </button>
                        </div>

                        {/* Reset button if filters active */}
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs font-semibold text-[#0B5ED7] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw size={12} /> Clear all filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Results Count Header */}
                {!loading && (
                    <div className="flex items-center justify-between mt-6 mb-2 px-1">
                        <p className="text-sm font-semibold text-[#5B6472]">
                            {total > 0 ? (
                                <>Showing <span className="text-[#111827] font-bold">{total}</span> verified session{total !== 1 ? 's' : ''}</>
                            ) : (
                                <>No workshops match the selected criteria</>
                            )}
                        </p>
                    </div>
                )}
            </div>

            {/* ─── Events Grid ─── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading && events.length === 0 ? (
                        Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)
                    ) : events.length === 0 ? (
                        <EmptyState hasSearch={hasActiveFilters} onReset={handleResetFilters} />
                    ) : (
                        events.map((event, idx) => {
                            const isPaid = event.is_paid && (event.price || 0) > 0;
                            const priceText = isPaid ? `₹${event.price}` : 'Free Entry';

                            return (
                                <Link
                                    href={`/events/${event.id}`}
                                    key={event.id || idx}
                                    className="km-card flex flex-col group overflow-hidden"
                                >
                                    {/* Card Image Area */}
                                    <div className="h-48 bg-[#F4F7FB] relative overflow-hidden border-b border-[#D9E0EA]">
                                        {event.image_url ? (
                                            <img
                                                src={event.image_url}
                                                alt={event.title}
                                                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-[#5B6472] p-4 bg-[#F4F7FB]">
                                                <div className="w-12 h-12 rounded-xl bg-white border border-[#D9E0EA] flex items-center justify-center text-[#071A4D] mb-2 shadow-2xs">
                                                    <Calendar size={22} className="text-[#F59E0B]" />
                                                </div>
                                                <span className="text-[11px] font-semibold text-[#5B6472]">Skill Masterclass</span>
                                            </div>
                                        )}

                                        {/* Location Badge */}
                                        <span className="absolute top-3 left-3 bg-[#111827]/85 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                                            <MapPin size={11} className="text-[#FF6B00]" /> {event.location || 'Online Meet / Zoom'}
                                        </span>

                                        {/* Pricing Badge */}
                                        <span className={`absolute bottom-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1 ${
                                            isPaid ? 'bg-[#FF6B00]' : 'bg-[#071A4D]'
                                        }`}>
                                            {isPaid && <Ticket size={12} />}
                                            {priceText}
                                        </span>
                                    </div>

                                    {/* Card Content Area */}
                                    <div className="p-5 flex flex-col flex-1">
                                        {/* Category Badge */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 rounded-md">
                                                {event.category || 'Live Workshop'}
                                            </span>
                                        </div>

                                        {/* Event Title */}
                                        <h3 className="font-bold text-[#111827] text-base leading-snug line-clamp-2 group-hover:text-[#0B5ED7] transition-colors mb-1.5">
                                            {event.title}
                                        </h3>

                                        {/* Organizer / Expert */}
                                        <p className="text-xs text-[#5B6472] font-normal mb-3">
                                            Hosted by <span className="font-medium text-[#111827]">{event.organizer}</span>
                                        </p>

                                        {/* Date & Time */}
                                        <div className="flex items-center gap-2 text-xs text-[#5B6472] mb-3">
                                            <Calendar size={13} className="text-[#F59E0B] shrink-0" />
                                            <span>{formatDate(event.date)}</span>
                                            {event.time && <span>• {event.time}</span>}
                                        </div>

                                        {/* Available seats if capacity configured */}
                                        {event.capacity && event.capacity > 0 ? (
                                            <div className="mb-3 text-[11px] text-[#5B6472] flex items-center justify-between">
                                                <span>Seats left: <strong className="text-[#111827]">{event.available_seats ?? event.capacity}</strong></span>
                                                <span className="text-[#5B6472]">Capacity: {event.capacity}</span>
                                            </div>
                                        ) : null}

                                        {/* Card Footer */}
                                        <div className="mt-auto pt-3.5 border-t border-[#D9E0EA] flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setAttendeeModalEvent({
                                                        id: event.id,
                                                        title: event.title,
                                                        total: event.participants?.length || 0
                                                    });
                                                }}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-[#5B6472] hover:text-[#071A4D] hover:bg-[#F4F7FB] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                                title="View registered participants"
                                            >
                                                <Users size={13} className="text-[#071A4D]" />
                                                <span>{event.participants?.length || 0} registered</span>
                                            </button>

                                            <span className="text-xs font-semibold text-[#071A4D] group-hover:text-[#0B5ED7] flex items-center gap-1 transition-colors">
                                                View Session <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>

                {/* Load More Button */}
                {hasMore && !loading && (
                    <div className="flex justify-center mt-10">
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            className="btn-outline text-xs px-8 py-3 cursor-pointer shadow-2xs"
                        >
                            Load More Workshops
                        </button>
                    </div>
                )}

                {/* Loading Indicator for Subsequent Pages */}
                {loading && events.length > 0 && (
                    <div className="flex justify-center mt-8">
                        <div className="w-8 h-8 border-3 border-[#071A4D]/20 border-t-[#071A4D] rounded-full animate-spin" />
                    </div>
                )}

                {/* Attendee List Modal */}
                {attendeeModalEvent && (
                    <AttendeeListModal
                        isOpen={Boolean(attendeeModalEvent)}
                        onClose={() => setAttendeeModalEvent(null)}
                        eventId={attendeeModalEvent.id}
                        eventTitle={attendeeModalEvent.title}
                        totalJoinedCount={attendeeModalEvent.total}
                    />
                )}
            </div>
        </div>
    );
};

export default PublicEventsPage;
