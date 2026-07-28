"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {
    Calendar,
    Clock,
    MapPin,
    Video,
    Phone,
    User,
    Briefcase,
    CheckCircle,
    XCircle,
    Loader2,
    ChevronRight,
    MessageSquare
} from "lucide-react";
import Link from "next/link";

export default function InterviewsPage() {
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInterviews = async () => {
            try {
                const data = await api.get("/interviews/my") as any[];
                setInterviews(data);
            } catch (error) {
                console.error("Failed to fetch interviews:", error);
                toast.error("Failed to load interviews");
            } finally {
                setLoading(false);
            }
        };

        fetchInterviews();
    }, []);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            await api.patch(`/interviews/${id}/status`, { status: newStatus });
            setInterviews(prev => prev.map(inview =>
                inview.id === id ? { ...inview, status: newStatus } : inview
            ));
            toast.success(`Interview marked as ${newStatus}`);
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <ToastContainer />

            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Scheduled Interviews</h1>
                    <p className="text-gray-500 mt-1">Manage your upcoming and past interview sessions.</p>
                </div>
            </header>

            {interviews.length === 0 ? (
                <div className="bg-white p-16 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">No interviews scheduled</h3>
                    <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                        Interviews appear here once you schedule them with candidates from the Applications page.
                    </p>
                    <Link
                        href="/recruiter/applications"
                        className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                        Go to Applications
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {interviews.map((inview) => (
                        <div key={inview.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-blue-200 transition-colors">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                {/* Date & Time Badge */}
                                <div className="md:w-48 shrink-0 flex flex-row md:flex-col gap-4 items-center md:items-start justify-between md:justify-center border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0 md:pr-8">
                                    <div className="text-center md:text-left">
                                        <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Date</p>
                                        <p className="text-lg font-bold text-gray-900">{new Date(inview.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div className="text-center md:text-left">
                                        <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Time</p>
                                        <p className="text-lg font-bold text-gray-900">{new Date(inview.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter
                                        ${inview.status === 'Scheduled' ? 'bg-blue-50 text-blue-600' : ''}
                                        ${inview.status === 'Completed' ? 'bg-green-50 text-green-600' : ''}
                                        ${inview.status === 'Cancelled' ? 'bg-red-50 text-red-600' : ''}
                                    `}>
                                        {inview.status}
                                    </div>
                                </div>

                                {/* Main Info */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">{inview.job?.title || "Job Title"}</h3>
                                            <div className="flex items-center gap-2 text-gray-500 mt-1 font-medium">
                                                <User className="w-4 h-4" />
                                                <span>Candidate: {inview.candidate?.name || "Anonymous Candidate"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {inview.type === 'Video' && <Video className="w-5 h-5 text-purple-500" />}
                                            {inview.type === 'Phone' && <Phone className="w-5 h-5 text-green-500" />}
                                            {inview.type === 'In-person' && <MapPin className="w-5 h-5 text-red-500" />}
                                            <span className="font-bold text-gray-700">{inview.type} Interview</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                                <MapPin className="w-3 h-3" />
                                                Location / Link
                                            </p>
                                            <p className="text-sm font-bold text-gray-700 break-all">{inview.location}</p>
                                        </div>
                                        {inview.notes && (
                                            <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                                    <MessageSquare className="w-3 h-3" />
                                                    Notes
                                                </p>
                                                <p className="text-sm text-gray-600 italic">"{inview.notes}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="md:w-40 flex flex-row md:flex-col gap-3 justify-center">
                                    {inview.status === 'Scheduled' && (
                                        <>
                                            <button
                                                onClick={() => handleUpdateStatus(inview.id, 'Completed')}
                                                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Finish
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(inview.id, 'Cancelled')}
                                                className="flex-1 px-4 py-2.5 bg-white border border-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                    <button className="flex-1 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all">
                                        View Detail
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
