"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { CalendarBlankIcon, CaretRightIcon, ChatIcon, CheckCircleIcon, MapPinIcon, PhoneIcon, UserIcon, VideoCameraIcon, XCircleIcon } from '@phosphor-icons/react';
import Link from "next/link";
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";

export default function InterviewsPage() {
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInterviews = async () => {
        try {
            const data = await api.get("/interviews/my") as any[];
            setInterviews(data);
        } catch (error) {
            console.error("Failed to fetch interviews:", error);
            notify.error("Failed to load interviews");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterviews();
    }, []);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            await api.patch(`/interviews/${id}/status`, { status: newStatus });
            setInterviews(prev => prev.map(inview =>
                inview.id === id ? { ...inview, status: newStatus } : inview
            ));
            notify.success(`Interview marked as ${newStatus}`);
        } catch (error) {
            notify.error("Failed to update status");
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeaderSkeleton />
                <CardGridSkeleton count={6} />
            </div>
        );
    }

    return (
        <div className="space-y-6 font-sans text-km-text-primary pb-16">

            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">Scheduled Interviews</h1>
                    <p className="text-xs text-km-text-secondary mt-0.5">Manage upcoming and past candidate evaluation sessions</p>
                </div>
            </header>

            {interviews.length === 0 ? (
                <div className="bg-km-surface-card p-12 rounded-2xl shadow-xs border border-km-border text-center">
                    <CalendarBlankIcon size={36} weight="duotone" className="text-km-text-secondary mx-auto mb-3" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-km-text-primary font-poppins">No interviews scheduled yet</h3>
                    <p className="text-xs text-km-text-secondary mt-1 max-w-sm mx-auto mb-4">
                        Interviews appear here once you schedule sessions with candidates from your Applicant Pipeline.
                    </p>
                    <Link
                        href="/recruiter/applications"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-km-primary text-white rounded-xl text-xs font-semibold hover:bg-km-primary-dark transition-colors shadow-xs"
                    >
                        <span>View Applicant Pipeline</span>
                        <CaretRightIcon weight="bold" size={13} aria-hidden="true" />
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {interviews.map((inview) => (
                        <div key={inview.id} className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden transition-colors">
                            <div className="p-5 flex flex-col md:flex-row gap-5">
                                {/* Date & Time Column */}
                                <div className="md:w-44 shrink-0 flex flex-row md:flex-col gap-3 items-center md:items-start justify-between md:justify-center border-b md:border-b-0 md:border-r border-km-border/70 pb-4 md:pb-0 md:pr-5">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-km-text-secondary">Date</p>
                                        <p className="text-sm font-semibold text-km-text-primary">
                                            {new Date(inview.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-km-text-secondary">Time</p>
                                        <p className="text-xs font-medium text-km-text-secondary">
                                            {new Date(inview.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                    <div>
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                            inview.status === "Scheduled" ? "bg-blue-50 text-km-blue border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-km-link" :
                                            inview.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400" :
                                            "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400"
                                        }`}>
                                            {inview.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Main Details */}
                                <div className="flex-1 space-y-3 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <h3 className="text-sm font-semibold text-km-text-primary font-poppins">{inview.job?.title || "Position Title"}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-km-text-secondary mt-0.5">
                                                <UserIcon weight="regular" size={13} aria-hidden="true" />
                                                <span>Candidate: <strong className="text-km-text-primary font-medium">{inview.candidate?.name || "Candidate"}</strong></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-km-text-secondary">
                                            {inview.type === "Video" && <VideoCameraIcon size={16} weight="regular" className="text-km-blue" aria-hidden="true" />}
                                            {inview.type === "Phone" && <PhoneIcon size={16} weight="regular" className="text-emerald-600" aria-hidden="true" />}
                                            {inview.type === "In-person" && <MapPinIcon size={16} weight="regular" className="text-amber-600" aria-hidden="true" />}
                                            <span>{inview.type} Interview</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-km-surface p-2.5 rounded-xl border border-km-border/60">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-km-text-secondary flex items-center gap-1 mb-1">
                                                <MapPinIcon weight="regular" size={12} aria-hidden="true" />
                                                <span>{inview.type === "Video" ? "Meeting URL" : inview.type === "Phone" ? "Phone Contact" : "Address"}</span>
                                            </p>
                                            <p className="text-xs font-medium text-km-text-primary break-all">
                                                {inview.type === "Video" && inview.location?.startsWith("http") ? (
                                                    <a href={inview.location} target="_blank" rel="noreferrer" className="text-km-blue hover:underline">
                                                        {inview.location}
                                                    </a>
                                                ) : (
                                                    inview.location || "N/A"
                                                )}
                                            </p>
                                        </div>
                                        {inview.notes && (
                                            <div className="bg-km-surface p-2.5 rounded-xl border border-km-border/60">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-km-text-secondary flex items-center gap-1 mb-1">
                                                    <ChatIcon weight="regular" size={12} aria-hidden="true" />
                                                    <span>Instructions</span>
                                                </p>
                                                <p className="text-xs text-km-text-secondary italic line-clamp-2">"{inview.notes}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="md:w-36 flex flex-row md:flex-col gap-2 justify-center shrink-0">
                                    {inview.status === "Scheduled" && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateStatus(inview.id, "Completed")}
                                                className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                                            >
                                                <CheckCircleIcon weight="bold" size={14} aria-hidden="true" />
                                                <span>Finish</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateStatus(inview.id, "Cancelled")}
                                                className="flex-1 px-3 py-1.5 bg-km-surface-card border border-red-200 text-red-600 hover:bg-red-50/70 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <XCircleIcon weight="regular" size={14} aria-hidden="true" />
                                                <span>Cancel</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
