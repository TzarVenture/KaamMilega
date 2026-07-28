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
                <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="bg-[#fcfcff] min-h-screen pb-20">
            <div className="max-w-5xl mx-auto p-6 md:p-12">
                <header className="mb-12">
                    <h1 className="text-4xl font-black text-[#2d2d4d]">My Interviews</h1>
                    <p className="text-slate-500 font-medium mt-2">Track your upcoming meeting with recruiters and dream companies.</p>
                </header>

                {interviews.length === 0 ? (
                    <div className="bg-white p-16 rounded-[32px] border border-slate-100 text-center shadow-sm">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <Calendar className="w-12 h-12 text-slate-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">No Interviews Yet</h2>
                        <p className="text-slate-500 mt-3 max-w-sm mx-auto font-medium">
                            Apply to more jobs to increase your chances of getting shortlisted for interviews!
                        </p>
                        <Link
                            href="/jobs"
                            className="mt-10 inline-flex items-center gap-2 px-10 py-4 bg-[#2d2d4d] text-white rounded-full font-black hover:bg-black transition-all shadow-xl shadow-slate-200"
                        >
                            Find More Jobs
                            <ChevronRight className="w-5 h-5" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {interviews.map((inview) => (
                            <div key={inview.id} className="bg-white rounded-[32px] border border-slate-100 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all group">
                                <div className="p-8 space-y-6">
                                    {/* Header: Company & Job */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-900 rounded-[20px] flex items-center justify-center">
                                                <Building2 className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 leading-tight">{inview.job?.title}</h3>
                                                <p className="text-slate-500 font-bold text-sm tracking-tight">{inview.job?.company}</p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            inview.status === 'Scheduled' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                inview.status === 'Completed' ? "bg-green-50 text-green-600 border-green-100" :
                                                    "bg-red-50 text-red-600 border-red-100"
                                        )}>
                                            {inview.status}
                                        </div>
                                    </div>

                                    {/* Timing Section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#f8faff] p-4 rounded-2xl border border-blue-50">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Date
                                            </p>
                                            <p className="font-black text-slate-800">
                                                {new Date(inview.scheduled_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="bg-[#f8faff] p-4 rounded-2xl border border-blue-50">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                Time
                                            </p>
                                            <p className="font-black text-slate-800">
                                                {new Date(inview.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Location / Join Link */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                                                {inview.type === 'Video' ? <Video className="w-5 h-5 text-purple-600" /> :
                                                    inview.type === 'Phone' ? <Phone className="w-5 h-5 text-green-600" /> :
                                                        <MapPin className="w-5 h-5 text-red-600" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-tight text-slate-400">{inview.type} INTERVIEW</p>
                                                <p className="text-sm font-bold text-slate-700">{inview.location}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {inview.notes && (
                                        <div className="bg-pink-50/30 p-4 rounded-2xl border border-pink-100/50">
                                            <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1 italic">Notes from HR</p>
                                            <p className="text-sm text-slate-600 leading-relaxed">"{inview.notes}"</p>
                                        </div>
                                    )}

                                    {inview.status === 'Scheduled' && (
                                        <button className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black flex items-center justify-center gap-2 group-hover:bg-[#2d2d4d] transition-all">
                                            {inview.type === 'Video' ? 'Join Virtual Lobby' : 'View Full Details'}
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
                div {
                    font-family: 'Montserrat', sans-serif;
                }
            `}</style>
        </div>
    );
}
