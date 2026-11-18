'use client'

import Link from 'next/link';
import { ArrowRightIcon, CalendarBlankIcon, ClockIcon, MapPinIcon, UsersIcon, VideoCameraIcon } from '@phosphor-icons/react';

/** The event fields a card shows, as GET /events returns them */
export interface EventCardData {
    id?: string;
    title: string;
    organizer: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM, India time
    location: string;
    image_url?: string;
    category?: string;
    is_paid?: boolean;
    price?: number;
    capacity?: number;
    available_seats?: number;
    participants?: string[];
}

function formatDate(dateStr: string) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

/**
 * One event in the /events grid. The Host an event page renders the same card as a live
 * preview (preview: true), so a host sees exactly what people will see.
 */
export default function EventCard({ event, onShowAttendees, preview = false }: {
    event: EventCardData;
    onShowAttendees?: (event: { id: string; title: string; total: number }) => void;
    preview?: boolean;
}) {
    const isPaid = event.is_paid && (event.price || 0) > 0;
    const d = event.date ? new Date(event.date) : null;
    const validDate = d !== null && !isNaN(d.getTime());
    const registered = event.participants?.length || 0;
    const seatsLeft = event.capacity && event.capacity > 0 ? (event.available_seats ?? event.capacity) : null;
    const isOnline = /online|zoom|meet/i.test(event.location || '');
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const isPast = validDate && d !== null && d < startOfToday;
    const className = `km-card flex flex-col group overflow-hidden ${isPast ? 'opacity-75' : ''}`;

    const body = (
        <>
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
                    {registered > 0 && onShowAttendees ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onShowAttendees({ id: event.id || '', title: event.title, total: registered });
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
        </>
    );

    if (preview) return <div className={className}>{body}</div>;
    return <Link href={`/events/${event.id}`} className={className}>{body}</Link>;
}
