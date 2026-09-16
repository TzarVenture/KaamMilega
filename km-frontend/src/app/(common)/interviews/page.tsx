"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Loader2, Calendar, Clock, MapPin, Video, Phone, Building2, ChevronRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function UserInterviewsPage() {
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInterviews = async () => {
            try {
                const data = await api.get("/interviews/my") as any[];
                setInterviews(data);
            } catch (error) {
                console.error("Failed to fetch interviews:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInterviews();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-km-primary" />
            </div>
        );
    }

    return (
        <div className="bg-[#F8FAFC] min-h-screen pb-20 font-sans">
            <div className="max-w-5xl mx-auto p-6 md:p-12">
                <header className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">My Interviews</h1>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">Track your upcoming interviews with recruiters and verified employers.</p>
                </header>

                {interviews.length === 0 ? (
                    <div className="bg-white p-12 sm:p-16 rounded-3xl border border-slate-200/80 text-center shadow-xs">
                        <div className="w-20 h-20 bg-blue-50 text-km-primary rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-10 h-10" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">No Scheduled Interviews</h2>
                        <p className="text-slate-500 mt-2 max-w-sm mx-auto text-xs font-medium">
                            Apply to active job postings to get shortlisted and receive direct interview calls!
                        </p>
                        <Link
                            href="/jobs"
                            className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-900/10"
                        >
                            Find Active Jobs
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {interviews.map((inview) => (
                            <div key={inview.id} className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden hover:shadow-lg transition-all group">
                                <div className="p-6 sm:p-8 space-y-6">
                                    {/* Header: Company & Job */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-linear-to-br from-slate-950 via-km-primary-dark to-slate-950 rounded-2xl flex items-center justify-center border border-slate-700 shadow-xs">
                                                <Building2 className="w-7 h-7 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 leading-tight">{inview.job?.title}</h3>
                                                <p className="text-slate-500 font-bold text-xs">{inview.job?.company}</p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                            inview.status === 'Scheduled' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                inview.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                    "bg-rose-50 text-rose-700 border-rose-200"
                                        )}>
                                            {inview.status}
                                        </div>
                                    </div>

                                    {/* Timing Section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-km-primary mb-1 flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Date
                                            </p>
                                            <p className="font-extrabold text-xs text-slate-900">
                                                {new Date(inview.scheduled_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-km-primary mb-1 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                Time
                                            </p>
                                            <p className="font-extrabold text-xs text-slate-900">
                                                {new Date(inview.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Location / Join Link */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                                                {inview.type === 'Video' ? <Video className="w-5 h-5 text-km-primary" /> :
                                                    inview.type === 'Phone' ? <Phone className="w-5 h-5 text-emerald-600" /> :
                                                        <MapPin className="w-5 h-5 text-amber-600" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{inview.type} INTERVIEW</p>
                                                <p className="text-xs font-bold text-slate-800">{inview.location}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {inview.notes && (
                                        <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100">
                                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Notes from Recruiter</p>
                                            <p className="text-xs text-slate-700 font-medium">"{inview.notes}"</p>
                                        </div>
                                    )}

                                    {inview.status === 'Scheduled' && (
                                        <button className="w-full py-3.5 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/10">
                                            {inview.type === 'Video' ? 'Join Virtual Lobby' : 'View Full Details'}
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
