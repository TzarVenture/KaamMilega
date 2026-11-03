'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarBlankIcon, CurrencyInrIcon, PlusIcon, TrashIcon, PencilSimpleIcon, EyeIcon, TicketIcon, UsersIcon, CheckCircleIcon, ArrowCounterClockwiseIcon, CreditCardIcon, WalletIcon, XIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import api from '@/lib/axios';
import Pagination from '@/components/ui/Pagination';
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, MenuItem, RowMenu, SearchInput, SkeletonRows, StatCard, StatusBadge, btn, table } from '@/components/admin/ui';

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
            notify.error(error, "Couldn't load events");
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


    // Open Audit Inspector
    const handleInspectEvent = async (id: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res: any = await api.get(`/admin/events/${id}`);
            setSelectedEventDetail(res);
        } catch (error: any) {
            notify.error(error, "Couldn't load this event's details");
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
            notify.error('Enter a title');
            return;
        }

        setSubmitting(true);
        try {
            if (editingEventId) {
                await api.put(`/admin/events/${editingEventId}`, formData);
                notify.success('Event updated');
            } else {
                await api.post('/admin/events', formData);
                notify.success('Event created');
            }
            setFormModalOpen(false);
            fetchEvents();
        } catch (error: any) {
            notify.error(error, editingEventId ? "Couldn't update the event" : "Couldn't create the event");
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
            notify.error(error, "Couldn't delete the event");
        } finally {
            setDeleting(false);
        }
    };

    // Aggregate Platform Stats
    const totalRevenueSum = events.reduce((acc, curr) => acc + (curr.total_revenue || 0), 0);
    const totalTicketsSum = events.reduce((acc, curr) => acc + (curr.total_tickets_sold || 0), 0);
    const totalParticipantsSum = events.reduce((acc, curr) => acc + (curr.total_participants || 0), 0);

    return (
        <div>
            <AdminPageHeader
                title="Events"
                description="Workshops, webinars and hiring drives with their bookings"
                actions={
                    <>
                        <button type="button" onClick={() => fetchEvents()} disabled={loading} className={btn.secondary}>
                            <ArrowCounterClockwiseIcon size={16} aria-hidden="true" />
                            Refresh
                        </button>
                        <button type="button" onClick={handleOpenCreate} className={btn.primary}>
                            <PlusIcon size={16} weight="bold" aria-hidden="true" />
                            Create event
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Events" value={loading ? '–' : total} icon={CalendarBlankIcon} iconClassName="text-km-events-text" />
                <StatCard label="Registrations" value={loading ? '–' : totalParticipantsSum} icon={UsersIcon} hint="Events on this page" />
                <StatCard label="Tickets confirmed" value={loading ? '–' : totalTicketsSum} icon={TicketIcon} hint="Events on this page" />
                <StatCard label="Revenue" value={loading ? '–' : `₹${totalRevenueSum.toLocaleString('en-IN')}`} icon={CurrencyInrIcon} iconClassName="text-km-skills-text" hint="Events on this page" />
            </div>

            <AdminPanel>
                <div className="px-5 py-4 border-b border-km-border-subtle">
                    <SearchInput value={search} onChange={setSearch} placeholder="Search title, organiser, category or city" className="w-full sm:max-w-sm" />
                </div>

                {loading ? (
                    <SkeletonRows rows={5} />
                ) : events.length === 0 ? (
                    <EmptyState icon={CalendarBlankIcon} title="No events found" description="Try a different search, or create an event." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Event</th>
                                    <th className={table.th}>Organiser</th>
                                    <th className={table.th}>When and where</th>
                                    <th className={table.th}>Price</th>
                                    <th className={`${table.th} text-right`}>Booked</th>
                                    <th className={`${table.th} text-right`}>Revenue</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((ev) => (
                                    <tr key={ev.id} className={table.row}>
                                        <td className={table.td}>
                                            <div className="min-w-[220px] max-w-sm">
                                                <button type="button" onClick={() => handleInspectEvent(ev.id)} className="font-medium text-km-heading hover:text-km-link text-left cursor-pointer">
                                                    {ev.title}
                                                </button>
                                                <p className="text-xs text-km-text-secondary">{ev.category || 'General'}</p>
                                            </div>
                                        </td>
                                        <td className={`${table.td} whitespace-nowrap`}>{ev.organizer || 'KaamMilega'}</td>
                                        <td className={`${table.td} whitespace-nowrap`}>
                                            <p className="font-inter">{ev.date || 'Date to be announced'}</p>
                                            <p className="text-xs text-km-text-secondary truncate max-w-[180px]">{ev.location || 'Online'}</p>
                                        </td>
                                        <td className={`${table.td} whitespace-nowrap`}>
                                            {ev.is_paid && (ev.price || 0) > 0
                                                ? <span className="font-inter">₹{ev.price}</span>
                                                : <StatusBadge tone="green" dot={false}>Free</StatusBadge>}
                                        </td>
                                        <td className={`${table.td} text-right whitespace-nowrap`}>
                                            <p className="font-inter tabular-nums">{ev.total_participants}</p>
                                            <p className="text-xs text-km-text-secondary">
                                                {ev.capacity ? `${ev.available_seats ?? ev.capacity} of ${ev.capacity} left` : 'No limit'}
                                            </p>
                                        </td>
                                        <td className={`${table.td} text-right whitespace-nowrap`}>
                                            <p className="font-inter tabular-nums">₹{ev.total_revenue.toLocaleString('en-IN')}</p>
                                            {(ev.razorpay_bookings > 0 || ev.wallet_bookings > 0) && (
                                                <p className="text-xs text-km-text-secondary">
                                                    {[ev.razorpay_bookings > 0 && `${ev.razorpay_bookings} online`, ev.wallet_bookings > 0 && `${ev.wallet_bookings} wallet`].filter(Boolean).join(', ')}
                                                </p>
                                            )}
                                        </td>
                                        <td className={`${table.td} text-right`}>
                                            <RowMenu label={`Actions for ${ev.title}`}>
                                                {() => (
                                                    <>
                                                        <MenuItem icon={EyeIcon} onClick={() => handleInspectEvent(ev.id)}>View bookings</MenuItem>
                                                        <MenuItem icon={PencilSimpleIcon} onClick={() => handleOpenEdit(ev)}>Edit event</MenuItem>
                                                        <div className="my-1 border-t border-km-border-subtle" />
                                                        <MenuItem icon={TrashIcon} danger onClick={() => setDeleteConfirmId(ev.id)}>Delete event</MenuItem>
                                                    </>
                                                )}
                                            </RowMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
                        <p className="text-sm text-km-text-secondary">
                            {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
                        </p>
                        <Pagination current={page} total={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </AdminPanel>

            {/* AUDIT INSPECTOR MODAL: Full Detail of Bookings & Attendees   */}
            {/* ───────────────────────────────────────────────────────────── */}
            <>
                {auditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60">
                        <div
                            className="bg-km-surface-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-sm border border-km-border"
                        >
                            {/* Modal Header */}
                            <div className="p-5 sm:p-6 border-b border-km-border flex items-center justify-between bg-km-surface">
                                <div>
                                    <span className="text-xs font-bold text-km-link">
                                        Event audit & ledger inspector
                                    </span>
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5">
                                        {selectedEventDetail?.event?.title || 'Event Details'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Hosted by {selectedEventDetail?.event?.organizer} • {selectedEventDetail?.event?.date}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAuditModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-km-surface-card transition-colors"
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
                                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-km-border">
                                                <p className="text-xs font-bold text-slate-400">Gross revenue</p>
                                                <p className="text-lg sm:text-xl font-bold text-emerald-600 mt-1">₹{selectedEventDetail?.total_revenue?.toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-km-border">
                                                <p className="text-xs font-bold text-slate-400">Tickets issued</p>
                                                <p className="text-lg sm:text-xl font-bold text-km-link mt-1">{selectedEventDetail?.total_tickets_sold}</p>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-km-border">
                                                <p className="text-xs font-bold text-slate-400">Paid seats</p>
                                                <p className="text-lg sm:text-xl font-bold text-blue-600 mt-1">{selectedEventDetail?.paid_registrations}</p>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-km-border">
                                                <p className="text-xs font-bold text-slate-400">Free passes</p>
                                                <p className="text-lg sm:text-xl font-bold text-slate-700 mt-1">{selectedEventDetail?.free_registrations}</p>
                                            </div>
                                        </div>

                                        {/* Booked Attendees & Ticket Breakdown */}
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <TicketIcon size={18} className="text-km-link" />
                                                All Issued Tickets & Bookings ({selectedEventDetail?.tickets?.length || 0})
                                            </h4>

                                            {(!selectedEventDetail?.tickets || selectedEventDetail.tickets.length === 0) ? (
                                                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl text-xs">
                                                    No tickets have been booked for this event yet.
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-km-border overflow-hidden">
                                                    <table className="w-full text-left text-xs text-slate-600">
                                                        <thead className="bg-slate-50 text-xs text-slate-400 font-bold border-b border-km-border">
                                                            <tr>
                                                                <th className="px-4 py-3">Ticket #</th>
                                                                <th className="px-4 py-3">Attendee name</th>
                                                                <th className="px-4 py-3">Contact</th>
                                                                <th className="px-4 py-3">Method</th>
                                                                <th className="px-4 py-3">Paid amount</th>
                                                                <th className="px-4 py-3">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-km-border">
                                                            {selectedEventDetail.tickets.map((t) => (
                                                                <tr key={t.id} className="hover:bg-km-surface">
                                                                    <td className="px-4 py-3 font-mono font-bold text-km-link">
                                                                        {t.ticket_number}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">
                                                                        {t.attendee_name || 'Guest'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-400">
                                                                        {t.attendee_email}
                                                                        {t.attendee_phone && <span className="block text-xs">{t.attendee_phone}</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 capitalize">
                                                                        {t.payment_method === 'wallet' && (
                                                                            <span className="inline-flex items-center gap-1 text-km-link font-semibold">
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
                                                                    <td className="px-4 py-3 font-bold text-slate-800">
                                                                        ₹{t.amount}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
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
                        </div>
                    </div>
                )}
            </>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* CREATE / EDIT EVENT MODAL                                     */}
            {/* ───────────────────────────────────────────────────────────── */}
            <>
                {formModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60">
                        <div
                            className="bg-km-surface-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-sm border border-km-border"
                        >
                            <div className="p-5 sm:p-6 border-b border-km-border flex items-center justify-between">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                                    {editingEventId ? 'Edit Event Details' : 'Create Official Event'}
                                </h3>
                                <button
                                    onClick={() => setFormModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                                >
                                    <XIcon size={18} weight="bold" />
                                </button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Event title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Masterclass in Scalable Backend Architecture"
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Organizer / host name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.organizer}
                                            onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                        >
                                            <option value="Skill Workshop">Skill workshop</option>
                                            <option value="Hiring Drive">Hiring drive</option>
                                            <option value="Webinar">Webinar</option>
                                            <option value="Expert Session">Expert session</option>
                                            <option value="Community Meetup">Community meetup</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Event date
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 2026-11-15 or Nov 15, 2026"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Time slot
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 10:00 AM - 12:00 PM"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Location / platform link
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Online (Zoom Link provided on ticket) or Mumbai Center"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Pricing type
                                        </label>
                                        <select
                                            value={formData.is_paid ? 'paid' : 'free'}
                                            onChange={(e) => setFormData({ ...formData, is_paid: e.target.value === 'paid' })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                        >
                                            <option value="free">Free registration</option>
                                            <option value="paid">Paid ticket</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Ticket price (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={!formData.is_paid}
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900 disabled:opacity-40"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Seat capacity
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.capacity}
                                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0, available_seats: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Cover banner image URL
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={formData.image_url}
                                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Event description / agenda
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe key learnings, speaker bio, and target audience..."
                                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-km-blue/20 outline-none text-slate-900 resize-none"
                                    />
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3 border-t border-km-border">
                                    <button
                                        type="button"
                                        onClick={() => setFormModalOpen(false)}
                                        className="px-4 py-2 text-xs sm:text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-km-primary hover:bg-km-primary-dark rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : editingEventId ? 'Update Event' : 'Publish Event'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </>

            {deleteConfirmId && (
                <ConfirmDialog
                    title="Delete this event?"
                    description="It's removed from the events directory and existing tickets are marked as cancelled."
                    confirmLabel="Delete event"
                    busy={deleting}
                    onCancel={() => setDeleteConfirmId(null)}
                    onConfirm={handleDeleteEvent}
                />
            )}
        </div>
    );
}
