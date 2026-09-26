'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, CheckCircle2, Briefcase, MapPin, Building2, Calendar } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';

export interface TickerUpdate {
    id: string;
    name: string;
    status: string;
    role: string;
    company: string;
    city: string;
    thumbnail?: string;
    quote?: string;
}

interface SuccessTickerProps {
    updates?: TickerUpdate[];
}

const defaultUpdates: TickerUpdate[] = [
    {
        id: '1',
        name: 'Dharmender Kumar',
        status: 'Fixed An Interview',
        role: 'Warehouse Executive',
        company: 'Technova Logistics',
        city: 'Bhiwandi, Thane',
        quote: 'Scheduled a direct video interview with HR within 2 hours of applying on KaamMilega with zero brokerage.',
    },
    {
        id: '2',
        name: 'Roshan Yadav',
        status: 'Selected for Role',
        role: 'Shift Supervisor',
        company: 'Reliance Supply Chain',
        city: 'Surat, Gujarat',
        quote: 'Got a call directly from the hiring manager. Accepted offer with 25% salary hike.',
    },
    {
        id: '3',
        name: 'Priya Sharma',
        status: 'Fixed An Interview',
        role: 'Store Executive',
        company: 'Tata Croma',
        city: 'Mumbai, Maharashtra',
        quote: 'Clean verification and direct HR chat helped me schedule my interview for tomorrow morning.',
    },
    {
        id: '4',
        name: 'Sachin Singh',
        status: 'Selected for Role',
        role: 'Commercial Driver',
        company: 'City Fleet Transport',
        city: 'Surat, Gujarat',
        quote: 'Instant gig dispatch and verified commercial driving job with guaranteed daily payouts.',
    },
    {
        id: '5',
        name: 'Basina Akhil',
        status: 'Fixed An Interview',
        role: 'Software Associate',
        company: 'Technova Solutions',
        city: 'Bhiwandi, Maharashtra',
        quote: 'Applied directly with verified resume. HR reviewed within 30 minutes.',
    },
    {
        id: '6',
        name: 'Raju Yadav',
        status: 'Completed Instant Gig',
        role: 'Lead Electrician',
        company: 'InstantMilega™ Partner',
        city: 'Delhi NCR',
        quote: 'Received an emergency commercial electrical repair gig 15 minutes after going online.',
    },
];

function formatStatus(status: string) {
    if (!status) return '';
    const lower = status.toLowerCase();
    const words = lower.split(/\s+/);
    return words
        .map((w, i) => {
            if (i > 0 && ['an', 'a', 'the', 'for', 'of', 'in', 'on', 'with'].includes(w)) {
                return w;
            }
            return w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(' ');
}

function getStatusStyle(status: string) {
    const s = (status || '').toLowerCase();
    if (s.includes('interview')) {
        return 'bg-blue-50 text-km-blue border-blue-100';
    }
    if (s.includes('gig') || s.includes('instant')) {
        return 'bg-orange-50 text-km-accent border-orange-100';
    }
    if (s.includes('selected') || s.includes('placed') || s.includes('completed')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function SuccessTicker({ updates }: SuccessTickerProps) {
    const [selectedStory, setSelectedStory] = useState<TickerUpdate | null>(null);
    const [liveUpdates, setLiveUpdates] = useState<TickerUpdate[]>([]);

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res: any = await api.get('/platform/live-activity');
                const events = res?.events || [];
                if (Array.isArray(events) && events.length > 0) {
                    const formatted: TickerUpdate[] = events.map((ev: any, idx: number) => ({
                        id: String(ev.id || idx),
                        name: ev.title || 'Verified Member',
                        status: ev.tag || 'Platform Milestone',
                        role: ev.badge || 'Verified',
                        company: ev.time || 'KaamMilega',
                        city: ev.time || 'India',
                        quote: ev.description || 'Zero-brokerage verified opportunity on KaamMilega.',
                    }));
                    setLiveUpdates(formatted);
                }
            } catch (e) {
                // fallback to default updates seamlessly
            }
        };
        fetchLive();
    }, []);

    const items = liveUpdates.length > 0 
        ? [...liveUpdates, ...defaultUpdates] 
        : (updates && updates.length > 0 ? updates : defaultUpdates);

    return (
        <>
            <div className="relative bg-slate-50/70 py-3 sm:py-3.5 overflow-hidden font-sans border-b border-slate-200/80">
                {/* Subtle side edge fade vignettes */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

                <div className="animate-km-marquee flex gap-4 sm:gap-6 items-center">
                    {[...items, ...items].map((item, idx) => (
                        <button
                            key={`${item.id}-${idx}`}
                            type="button"
                            onClick={() => setSelectedStory(item)}
                            className="group flex items-center gap-3.5 bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-slate-300 rounded-2xl px-4 py-2.5 shadow-2xs hover:shadow-xs transition-all text-left shrink-0 cursor-pointer"
                        >
                            {/* Circular Play Button Icon (Client Signature Element) */}
                            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-km-primary group-hover:bg-km-primary-dark rounded-full flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-all">
                                <Play size={14} className="fill-white translate-x-0.5" />
                            </div>

                            {/* Details */}
                            <div className="flex flex-col">
                                <div className="flex items-center">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border ${getStatusStyle(item.status)}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                                        <span>{formatStatus(item.status)}</span>
                                    </span>
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 mt-1 leading-tight group-hover:text-km-primary transition-colors">
                                    {item.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium leading-none mt-1 flex items-center gap-1">
                                    <span>{item.role}</span>
                                    <span className="text-slate-300">•</span>
                                    <span>{item.city}</span>
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Video Story Modal (Opens on Click of Any Ticker Update) */}
            <AnimatePresence>
                {selectedStory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 font-sans"
                        >
                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={() => setSelectedStory(null)}
                                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center transition-colors"
                            >
                                <X size={18} />
                            </button>

                            {/* Video Player Frame */}
                            <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
                                
                                {/* Centered Play Icon */}
                                <div className="relative z-10 w-16 h-16 rounded-full bg-km-primary/90 text-white flex items-center justify-center shadow-xl border-2 border-white/30">
                                    <Play size={28} className="fill-white translate-x-0.5" />
                                </div>

                                <div className="absolute bottom-4 left-4 right-4 z-10 text-white">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                        Verified Candidate Story
                                    </span>
                                    <h3 className="text-base font-bold mt-1 text-white leading-snug">
                                        {selectedStory.name} — {selectedStory.status}
                                    </h3>
                                </div>
                            </div>

                            {/* Details & Quote Content */}
                            <div className="p-6">
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mb-4 pb-4 border-b border-slate-100">
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                                        <Briefcase size={14} className="text-km-primary" />
                                        {selectedStory.role}
                                    </span>
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                                        <Building2 size={14} className="text-km-primary" />
                                        {selectedStory.company}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                        <MapPin size={14} />
                                        {selectedStory.city}
                                    </span>
                                </div>

                                <blockquote className="text-sm text-slate-700 italic leading-relaxed mb-6">
                                    &ldquo;{selectedStory.quote}&rdquo;
                                </blockquote>

                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStory(null)}
                                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
                                    >
                                        Close
                                    </button>
                                    <Link
                                        href={`/jobs?q=${encodeURIComponent(selectedStory.role)}`}
                                        onClick={() => setSelectedStory(null)}
                                        className="bg-km-primary hover:bg-km-primary-dark text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm"
                                    >
                                        View Matching Jobs →
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
