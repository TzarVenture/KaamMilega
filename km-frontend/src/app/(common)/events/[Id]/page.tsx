'use client'

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    Calendar, MapPin, Users, Share2, ArrowLeft, 
    MessageCircle, ShieldCheck, Clock, Bookmark, 
    ExternalLink, CheckCircle2
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

const EventDetailsPage = () => {
    const { id } = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);

    useEffect(() => {
        const fetchEventDetails = async () => {
            try {
                const res: any = await api.get(`/events/${id}`);
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
                toast.error(error.response?.data?.error || "Failed to load event details");
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchEventDetails();
    }, [id]);

    const handleRegister = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.info("Please login to register for this event");
            router.push('/login');
            return;
        }

        try {
            setRegistering(true);
            await api.post(`/events/${id}/register`);
            toast.success("Successfully registered for the event!");
            setIsRegistered(true);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to register");
        } finally {
            setRegistering(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
                <div className="text-gray-400 mb-4 scale-150">🔍</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
                <p className="text-gray-500 mb-6">The event you are looking for does not exist or has been removed.</p>
                <Link href="/events" className="bg-purple-600 text-white px-6 py-2 rounded-full font-bold hover:bg-purple-700 transition-all">
                    Back to Events
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-[#F8F9FB] min-h-screen pb-24 md:pb-0">
            {/* Header / Hero */}
            <div className="relative h-[450px] md:h-[550px] w-full overflow-hidden">
                {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-[#1D0A1C] flex items-center justify-center">
                        <div className="opacity-20 flex gap-4">
                            <div className="w-24 h-24 bg-purple-400 clip-path-triangle transform -rotate-12" />
                            <div className="w-20 h-20 bg-purple-300 clip-path-triangle translate-y-8" />
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent"></div>
                              <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
                    <button onClick={() => router.back()} className="p-2.5 md:p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/20">
                        <ArrowLeft className="w-4.5 h-4.5 md:w-5 md:h-5" />
                    </button>
                </div>

                <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 flex gap-2 md:gap-3">
                    <button className="p-2.5 md:p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/20">
                        <Share2 className="w-4.5 h-4.5 md:w-5 md:h-5" />
                    </button>
                    <button className="p-2.5 md:p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/20">
                        <Bookmark className="w-4.5 h-4.5 md:w-5 md:h-5" />
                    </button>
                </div>

                <div className="absolute bottom-16 md:bottom-20 left-4 right-4 md:left-8 md:right-8 z-10 max-w-5xl mx-auto">
                    <div className="flex flex-wrap gap-2 mb-4">
                         <span className="bg-purple-600 text-white text-[9px] md:text-[10px] uppercase font-black px-3 md:px-4 py-1 rounded-full tracking-wider shadow-lg shadow-purple-900/40">Workshop</span>
                         <span className="bg-orange-500 text-white text-[9px] md:text-[10px] uppercase font-black px-3 md:px-4 py-1 rounded-full tracking-wider shadow-lg shadow-orange-900/40">Featured</span>
                    </div>
                    <h1 className="text-2xl md:text-5xl font-black text-white mb-6 uppercase leading-tight drop-shadow-2xl">{event.title}</h1>
                    <div className="flex flex-wrap items-center gap-4 md:gap-8 text-white/90 font-bold text-xs md:text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/10 text-xs md:text-sm">
                                {event.organizer?.[0] || '🎉'}
                            </div> 
                            <span className="truncate max-w-[120px] md:max-w-none">By {event.organizer}</span>
                        </div>
                        <div className="flex items-center gap-2"><MapPin size={16} className="text-purple-400" /> {event.location}</div>
                        <div className="flex items-center gap-2"><Users size={16} className="text-purple-400" /> {event.participants?.length || 0} Registered</div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 flex flex-col lg:flex-row gap-8 lg:gap-12 -mt-10 md:-mt-12 relative z-20">
                
                {/* Main Text */}
                <div className="flex-1 space-y-6 md:space-y-8">
                    <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-50">
                        <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                            <span className="w-1.5 h-6 md:w-2 md:h-8 bg-purple-600 rounded-full"></span>
                            Event Overview
                        </h2>
                        <div className="prose prose-purple max-w-none text-gray-600 leading-relaxed font-medium text-sm md:text-base">
                            {event.description || "Join us for an exclusive insight session. More details coming soon."}
                             <p className="mt-4">
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-10 md:mt-12">
                             <div className="bg-purple-50 rounded-[20px] md:rounded-3xl p-5 md:p-6 border border-purple-100/50">
                                <h4 className="font-black text-purple-950 mb-3 md:mb-4 flex items-center gap-2 text-[13px] md:text-sm"><Clock size={16} /> What to expect</h4>
                                <ul className="space-y-2 md:space-y-3">
                                    {['Expert guidance', 'Interactive sessions', 'Practical workshops', 'Networking opportunities'].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[12px] md:text-[13px] font-bold text-purple-800/70">
                                            <CheckCircle2 size={16} className="text-purple-600 shrink-0" /> {item}
                                        </li>
                                    ))}
                                </ul>
                             </div>
                             <div className="bg-orange-50 rounded-[20px] md:rounded-3xl p-5 md:p-6 border border-orange-100/50">
                                <h4 className="font-black text-orange-950 mb-3 md:mb-4 flex items-center gap-2 text-[13px] md:text-sm"><ShieldCheck size={16} /> Prerequisites</h4>
                                <p className="text-[12px] md:text-[13px] font-bold text-orange-800/70 leading-relaxed">
                                    Basic understanding of the topic is recommended. Bring your curious mind and be ready to engage.
                                </p>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Sticky Card */}
                <div className="lg:w-[400px]">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.1)] border border-gray-50 overflow-hidden relative">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 ring-1 ring-purple-500/10"></div>
                             
                             <div className="space-y-6 relative z-10">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 md:gap-4 group">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-all">
                                            <Calendar className="w-4.5 h-4.5 md:w-5 md:h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
                                            <p className="text-[13px] md:text-sm font-black text-gray-900">{event.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 md:gap-4 group">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0 border border-orange-100 group-hover:bg-orange-600 group-hover:text-white transition-all">
                                            <Clock className="w-4.5 h-4.5 md:w-5 md:h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Time</p>
                                            <p className="text-[13px] md:text-sm font-black text-gray-900">{event.time}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 md:gap-4 group">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <MapPin className="w-4.5 h-4.5 md:w-5 md:h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                                            <p className="text-[13px] md:text-sm font-black text-gray-900 truncate max-w-[150px] md:max-w-[200px]">{event.location}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 space-y-3 hidden md:block">
                                    {isRegistered ? (
                                        <button className="w-full py-4 bg-green-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-default italic">
                                            <CheckCircle2 className="w-4.5 h-4.5" /> YOU ARE REGISTERED
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleRegister}
                                            disabled={registering}
                                            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/30 active:scale-[0.98]"
                                        >
                                            {registering ? "REGISTERING..." : "REGISTER FOR EVENT"}
                                        </button>
                                    )}
                                    <button className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-all">
                                        ADD TO CALENDAR
                                    </button>
                                </div>

                                <div className="text-center pt-2">
                                     <p className="text-[10px] font-bold text-gray-400">Join {event.participants?.length || '50+'} others for this exclusive session.</p>
                                </div>
                             </div>
                        </div>

                        {/* Organizer Mini Card */}
                        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 flex items-center gap-3 md:gap-4">
                             <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-950 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black text-base md:text-lg shadow-inner">{event.organizer?.[0] || 'O'}</div>
                             <div className="flex-1 min-w-0">
                                <h4 className="font-black text-gray-900 text-[13px] md:text-sm truncate">{event.organizer}</h4>
                                <p className="text-[10px] md:text-[11px] text-gray-400 font-bold italic">Top Rated Expert</p>
                             </div>
                             <button className="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-all">
                                <MessageCircle className="w-4.5 h-4.5 md:w-5 md:h-5" />
                             </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100 z-50 shadow-[0_-10px_25px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Registration</p>
                        <p className="text-sm font-black text-purple-600">{isRegistered ? "Registered" : "Open Now"}</p>
                    </div>
                    {isRegistered ? (
                        <button className="flex-2 py-3.5 bg-green-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 italic">
                            <CheckCircle2 className="w-4 h-4" /> REGISTERED
                        </button>
                    ) : (
                        <button 
                            onClick={handleRegister}
                            disabled={registering}
                            className="flex-2 py-3.5 bg-purple-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20"
                        >
                            {registering ? "REGISTERING..." : "REGISTER NOW"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventDetailsPage;
