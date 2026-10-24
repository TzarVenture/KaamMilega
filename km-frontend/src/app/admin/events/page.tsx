'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    CalendarBlankIcon,
    CurrencyInrIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    TrashIcon,
    PencilSimpleIcon,
    EyeIcon,
    TicketIcon,
    UsersIcon,
    MapPinIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowCounterClockwiseIcon,
    CreditCardIcon,
    WalletIcon,
    XIcon,
    CaretLeftIcon,
    CaretRightIcon
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { notify } from '@/lib/notify';
import api from '@/lib/axios';

interface AdminEventItem {
    id: string;
    title: string;
    organizer: string;
    organizer_id?: string;
    description?: string;
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
    total_participants: number;
    total_tickets_sold: number;
    total_revenue: number;
    free_registrations: number;
    paid_registrations: number;
    wallet_bookings: number;
    razorpay_bookings: number;
    created_at: string;
}

interface EventDetailResponse {
    event: AdminEventItem;
    total_participants: number;
    total_tickets_sold: number;
    total_revenue: number;
    free_registrations: number;
    paid_registrations: number;
    tickets: Array<{
        id: string;
        ticket_number: string;
        attendee_name: string;
        attendee_email: string;
        attendee_phone?: string;
        amount: number;
        payment_status: string;
        payment_method: string;
        created_at: string;
        status: string;
    }>;
    attendees: Array<{
        id: string;
        name: string;
        headline?: string;
        city?: string;
        role?: string;
        ticket_number?: string;
        payment_type?: string;
        joined_at?: string;
    }>;
}

const ITEMS_PER_PAGE = 10;

