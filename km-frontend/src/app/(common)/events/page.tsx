'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowsDownUpIcon, CalendarBlankIcon, CheckCircleIcon, ClockIcon, MagnifyingGlassIcon, MapPinIcon, TagIcon, TicketIcon, UsersIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from "@/lib/notify";
import Link from 'next/link';
import AttendeeListModal from '@/components/km/AttendeeListModal';
import PageHero, { HeroAccent } from '@/components/km/PageHero';
import AdSlot from '@/components/ads/AdSlot';

/** The events grid shows one sponsored row, after this many events (a full row at 1, 2 or 3 columns) */
const GRID_AD_AFTER = 6;

interface EventData {
    id: string;
    title: string;
    organizer: string;
    organizer_id?: string;
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
    <div className="bg-km-surface-card rounded-2xl overflow-hidden border border-km-border flex flex-col shadow-xs">
        <div className="h-48 bg-km-surface animate-shimmer" />
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
                <div className="h-4 bg-km-surface animate-shimmer rounded-md w-1/3" />
                <div className="h-5 bg-km-surface animate-shimmer rounded-md w-4/5" />
                <div className="h-3 bg-km-surface animate-shimmer rounded-md w-1/2" />
            </div>
            <div className="pt-3 border-t border-km-border flex justify-between items-center">
                <div className="h-3 bg-km-surface animate-shimmer rounded-md w-1/4" />
                <div className="h-3 bg-km-surface animate-shimmer rounded-md w-1/4" />
            </div>
        </div>
    </div>
);

