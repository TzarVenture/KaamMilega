"use client";

import React, { useState, useEffect } from "react";
import { 
    X, 
    Users, 
    Search, 
    MapPin, 
    ExternalLink, 
    Ticket, 
    CheckCircle2, 
    Sparkles,
    Shield
} from "lucide-react";
import api from "@/lib/axios";
import Link from "next/link";

export interface AttendeeItem {
    id: string;
    name: string;
    headline?: string;
    profile_image?: string;
    city?: string;
    role?: string;
    ticket_number?: string;
    payment_type?: string;
    joined_at?: string;
}

interface AttendeeListModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle: string;
    totalJoinedCount?: number;
}

export default function AttendeeListModal({
    isOpen,
    onClose,
    eventId,
    eventTitle,
    totalJoinedCount = 0
}: AttendeeListModalProps) {
    const [attendees, setAttendees] = useState<AttendeeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!isOpen || !eventId) return;

        let isMounted = true;
        const fetchAttendees = async () => {
            setLoading(true);
            setError(null);
            try {
                const res: any = await api.get(`/events/${eventId}/attendees`);
                if (isMounted) {
                    if (res && Array.isArray(res.attendees)) {
                        setAttendees(res.attendees);
                    } else if (Array.isArray(res)) {
                        setAttendees(res);
                    } else {
                        setAttendees([]);
                    }
                }
            } catch (err: any) {
                console.error("Failed to load attendees:", err);
                if (isMounted) {
                    setError("Failed to load event attendees. Please try again.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAttendees();

        return () => {
            isMounted = false;
        };
    }, [isOpen, eventId]);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filteredAttendees = attendees.filter((a) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (a.name && a.name.toLowerCase().includes(q)) ||
            (a.headline && a.headline.toLowerCase().includes(q)) ||
            (a.city && a.city.toLowerCase().includes(q)) ||
            (a.role && a.role.toLowerCase().includes(q))
        );
    });

    const getInitials = (name: string) => {
        if (!name) return "KM";
        const parts = name.trim().split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── Modal Header ─── */}
                <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 bg-linear-to-r from-slate-50 via-white to-blue-50/40">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                        title="Close modal"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1a2b8c]/10 text-[#1a2b8c]">
                            <Users size={12} />
                            <span>Confirmed Attendees</span>
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                            • {attendees.length > 0 ? attendees.length : totalJoinedCount} {attendees.length === 1 ? 'member' : 'members'}
                        </span>
                    </div>

                    <h2 className="text-lg md:text-xl font-black text-slate-900 line-clamp-1">
                        {eventTitle || "Event Attendees"}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Network and connect with fellow participants attending this event.
                    </p>

                    {/* Search Input */}
                    <div className="relative mt-4">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search attendees by name, role, or city..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1a2b8c] focus:ring-2 focus:ring-[#1a2b8c]/10 transition-all shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ─── Attendees Body ─── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 divide-y divide-slate-100">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-3 border-[#1a2b8c]/20 border-t-[#1a2b8c] rounded-full animate-spin" />
                            <p className="text-xs font-medium text-slate-500">Loading attendee list...</p>
                        </div>
                    ) : error ? (
                        <div className="py-10 text-center space-y-2">
                            <p className="text-xs font-semibold text-rose-600">{error}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setLoading(true);
                                    setError(null);
                                    api.get(`/events/${eventId}/attendees`)
                                        .then((res: any) => setAttendees(res?.attendees || res || []))
                                        .catch(() => setError("Failed to reload"))
                                        .finally(() => setLoading(false));
                                }}
                                className="text-xs font-bold text-[#1a2b8c] underline hover:no-underline"
                            >
                                Try again
                            </button>
                        </div>
                    ) : attendees.length === 0 ? (
                        <div className="py-14 text-center px-4">
                            <div className="w-14 h-14 mx-auto mb-3 bg-blue-50 text-[#1a2b8c] rounded-2xl flex items-center justify-center">
                                <Users size={26} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800 mb-1">No attendees yet</h3>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                Be the first person to register and grab a spot for this event!
                            </p>
                        </div>
                    ) : filteredAttendees.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-xs font-medium text-slate-500">
                                No attendees found matching &quot;<strong className="text-slate-700">{searchQuery}</strong>&quot;
                            </p>
                        </div>
                    ) : (
                        filteredAttendees.map((attendee, idx) => (
                            <div 
                                key={attendee.id || idx}
                                className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group hover:bg-slate-50/80 -mx-3 px-3 py-2 rounded-2xl transition-all"
                            >
                                {/* Left: Avatar + Details */}
                                <div className="flex items-center gap-3 min-w-0">
                                    {attendee.profile_image ? (
                                        <img
                                            src={attendee.profile_image}
                                            alt={attendee.name}
                                            className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-[#071A4D] to-blue-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                            {getInitials(attendee.name)}
                                        </div>
                                    )}

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h4 className="text-xs md:text-sm font-bold text-slate-900 truncate">
                                                {attendee.name || "Member"}
                                            </h4>
                                            {attendee.payment_type === "paid" ? (
                                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                                    <Ticket size={9} />
                                                    <span>Ticket</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 size={9} />
                                                    <span>Pass</span>
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                                            {attendee.headline || "KaamMilega Member"}
                                        </p>

                                        {attendee.city && (
                                            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} className="text-slate-400" />
                                                <span>{attendee.city}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Action CTA */}
                                <div className="shrink-0">
                                    <Link
                                        href={`/profile/${attendee.id}`}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-white border border-slate-200 hover:border-[#1a2b8c] text-slate-700 hover:text-[#1a2b8c] rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-95"
                                        title="View member profile"
                                    >
                                        <span>View</span>
                                        <ExternalLink size={11} />
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ─── Modal Footer ─── */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <Sparkles size={12} className="text-amber-500" />
                        <span>Showing {filteredAttendees.length} of {attendees.length} joined</span>
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