export default function AdminEventsPage() {
    const [events, setEvents] = useState<AdminEventItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Detail Audit Modal State
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);
    const [selectedEventDetail, setSelectedEventDetail] = useState<EventDetailResponse | null>(null);

    // Create / Edit Modal State
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        organizer: 'KaamMilega Official',
        description: '',
        date: '',
        time: '',
        location: '',
        image_url: '',
        category: 'Skill Workshop',
        is_paid: false,
        price: 0,
        capacity: 100,
        available_seats: 100,
    });

    // Delete Confirmation State
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await api.get('/admin/events', {
                params: {
                    page,
                    limit: ITEMS_PER_PAGE,
                    search: debouncedSearch,
                },
            });
            setEvents(res.data || []);
            setTotal(res.total || 0);
        } catch (error: any) {
            notify.error(error, 'Failed to fetch events oversight data');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // Total calculated pages
    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    }, [total]);

    // Standard numbered pagination list: 1, 2, 3, 4, ...
    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Keep first, current range, and last with ellipsis
            if (page <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
            } else if (page >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
            }
        }
        return pages;
    }, [totalPages, page]);

    // Open Audit Inspector
    const handleInspectEvent = async (id: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res: any = await api.get(`/admin/events/${id}`);
            setSelectedEventDetail(res);
        } catch (error: any) {
            notify.error(error, 'Failed to load event audit details');
            setAuditModalOpen(false);
        } finally {
            setAuditLoading(false);
        }
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        setEditingEventId(null);
        setFormData({
            title: '',
            organizer: 'KaamMilega Official',
            description: '',
            date: '',
            time: '10:00 AM - 12:00 PM',
            location: 'Online (Zoom / Meet)',
            image_url: '',
            category: 'Skill Workshop',
            is_paid: false,
            price: 0,
            capacity: 100,
            available_seats: 100,
        });
        setFormModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (ev: AdminEventItem) => {
        setEditingEventId(ev.id);
        setFormData({
            title: ev.title || '',
            organizer: ev.organizer || '',
            description: ev.description || '',
            date: ev.date || '',
            time: ev.time || '',
            location: ev.location || '',
            image_url: ev.image_url || '',
            category: ev.category || 'Skill Workshop',
            is_paid: !!ev.is_paid,
            price: ev.price || 0,
            capacity: ev.capacity || 100,
            available_seats: ev.available_seats ?? (ev.capacity || 100),
        });
        setFormModalOpen(true);
    };

    // Submit Create or Edit
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            notify.error('Title is required');
            return;
        }

        setSubmitting(true);
        try {
            if (editingEventId) {
                await api.put(`/admin/events/${editingEventId}`, formData);
                notify.success('Event updated successfully');
            } else {
                await api.post('/admin/events', formData);
                notify.success('Official platform event created');
            }
            setFormModalOpen(false);
            fetchEvents();
        } catch (error: any) {
            notify.error(error, editingEventId ? 'Failed to update event' : 'Failed to create event');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Event
    const handleDeleteEvent = async () => {
        if (!deleteConfirmId) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/events/${deleteConfirmId}`);
            notify.success('Event removed and tickets updated');
            setDeleteConfirmId(null);
            fetchEvents();
        } catch (error: any) {
            notify.error(error, 'Failed to delete event');
        } finally {
            setDeleting(false);
        }
    };

    // Aggregate Platform Stats
    const totalRevenueSum = events.reduce((acc, curr) => acc + (curr.total_revenue || 0), 0);
    const totalTicketsSum = events.reduce((acc, curr) => acc + (curr.total_tickets_sold || 0), 0);
    const totalParticipantsSum = events.reduce((acc, curr) => acc + (curr.total_participants || 0), 0);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 px-3 sm:px-6 lg:px-8 py-2">
            {/* Header: Title and Unified Action CTA */}
            <div className="bg-white dark:bg-km-surface-card p-5 sm:p-6 rounded-2xl border border-purple-50 dark:border-white/5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <CalendarBlankIcon size={24} weight="duotone" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                Events & Workshops Oversight
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Administrative oversight over platform events, bookings, attendees, and ticket transactions.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start md:self-center">
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-600/20 transition-all cursor-pointer whitespace-nowrap"
                    >
                        <PlusIcon weight="bold" size={16} />
                        <span>Create Official Event</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-km-surface-card p-4 sm:p-5 rounded-2xl border border-purple-50 dark:border-white/5 shadow-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Events</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">{total}</p>
                </div>
                <div className="bg-white dark:bg-km-surface-card p-4 sm:p-5 rounded-2xl border border-purple-50 dark:border-white/5 shadow-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Registered</p>
                    <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1.5">{totalParticipantsSum}</p>
                </div>
                <div className="bg-white dark:bg-km-surface-card p-4 sm:p-5 rounded-2xl border border-purple-50 dark:border-white/5 shadow-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tickets Confirmed</p>
                    <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1.5">{totalTicketsSum}</p>
                </div>
                <div className="bg-white dark:bg-km-surface-card p-4 sm:p-5 rounded-2xl border border-purple-50 dark:border-white/5 shadow-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">₹{totalRevenueSum.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {/* Search and Refresh Bar */}
            <div className="bg-white dark:bg-km-surface-card p-3 sm:p-4 rounded-2xl border border-purple-50 dark:border-white/5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-xs">
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by title, organizer, category, location..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-white"
                    />
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                    <button
                        onClick={() => { setSearch(''); setPage(1); fetchEvents(); }}
                        className="text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 font-semibold inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg border border-slate-200 dark:border-white/10"
                    >
                        <ArrowCounterClockwiseIcon size={14} weight="bold" />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Events Management Table Container */}
            <div className="bg-white dark:bg-km-surface-card rounded-2xl border border-purple-50 dark:border-white/5 overflow-hidden shadow-xs">
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50/80 dark:bg-white/5 text-[11px] uppercase font-bold text-slate-400 border-b border-purple-50 dark:border-white/5 tracking-wider">
                            <tr>
                                <th className="px-5 py-4">Event Details</th>
                                <th className="px-4 py-4">Organizer</th>
                                <th className="px-4 py-4">Schedule & Venue</th>
                                <th className="px-4 py-4">Price</th>
                                <th className="px-4 py-4">Registrations</th>
                                <th className="px-4 py-4">Revenue</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                                        Loading platform events data...
                                    </td>
                                </tr>
                            ) : events.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                                        No events found matching your filter criteria.
                                    </td>
                                </tr>
                            ) : (
                                events.map((ev) => (
                                    <tr key={ev.id} className="hover:bg-purple-50/20 dark:hover:bg-white/2 transition-colors">
                                        {/* Title & Category - Full readable space without trimming */}
                                        <td className="px-5 py-4 min-w-[240px] max-w-md">
                                            <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">
                                                {ev.title}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-100 dark:border-purple-800/40">
                                                    {ev.category || 'General'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">ID: {ev.id.slice(-6)}</span>
                                            </div>
                                        </td>

                                        {/* Organizer */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                {ev.organizer || 'Official'}
                                            </span>
                                        </td>

                                        {/* Schedule & Venue */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                                                <CalendarBlankIcon size={14} className="text-purple-600 shrink-0" />
                                                <span>{ev.date || 'TBD'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                                                <MapPinIcon size={13} className="text-orange-500 shrink-0" />
                                                <span className="truncate max-w-[150px]">{ev.location || 'Online'}</span>
                                            </div>
                                        </td>

                                        {/* Pricing */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {ev.is_paid && (ev.price || 0) > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-900/40">
                                                    ₹{ev.price}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/40">
                                                    Free Entry
                                                </span>
                                            )}
                                        </td>

                                        {/* Registrations */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                                                <UsersIcon size={14} className="text-purple-600 shrink-0" />
                                                <span>{ev.total_participants} booked</span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                Seats Left: {ev.available_seats ?? ev.capacity ?? '∞'} / {ev.capacity || '∞'}
                                            </div>
                                        </td>

                                        {/* Revenue & Payment Channels */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm">
                                                ₹{ev.total_revenue.toLocaleString('en-IN')}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {ev.razorpay_bookings > 0 && `${ev.razorpay_bookings} via Gateway `}
                                                {ev.wallet_bookings > 0 && `${ev.wallet_bookings} via Wallet`}
                                                {ev.total_revenue === 0 && 'Free Passes'}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-4 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleInspectEvent(ev.id)}
                                                    className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                                                    title="Inspect all booked attendees & transactions"
                                                >
                                                    <EyeIcon size={16} weight="bold" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(ev)}
                                                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                                    title="Edit Event Information"
                                                >
                                                    <PencilSimpleIcon size={16} weight="bold" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(ev.id)}
                                                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    title="Delete Event"
                                                >
                                                    <TrashIcon size={16} weight="bold" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* Standard Consistent Pagination: 1 2 3 4 ...                   */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div className="px-5 py-4 bg-slate-50/60 dark:bg-white/2 border-t border-purple-50 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <p className="text-slate-500 font-medium">
                        Showing <span className="font-bold text-slate-900 dark:text-white">{events.length > 0 ? (page - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-bold text-slate-900 dark:text-white">{Math.min(page * ITEMS_PER_PAGE, total)}</span> of <span className="font-bold text-slate-900 dark:text-white">{total}</span> events
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        {/* Prev Button */}
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 transition-colors"
                        >
                            <CaretLeftIcon size={14} weight="bold" />
                            <span>Prev</span>
                        </button>

                        {/* Numbered Page Buttons: 1, 2, 3, 4 ... */}
                        {pageNumbers.map((p, idx) => {
                            if (p === '...') {
                                return (
                                    <span key={`dots-${idx}`} className="w-8 h-9 flex items-center justify-center text-slate-400 font-bold">
                                        ...
                                    </span>
                                );
                            }

                            const pageNum = Number(p);
                            const isActive = pageNum === page;

                            return (
                                <button
                                    key={`page-${pageNum}`}
                                    type="button"
                                    onClick={() => setPage(pageNum)}
                                    className={`w-9 h-9 rounded-xl font-bold transition-all text-xs border ${
                                        isActive
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/30'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-white/5 bg-white dark:bg-km-surface-card border-slate-200 dark:border-white/10'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}

                        {/* Next Button */}
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 transition-colors"
                        >
                            <span>Next</span>
                            <CaretRightIcon size={14} weight="bold" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* AUDIT INSPECTOR MODAL: Full Detail of Bookings & Attendees   */}
            {/* ───────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {auditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#111827] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-purple-50 dark:border-white/10"
                        >
                            {/* Modal Header */}
                            <div className="p-5 sm:p-6 border-b border-purple-50 dark:border-white/10 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20">
                                <div>
                                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                                        Event Audit & Ledger Inspector
                                    </span>
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                        {selectedEventDetail?.event?.title || 'Event Details'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Hosted by {selectedEventDetail?.event?.organizer} • {selectedEventDetail?.event?.date}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAuditModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-white/10 transition-colors"
                                >
                                    <XIcon size={18} weight="bold" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                                {auditLoading ? (
                                    <div className="py-20 text-center text-slate-400 font-medium">
                                        Aggregating confirmed tickets and transactional ledger...
                                    </div>
                                ) : (
                                    <>
                                        {/* Financial Summary Cards */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                            <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-purple-50 dark:border-white/5">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Gross Revenue</p>
                                                <p className="text-lg sm:text-xl font-black text-emerald-600 mt-1">₹{selectedEventDetail?.total_revenue?.toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-purple-50 dark:border-white/5">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Tickets Issued</p>
                                                <p className="text-lg sm:text-xl font-black text-purple-600 mt-1">{selectedEventDetail?.total_tickets_sold}</p>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-purple-50 dark:border-white/5">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Paid Seats</p>
                                                <p className="text-lg sm:text-xl font-black text-blue-600 mt-1">{selectedEventDetail?.paid_registrations}</p>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-purple-50 dark:border-white/5">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Free Passes</p>
                                                <p className="text-lg sm:text-xl font-black text-slate-700 dark:text-slate-300 mt-1">{selectedEventDetail?.free_registrations}</p>
                                            </div>
                                        </div>

                                        {/* Booked Attendees & Ticket Breakdown */}
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                                <TicketIcon size={18} className="text-purple-600" />
                                                All Issued Tickets & Bookings ({selectedEventDetail?.tickets?.length || 0})
                                            </h4>

                                            {(!selectedEventDetail?.tickets || selectedEventDetail.tickets.length === 0) ? (
                                                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-white/5 rounded-2xl text-xs">
                                                    No tickets have been booked for this event yet.
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-purple-50 dark:border-white/5 overflow-hidden">
                                                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                                                        <thead className="bg-slate-50 dark:bg-white/5 uppercase text-[10px] text-slate-400 font-bold border-b border-purple-50 dark:border-white/5">
                                                            <tr>
                                                                <th className="px-4 py-3">Ticket #</th>
                                                                <th className="px-4 py-3">Attendee Name</th>
                                                                <th className="px-4 py-3">Contact</th>
                                                                <th className="px-4 py-3">Method</th>
                                                                <th className="px-4 py-3">Paid Amount</th>
                                                                <th className="px-4 py-3">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-purple-50 dark:divide-white/5">
                                                            {selectedEventDetail.tickets.map((t) => (
                                                                <tr key={t.id} className="hover:bg-purple-50/30 dark:hover:bg-white/2">
                                                                    <td className="px-4 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                                                                        {t.ticket_number}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                                                                        {t.attendee_name || 'Guest'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-400">
                                                                        {t.attendee_email}
                                                                        {t.attendee_phone && <span className="block text-[10px]">{t.attendee_phone}</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 capitalize">
                                                                        {t.payment_method === 'wallet' && (
                                                                            <span className="inline-flex items-center gap-1 text-purple-600 font-semibold">
                                                                                <WalletIcon size={12} /> Wallet
                                                                            </span>
                                                                        )}
                                                                        {t.payment_method === 'razorpay' && (
                                                                            <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                                                                                <CreditCardIcon size={12} /> Gateway
                                                                            </span>
                                                                        )}
                                                                        {t.payment_method === 'free' && (
                                                                            <span className="text-slate-400">Free</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                                                                        ₹{t.amount}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                                                                            <CheckCircleIcon size={12} weight="bold" /> {t.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* CREATE / EDIT EVENT MODAL                                     */}
            {/* ───────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {formModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#111827] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-purple-50 dark:border-white/10"
                        >
                            <div className="p-5 sm:p-6 border-b border-purple-50 dark:border-white/10 flex items-center justify-between">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                    {editingEventId ? 'Edit Event Details' : 'Create Official Event'}
                                </h3>
                                <button
                                    onClick={() => setFormModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    <XIcon size={18} weight="bold" />
                                </button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Event Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Masterclass in Scalable Backend Architecture"
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Organizer / Host Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.organizer}
                                            onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                        >
                                            <option value="Skill Workshop">Skill Workshop</option>
                                            <option value="Hiring Drive">Hiring Drive</option>
                                            <option value="Webinar">Webinar</option>
                                            <option value="Expert Session">Expert Session</option>
                                            <option value="Community Meetup">Community Meetup</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Event Date
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 2026-11-15 or Nov 15, 2026"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Time Slot
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 10:00 AM - 12:00 PM"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Location / Platform Link
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Online (Zoom Link provided on ticket) or Mumbai Center"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Pricing Type
                                        </label>
                                        <select
                                            value={formData.is_paid ? 'paid' : 'free'}
                                            onChange={(e) => setFormData({ ...formData, is_paid: e.target.value === 'paid' })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                        >
                                            <option value="free">Free Registration</option>
                                            <option value="paid">Paid Ticket</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Ticket Price (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={!formData.is_paid}
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white disabled:opacity-40"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Seat Capacity
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.capacity}
                                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0, available_seats: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Cover Banner Image URL
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={formData.image_url}
                                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Event Description / Agenda
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe key learnings, speaker bio, and target audience..."
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white resize-none"
                                    />
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3 border-t border-purple-50 dark:border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setFormModalOpen(false)}
                                        className="px-4 py-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-98 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : editingEventId ? 'Update Event' : 'Publish Event'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Alert Modal */}
            <AnimatePresence>
                {deleteConfirmId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#111827] rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-purple-50 dark:border-white/10"
                        >
                            <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <TrashIcon size={24} weight="bold" />
                            </div>
                            <h4 className="text-base font-bold text-slate-800 dark:text-white">Delete This Event?</h4>
                            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                This will remove the event from the public directory. Existing registered tickets will be marked as cancelled.
                            </p>
                            <div className="mt-6 flex items-center gap-2 justify-center">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteEvent}
                                    disabled={deleting}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all cursor-pointer"
                                >
                                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
