'use client'

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Calendar, MapPin, Users, Share2, ArrowLeft,
    MessageCircle, Clock, Bookmark,
    CheckCircle2
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import Link from 'next/link';

interface EventDetails {
    id: string;
    title: string;
    description: string;
    organizer: string;
    date: string;
    time: string;
    location: string;
    image_url?: string;
    participants?: string[];
}

// ─── Shimmer Skeleton ───
const DetailSkeleton = () => (
    <div className="bg-slate-50 min-h-screen animate-pulse">
        {/* Hero Skeleton */}
        <div className="relative h-72 md:h-96 bg-slate-200 w-full" />

        {/* Content Skeleton */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-8 -mt-16 relative z-20">
            {/* Main */}
            <div className="flex-1 space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-slate-100">
                    <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-6" />
                    <div className="space-y-3">
                        <div className="h-4 bg-slate-100 rounded w-full" />
                        <div className="h-4 bg-slate-100 rounded w-5/6" />
                        <div className="h-4 bg-slate-100 rounded w-4/6" />
                        <div className="h-4 bg-slate-100 rounded w-full" />
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                    </div>
                </div>
            </div>
            {/* Sidebar */}
            <div className="w-full lg:w-88">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-5">
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-slate-200 rounded-xl" />
                            <div className="flex-1">
                                <div className="h-3 bg-slate-100 rounded w-1/3 mb-1.5" />
                                <div className="h-4 bg-slate-200 rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                    <div className="h-12 bg-slate-200 rounded-xl w-full mt-4" />
                </div>
            </div>
        </div>
    </div>
);

const EventDetailsPage = () => {
    const { Id } = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);

    useEffect(() => {
        const fetchEventDetails = async () => {
            try {
                const res: any = await api.get(`/events/${Id}`);
                setEvent(res);

                // Check if current user is already registered
                const storedUser = localStorage.getItem('user');
                if (storedUser && res.participants) {
                    const user = JSON.parse(storedUser);
                    const userId = user.id || user._id;
                    if (res.participants.includes(userId)) {
                        setIsRegistered(true);
                    }
                }
            } catch (error: any) {
                toast.error(error.message || "Failed to load event details");
            } finally {
                setLoading(false);
            }
        };

        if (Id) fetchEventDetails();
    }, [Id]);

    const handleRegister = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.info("Please login to register for this event");
            router.push('/login');
            return;
        }

        try {
            setRegistering(true);
            await api.post(`/events/${Id}/register`);
            toast.success("Successfully registered for the event!");
            setIsRegistered(true);
        } catch (error: any) {
            toast.error(error.message || "Failed to register");
        } finally {
            setRegistering(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    if (loading) return <DetailSkeleton />;

    if (!event) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                    <Calendar className="w-10 h-10 text-km-accent" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">Event Not Found</h1>
                <p className="text-sm text-slate-500 mb-8 text-center max-w-sm">The event you are looking for does not exist or has been removed.</p>
                <Link href="/events" className="bg-km-primary hover:bg-km-primary-dark text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-md">
                    ← Back to Events
                </Link>
            </div>
        );
    }

    const participantCount = event.participants?.length || 0;

    return (
        <div className="bg-slate-50 min-h-screen pb-28 md:pb-8">

            {/* ─── Hero Image ─── */}
            <div className="relative h-72 md:h-96 w-full overflow-hidden bg-slate-900">
                {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-950 via-[#071A4D] to-slate-950 flex items-center justify-center">
                        <div className="opacity-15 flex gap-4">
                            <div className="w-20 h-20 bg-km-accent rounded-xl transform -rotate-12" />
                            <div className="w-16 h-16 bg-km-accent/70 rounded-xl translate-y-6" />
                        </div>
                    </div>
                )}
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/30 to-transparent" />

                {/* Top Navigation */}
                <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all border border-white/10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 flex gap-2">
                    <button className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all border border-white/10">
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all border border-white/10">
                        <Bookmark className="w-5 h-5" />
                    </button>
                </div>

                {/* Hero Title Overlay */}
                <div className="absolute bottom-6 md:bottom-10 left-4 right-4 md:left-8 md:right-8 z-10 max-w-5xl mx-auto">
                    <h1 className="text-2xl md:text-4xl font-black text-white mb-3 leading-tight tracking-tight">
                        {event.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 md:gap-6 text-white/80 text-xs md:text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-xs font-bold backdrop-blur-sm">
                                {event.organizer?.[0] || 'O'}
                            </div>
                            By {event.organizer}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-km-accent" /> {event.location}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Users size={14} className="text-km-accent" /> {participantCount} registered
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── Content Area ─── */}
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10 flex flex-col lg:flex-row gap-6 lg:gap-8">

                {/* ── Main Content ── */}
                <div className="flex-1 space-y-6">
                    {/* About Section */}
                    <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2.5">
                            <span className="w-1 h-6 bg-km-accent rounded-full" />
                            About This Event
                        </h2>
                        <div className="text-slate-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                            {event.description || "Join us for this exciting event! More details will be shared with registered participants."}
                        </div>
                    </div>

                    {/* Quick Info Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-km-accent shrink-0">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                                <p className="text-sm font-bold text-slate-800">{formatDate(event.date)}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-km-primary shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</p>
                                <p className="text-sm font-bold text-slate-800">{event.time || 'TBA'}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                                <p className="text-sm font-bold text-slate-800 truncate max-w-40">{event.location}</p>
                            </div>
                        </div>
                    </div>

                    {/* Organizer Section */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-km-primary-dark rounded-xl flex items-center justify-center text-white font-black text-lg shadow-inner">
                            {event.organizer?.[0] || 'O'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm">{event.organizer}</h4>
                            <p className="text-xs text-slate-400 font-medium">Event Organizer</p>
                        </div>
                        <button className="p-2.5 text-km-primary hover:bg-blue-50 rounded-xl transition-all border border-slate-100">
                            <MessageCircle className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── Sidebar ── */}
                <div className="w-full lg:w-88">
                    <div className="lg:sticky lg:top-24 space-y-5">
                        {/* Registration Card */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 mb-5">Register for Event</h3>

                            {/* Meta Info */}
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-km-accent shrink-0">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                                        <p className="text-sm font-bold text-slate-800">{event.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-km-primary shrink-0">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</p>
                                        <p className="text-sm font-bold text-slate-800">{event.time || 'TBA'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                        <MapPin size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                                        <p className="text-sm font-bold text-slate-800">{event.location}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Participant count */}
                            <div className="bg-slate-50 rounded-xl py-3 px-4 mb-5 text-center">
                                <p className="text-xs font-bold text-slate-500">
                                    <span className="text-km-primary font-black">{participantCount}</span> {participantCount === 1 ? 'person has' : 'people have'} registered
                                </p>
                            </div>

                            {/* Register Button */}
                            {isRegistered ? (
                                <button className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                                    <CheckCircle2 size={18} /> You're Registered!
                                </button>
                            ) : (
                                <button
                                    onClick={handleRegister}
                                    disabled={registering}
                                    className="w-full py-3.5 bg-km-accent hover:bg-km-accent-dark text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:opacity-60"
                                >
                                    {registering ? "Registering..." : "Register for Event"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Mobile Bottom Bar ─── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg p-4 border-t border-slate-100 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Registration</p>
                        <p className="text-sm font-black text-slate-800">
                            {isRegistered ? (
                                <span className="text-emerald-600">Registered ✓</span>
                            ) : (
                                <span className="text-km-accent">Open Now</span>
                            )}
                        </p>
                    </div>
                    {isRegistered ? (
                        <button className="flex-2 py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <CheckCircle2 size={16} /> Registered
                        </button>
                    ) : (
                        <button
                            onClick={handleRegister}
                            disabled={registering}
                            className="flex-2 py-3 bg-km-accent text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-km-accent-dark transition-all shadow-lg shadow-orange-500/20 disabled:opacity-60"
                        >
                            {registering ? "Registering..." : "Register Now"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventDetailsPage;