// ─── Professional Empty State ───
const EmptyState = ({ hasSearch, onReset }: { hasSearch: boolean; onReset: () => void }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center">
        <CalendarBlankIcon size={36} weight="duotone" className="text-[#F59E0B] mb-4" aria-hidden="true" />
        <h3 className="text-lg font-bold text-km-text-primary mb-1.5">
            {hasSearch ? "No Workshops Found" : "No Workshops Scheduled Yet"}
        </h3>
        <p className="text-sm text-km-text-secondary max-w-md mb-5 leading-relaxed">
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
                <ArrowCounterClockwiseIcon weight="bold" size={13} />
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

    // Only the newest request may update the list, so a slow older answer can't overwrite a newer filter
    const requestIdRef = useRef(0);

    const fetchEvents = useCallback(async (pageNum: number, currentSearch: string, currentLocation: string, currentSort: string, currentPricing: string) => {
        const requestId = ++requestIdRef.current;
        try {
            setLoading(true);
            let url = `/events?page=${pageNum}&limit=9`;
            if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
            if (currentLocation) url += `&location=${encodeURIComponent(currentLocation)}`;
            if (currentSort === 'upcoming') url += `&sort=Upcoming`;
            if (currentPricing === 'free') url += `&is_paid=false`;
            if (currentPricing === 'paid') url += `&is_paid=true`;

            const res: any = await api.get(url);
            if (requestId !== requestIdRef.current) return;
            const newEvents = res.data || [];
            if (pageNum === 1) {
                setEvents(newEvents);
            } else {
                setEvents((prev) => [...prev, ...newEvents]);
            }
            setTotal(res.total || 0);
            setHasMore(newEvents.length === 9);
        } catch (error: any) {
            if (requestId === requestIdRef.current) notify.error(error, "Failed to load workshops");
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
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
        <div className="bg-km-surface min-h-screen pb-20 font-sans">

            {/* ─── Hero ─── */}
            <PageHero
                overlap
                kicker={{ label: 'Events & Bootcamps', Icon: CalendarBlankIcon, tone: 'events' }}
                title={<>Skill Bootcamps & <HeroAccent>Live Events</HeroAccent></>}
                description="Live workshops and bootcamps by verified experts, on Google Meet or Zoom."
                highlights={[
                    { Icon: VideoCameraIcon, label: 'Google Meet & Zoom Access' },
                    { Icon: CheckCircleIcon, label: 'Verified Industry Experts' },
                    { Icon: TicketIcon, label: 'Instant Digital Entry Pass' },
                ]}
                art={{ src: '/events-page-art.png', alt: 'KaamMilega Events and Bootcamps', wide: true }}
            >
                <div className="flex flex-wrap items-center gap-3">
                    <a href="#workshops-catalog" className="btn-accent text-xs px-5 py-2.5 shadow-sm">
                        Browse Events
                    </a>
                    <Link
                        href="/expert/apply"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/30 text-white hover:bg-white/10 hover:border-white transition-all shadow-xs dark:hover:border-km-surface-card"
                    >
                        <span>Host an Event</span>
                        <ArrowRightIcon weight="bold" size={13} />
                    </Link>
                </div>
            </PageHero>

            {/* ─── Search + Filters Bar ─── */}
            <div id="workshops-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 lg:-mt-10 relative z-20">
                <div className="bg-km-surface-card rounded-2xl shadow-sm border border-km-border p-4 sm:p-5">
                    <div className="flex flex-col md:flex-row gap-3 mb-3.5">
                        {/* Search Input */}
                        <div className="flex-1 flex items-center gap-2.5 bg-km-surface-card rounded-xl px-3.5 py-2.5 border border-km-border focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all">
                            <MagnifyingGlassIcon weight="bold" size={17} className="text-km-text-secondary shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by workshop title, mentor name, or skill..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-transparent text-sm text-km-text-primary placeholder:text-km-text-secondary/70 focus:outline-hidden font-medium"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="text-km-text-secondary hover:text-km-text-primary p-0.5 rounded-full"
                                >
                                    <XIcon weight="bold" size={14} />
                                </button>
                            )}
                        </div>

                        {/* Location Input */}
                        <div className="w-full md:w-60 flex items-center gap-2.5 bg-km-surface-card rounded-xl px-3.5 py-2.5 border border-km-border focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all">
                            <MapPinIcon weight="bold" size={17} className="text-km-text-secondary shrink-0" />
                            <input
                                type="text"
                                placeholder="Filter by city or online..."
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full bg-transparent text-sm text-km-text-primary placeholder:text-km-text-secondary/70 focus:outline-hidden font-medium"
                            />
                            {locationFilter && (
                                <button
                                    type="button"
                                    onClick={() => setLocationFilter('')}
                                    className="text-km-text-secondary hover:text-km-text-primary p-0.5 rounded-full"
                                >
                                    <XIcon weight="bold" size={14} />
                                </button>
                            )}
                        </div>

                        {/* Sort Toggle */}
                        <button
                            type="button"
                            onClick={() => setSort(s => s === 'recent' ? 'upcoming' : 'recent')}
                            className="flex items-center justify-center gap-2 bg-km-surface-card hover:bg-km-surface text-km-text-primary px-4 py-2.5 rounded-xl border border-km-border font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
                        >
                            <ClockIcon weight="bold" size={14} className="text-km-text-secondary" />
                            <span>{sort === 'upcoming' ? 'Sorted by: Upcoming Date' : 'Sorted by: Recently Added'}</span>
                            <ArrowsDownUpIcon weight="bold" size={13} className="text-km-text-secondary" />
                        </button>
                    </div>

                    {/* Pricing Filter Pills & Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-km-border">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-km-text-secondary mr-1 flex items-center gap-1.5">
                                <TagIcon weight="bold" size={13} className="text-[#F59E0B]" /> Format & Pricing:
                            </span>
                            <button
                                type="button"
                                onClick={() => setPricingFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    pricingFilter === 'all'
                                        ? 'bg-[#071A4D] text-white shadow-2xs dark:bg-km-primary'
                                        : 'bg-km-surface text-km-text-secondary hover:text-km-text-primary'
                                }`}
                            >
                                All Sessions
                            </button>
                            <button
                                type="button"
                                onClick={() => setPricingFilter('free')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    pricingFilter === 'free'
                                        ? 'bg-[#071A4D] text-white shadow-2xs dark:bg-km-primary'
                                        : 'bg-km-surface text-km-text-secondary hover:text-km-text-primary'
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
                                        : 'bg-km-surface text-km-text-secondary hover:text-km-text-primary'
                                }`}
                            >
                                <TicketIcon weight="bold" size={12} />
                                Paid Masterclasses
                            </button>
                        </div>

                        {/* Reset button if filters active */}
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs font-semibold text-km-link hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <ArrowCounterClockwiseIcon weight="bold" size={12} /> Clear all filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Results Count Header */}
                {!loading && (
                    <div className="flex items-center justify-between mt-6 mb-2 px-1">
                        <p className="text-sm font-semibold text-km-text-secondary">
                            {total > 0 ? (
                                <>Showing <span className="text-km-text-primary font-bold">{total}</span> verified session{total !== 1 ? 's' : ''}</>
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
                            const d = event.date ? new Date(event.date) : null;
                            const validDate = d !== null && !isNaN(d.getTime());
                            const registered = event.participants?.length || 0;
                            const seatsLeft = event.capacity && event.capacity > 0 ? (event.available_seats ?? event.capacity) : null;
                            const isOnline = /online|zoom|meet/i.test(event.location || '');
                            const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
                            const isPast = validDate && d !== null && d < startOfToday;

                            return (
                                <React.Fragment key={event.id || idx}>
                                <Link href={`/events/${event.id}`} className={`km-card flex flex-col group overflow-hidden ${isPast ? 'opacity-75' : ''}`}>
                                    <div className="h-32 overflow-hidden border-b border-km-border bg-linear-to-br from-[#071A4D] to-[#0B5ED7] flex items-center justify-center">
                                        {event.image_url ? (
                                            <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <CalendarBlankIcon size={36} weight="duotone" className="text-[#FCD34D]" aria-hidden="true" />
                                        )}
                                    </div>

                                    <div className="p-5 flex flex-col flex-1">
                                        <div className="flex items-start gap-4 mb-4">
                                            {/* Date tile */}
                                            <div className="w-14 shrink-0 rounded-xl border border-km-border bg-km-surface text-center py-2">
                                                <span className="block text-xs font-semibold text-[#B45309] dark:text-amber-300">
                                                    {validDate && d ? d.toLocaleDateString('en-IN', { month: 'short' }) : 'Date'}
                                                </span>
                                                <span className="block text-xl font-bold text-km-text-primary leading-tight">
                                                    {validDate && d ? d.getDate() : '–'}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="text-xs font-semibold text-[#B45309] dark:text-amber-300 truncate">
                                                        {event.category || 'Workshop'}
                                                    </span>
                                                    {isPast ? (
                                                        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md bg-km-surface text-km-text-secondary border border-km-border">
                                                            Ended
                                                        </span>
                                                    ) : (
                                                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md ${isPaid ? 'bg-[#FF6B00] text-white' : 'bg-km-surface text-[#15803D] border border-km-border dark:text-emerald-400'}`}>
                                                            {isPaid ? `₹${event.price}` : 'Free'}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-km-text-primary text-base leading-snug line-clamp-2 group-hover:text-km-link transition-colors">
                                                    {event.title}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-km-text-secondary mb-4">
                                            <p className="flex items-center gap-2">
                                                <ClockIcon weight="bold" size={14} className="text-[#F59E0B] shrink-0" />
                                                {validDate && d ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : formatDate(event.date)}
                                                {event.time && ` · ${event.time}`}
                                            </p>
                                            <p className="flex items-center gap-2 min-w-0">
                                                {isOnline
                                                    ? <VideoCameraIcon weight="bold" size={14} className="text-[#F59E0B] shrink-0" />
                                                    : <MapPinIcon weight="bold" size={14} className="text-[#F59E0B] shrink-0" />}
                                                <span className="truncate">{event.location || 'Online'}</span>
                                            </p>
                                            <p className="truncate">
                                                Hosted by <span className="font-medium text-km-text-primary">{event.organizer}</span>
                                            </p>
                                        </div>

                                        <div className="mt-auto pt-3.5 border-t border-km-border flex items-center justify-between gap-2">
                                            {registered > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setAttendeeModalEvent({ id: event.id, title: event.title, total: registered });
                                                    }}
                                                    className="flex items-center gap-1.5 text-xs font-medium text-km-text-secondary hover:text-km-text-primary cursor-pointer"
                                                >
                                                    <UsersIcon weight="bold" size={14} />
                                                    {registered} going{seatsLeft !== null && ` · ${seatsLeft} seats left`}
                                                </button>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-xs text-km-text-secondary">
                                                    <UsersIcon weight="bold" size={14} />
                                                    {seatsLeft !== null ? `${seatsLeft} seats` : 'Open to all'}
                                                </span>
                                            )}
                                            <span className="text-xs font-semibold text-km-heading group-hover:text-km-link flex items-center gap-1 transition-colors">
                                                View event <ArrowRightIcon weight="bold" size={13} />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                                {idx === Math.min(GRID_AD_AFTER, events.length) - 1 && <AdSlot placement="events_inline" className="col-span-full" />}
                                </React.Fragment>
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
                        <div className="w-8 h-8 border-3 border-[#071A4D]/20 border-t-[#071A4D] rounded-full animate-spin dark:border-km-link" />
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
